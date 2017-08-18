'use strict'

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')
const defined = require('if-defined')
const stableId = require('stable-id')

/* application modules */
const ImmutableCoreModelCacheQueryId = require('./immutable-core-model-cache-query-id')
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelCacheQueryViewIdCollection

/**
 * @function ImmutableCoreModelCacheQueryViewIdCollection
 *
 * instantiate new ImmutableCoreModelCacheQueryViewIdCollection instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQueryViewIdCollection (args) {
    // store args
    this.cache = args.cache
    // shallow clone query since it may be modified and to avoid
    // create circular reference
    this.query = _.clone(args.query)
    // and cache to view
    args.query.cache = this
    // get list of id(s) being queried
    this.ids = Array.isArray(this.query.select.args.where.id)
        ? this.query.select.args.where.id
        : [this.query.select.args.where.id]
    // get list of model view instance ids being applied
    this.modelViewInstanceIds = _.map(this.query.modelViews, 'modelViewInstanceId')
    // get cache keys
    this.idCacheKey = this.cacheKey()
    // result loaded from cache
    this.cached
}

/* public functions */
ImmutableCoreModelCacheQueryViewIdCollection.prototype = {
    cacheKey: cacheKey,
    cacheQuery: cacheQuery,
    cacheQueryResult: cacheQueryResult,
    cacheResults: cacheResults,
    loadUncached: loadUncached,
    // class properties
    ImmutableCoreModelCacheQueryViewIdCollection: true,
    class: 'ImmutableCoreModelCacheQueryViewIdCollection',
    view: true,
}

/**
 * @function cacheKey
 *
 * create cache key from id
 *
 * @param {string} id
 *
 * @returns {string}
 */
function cacheKey (id) {
    //  get cache id
    var cacheId = stableId({
        columnsId: this.cache.model.columnsId,
        modelViewInstanceIds: this.modelViewInstanceIds,
        recordIds: this.ids,
    })
    // create cache key
    return `${this.cache.model.name}:view:id:collection:${cacheId}`
}

/**
 * @function cacheQuery
 *
 * @returns {Promise}
 */
function cacheQuery () {
    // debug
    debug('view:id:collection:get', this.idCacheKey, this.ids)
    // attempt to get from cache
    return this.cache.redis.getAsync(this.idCacheKey)
    // check result
    .then(cached => this.cacheQueryResult(cached))
}

/**
 * @function cacheQuery
 *
 * @param {array} cached
 *
 * @returns {Promise}
 */
function cacheQueryResult (cached) {
    // decode result if not null
    if (cached !== null) {
        try {
            // decode JSON
            this.cached = JSON.parse(cached)
            // add cached view flag
            this.cached._cachedView = true
        }
        catch (err) {
            // ignore errors
        }
    }
    // return cached result or load
    return defined(this.cached) ? this.cached : this.loadUncached()
}

/**
 * @function cacheResults
 *
 * cache view results - called by ImmutableCoreModelQuery after completing
 * query and applying views
 *
 * @param {object} result
 *
 * @returns {Promise}
 */
function cacheResults (result) {
    // JSON encode result
    try {
        var cacheValue = JSON.stringify(result)
    }
    catch (err) {
        // ignore errors
    }
    // cache value
    if (defined(cacheValue)) {
        // debug
        debug('view:id:collection:set', this.idCacheKey)
        // cache results
        return this.cache.redis.setAsync(this.idCacheKey, cacheValue)
    }
}

/**
 * @function loadUncached
 *
 * @returns {Promise}
 */
function loadUncached () {
    // debug
    debug('view:id:collection:loadUncached', this.idCacheKey)
    // create new select for only uncached ids without view applied
    var select = sql.select(this.query.model, {
        all: true,
        where: {id: this.ids},
    })
    // replace original select in query
    this.query.select = select
    // create new id cache instance to fetch the raw records
    // without view applied from cache or database
    var cacheQuery = new ImmutableCoreModelCacheQueryId({
        cache: this.cache,
        query: this.query,
    })
    // execute cached query
    return cacheQuery.cacheQuery()
}
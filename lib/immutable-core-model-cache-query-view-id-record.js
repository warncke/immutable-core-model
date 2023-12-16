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
module.exports = ImmutableCoreModelCacheQueryViewIdRecord

/**
 * @function ImmutableCoreModelCacheQueryViewIdRecord
 *
 * instantiate new ImmutableCoreModelCacheQueryViewIdRecord instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQueryViewIdRecord (args) {
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
    // number of ids
    this.numIds = this.ids.length
    // get list of model view instance ids being applied
    this.modelViewInstanceIds = _.map(this.query.modelViews, 'modelViewInstanceId')
    // get cache keys
    this.idCacheKeys = _.map(this.ids, id => this.cacheKey(id))
    // list of results loaded from cache
    this.cached = []
}

/* public functions */
ImmutableCoreModelCacheQueryViewIdRecord.prototype = {
    cacheKey: cacheKey,
    cacheQuery: cacheQuery,
    cacheQueryResult: cacheQueryResult,
    cacheResults: cacheResults,
    loadUncached: loadUncached,
    // class properties
    ImmutableCoreModelCacheQueryViewIdRecord: true,
    class: 'ImmutableCoreModelCacheQueryViewIdRecord',
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
        recordId: id,
    })
    // create cache key
    return `${this.cache.model.name}:view:id:record:${cacheId}`
}

/**
 * @function cacheQuery
 *
 * @returns {Promise}
 */
function cacheQuery () {
    // debug
    debug('view:id:record:get', this.idCacheKeys, this.ids)
    // attempt to get from cache
    return this.cache.redis.mGet(this.idCacheKeys)
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
    // list of ids that where not cached
    this.uncachedIds = []
    // check result set for uncached ids
    for (var i=0; i < this.numIds; i++) {
        var cachedValue = undefined
        // decode result if not null
        if (cached[i] !== null) {
            try {
                // decode JSON
                cachedValue = JSON.parse(cached[i])
                // add cached view flag
                cachedValue._cachedView = true
            }
            catch (err) {
                // ignore errors
            }
        }
        // if there is cached value use otherwise add id to fetch list
        defined(cachedValue)
            ? this.cached.push(cachedValue)
            : this.uncachedIds.push(this.ids[i])
    }
    // debug
    debug('view:id:record:uncachedIds', this.uncachedIds)
    // if all records were cached the return result from cache
    if (this.uncachedIds.length === 0) {
        // set cached view flag
        this.cached._cachedView = true
        // return cached results
        return this.cached
    }
    // load uncached records and return all
    else {
        return this.loadUncached()
    }
}

/**
 * @function cacheResults
 *
 * cache view results - called by ImmutableCoreModelQuery after completing
 * query and applying views
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function cacheResults (results) {
    // get id column name
    var idColumn = this.query.model.columnName('id')
    // make sure results is array
    if (!Array.isArray(results)) {
        results = [results]
    }
    // arguments for multi-set
    var setArgs = []
    // args are list of key, value, key, value
    _.each(results, result => {
        // require result
        if (!defined(result)) {
            return
        }
        // get raw data unless the result is already raw
        if (!this.query.args.raw) {
            result = result.raw
        }
        // JSON encode result
        try {
            var cacheValue = JSON.stringify(result)
        }
        catch (err) {
            // ignore errors
        }
        // cache value
        if (defined(cacheValue)) {
            // get cache key
            var cacheKey = this.cacheKey(result[idColumn])
            // debug
            debug('view:id:record:set', cacheKey)
            // add to list to cache
            setArgs.push(cacheKey, cacheValue)
        }
    })
    // cache results
    if (setArgs.length > 0) {
        return this.cache.redis.mSet(setArgs)
    }
}

/**
 * @function loadUncached
 *
 * @returns {Promise}
 */
function loadUncached () {
    // debug
    debug('view:id:record:loadUncached')
    // create new select for only uncached ids without view applied
    var select = sql.select(this.query.model, {
        all: true,
        where: {id: this.uncachedIds},
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
    // cache result
    .then(results => {
        // resolve with cached + loaded results
        return this.cached.concat(results)
    })
}
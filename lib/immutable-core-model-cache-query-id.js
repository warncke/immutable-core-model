'use strict'

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')
const defined = require('if-defined')

/* application modules */
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelCacheQueryId

/**
 * @function ImmutableCoreModelCacheQueryId
 *
 * instantiate new ImmutableCoreModelCacheQueryId instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQueryId (args) {
    // store args
    this.cache = args.cache
    this.query = args.query
    // get list of id(s) being queried
    this.ids = Array.isArray(this.query.select.args.where.id)
        ? this.query.select.args.where.id
        : [this.query.select.args.where.id]
    // number of ids
    this.numIds = this.ids.length
    // get cache keys
    this.idCacheKeys = _.map(this.ids, id => this.cacheKey(id))
    // list of results loaded from cache
    this.cached = []
}

/* public functions */
ImmutableCoreModelCacheQueryId.prototype = {
    cacheKey: cacheKey,
    cacheQuery: cacheQuery,
    cacheResults: cacheResults,
    loadUncached: loadUncached,
    loadUncachedAll: loadUncachedAll,
    loadUncachedSome: loadUncachedSome,
    // class properties
    class: 'ImmutableCoreModelCacheQueryId',
    ImmutableCoreModelCacheQueryId: true,
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
    return `${this.cache.model.name}:id:${id}`
}

/**
 * @function cacheQuery
 *
 * @returns {Promise}
 */
function cacheQuery () {
    // debug
    debug('id:get', this.idCacheKeys)
    // attempt to get from cache
    return this.cache.redis.mgetAsync(this.idCacheKeys)
    // check result
    .then(cached => {
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
                    // add cached flag
                    cachedValue._cached = true
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
        debug('id:uncachedIds', this.uncachedIds)
        // if all records were cached the return result from cache
        return this.uncachedIds.length === 0
            ? this.cached
            : this.loadUncached()
    })
}

/**
 * @function cacheResults
 *
 * cache database results
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function cacheResults (results) {
    var idColumn = this.query.model.columnName('id')
    // arguments for multi-set
    var setArgs = []
    // args are list of key, value, key, value
    _.each(results, result => {
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
            debug('id:set', cacheKey)
            // add to list to cache
            setArgs.push(cacheKey, cacheValue)
        }
    })
    // cache results
    if (setArgs.length > 0) {
        return this.cache.redis.msetAsync(setArgs)
    }
}

/**
 * @function loadUncached
 *
 * @returns {Promise}
 */
function loadUncached () {
    // if no ids were cached load all
    return this.uncachedIds.length === this.numIds
        ? this.loadUncachedAll()
        : this.loadUncachedSome()
}

/**
 * @function loadUncachedAll
 *
 * @returns {Promise}
 */
function loadUncachedAll () {
    // debug
    debug('id:loadUncachedAll')
    // execute original query
    return this.query.executeQuery()
    // cache result
    .then(results => {
        // cache results if there are any
        if (results.length > 0) {
            // cache results - do not wait to complete
            this.cacheResults(results)
        }
        // resolve with results
        return results
    })
}

/**
 * @function loadUncachedSome
 *
 * @returns {Promise}
 */
function loadUncachedSome () {
    // debug
    debug('id:loadUncachedSome')
    // create new select for only uncached ids
    var select = sql.select(this.query.model, {where: {id: this.uncachedIds}})
    // replace original select in query
    this.query.select = select
    // execute modified query
    return this.query.executeQuery()
    // cache result
    .then(results => {
        // cache results if there are any
        if (results.length > 0) {
            this.cacheResults(results)
        }
        // resolve with cached + loaded results
        return this.cached.concat(results)
    })
}
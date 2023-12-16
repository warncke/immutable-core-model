'use strict'

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')
const stableId = require('stable-id')

/* exports */
module.exports = ImmutableCoreModelCacheQueryViewSelectCollection

/**
 * @function ImmutableCoreModelCacheQueryViewSelectCollection
 *
 * instantiate new ImmutableCoreModelCacheQueryViewSelectCollection instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQueryViewSelectCollection (args) {
    // store args
    this.cache = args.cache
    // shallow clone query since it may be modified and to avoid
    // create circular reference
    this.query = _.clone(args.query)
    // and cache to view
    args.query.cache = this
    // init properties
    this.cached = null
    this.selectCacheKey = this.cacheKey()
}

/* public functions */
ImmutableCoreModelCacheQueryViewSelectCollection.prototype = {
    cacheKey: cacheKey,
    cacheQuery: cacheQuery,
    cacheResults: cacheResults,
    cacheValid: cacheValid,
    cachedValue: cachedValue,
    loadUncached: loadUncached,
    // class properties
    ImmutableCoreModelCacheQueryViewSelectCollection: true,
    class: 'ImmutableCoreModelCacheQueryViewSelectCollection',
    view: true,
}

/**
 * @function cacheKey
 *
 * @returns {string}
 */
function cacheKey () {
    //  get cache id
    var cacheId = stableId({
        args: this.query.args,
        columnsId: this.cache.model.columnsId,
    })
    // create cache key
    return `${this.cache.model.name}:view:select:collection:${cacheId}`
}

/**
 * @function cacheQuery
 *
 * @returns {Promise}
 */
function cacheQuery () {
    // debug
    debug('view:select:collection:get', this.selectCacheKey)
    // get cached value
    var cacheGetPromise = this.cache.redis.get(this.selectCacheKey)
    // store cached value
    .then(res => {
        // skip if not cached
        if (res === null) {
            this.cached = null
        }
        // decode response
        else {
            try {
                this.cached = JSON.parse(res)
            }
            catch (err) {
                this.cached = null
            }
        }
    })
    // get the current max record number
    var maxRecordNumberPromise = this.cache.model.maxRecordNumber({
        session: this.query.session,
    }).then(n => {
        // debug
        debug('view:select:collection:initialMaxRecordNumber', n, this.selectCacheKey)
        // store n to check if cache is valid and whether or not
        // query result can be cached
        this.initialMaxRecordNumber = n
    })
    // wait for promises to resolve
    return Promise.all([
        cacheGetPromise,
        maxRecordNumberPromise,
    ])
    .then(() => {
        // return cached value if valid or do query and cache
        return this.cacheValid() ? this.cachedValue() : this.loadUncached()
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
    // get current max record number
    return this.cache.model.maxRecordNumber({
        session: this.query.session,
    }).then(n => {
        // if state has changed do not cache
        if (n !== this.initialMaxRecordNumber) {
            return
        }
        // JSON encode data to cache
        try {
            var cacheValue = JSON.stringify({
                n: n,
                v: results,
            })
        }
        catch (err) {
            // ignore errors
        }
        // cache result
        if (cacheValue) {
            debug('view:select:collection:set', this.selectCacheKey)
            return this.cache.redis.set(this.selectCacheKey, cacheValue)
        }
    })
}

/**
 * @function cacheValid
 *
 * check if cached value is value
 *
 * @returns {boolean}
 */
function cacheValid () {
    // false if cache result is null
    if (this.cached === null) {
        debug('view:select:collection:cacheValid:false:null', this.selectCacheKey)
        return false
    }
    // false if n does not match
    if (this.cached.n !== this.initialMaxRecordNumber) {
        debug('view:select:collection:cacheValid:false:maxRecordNumber', this.selectCacheKey)
        return false
    }
    // cache is valid
    debug('view:select:collection:cacheValid:true', this.selectCacheKey)
    return true
}

/**
 * @function cachedValue
 *
 * return cached value
 *
 * @returns {array}
 */
function cachedValue () {
    // get cached value
    var cachedValue = this.cached.v
    // set cached flag
    cachedValue._cachedView = true
    // return cached value
    return cachedValue
}

/**
 * @function loadUncached
 *
 * perform query, cache value, and return results
 *
 * @returns {Promise}
 */
function loadUncached () {
    // execute original query
    return this.query.executeQuery()
}
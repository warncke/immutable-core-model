'use strict'

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')

/* application modules */
const ImmutableCoreModelCacheQueryId = require('./immutable-core-model-cache-query-id')
const ImmutableCoreModelCacheQuerySelect = require('./immutable-core-model-cache-query-select')

/* exports */
module.exports = ImmutableCoreModelCache

/**
 * @function ImmutableCoreModelCache
 *
 * instantiate new ImmutableCoreModelCache instance
 *
 * @param {object} args
 * @param {ImmutableCoreModel} args.model
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCache (args) {
    // require model
    this.assert(args.model && args.model.ImmutableCoreModel, 'model required')
    // require redis
    this.assert(args.redis, 'redis required')
    // store args
    this.model = args.model
    this.redis = args.redis
}

/* public functions */
ImmutableCoreModelCache.prototype = {
    assert: assert,
    canCache: canCache,
    error: error,
    query: query,
    // class properties
    class: 'ImmutableCoreModelCache',
    ImmutableCoreModelCache: true,
}

/**
 * @function assert
 *
 * throw error if value is not true
 *
 * @param {boolean} assertValue
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @throws {Error}
 */
function assert (assertValue, message, error) {
    if (!assertValue) {
        throw error(message, error)
    }
}

/**
 * @function canCache
 *
 * @param {ImmutableCoreModelQuery} query
 *
 * @returns {boolean}
 */
function canCache (query) {
    // if query is select by id then cache
    if (query.select.isSelectById) {
        debug('canCache:true:id')
        return true
    }
    // if query is selecting only ids then cache
    if (query.select.isSelectOnlyIds) {
        debug('canCache:true:select')
        return true
    }
    // default to false
    debug('canCache:false')
    return false
}

/**
 * @function error
 *
 * create/update error object with query data
 *
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @returns {Error}
 */
function error (message, error) {
    // get model name
    var modelName = defined(this.model) ? this.model.name : 'undefined model'
    // build custom error message
    message = `${modelName} query error` + (
        typeof message === 'string'
            ? `: ${message}`
            : ''
    )
    // use error object passed in
    if (defined(error)) {
        // create data object with original message
        error.data = {
            error: {
                code: error.code,
                message: error.message,
            },
        }
    }
    // create new error message
    else {
        error = new Error(message)
        error.data = {}
    }

    return error
}

/**
 * @function query
 *
 * perform query using cache
 *
 * @param {ImmutableCoreModelQuery} query
 *
 * @returns {Promise}
 */
function query (query) {
    // if cache is not connected immediately execute query and do not cache
    if (!this.redis.connected) {
        return query.executeQuery()
    }
    // execute query if it cant be cached
    if (!this.canCache(query)) {
        return query.executeQuery()
    }
    // build args for cache query instance
    var cacheQueryArgs = {
        cache: this,
        query: query,
    }
    // get cahe query instance
    var cacheQuery = query.select.isSelectById
        ? new ImmutableCoreModelCacheQueryId(cacheQueryArgs)
        : new ImmutableCoreModelCacheQuerySelect(cacheQueryArgs)
    // execute cached query
    return cacheQuery.cacheQuery()
}
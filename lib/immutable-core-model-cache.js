'use strict'

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')
const defined = require('if-defined')

/* application modules */
const ImmutableCoreModelCacheQueryId = require('./immutable-core-model-cache-query-id')
const ImmutableCoreModelCacheQuerySelect = require('./immutable-core-model-cache-query-select')
const ImmutableCoreModelCacheQueryViewId = require('./immutable-core-model-cache-query-view-id')
const ImmutableCoreModelCacheQueryViewSelect = require('./immutable-core-model-cache-query-view-select')

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
        debug('cache:false:redis:disconnected')
        return query.executeQuery()
    }
    // build args for cache query instance
    var cacheQueryArgs = {
        cache: this,
        query: query,
    }
    // cache query object
    var cacheQuery
    // if query has views then cache after views are applied
    if (query.modelViews.length > 0) {
        // view query where underlying query is by id
        if (query.select.isSelectById) {
            debug('cache:view:id:true')
            // build cache query object
            cacheQuery = new ImmutableCoreModelCacheQueryViewId(cacheQueryArgs)
        }
        // view query where underlying query is select
        else if (query.select.isSelectOnlyIds) {
            debug('cache:view:select:true')
            // build cache query object
            cacheQuery = new ImmutableCoreModelCacheQueryViewSelect(cacheQueryArgs)
        }
    }
    // if query is select by id then cache result
    else if (query.select.isSelectById) {
        debug('cache:id:true')
        // build cache query object
        cacheQuery = new ImmutableCoreModelCacheQueryId(cacheQueryArgs)
    }
    // if query has views then cache after views are applied
    else if (query.select.isSelectOnlyIds) {
        debug('cache:select:true')
        // build cache query object
        cacheQuery = new ImmutableCoreModelCacheQuerySelect(cacheQueryArgs)
    }
    // execute cache query if available
    if (defined(cacheQuery)) {
        return cacheQuery.cacheQuery()
    }
    // execute original query uncached
    else {
        debug('cache:false:unsupported')
        return query.executeQuery()
    }
}
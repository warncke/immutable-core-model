'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

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
    assert.ok(args.model && args.model.ImmutableCoreModel, 'model required')
    // require redis
    assert.ok(args.redis, 'redis required')
    // store args
    this.model = args.model
    this.redis = args.redis
}

/* public functions */
ImmutableCoreModelCache.prototype = {
    canCache: canCache,
    query: query,
    // class properties
    class: 'ImmutableCoreModelCache',
    ImmutableCoreModelCache: true,
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
        return true
    }
    // default to false
    return false
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
    // if query cannot be cached then execute query
    if (!this.canCache(query)) {
        return query.executeQuery()
    }
    // if query is select by id then do id cache query
    if (query.select.isSelectById) {
        // create new cache query instance
        var cacheQuery = new ImmutableCoreModelCacheQueryId({
            cache: this,
            query: query,
        })
        // execute query
        return cacheQuery.cacheQuery()
    }
    else {
        return query.executeQuery()
    }
}
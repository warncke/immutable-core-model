'use strict'

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')
const stableId = require('stable-id')

/* exports */
module.exports = ImmutableCoreModelCacheQueryViewSelect

/**
 * @function ImmutableCoreModelCacheQueryViewSelect
 *
 * instantiate new ImmutableCoreModelCacheQueryViewSelect instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQueryViewSelect (args) {
    // store args
    this.cache = args.cache
    this.query = args.query
    // init properties
    this.cached = null
}

/* public functions */
ImmutableCoreModelCacheQueryViewSelect.prototype = {
    cacheKey: cacheKey,
    cacheQuery: cacheQuery,
    // class properties
    class: 'ImmutableCoreModelCacheQueryViewSelect',
    ImmutableCoreModelCacheQueryViewSelect: true,
}

/**
 * @function cacheKey
 *
 * @returns {string}
 */
function cacheKey () {
    return `${this.cache.model.name}:${this.cache.model.columnsId}:select:${stableId(this.query.args)}`
}

/**
 * @function cacheQuery
 *
 * @returns {Promise}
 */
function cacheQuery () {

}
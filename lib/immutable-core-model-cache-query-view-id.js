'use strict'

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-cache')
const stableId = require('stable-id')

/* exports */
module.exports = ImmutableCoreModelCacheQueryViewId

/**
 * @function ImmutableCoreModelCacheQueryViewId
 *
 * instantiate new ImmutableCoreModelCacheQueryViewId instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQueryViewId (args) {
    // store args
    this.cache = args.cache
    this.query = args.query
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
ImmutableCoreModelCacheQueryViewId.prototype = {
    cacheKey: cacheKey,
    cacheQuery: cacheQuery,
    // class properties
    class: 'ImmutableCoreModelCacheQueryViewId',
    ImmutableCoreModelCacheQueryViewId: true,
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
    console.log({
        columnsId: this.cache.model.columnsId,
        modelViewInstanceIds: this.modelViewInstanceIds,
        recordId: id,
    })
    // create cache key
    return `${this.cache.model.name}:view:id:${cacheId}`
}

/**
 * @function cacheQuery
 *
 * @returns {Promise}
 */
function cacheQuery () {

}
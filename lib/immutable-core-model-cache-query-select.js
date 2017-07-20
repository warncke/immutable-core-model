'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')

/* exports */
module.exports = ImmutableCoreModelCacheQuerySelect

/**
 * @function ImmutableCoreModelCacheQuerySelect
 *
 * instantiate new ImmutableCoreModelCacheQuerySelect instance
 *
 * @param {object} args
 * @param {ImmutableCoreModelCache} args.cache
 * @param {ImmutableCoreModelQuery} args.query
 *
 * @returns {ImmutableCoreModelCache}
 */
function ImmutableCoreModelCacheQuerySelect (args) {
    // require cache object
    assert.ok(args.cache && args.cache.ImmutableCoreModelCache, 'cache required')
    // require query object
    assert.ok(args.query && args.query.ImmutableCoreModelQuery, 'query required')
    // store args
    this.cache = args.cache
    this.query = args.query
}

/* public functions */
ImmutableCoreModelCacheQuerySelect.prototype = {
    // class properties
    class: 'ImmutableCoreModelCacheQuerySelect',
    ImmutableCoreModelCacheQuerySelect: true,
}
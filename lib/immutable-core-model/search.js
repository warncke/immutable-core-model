'use strict'

/* native modules */
const assert = require('assert')

/* exports */
module.exports = search

/**
 * @function search
 *
 * do elasticsearch search query
 *
 * @param {object} args
 *
 * @returns {}
 */
function search (args) {
    // currently only raw mode is supported
    assert.ok(args.raw, 'elasticsearch only supports raw mode')
    // get raw mode property if set
    if (args.raw) {
        var raw = true
        // remove from args for elasticsearch
        delete args.raw
    }
    // get session if set
    if (args.session) {
        // not currently used
        delete args.session
    }
    // get elastic search client - throws error if no client
    var elasticsearchClient = this.elasticsearch()
    // do search
    return elasticsearchClient.search(args)
}
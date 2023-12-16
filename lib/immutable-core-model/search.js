'use strict'

/* native modules */
const assert = require('assert')

/* exports */
module.exports = search

/**
 * @function search
 *
 * do opensearch search query
 *
 * @param {object} args
 *
 * @returns {}
 */
async function search (args) {
    // currently only raw mode is supported
    assert.ok(args.raw, 'opensearch only supports raw mode')
    // get raw mode property if set
    if (args.raw) {
        var raw = true
        // remove from args for opensearch
        delete args.raw
    }
    // get session if set
    if (args.session) {
        // not currently used
        delete args.session
    }
    // get elastic search client - throws error if no client
    var opensearchClient = this.opensearch()
    // do search
    var res = await opensearchClient.search(args)
    return res
}
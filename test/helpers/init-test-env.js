'use strict'

/* npm modules */
const defined = require('if-defined')

/* application modules */
const mysql = require('./mysql')
const opensearch = require('./opensearch')
const redis = require('./redis')
const reset = require('./reset')
const session = require('./session')

/* init globals */
global.Promise = require('bluebird')
global._ = require('lodash')
global.chai = require('chai')
global.assert = global.chai.assert

/* exports */
module.exports = initTestEnv

/**
 * @function initTestEnv
 *
 * return mysql and redis clients and mock session
 *
 * @returns {array}
 */
async function initTestEnv (args) {
    if (!defined(args)) {
        args = {}
    }
    if (args.opensearch) {
        var opensearchClient = opensearch()
    }
    return [await mysql(), await redis(args.redis), reset, session(), opensearchClient]
}
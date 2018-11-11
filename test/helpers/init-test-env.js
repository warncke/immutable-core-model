'use strict'

/* npm modules */
const defined = require('if-defined')

/* application modules */
const mysql = require('./mysql')
const elasticsearch = require('./elasticsearch')
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
    if (args.elasticsearch) {
        var elasticsearchClient = elasticsearch()
    }
    return [await mysql(), redis(args.redis), reset, session(), elasticsearchClient]
}
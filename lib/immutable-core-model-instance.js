'use strict'

/* native modules */
const assert = require('assert')
const util = require('util')

/* npm modules */
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelInstance

/**
 * @function ImmutableCoreModelInstance
 *
 * create a new object instance from raw data object either returned by
 * database or created in the same format.
 *
 * this function does not do any validation on arguments because it is assumed
 * that it will only be used internally by other methods that are already doing
 * validation.
 *
 * @param {object} args
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function ImmutableCoreModelInstance (args) {
    // get values from args
    this.model = args.model
    this.raw = args.raw
    this.session = args.session
}

/* public functions */
ImmutableCoreModelInstance.prototype = {
    accountId: accountId,
    createTime: createTime,
    data: data,
    id: id,
    inspect: inspect,
    originalId: originalId,
    parentId: parentId,
    raw: raw,
    sessionId: sessionId,
    toJSON: data,
}

/**
 * @function accountId
 *
 * get account id
 *
 * @returns {string}
 */
function accountId () {
    return this.raw[this.model.defaultColumnsInverse.accountId]
}

/**
 * @function createTime
 *
 * get create time
 *
 * @returns {string}
 */
function createTime () {
    return this.raw[this.model.defaultColumnsInverse.createTime]
}

/**
 * @function data
 *
 * return the data object for instance
 *
 * @returns {object}
 */
function data () {
    return this.raw[this.model.defaultColumnsInverse.data]
}

/**
 * @function id
 *
 * get instance id
 *
 * @returns {string}
 */
function id () {
    return this.raw[this.model.defaultColumnsInverse.id]
}

/**
 * @function inspect
 *
 * generate output for util.inspect used by node.js console.log
 *
 * @param {integer} depth
 * @param {object} options
 *
 * @returns {string}
 */
function inspect (depth, options) {
    return '[immutable.model.'+this.model.name+'] '+util.inspect(this.raw)
}

/**
 * @function originalId
 *
 * get original id
 *
 * @returns {string}
 */
function originalId () {
    return this.raw[this.model.defaultColumnsInverse.originalId]
}

/**
 * @function parentId
 *
 * get parent id
 *
 * @returns {string}
 */
function parentId () {
    return this.raw[this.model.defaultColumnsInverse.parentId]
}

/**
 * @function raw
 *
 * return the raw data as returned by database for instance
 *
 * @returns {object}
 */
function raw () {
    return this.raw
}

/**
 * @function sessionId
 *
 * get session id
 *
 * @returns {string}
 */
function sessionId () {
    return this.raw[this.model.defaultColumnsInverse.sessionId]
}
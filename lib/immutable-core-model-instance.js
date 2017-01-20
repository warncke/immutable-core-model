'use strict'

/* native modules */
const assert = require('assert')
const util = require('util')

/* npm modules */
const _ = require('lodash')
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
    empty: empty,
    id: id,
    inspect: inspect,
    originalId: originalId,
    parentId: parentId,
    raw: raw,
    sessionId: sessionId,
    toJSON: data,
    update: update,
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
 * @function empty
 *
 * empty object data
 *
 * @param {object} args
 *
 * @returns {string}
 */
async function empty (args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // to empty object data must be set to null
    args.data = null
    // use update method to empty
    return this.update(args)
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

/**
 * @function update
 *
 * create and return new revision of object - args data will be merged into
 * existing data.
 *
 * @param {object} args
 *
 * @returns {string}
 */
async function update (args) {
    // data for new revision
    var data
    // if data was assed in args then merge into existing data - if data
    // is set to null then object will be emptied
    if (args.data !== null) {
        // create clone or existing object data to merge update into
        data = _.cloneDeep(this.data())
        // merge update data into existing data
        _.merge(data, args.data)
    }
    // create new instance
    return this.model.create({
        // use accountId from original object unless accountId in args
        accountId: args.accountId || this.accountId(),
        // object data
        data: data,
        // set original id from current instance
        originalId: this.originalId(),
        // id of this instance is parentId for revision
        parentId: this.id(),
        // use session from this instance unless set in args
        session: args.session || this.session,
    })
}
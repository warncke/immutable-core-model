'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const immutable = require('immutable-core')
const microTimestamp = require('micro-timestamp')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')
const stableId = require('stable-id')

/* application modules */
const ImmutableCoreModelInstance = require('../immutable-core-model-instance')
const sql = require('../sql')

/* exports */
module.exports = initCreate

/**
 * @function initCreate
 *
 * called by new ImmutableCoreModel to add create method to module
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initCreate (args) {
    // module method name for creating new record
    var createMethodName = this.name+'Create'
    // add create method to module and to object instance
    this.create = immutable.method(this.moduleName+'.'+createMethodName, args => create(this, args))
}

/**
 * @function create
 *
 * create a new model instance
 *
 * @param {object} model
 * @param {object} args
 *
 * @returns {Promise}
 */
async function create (model, args) {
    // require model
    assert.equal(typeof model, 'object', 'model must be object')
    // require object for args
    assert.equal(typeof args, 'object', 'argument must be object')
    // require database
    assert.ok(model.database, 'database required for create')
    // get model columns
    var columns = model.columns
    // get mapping of columns to default columns
    var defaultColumns = model.defaultColumns
    // get inverse default column mapping
    var defaultColumnsInverse = model.defaultColumnsInverse
    // make sure data is object
    var data = requireValidOptionalObject(args.data)
    // make sure session is object
    var session = requireValidOptionalObject(args.session)
    // raw instance data that will be inserted into database
    var raw = {}
    // set account id
    if (defaultColumnsInverse.accountId) {
        // set accountId based on explicit arg or use session accountId if set
        raw[defaultColumnsInverse.accountId] = args.accountId || session.accountId
    }
    // set create time
    if (defaultColumnsInverse.createTime) {
        // set createTime to explicit arg, session requestTimestamp
        // or current value
        raw[defaultColumnsInverse.createTime] = args.creteTime || session.requestTimestamp || microTimestamp()
    }
    // set data
    if (defaultColumnsInverse.data) {
        raw[defaultColumnsInverse.data] = data
    }
    // set original id
    if (defaultColumnsInverse.originalId) {
        raw[defaultColumnsInverse.originalId] = args.originalId
    }
    // set parent id
    if (defaultColumnsInverse.parentId) {
        raw[defaultColumnsInverse.parentId] = args.parentId
    }
    // set session id
    if (defaultColumnsInverse.sessionId) {
        raw[defaultColumnsInverse.sessionId] = session.sessionId
    }
    // set id
    if (defaultColumnsInverse.id) {
        raw[defaultColumnsInverse.id] = stableId(raw)
        // set original id if not already set
        if (defaultColumnsInverse.originalId && !raw[defaultColumnsInverse.originalId]) {
            raw[defaultColumnsInverse.originalId] = raw[defaultColumnsInverse.id]
        }
    }
    // add any extra columns using values from data - since these values are
    // already in data they are not used for calculating the id
    _.each(model.extraColumns, (spec, name) => {
        // get value from data using path from spec
        raw[name] = _.get(data, spec.path)
    })
    // after calculating id the actual data column needs to be set
    // this will be replaced with object data after insert
    if (defaultColumnsInverse.data) {
        raw[defaultColumnsInverse.data] = model.encodeData(data)
    }
    // get insert sql
    var insertSql = sql.insert(model)
    // debug
    debug(insertSql)
    // attempt insert
    return model.database.query(insertSql, raw, {}, args.session)
    // if query resolved then insert was success
    .then(res => {
        // reset data to object
        if (defaultColumnsInverse.data) {
            raw[defaultColumnsInverse.data] = data
        }
        // resolve with new instance
        return new ImmutableCoreModelInstance({
            model: model,
            raw: raw,
            session: session,
        })
    })
}
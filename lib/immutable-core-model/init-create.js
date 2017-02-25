'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
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
    this.createMeta = immutable.method(this.moduleName+'.'+createMethodName, args => createMeta(this, args))
}

/**
 * @function createMeta
 *
 * create a new model instance
 *
 * @param {object} model
 * @param {object} args
 *
 * @returns {Promise}
 */
function createMeta (model, args) {
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
        raw[defaultColumnsInverse.createTime] = args.createTime || session.requestCreateTime || session.requestTimestamp || microTimestamp()
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
        // if id is set in args then use it
        if (args.id) {
            raw[defaultColumnsInverse.id] = args.id
        }
        // set id based only on the data value
        else if (model.idDataOnly) {
            raw[defaultColumnsInverse.id] = stableId(data)
        }
        // set id based on data and meta data
        else {
            raw[defaultColumnsInverse.id] = stableId(raw)
        }
        // set original id if not already set
        if (defaultColumnsInverse.originalId && !raw[defaultColumnsInverse.originalId]) {
            raw[defaultColumnsInverse.originalId] = raw[defaultColumnsInverse.id]
        }
    }
    // add any extra columns using values from data - since these values are
    // already in data they are not used for calculating the id
    _.each(model.extraColumns, (spec, name) => {
        // if firstOnly is set for spec and this is not the first revision
        // then skip unless caller specifically indicates to update column
        if (spec.firstOnly && args.parentId && (!args.updateColumns || !args.updateColumns[name])) {
            return
        }
        // get value from data using path from spec or get from args
        raw[name] = _.get(data, spec.path) || args[name]
    })
    // after all data has been assembled but before encoding data do validation
    if ((model.validateSchema || args.validate) && args.validate !== false) {
        // get global validator
        var validator = model.global().validator
        // throw error if validation failed
        if (!validator.validate(model.schemaId, raw)) {
            var error = new Error('schema validation failed: '+validator.errorsText())
            error.data = validator.errors
            // throw error
            return Promise.reject(error)
        }
    }
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
    var promise = model.database().query(insertSql, raw, {}, args.session)
    // do not wait for response
    if (args.wait === false) {
        // catch any errors on insert
        if (args.catch !== false) {
            promise.catch(function () {})
        }
        //  do not return response if flag set
        if (args.response === false) {
            return
        }
        // return if only if flag set
        if (args.responseIdOnly) {
            return raw[defaultColumnsInverse.id]
        }
        // reset data to object
        if (defaultColumnsInverse.data) {
            raw[defaultColumnsInverse.data] = data
        }
        // resolve with new instance
        return model.newInstance({
            model: model,
            promise: promise,
            raw: raw,
            session: session,
        })
    }
    // wait for response
    else {
        // if query resolved then insert was success
        return promise.then(res => {
            //  do not return response if flag set
            if (args.response === false) {
                return
            }
            // return if only if flag set
            if (args.responseIdOnly) {
                return raw[defaultColumnsInverse.id]
            }
            // reset data to object
            if (defaultColumnsInverse.data) {
                raw[defaultColumnsInverse.data] = data
            }
            // resolve with new instance
            return model.newInstance({
                model: model,
                raw: raw,
                session: session,
            })
        })
        // check error response
        .catch(err => {
            // if duplicate flag is set then ignore duplicate key errors
            if (args.duplicate && err.code === 1062) {
                //  do not return response if flag set
                if (args.response === false) {
                    return
                }
                // return if only if flag set
                if (args.responseIdOnly) {
                    return raw[defaultColumnsInverse.id]
                }
                // reset data to object
                if (defaultColumnsInverse.data) {
                    raw[defaultColumnsInverse.data] = data
                }
                // resolve with new instance
                return model.newInstance({
                    model: model,
                    raw: raw,
                    session: session,
                })
            }
            // otherwise rethrow error
            else {
                throw err
            }
        })
    }
}
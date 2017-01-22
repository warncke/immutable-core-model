'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const immutable = require('immutable-core')

/* application modules */
const ImmutableCoreModelInstance = require('../immutable-core-model-instance')
const ImmutableCoreModelResult = require('../immutable-core-model-result')
const sql = require('../sql')

/* exports */
module.exports = initQuery

/**
 * @function initQuery
 *
 * called by new ImmutableCoreModel to add query method to module
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initQuery (args) {
    // module method name for querying records
    var queryMethodName = this.name+'Query'
    // add query method to module and to object instance
    this.query = immutable.method(this.moduleName+'.'+queryMethodName, args => query(this, args))
}

/**
 * @function query
 *
 * do query
 *
 * @param {object} model
 * @param {object} args
 *
 * @returns {Promise}
 */
async function query (model, args) {
    // debug query args
    debug(args)
    // require model
    assert.equal(typeof model, 'object', 'model must be object')
    // require object for args
    assert.equal(typeof args, 'object', 'argument must be object')
    // require database
    assert.ok(model.database, 'database required for create')
    // get select sql
    var select = sql.select(model, args)
    // debug
    debug(select)
    // attempt query
    return model.database.query(select.sql, select.params, select.options, args.session)
    // build response for query
    .then(res => {
        // if query is for a single record then either return the record
        // or undefined if not found
        if (args.limit === 1) {
            // return new instance or undefined
            return res.length
                ? instanceFromRes(model, res[0], args.session)
                : undefined
        }
        // if query is for all records then return all
        else if (args.all) {
            return _.map(res, raw => instanceFromRes(model, raw, args.session))
        }
        // otherwise return new result object
        else {
            return new ImmutableCoreModelResult({
                model: model,
                raw: res,
                session: args.session,
            })
            throw new Error('multi record results not yet supported')
        }
    })
}

/* private functions */

/**
 * @function instanceFromRes
 *
 * create new ImmutableCoreModelInstance from db response
 *
 * @param {object} model
 * @param {object} raw
 * @param {object} session
 *
 * @returns {ImmutableCoreModelInstance}
 *
 * @throws {Error}
 */
function instanceFromRes (model, raw, session) {
    // get data column to decode data
    var dataColumn = model.columnName('data')
    // decode data column
    raw[dataColumn] = model.decodeData(raw[dataColumn])
    // resolve with new model instance
    return new ImmutableCoreModelInstance({
        model: model,
        raw: raw,
        session: session,
    })
}
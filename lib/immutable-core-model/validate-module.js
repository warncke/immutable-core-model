'use strict'

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-validate')
const defined = require('if-defined')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = {
    validate: validate,
    validateData: validateData,
    validateDeleted: validateDeleted,
}

/**
 * @function validate
 *
 * iterates over all all rows in table and validates that column values match
 * data values. if any values do not match they are updated.
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
async function validate (args) {
    // skip if model does not have id column
    if (!defined(this.columnName('id'))) {
        return
    }
    // debug
    debug('validate '+this.name)
    // make sure args is object
    args = requireValidOptionalObject(args)
    // make sure session is object
    args.session = requireValidOptionalObject(args.session)
    // set default session id
    if (!defined(args.session.sessionId)) {
        args.session.sessionId = '11111111111111111111111111111111'
    }
    // validate data and columns
    await this.validateData(args)
    // validate deleted status if d column created
    if (this.dColumnCreated) {
        await this.validateDeleted(args)
    }
}

/**
 * @function validateData
 *
 * iterates over all all rows in table and validates that column values match
 * data values. if any values do not match they are updated.
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
async function validateData (args) {
    debug('validate '+this.name)
    // query all records and iterate over response
    var res = await this.query({
        // skip access control checks
        allow: true,
        // do not cache
        cache: false,
        // make sure session is object
        session: args.session,
    })
    // get response
    debug('checking '+res.length+' records')
    // iterate over records waiting for promise to be resolved
    await res.each(async (rec, num) => {
        // set to true if column needs to be updated
        var needsUpdate = false
        // check if any columns do not match
        _.each(this.extraColumns, (spec, name) => {
            // skip if no data
            if (!rec.data) {
                return
            }
            // if already updating or column value does not match data
            // value then set the update flag to true
            if (needsUpdate || rec.raw[name] !== rec.data[spec.path]) {
                needsUpdate = true
            }
        })
        // go to next record if update not needed
        if (!needsUpdate) {
            return
        }
        // debug
        debug('updating record num '+num)
        // get update sql
        var update = sql.updateExtraColumns(this, rec)
        // do update
        await this.database().query(update.sql, update.params, {}, args.session)
        // increment update count
        this.updated++
    })
    // validate complete
    this.validated = true
}

/**
 * @function validateDeleted
 *
 * if delete/unDelete tables exist set correct value for d column
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
async function validateDeleted (args) {
    try {
        var deletedTable = await this.database().query(
            sql.showCreateTable({name: `${this.name}Delete`}), {}, {}, args.session
        )
    }
    // exception will be thrown if table does not exist
    catch (err) {
        return
    }
    // get deleted records
    var deletedIds = await this.database().query(
        sql.selectDeleted(this), {}, {}, args.session
    )
    debug(`checking ${deletedIds.length} deleted records`)
    // check each record and delete if needed
    await Promise.each(deletedIds, async deletedId => {
        // load current record
        var record = await this.query({
            allow: true,
            cache: false,
            current: true,
            one: true,
            session: args.session,
            where: { id: deletedId.id }
        })
        // skip if record not found
        if (!defined(record)) {
            return
        }
        // skip if id does not match
        if (record.id !== deletedId.id) {
            return
        }
        // skip if record already deleted
        if (record.isDeleted) {
            return
        }
        debug(`deleting ${record.id}`)
        // delete record
        await record.delete({allow: true, cache: false})
    })
}
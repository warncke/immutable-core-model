'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-validate')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = validate

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
function validate (args) {
    debug('validate '+this.name)
    // make sure args is object
    args = requireValidOptionalObject(args)
    // query all records and iterate over response
    return this.query({
        // skip access control checks
        allow: true,
        // do not cache
        cache: false,
        // make sure session is object
        session: requireValidOptionalObject(args.session),
    })
    // get response
    .then(res => {
        debug('checking '+res.length+' records')
        // iterate over records waiting for promise to be resolved
        return res.each((rec, num) => {
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
            return this.database().query(update.sql, update.params, {}, args.session)
            // increment update count
            .then(() => {
                this.updated++
            })
        })
    })
    // validate complete
    .then(() => {
        this.validated = true
    })
}
'use strict'

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = maxRecordNumber

/**
 * @function maxRecordNumber
 *
 * get max record (n)umber with optional where
 *
 * @param {object} args
 * @param {object} args.session
 * @param {object} args.where
 *
 * @returns {Promise<integer>}
 */
function maxRecordNumber (args) {
    // get sql
    var select = sql.maxRecordNumber(this, args)
    // do query
    return this.database().query(
        select.sql,
        select.params,
        select.options,
        args.session
    )
    // get n value from response
    .then(res => {
        return parseInt(res[0].n)
    })
}
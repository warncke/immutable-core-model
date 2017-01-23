'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')

/* globals */

// number of records to fetch at a time
const fetchNumDefault = 25

/* exports */
module.exports = ImmutableCoreModelResult

/**
 * @function ImmutableCoreModelResult
 *
 * create result set instance which is returned by query for multi-record queries
 * that do not specify to return all results.
 *
 * @returns {Object}
 *
 * @throws {Error}
 */
function ImmutableCoreModelResult (args) {
    // model used to perform query
    this.model = args.model
    // get ids from raw result - array of arrays having id as element
    this.ids = _.map(args.raw, row => row[0])
    // session used to make query
    this.session = args.session
    // total number of records
    this.length = this.ids.length
    // number of rows to fetch at a time
    this.fetchNum = fetchNumDefault
    // number of rows fetched
    this.fetched = 0
    // buffer of fetched rows
    this.buffer
    // flag indicating whether or not more rows can be fetched
    this.done = this.length > 0 ? false : true
}

/* public methods */
ImmutableCoreModelResult.prototype = {
    each: each,
    fetch: fetch,
}

/**
 * @function each
 *
 * returns promise that will be resolved after iterating over all records and
 * calling passed in callback for each.
 *
 * the callback function will be called with the current row, the row number, and
 * a context object which is passed to each callback.
 *
 * the context object can be passed in as an optional argument.
 *
 * the promise returned by each will be resolved with the context object when
 * iteration is complete.
 *
 * @param {function} callback
 * @param {object} context
 *
 * @returns {Promise}
 */
async function each (callback, context) {
    // require function
    assert.equal(typeof callback, 'function', 'callback must be function')
    // create context object that will be passed to each callback
    if (!context) {
        context = {}
    }
    // create row number counter
    var rowNum = 0
    // handle errors for await
    try {
        // loop till all rows fetched
        while (this.fetched < this.length) {
            // load more rows if buffer empty
            if (!this.buffer) {
                await this.fetch()
            }
            // iterate over all rows using Promise.each so that if callback
            // returns Promise it will be waited on to complete
            await Promise.each(this.buffer, row => {
                return callback(row, rowNum++, context)
            })
            // empty buffer
            this.buffer = undefined
        }
    }
    // rethrow error
    catch (err) {
        throw err
    }
    // resolve with context
    return context
}

/**
 * @function fetch
 *
 * loads up to fetchNum more records and stores them as array in buffer
 *
 * @returns {Promise}
 */
async function fetch () {
    // if fetchNum exceeds numner of remaining records then set to max
    var fetchNum = _.clamp(this.fetchNum, this.length - this.fetched)
    // get list of ids to fetch
    var ids = this.ids.slice(this.fetched, this.fetched + fetchNum)
    // handle errors for await
    try {
        // fetch records
        var records = await this.model.query({
            all: true,
            session: this.session,
            where: {
                id: ids
            },
        })
        // get records indexed by id
        var recordsById = _.keyBy(records, rec => rec.id)
        // put records in buffer in order of ids
        this.buffer = _.map(ids, id => recordsById[id])
    }
    // rethrow error
    catch (err) {
        throw err
    }
    // add number of records fetched to count - use fetchNum instead of
    // the number of rows returned otherwise if a record is missing the
    // iteration will never finish
    this.fetched += fetchNum
    // set done to true when all records fetched
    if (this.fetched == this.length) {
        this.done = true
    }
}
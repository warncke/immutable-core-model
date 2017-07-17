'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const defined = require('if-defined')

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
 * @param {object} args
 * @param {ImmutableCoreModelQuery} args.query
 * @param {array} args.results
 *
 * @returns {Object}
 *
 * @throws {Error}
 */
function ImmutableCoreModelResult (args) {
    // original query instance
    this.query = args.query
    // if the view arg is set then apply views to records
    this.applyView = args.applyView === true ? true : false
    // get id column name
    var idColumn = this.query.model.defaultColumnsInverse.id
    // require id column
    assert(defined(idColumn), `${this.query.model.name} result error: id column required`)
    // get ids from raw result - array of arrays having id as element
    this.ids = _.map(args.results, row => row[idColumn])
    // total number of records
    this.length = this.ids.length
    // number of rows to fetch at a time
    this.fetchNum = fetchNumDefault
    // number of rows fetched
    this.fetched = 0
    // flag indicating whether or not more rows can be fetched
    this.done = this.length > 0 ? false : true
    // list of records fetched for next
    this.records
}

/* public methods */
ImmutableCoreModelResult.prototype = {
    each: each,
    fetch: fetch,
    inspect: inspect,
    // class properties
    class: 'ImmutableCoreModelResult',
    ImmutableCoreModelResult: true,
}

/**
 * @function each
 *
 * returns promise that will be resolved after iterating over all records and
 * calling passed in callback for each.
 *
 * the callback function will be called with the current row, the row number,
 * and a context object which is passed to each callback.
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
 *
 * @throws {Error}
 */
function each (callback, context) {
    // require function
    assert.equal(typeof callback, 'function', 'callback must be function')
    // create context object that will be passed to each callback
    if (!context) {
        context = {}
    }
    // record number counter
    var recordNum = 0
    // return new promise that will be resolved once all records iterated over
    return new Promise((resolve, reject) => {
        _each(this, callback, context, recordNum, resolve, reject)
    })
}

/**
 * @function _each
 *
 * recursive record iterator
 *
 * @param {ImmutableCoreModelResult} result
 * @param {function} callback
 * @param {object} context
 * @param {integer} recordNum
 * @param {function} resolve
 * @param {function} reject
 */
function _each (result, callback, context, recordNum, resolve, reject) {
    // fetch more records
    result.fetch()
    // iterate over fetched records
    .then(records => {
        if (!records || !records.length) {
            return
        }
        // iterate over records
        return Promise.each(records, record => {
            // wait for callback to complete if it returns promise
            return callback(record, recordNum++, context)
        })
    })
    .then(() => {
        // resolve parent promise if done
        if (result.done) {
            resolve(context)
        }
        // iterate over more records if not all fetched
        else {
            _each(result, callback, context, recordNum, resolve, reject)
        }
    })
    // pass errors to parent promise
    .catch(reject)
}

/**
 * @function fetch
 *
 * loads up to fetchNum more records and stores them as array in buffer
 *
 * @param {integer} fetchNum
 * @param {integer} offset
 *
 * @returns {Promise}
 */
function fetch (fetchNum, offset) {
    // if all records already fetched resolve with undefined
    if (this.done) {
        return Promise.resolve([])
    }
    // set default fetchNum
    if (!fetchNum) {
        fetchNum = this.fetchNum
    }
    // if offset is set then set fetched with offset
    if (offset) {
        this.fetched = offset
    }
    // if fetchNum exceeds numner of remaining records then set to max
    fetchNum = _.clamp(fetchNum, this.length - this.fetched)
    // get list of ids to fetch
    var ids = this.ids.slice(this.fetched, this.fetched + fetchNum)
    // create where args for records query
    var whereArgs = {id: ids}
    // if isDeleted was set on original query then set for fetch
    if (defined(this.query.args.where.isDeleted)) {
        whereArgs.isDeleted = this.query.args.where.isDeleted
    }
    // fetch records
    return this.query.model.query({
        all: true,
        allow: this.query.args.allow,
        session: this.query.session,
        where: whereArgs,
        view: this.applyView ? this.query.args.view : false,
    })
    .then(records => {
        // add number of fetched records to count of fetched
        this.fetched += fetchNum
        // set done to true when all records fetched
        if (this.fetched === this.length) {
            this.done = true
        }
        // get records indexed by id
        var recordsById = _.keyBy(records, rec => rec.id)
        // records ordered by ids
        var orderedRecords = []
        // put records in buffer in order of ids
        _.each(ids, id => {
            // if the record was not retrieved then skip
            if (!recordsById[id]) {
                return
            }
            // add record to results
            orderedRecords.push(recordsById[id])
        })
        // resolve with ordred records
        return orderedRecords
    })
}

/**
 * @function inspect
 *
 * custom inspect function for console log
 *
 * @returns {object}
 */
function inspect () {
    return _.pick(this, ['class', 'done', 'fetched', 'ids', 'length'])
}
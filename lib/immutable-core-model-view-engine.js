'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')

/* exports */
module.exports = ImmutableCoreModelViewEngine

/**
 * @function ImmutableCoreModelViewEngine
 *
 * create new model view engine instance that will apply model views
 * to query results.
 *
 * @param {object} args
 * @param {object} model
 * @param {array} modelViews
 *
 * @returns {ImmutableCoreModelViewEngine}
 *
 * @throws {Error}
 */
function ImmutableCoreModelViewEngine (args) {
    this.model = args.model
    this.query = args.query
    // flags indicating what types of model views must be executed
    this.hasRecord = false
    this.hasRecordSequential = false
    this.hasRecordParallel = false
    this.hasRecordSynchronous = false
    this.hasRecordAsynchronous = false
    this.hasCollection = false
    this.hasCollectionSequential = false
    this.hasCollectionParallel = false
    this.hasCollectionSynchronous = false
    this.hasCollectionAsynchronous = false
    // model views categorized by execution options
    this.modelViews = {}
    // map model views based on type and execution options
    _.map(args.modelViews, modelView => {
        // get model view type
        var type = modelView.type
        var synchronous = modelView.synchronous ? 'synchronous' : 'asynchronous'
        // set flags for model view
        if (type === 'record') {
            this.hasRecord = true
            // set sequential flag
            if (modelView.sequential) {
                this.hasRecordSequential = true
            }
            else {
                this.hasRecordParallel = true
            }
            // set synchronous flag
            if (modelView.synchronous) {
                this.hasRecordSynchronous = true
            }
            else {
                this.hasRecordAsynchronous = true
            }
        }
        else if (type === 'collection') {
            this.hasCollection = true
            // set sequential flag
            if (modelView.sequential) {
                this.hasCollectionSequential = true
            }
            else {
                this.hasCollectionParallel = true
            }
            // set synchronous flag
            if (modelView.synchronous) {
                this.hasCollectionSynchronous = true
            }
            else {
                this.hasCollectionAsynchronous = true
            }
        }
        else {
            throw new Error('invalid type '+type)
        }
        // create entry for type
        if (!this.modelViews[type]) {
            this.modelViews[type]= {}
        }
        // create entry for synchronous property
        if (!this.modelViews[type][synchronous]) {
            this.modelViews[type][synchronous] = []
        }
        // store model view by properties
        this.modelViews[type][synchronous].push(modelView)
    })
}

/* public functions */
ImmutableCoreModelViewEngine.prototype = {
    applyModelViewRecord: applyModelViewRecord,
    applyModelViewRecordAsynchronous: applyModelViewRecordAsynchronous,
    applyModelViewRecordSynchronous: applyModelViewRecordSynchronous,
    collectionResult: collectionResult,
    result: result,
    recordResult: recordResult,
    newRecordInstance: newRecordInstance,
}

/**
 * @function applyModelViewRecord
 *
 * takes raw database response record, decodes data, and applies record
 * views to it.
 *
 * @param {object} raw
 *
 * @returns {Promise|object}
 */
function applyModelViewRecord (raw) {
    // get data column to decode data
    var dataColumn = this.model.columnName('data')
    // decode data column
    var data = raw[dataColumn] = this.model.decodeData(raw[dataColumn])    
    // if there are asychronous views then do async apply
    if (this.hasRecordAsynchronous) {

    }
    else {
        // apply view models
        this.applyModelViewRecordSynchronous(data)
        // return modified raw record
        return raw
    }
}

/**
 * @function applyModelViewRecordAsynchronous
 *
 * apply asynchronous models views to record data
 *
 * @param {object} data
 *
 * @returns {Promise}
 */
function applyModelViewRecordAsynchronous (data) {
}

/**
 * @function applyModelViewRecordAsynchronous
 *
 * apply synchronous models views to record data
 *
 * @param {object} data
 *
 * @returns {object}
 */
function applyModelViewRecordSynchronous (data) {
    // apply model views to data
    _.each(this.modelViews.record.synchronous, modelView => {
        // call each function with modelView and data
        modelView.each(modelView, data)
    })
}

/**
 * @function collectionResult
 *
 * return collection result
 *
 * @param {array} res
 *
 * @returns {Promise}
 */
function collectionResult (res) {

}

/**
 * @function result
 *
 * return result based on database result and model views
 *
 * @param {array} res
 *
 * @returns {Promise}
 */
function result (res) {
    // if there is a collection view then collection will be returned
    // otherwise records will be returned
    return this.hasCollection
        ? this.collectionResult(res)
        : this.recordResult(res)
}

/**
 * @function recordResult
 *
 * return record result
 *
 * @param {array} res
 *
 * @returns {Promise}
 */
function recordResult (res) {
    // if query is for a single record then return record or undefined
    if (this.query.limit === 1) {
        // if there are not results return undefined
        if (!res.length) {
            return undefined
        }
        // apply model view to record
        return Promise.resolve(this.applyModelViewRecord(res[0]))
        // resolve with instance
        .then(raw => this.newRecordInstance(raw))
    }
}

/**
 * @function applyModelViewRecord
 *
 * @param {object} raw
 *
 * @returns {Promise}
 */
function newRecordInstance (raw) {
    // return with new model instance
    return this.model.newInstance({
        model: this.model,
        raw: raw,
        session: this.query.session,
    })
}
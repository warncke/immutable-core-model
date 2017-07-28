'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const ImmutableCoreModelResult = require('./immutable-core-model-result')
const Promise = require('bluebird')
const _ = require('lodash')
const defined = require('if-defined')

/* exports */
module.exports = ImmutableCoreModelViewEngine

/**
 * @function ImmutableCoreModelViewEngine
 *
 * create new model view engine instance that will apply model views
 * to query results.
 *
 * @param {object} args
 * @param {ImmutableCoreModelQuery} args.query

 * @param {object} args
 * @param {object} model
 * @param {array} modelViews
 *
 * @returns {ImmutableCoreModelViewEngine}
 *
 * @throws {Error}
 */
function ImmutableCoreModelViewEngine (args) {
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
    _.each(this.query.modelViews, modelView => {
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
    applyModelViewCollection: applyModelViewCollection,
    applyModelViewCollectionAsynchronous: applyModelViewCollectionAsynchronous,
    applyModelViewCollectionSynchronous: applyModelViewCollectionSynchronous,
    applyModelViewRecord: applyModelViewRecord,
    applyModelViewRecordAsynchronous: applyModelViewRecordAsynchronous,
    applyModelViewRecordSynchronous: applyModelViewRecordSynchronous,
    collectionResult: collectionResult,
    collectionResultIterator: collectionResultIterator,
    collectionResultList: collectionResultList,
    collectionResultPost: collectionResultPost,
    collectionResultPre: collectionResultPre,
    result: result,
    recordResult: recordResult,
    newRecordInstance: newRecordInstance,
    // class properties
    class: 'ImmutableCoreModelViewEngine',
    ImmutableCoreModelViewEngine: true,
}


/**
 * @function applyModelViewCollection
 *
 * apply views to results object
 *
 * @param {object} context
 * @param {integer} num
 * @param {array} raw
 *
 * @returns {Promise}
 */
function applyModelViewCollection (context, num, raw) {
    // if there are record views then execute them before collection
    if (this.hasRecord) {
        var recordPromise = this.applyModelViewRecord(raw)
    }
    // wait for record view to resolve
    return Promise.resolve(recordPromise)
    // apply collection view
    .then(recordRaw => {
        // if there is a record result use it
        if (recordRaw) {
            raw = recordRaw
        }
        // if there are synchronous collection views apply
        if (this.hasCollectionSynchronous) {
            this.applyModelViewCollectionSynchronous(context, num, raw)
        }
        // if there are asychronous views then do async apply
        if (this.hasCollectionAsynchronous) {
            return this.applyModelViewCollectionAsynchronous(context, num, raw)
        }
        // otherwise resolve with context
        else {
            return context
        }
    })
}

/**
 * @function applyModelViewCollectionAsynchronous
 *
 * apply views to results object
 *
 * @param {object} context
 * @param {integer} num
 * @param {array} raw
 *
 * @returns {Promise}
 */
function applyModelViewCollectionAsynchronous (context, num, raw) {
    // get data column
    var dataColumn = this.query.model.columnName('data')
    // apply model views to data
    return Promise.all(_.map(this.modelViews.collection.asynchronous, modelView => {
        // if this model view applies to meta data then pass entire db record
        var data = modelView.meta ? raw : raw[dataColumn]
        // call each function with modelView and data
        return modelView.each({
            context: context,
            modelView: modelView,
            number: num,
            record: data,
            session: this.query.session,
        })
        // merge result to data
        .then((eachContext => {
            _.merge(context, eachContext)
        }))
    }))
    // resolve with merged context
    .then(() => context)
}

/**
 * @function applyModelViewCollectionSynchronous
 *
 * apply views to results object
 *
 * @param {object} context
 * @param {integer} num
 * @param {array} raw
 *
 * @returns {Promise}
 */
function applyModelViewCollectionSynchronous (context, num, raw) {
    // get data column
    var dataColumn = this.query.model.columnName('data')
    // apply model views to data
    _.each(this.modelViews.collection.synchronous, modelView => {
        // if this model view applies to meta data then pass entire db record
        var data = modelView.meta ? raw : raw[dataColumn]
        // call each function with modelView and data
        modelView.each(modelView, data, num, context)
    })
}

/**
 * @function applyModelViewRecord
 *
 * apply record views to db response
 *
 * @param {object} raw
 *
 * @returns {Promise}
 */
function applyModelViewRecord (raw) {
    // if record is cached view then do not reprocess
    if (raw._cachedView) {
        return Promise.resolve(raw)
    }
    // if there are synchronous views then do sync apply
    if (this.hasRecordSynchronous) {
        this.applyModelViewRecordSynchronous(raw)
    }
    // if there are asychronous views then do async apply
    if (this.hasRecordAsynchronous) {
        return this.applyModelViewRecordAsynchronous(raw)
    }
    // otherwise resolve with result
    else {
        return Promise.resolve(raw)
    }
}

/**
 * @function applyModelViewRecordAsynchronous
 *
 * apply asynchronous models views to db response
 *
 * @param {object} raw
 *
 * @returns {Promise}
 */
function applyModelViewRecordAsynchronous (raw) {
    // get data column
    var dataColumn = this.query.model.columnName('data')
    // apply model views to data
    return Promise.all(_.map(this.modelViews.record.asynchronous, modelView => {
        // if this model view applies to meta data then pass entire db record
        var data = modelView.meta ? raw : raw[dataColumn]
        // call each function with modelView and data
        return modelView.each({
            modelView: modelView,
            record: data,
            session: this.query.session,
        })
        // merge result to data
        .then((eachData => {
            _.merge(data, eachData)
        }))
    }))
    // resolve with merged data
    .then(() => raw)
}

/**
 * @function applyModelViewRecordAsynchronous
 *
 * apply synchronous models views to db response
 *
 * @param {object} raw
 *
 * @returns {object}
 */
function applyModelViewRecordSynchronous (raw) {
    // get data column
    var dataColumn = this.query.model.columnName('data')
    // apply model views to data
    _.each(this.modelViews.record.synchronous, modelView => {
        // if this model view applies to meta data then pass entire db record
        var data = modelView.meta ? raw : raw[dataColumn]
        // call each function with modelView and data
        modelView.each(modelView, data)
    })
}

/**
 * @function collectionResult
 *
 * return collection result
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function collectionResult (results) {
    // get context by executing any pre methods on collection views
    return this.collectionResultPre()
    // apply views to each record
    .then(context => {
        // if there are no results then do nothing
        if (!Array.isArray(results) || !results.length) {
            return context
        }
        // check if full records were loaded
        return this.query.limit === 1 || this.query.all
            // apply views to results directly
            ? this.collectionResultList(context, results)
            // create result object to iterate over results
            : this.collectionResultIterator(context, results)
    })
    // apply any post methods to context and return result
    .then(context => {
        return this.collectionResultPost(context)
    })
}

/**
 * @function collectionResultIterator
 *
 * create result object to iterate over results
 *
 * @param {object} context
 * @param {array} results
 *
 * @returns {Promise}
 */
function collectionResultIterator (context, results) {
    // create new result object
    var result = new ImmutableCoreModelResult({
        query: this.query,
        results: results,
    })
    // execute iterator
    return result.each((record, num) => {
        // get result
        return this.applyModelViewCollection(context, num, record.raw)
        // merge result to context
        .then(ctx => {
            _.merge(context, ctx)
        })
    })
    // resolve with context
    .then(() => context)
}

/**
 * @function collectionResultList
 *
 * apply views to results list
 *
 * @param {object} context
 * @param {array} results
 *
 * @returns {Promise}
 */
function collectionResultList (context, results) {
    // apply views to each result
    return Promise.each(results, (raw, num) => {
        // get result
        return this.applyModelViewCollection(context, num, raw)
        // merge result to context
        .then(ctx => {
            _.merge(context, ctx)
        })
    })
    // resolve with context
    .then(() => context)
}

/**
 * @function collectionResultPost
 *
 * execute any collection post functions and return results
 *
 * @param {object} context
 *
 * @returns {Promise}
 */
function collectionResultPost (context) {
    // if there are synchronous views then execute any post functions
    if (this.hasCollectionSynchronous) {
        _.each(this.modelViews.collection.synchronous, modelView => {
            // if view does not have post function do nothing
            if (!modelView.post) {
                return
            }
            // execute post function and merge result to context
            _.merge(context, modelView.post(context))
        })
    }
    // if there are asynchronous views then execute any post functions
    if (this.hasCollectionAsynchronous) {
        return Promise.all(_.map(this.modelViews.collection.asynchronous, modelView => {
            // if view does not have post function do nothing
            if (!modelView.post) {
                return
            }
            // execute post function
            return modelView.post({
                context: context,
                session: this.query.session,
            }).then(ctx => {
                _.merge(context, ctx)
            })
        }))
        // resolve with context
        .then(() => context)
    }
    // otherwise resolve with context
    else {
        return Promise.resolve(context)
    }
}

/**
 * @function collectionResultPre
 *
 * execute any collection pre functions and return results
 *
 * @returns {Promise}
 */
function collectionResultPre () {
    // return values pre methods will be merged to context
    var context = {}
    // if there are synchronous views then execute any pre functions
    if (this.hasCollectionSynchronous) {
        _.each(this.modelViews.collection.synchronous, modelView => {
            // if view does not have pre function do nothing
            if (!modelView.pre) {
                return
            }
            // execute pre function and merge result to context
            _.merge(context, modelView.pre())
        })
    }
    // if there are asynchronous views then execute any pre functions
    if (this.hasCollectionAsynchronous) {
        return Promise.all(_.map(this.modelViews.collection.asynchronous, modelView => {
            // if view does not have pre function do nothing
            if (!modelView.pre) {
                return
            }
            // execute pre function
            return modelView.pre({
                session: this.query.session,
            })
            // merge result to context
            .then(ctx => {
                _.merge(context, ctx)
            })
        }))
        // resolve with context
        .then(() => context)
    }
    // otherwise resolve with context
    else {
        return Promise.resolve(context)
    }
}

/**
 * @function result
 *
 * return result based on database result and model views
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function result (results) {
    // if there is a collection view then collection will be returned
    // otherwise records will be returned
    return this.hasCollection
        ? this.collectionResult(results)
        : this.recordResult(results)
}

/**
 * @function recordResult
 *
 * return record result
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function recordResult (results) {
    // if only ids were selected the return result object to fetch records
    if (this.query.select.isSelectOnlyIds) {
        // build result object
        var result = new ImmutableCoreModelResult({
            query: this.query,
            results: results,
            applyView: true,
        })
        // return result or all records if specified
        return this.query.args.all ? result.all() : result
    }
    // otherwise return ImmutableCoreModelInstance record(s)
    else {
        // if query is for a single record then return record or undefined
        if (this.query.args.limit === 1) {
            // if there are not results return undefined
            if (!results.length) {
                return undefined
            }
            // apply model view to record
            return Promise.resolve(this.applyModelViewRecord(results[0]))
            // resolve with instance
            .then(result => this.newRecordInstance(result))
        }
        // if query is for all records then return all
        else {
            // apply model views to each record
            return Promise.map(results, result => {
                // apply model view to record
                return this.applyModelViewRecord(result)
                // resolve with instance
                .then(result => this.newRecordInstance(result))
            })
        }
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
    // return raw data
    if (this.query.args.raw) {
        return raw
    }
    // return new model instance
    else {
        return this.query.model.newInstance({
            model: this.query.model,
            raw: raw,
            session: this.query.session,
        })
    }
}
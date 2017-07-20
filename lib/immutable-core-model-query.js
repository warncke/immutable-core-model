'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const defined = require('if-defined')
const httpError = require('immutable-app-http-error')
const immutable = require('immutable-core')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const ImmutableCoreModelResult = require('./immutable-core-model-result')
const ImmutableCoreModelResolve = require('./immutable-core-model-resolve')
const ImmutableCoreModelViewEngine = require('./immutable-core-model-view-engine')
const requireValidModelView = require('./immutable-core-model/require-valid-model-view')
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelQuery

/**
 * @function ImmutableCoreModelQuery
 *
 * instantiate a new ImmutableCoreModelQuery instance
 *
 * @param {object} args
 * @param {ImmutableCoreModel} model
 * @param {object} session
 *
 * @returns {ImmutableCoreModelQuery}
 */
function ImmutableCoreModelQuery (args) {
    // args and session are both optional in some cases
    this.args = _.cloneDeep( requireValidOptionalObject(args.args) )
    this.session = requireValidOptionalObject(args.session)
    // require model
    assert.ok(defined(args.model) && args.model.ImmutableCoreModel, `model required for query`)
    // require database
    assert.ok(defined(args.model.database), `database required for query on ${args.model.name}`)
    // set model for query
    this.model = args.model
    // set default for where if not set
    this.args.where = requireValidOptionalObject(this.args.where)
    // do not allow arguments that should only be used internally
    assert.ok(!defined(this.args.accessId), `accessId not allowed for query on ${args.model.name}`)
    assert.ok(!defined(this.args.accessIdName), `accessIdName not allowed for query on ${args.model.name}`)
    assert.ok(!defined(this.args.accessModel), `accessModel not allowed for query on ${args.model.name}`)
    // get model view for query if any
    this.modelViews = this.getModelViews()
    // if model has deleted column then default to isDeleted:false
    if (defined(this.model.columns.d) && !defined(this.args.where.isDeleted)) {
        this.args.where.isDeleted = false
    }

}

/* public methods */
ImmutableCoreModelQuery.prototype = {
    accessControl: accessControl,
    accessControlOwn: accessControlOwn,
    accessControlStates: accessControlStates,
    decodeData: decodeData,
    error: error,
    execute: execute,
    executeRelated: executeRelated,
    executeRelatedResult: executeRelatedResult,
    executeRelatedResultResolve: executeRelatedResultResolve,
    executeRelatedResultWith: executeRelatedResultWith,
    executeRelatedResultWithQuery: executeRelatedResultWithQuery,
    executeQuery: executeQuery,
    executeQueryCached: executeQueryCached,
    executeQueryDirect: executeQueryDirect,
    getModelViews: getModelViews,
    orderResults: orderResults,
    newInstance: newInstance,
    result: result,
    resultModelView: resultModelView,
    resultRaw: resultRaw,
    // class properties
    class: 'ImmutableCoreModelQuery',
    ImmutableCoreModelQuery: true,
}

/**
 * @function accessControl
 *
 * check access for query, add any access control related params to args
 *
 * @throws {Error}
 */
function accessControl () {
    // if the query is for specific record(s) by id then the action type
    // is read. for all other queries the action type is list.
    this.action = defined(this.args.where.id) ? 'read' : 'list'
    // if allow override is set then skip access control
    if (this.args.allow) {
        return
    }
    // add scope of access allowed to args
    this.args.scope = this.model.accessControl.allowModelScope({
        action: this.action,
        model: this.model.name,
        session: this.session,
        states: this.accessControlStates(),
    })
    // if scope is undefined then throw access denied error
    if (!defined(this.args.scope)) {
        httpError(403, null, this.model.accessControl.audit)
    }
    // if scope is own add access control args
    if (this.args.scope === 'own') {
        this.accessControlOwn()
    }
}

/**
 * @function accessControlOwn
 *
 * add access control args for queries where scope is own
 *
 * @throws {Error}
 */
function accessControlOwn () {
    // if session has accessId set and it is used for model then use it
    if (defined(this.session.accessId) && this.session.accessIdName === this.model.accessIdName) {
        // if access is via another model then need to join that model
        if (this.model.accessModel) {
            this.args.accessModel = this.model.accessModel
        }
        // add access id to args
        this.args.accessIdName = this.session.accessIdName
        this.args.accessId = this.session.accessId
    }
    // otherwise try account id
    else if (defined(this.session.accountId) && this.model.defaultColumnsInverse.accountId) {
        // add access id to args
        this.args.accessIdName = 'accountId'
        this.args.accessId = this.session.accountId
    }
    // otherwise deny access because no access id available
    else {
        httpError(403, null, this.model.accessControl.audit)
    }
}

/**
 * @function accessControlStates
 *
 * get list of queried states to check if access is allowed
 *
 * @returns {array}
 */
function accessControlStates () {
    // list of states requested
    var states = []

    // return list of states
    return states
}

/**
 * @function decodeData
 *
 * decode any encoded data columns
 *
 * @param {array} results
 */
function decodeData (results) {
    return Promise.each(results, result => this.model.decodeData(result))
}

/**
 * @function error
 *
 * create/update error object with query data
 *
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @returns {Error}
 */
function error (message, error) {
    // build custom error message
    message = `${this.model.name} query error` + (
        typeof message === 'string'
            ? `: ${message}`
            : ''
    )
    // use error object passed in
    if (defined(error)) {
        // create data object with original message
        error.data = {
            message: error.message,
        }
    }
    // create new error message
    else {
        error = new Error(message)
        error.data = {}
    }
    // set query data for error
    error.data.args = this.args
    error.data.select = this.select

    return error
}

/**
 * @function execute
 *
 * execute query
 *
 * @returns {Promise}
 */
function execute () {
    // check access and set access params
    this.accessControl()
    // build select
    this.select = sql.select(this.model, this.args)
    // debug
    debug(this.select.sql, this.select.params)
    // do query
    defined(this.model.cache) && this.args.cache !== false
        ? this.executeQueryCached()
        : this.executeQueryDirect()
    // add queries for related records if any
    this.executeRelated()
    // build result
    return this.result()
}

/**
 * @function executeQuery
 *
 * execute query
 *
 * @returns {Promise}
 */
function executeQuery () {
    return this.model.database().query(
        this.select.sql,
        this.select.params,
        this.select.options,
        this.session
    )
    // decode data
    .then(results => {
        // decode any encoded data columns
        return this.decodeData(results)
    })
    // add custom error handler
    .catch(err => {
        throw this.error('db error', err)
    })
}

/**
 * @function executeQueryCached
 *
 * execute query with cache
 *
 * @returns {Promise}
 */
function executeQueryCached () {
    this.promise = this.model.cache.query(this)
}

/**
 * @function executeQueryDirect
 *
 * execute query without cache
 *
 * @returns {Promise}
 */
function executeQueryDirect () {
    this.promise = this.executeQuery()
}

/**
 * @function executeRelated
 *
 * add queries for any related models specified by args.with
 */
function executeRelated () {
    // skip unless related records are specified by with or resolve
    if (!defined(this.args.with) && !this.args.resolve) {
        return
    }
    // skip if select is only for ids
    if (this.select.onlyIds) {
        return
    }
    // add related queries to promise chain
    this.promise = this.promise.then(results => {
        // skip if there are no results
        if (!results.length) {
            return results
        }
        // iterate over results loading related records
        return Promise.map(results, result => this.executeRelatedResult(result), {
            concurrency: this.model.concurrency,
        })
    })
}

/**
 * @function executeRelatedResult
 *
 * execute queries for related models for specific result
 *
 * @param {object} result
 *
 * @returns {object}
 */
function executeRelatedResult (result) {
    // load related records or resolve/with in parallel
    return Promise.all([
        this.executeRelatedResultResolve(result),
        this.executeRelatedResultWith(result),
    ])
    // resolve with result with related data merged in
    .then(() => result)
}

/**
 * @function executeRelatedResultResolve
 *
 * execute queries for related models specified by resolve
 *
 * @param {object} result
 *
 * @returns {Promise}
 */
function executeRelatedResultResolve (result) {
    // skip if resolve not specified
    if (!this.args.resolve) {
        return
    }
    // create new resolve instance
    var resolve = new ImmutableCoreModelResolve({
        query: this,
        result: result,
    })
    // exceute resolve
    return resolve.resolve()
}

/**
 * @function executeRelatedResultWith
 *
 * execute queries for related models specified by with
 *
 * @param {object} result
 *
 * @returns {object}
 */
function executeRelatedResultWith (result) {
    // skip if no with models specified
    if (!defined(this.args.with)) {
        return
    }
    // add related records keyed by related model name
    result._related = {}
    // load all related records
    return Promise.map(_.keys(this.args.with), relatedName => this.executeRelatedResultWithQuery(result, relatedName), {
        concurrency: this.model.concurrency,
    })
}

/**
 * @function executeRelatedResultWithQuery
 *
 * perform query for related model
 *
 * @param {object} result
 * @param {string}
 *
 * @returns {object}
 */
function executeRelatedResultWithQuery (result, relatedName) {
    // get custom args for related model query
    var relatedArgs = this.args.with[relatedName]
    // get relation
    var relation = this.model.relation(relatedName)
    // build query args
    var queryArgs = {
        all: true,
        session: this.session,
        where: { relation: { name: this.model.name } },
    }
    // relation is via a linking table
    if (relation.via) {
        queryArgs.where.relation[relation.viaModelIdColumn] = result[relation.modelIdColumn] || result[model.defaultColumns[relation.modelIdColumn]]
    }
    // relation is direct
    else {
        queryArgs.where.relation[relation.relationIdColumn] = result[relation.modelIdColumn] || result[model.defaultColumns[relation.modelIdColumn]]
    }
    // merge args
    if (typeof relatedArgs === 'object') {
        _.merge(queryArgs, relatedArgs)
    }
    // do query on related model
    return relation.model.query(queryArgs)
    // merge related records once loaded
    .then(results => {
        result._related[relatedName] = results
    })
}

/**
 * @function getModelViews
 *
 * get list of model views to be applied to query results based on model
 * defaults and query args.
 *
 * @param {object} model
 * @param {object} args
 *
 * @returns {array}
 *
 * @throws {Error}
 */
function getModelViews () {
    // if view is false no model views will be applied overriding any defaults
    if (this.args.view === false) {
        return []
    }
    // get view from args or default
    var viewArg = defined(this.args.view) ? this.args.view : this.model.views.default
    // skip unless view arg is set from args or default
    if (!defined(viewArg)) {
        return []
    }
    // list of views to apply to model
    var views
    // if view is string then convert to array
    if (typeof viewArg === 'string') {
        views = [viewArg]
    }
    // if view is array use it
    else if (Array.isArray(viewArg)) {
        views = viewArg
    }
    // invalid argument
    else {
        throw this.error('invalid view argument')
    }
    // ImmutableCoreModelView objects in order specified
    var modelViews = []
    // iterate over views getting model view objects
    _.each(views, view => {
        var modelView = requireValidModelView(view, this.model.views, true)
        // if result is array then add all
        if (Array.isArray(modelView)) {
            _.each(modelView, modelView => modelViews.push(modelView))
        }
        // otherwise add object
        else {
            modelViews.push(modelView)
        }
    })
    // return model view objects
    return modelViews
}

/**
 * @function newInstance
 *
 * create new ImmutableCoreModelRecord from db response
 *
 * @param {object} result
 *
 * @returns {ImmutableCoreModelRecord|object}
 *
 * @throws {Error}
 */
function newInstance (result) {
    // return raw result or new instnace
    return this.args.raw
        ? result
        : this.model.newInstance({
            allow: this.args.allow,
            model: this.model,
            raw: result,
            session: this.session,
        })
}

/**
 * @function orderReults
 *
 * if query was for a list of ids then order results in the same order that
 * the ids were queried
 *
 * @param {array} res
 *
 * @returns {array}
 */
function orderResults (results) {
    // get id column names
    var idColumn = this.model.defaultColumnsInverse.id
    // require id column for model
    if (!defined(idColumn)) {
        return results
    }
    // get id column name that was used for query
    var queryIdColumn = defined(this.args.where.id)
        ? 'id'
        : defined(this.args.where[idColumn])
            ? idColumn
            : undefined
    // if query was not on id column then do not reorder
    if (!defined(queryIdColumn)) {
        return results
    }
    // list of ids as querired
    var queryIds
    // if id property is array then get ids
    if (Array.isArray(this.args.where[queryIdColumn])) {
        queryIds = this.args.where[queryIdColumn]
    }
    // if id has an in query with array then get ids
    else if (typeof this.args.where[queryIdColumn] === 'object' && Array.isArray(this.args.where[queryIdColumn].in)) {
        queryIds = this.args.where[queryIdColumn].in
    }
    // if query is not by list of ids then do not reorder
    if (!defined(queryIds)) {
        return results
    }
    // group results by id - if current record was queried then must use
    // the id that column was selected by instead of record id
    var resultsById = _.keyBy(results, this.args.current ? idColumn+'Select' : idColumn)
    // ordered result set
    var orderedRes = []
    // iterate over queried ids and add to ordered result set
    _.each(queryIds, queryId => {
        if (defined(resultsById[queryId])) {
            orderedRes.push(resultsById[queryId])
        }
    })

    return orderedRes
}

/**
 * @function result
 *
 * bulid query result based on response and args
 *
 * @returns {Promise}
 */
function result () {
    // wait for all queries to complete then build result
    return this.promise.then(results => {
        // order results if needed
        results = this.orderResults(results)
        // if there are model views then build result with ModelViewEngine
        // otherwise build result based on raw data
        return this.modelViews.length
            ? this.resultModelView(results)
            : this.resultRaw(results)
    })
}

/**
 * @function resultModelView
 *
 * bulid query result with model view engine
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function resultModelView (results) {
    // instantiate ModelViewEngine
    var modelViewEngine = new ImmutableCoreModelViewEngine({query: this})
    // build result with ModelViewEngine
    return modelViewEngine.result(results)
}

/**
 * @function resultRaw
 *
 * bulid query result with raw data
 *
 * @param {array} results
 *
 * @returns {Promise}
 */
function resultRaw (results) {
    // throw error if results required and not retrieved
    if (this.args.required && !results.length) {
        // throw error
        throw this.error('no records found')
    }
    // if only ids were selected the return result object to fetch records
    if (this.select.onlyIds) {
        return new ImmutableCoreModelResult({
            query: this,
            results: results,
        })
    }
    // otherwise return ImmutableCoreModelInstance record(s)
    else {
        // query is for a single record
        if (this.args.limit === 1) {
            // return new instance or undefined
            return results.length
                ? this.newInstance(results[0])
                : undefined
        }
        // query is for multiple records
        else {
            return _.map(results, result => this.newInstance(result))
        }
    }
}
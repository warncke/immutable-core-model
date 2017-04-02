'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const immutable = require('immutable-core')

/* application modules */
const ImmutableCoreModelResult = require('../immutable-core-model-result')
const ImmutableCoreModelViewEngine = require('../immutable-core-model-view-engine')
const requireValidModelView = require('./require-valid-model-view')
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

/* private functions */

/**
 * @function getViewsForQuery
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
function getModelViewsForQuery (model, args) {
    // ImmutableCoreModelView objects in order specified
    var modelViews = []
    // list of view arguments either from args or defaults. these can be
    // names, or constructor or instance object, and names can be aliases
    // for sets of model views so this list must be resolved and possibly
    // exapaned in the the actual model view objects
    var views = []
    // if views specified in args then use those
    if (args.view !== undefined) {
        // if views is falsy then no views for query
        if (!args.view) {
            return []
        }
        // if view is string then convert to array
        if (typeof args.view === 'string') {
            views = [args.view]
        }
        // if view is array use it
        else if (Array.isArray(args.view)) {
            views = args.view
        }
        // invalid argument
        else {
            throw new Error('invalid view argument '+args.view)
        }
    }
    // if default views are specified for model use those
    else if (model.views.default) {
        views = model.views.default
    }
    // iterate over views arguments getting actual model view objects
    _.each(views, view => {
        var modelView = requireValidModelView(view, model.views, true)
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
 * @function instanceFromRes
 *
 * create new ImmutableCoreModelInstance from db response
 *
 * @param {object} model
 * @param {object} raw
 * @param {object} session
 * @param {boolean} returnRaw
 * @param {object} select
 *
 * @returns {ImmutableCoreModelInstance}
 *
 * @throws {Error}
 */
function instanceFromRes (model, raw, session, returnRaw, select) {
    // get data column to decode data
    var dataColumn = model.columnName('data')
    // decode data column
    if (raw[dataColumn]) {
        raw[dataColumn] = model.decodeData(raw[dataColumn])
    }
    // decode data columns for any joined models
    _.each(select.joinRelationNames, relation => {
        // get relation
        relation = model.relation(relation)
        // get data column to decode data
        var dataColumn = relation.model.columnName('data')
        // decode data column
        if (raw[dataColumn]) {
            raw[dataColumn] = model.decodeData(raw[dataColumn])
        }
    })
    // return raw data
    if (returnRaw) {
        return raw
    }
    // resolve with new model instance
    else {
        return model.newInstance({
            model: model,
            raw: raw,
            session: session,
        })
    }
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
 *
 * @throws {Error}
 */
function query (model, args) {
    // debug query args
    debug(args)
    // require model
    assert.equal(typeof model, 'object', 'model must be object')
    // require object for args
    assert.equal(typeof args, 'object', 'argument must be object')
    // require database
    assert.ok(model.database, 'database required for create')
    // check compatibility of join with other options
    if (args.join || args.left) {
        // join can only be done with raw response
        assert.ok(args.raw, 'join without raw not yet supported')
        // join must be done with all or 1 record - result does not support
        assert.ok(args.all || args.limit === 1, 'join must have limit:1 or all:true')
    }
    // get select sql
    var select = sql.select(model, args)
    // debug
    debug(select.sql, select.params)
    // attempt query
    var queryPromise = model.database().query(select.sql, select.params, select.options, args.session)
    // if relations are specified and selecting by id load related records
    if (args.with && args.where && args.where.id && args.limit === 1) {
        queryPromise = queryPromise.then(records => {
            return queryRelated(model, args, records)
        })
    }
    // build response for query
    return queryPromise.then(records => {
        // if there are views for query then they will be applied to results
        var modelViews = getModelViewsForQuery(model, args)
        // if there are views then create a new engine to apply them
        if (modelViews && modelViews.length) {
            var modelViewEngine = new ImmutableCoreModelViewEngine({
                model: model,
                modelViews: modelViews,
                query: args,
                select: select,
            })
            // model view engine will decide what to return
            return modelViewEngine.result(records)
        }
        // otherwise create result based on args
        else {
            return result(model, args, records, select)
        }
    })
}

/**
 * @function queryRelated
 *
 * load related records
 *
 * @param {object} model
 * @param {object} args
 * @param {object} records
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
function queryRelated (model, args, records) {
    // if no records return
    if (!records.length) {
        return records
    }
    // get first (only) record from results
    var record = records[0]
    // related records
    var related = record._related = {}
    // promises that will be resolved with related records
    var promises = []
    // load related records
    _.each(args.with, (relatedArgs, relatedName) => {
        // get relation
        var relation = model.relation(relatedName)
        // build query args
        var queryArgs = {
            all: true,
            session: args.session,
            where: { relation: { name: model.name } },
        }
        // relation is via a linking table
        if (relation.via) {
            queryArgs.where.relation[relation.viaModelIdColumn] = record[relation.modelIdColumn] || record[model.defaultColumns[relation.modelIdColumn]]
        }
        // relation is direct
        else {
            queryArgs.where.relation[relation.relationIdColumn] = record[relation.modelIdColumn] || record[model.defaultColumns[relation.modelIdColumn]]
        }
        // merge args
        _.merge(queryArgs, relatedArgs)
        // do query on related model
        var promise = relation.model.query(queryArgs)
        // merge related records once loaded
        .then(records => {
            related[relatedName] = records
        })
        // add promise to list
        promises.push(promise)
    })
    // wait for all related records to load
    return Promise.all(promises)
    // merge related records
    .then(() => {
        // resolve with merged records
        return records
    })
}

/**
 * @function result
 *
 * create result - model instance, array of model instances, or result object
 * based on query args and database response.
 *
 * @param {object} model
 * @param {object} args
 * @param {array} res
 * @param {object} select
 *
 * @returns {array|object|undefined}
 *
 * @throws {Error}
 */
function result (model, args, res, select) {
    // if query is for a single record then either return the record
    // or undefined if not found
    if (args.limit === 1) {
        // return new instance or undefined
        return res.length
            ? instanceFromRes(model, res[0], args.session, args.raw, select)
            : undefined
    }
    // if query is for all records then return all
    else if (args.all) {
        return _.map(res, raw => instanceFromRes(model, raw, args.session, args.raw, select))
    }
    // otherwise return new result object
    else {
        return new ImmutableCoreModelResult({
            model: model,
            query: args,
            raw: res,
            select: select,
            session: args.session,
            view: false,
        })
    }
}
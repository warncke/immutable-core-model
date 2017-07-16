'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const defined = require('if-defined')

/* application modules */
const ImmutableCoreModelResolveValue = require('./immutable-core-model-resolve-value')

/* exports */
module.exports = ImmutableCoreModelResolve

/**
 * @function ImmutableCoreModelResolve
 *
 * instantiate new ImmutableCoreModelResolve instance to execute
 * resolve arguments for ImmutableCoreModelQuery
 *
 * @param {object} args
 * @param {ImmutableCoreModelQuery} args.query
 * @param {object} args.result
 *
 * @returns {ImmutableCoreModelResolve}
 */
function ImmutableCoreModelResolve (args) {
    // require query
    assert.ok(defined(args.query) && args.query.ImmutableCoreModelQuery, `query required`)
    // require result
    assert.ok(defined(args.result), `result required`)
    // store args
    this.query = args.query
    this.result = args.result
}

/* public methods */
ImmutableCoreModelResolve.prototype = {
    resolve: resolve,
    resolveAll: resolveAll,
    resolveOnly: resolveOnly,
    resolveProperty: resolveProperty,
    resolveValueArgs: resolveValueArgs,
    // class properties
    class: 'ImmutableCoreModelResolve',
    ImmutableCoreModelResolve: true,
}

/**
 * @function resolve
 *
 * execute resolve
 *
 * @returns {Promise|undefined}
 */
function resolve () {
    // if resolve is object the only resolve specified properties
    // if resolve is truth then resolve any object/id properties
    return typeof this.query.args.resolve === 'object'
        ? this.resolveOnly()
        : this.resolveAll()
}

/**
 * @function resolveAll
 *
 * resolve related models for any properties that match model names or
 * model id properties.
 *
 * @returns {Promise|undefined}
 */
function resolveAll () {
    // get data column to decode data
    var dataColumn = this.query.model.columnName('data')
    // skip if no data column
    if (!defined(dataColumn) || !defined(this.result[dataColumn])) {
        return
    }
    // get data
    var data = this.result[dataColumn]
    // iterate over properties resolving any models
    return Promise.map(_.keys(data), property => {
        return this.resolveProperty(data, property)
    }, {
        concurrency: this.query.model.concurrency,
    })
    // discard map result
    .then(() => undefined)
}

/**
 * @function resolveOnly
 *
 * resolve related models specified by resolve args
 *
 * @returns {Promise|undefined}
 */
function resolveOnly () {
    // get data column to decode data
    var dataColumn = this.query.model.columnName('data')
    // skip if no data column
    if (!defined(dataColumn) || !defined(this.result[dataColumn])) {
        return
    }
    // get data
    var data = this.result[dataColumn]
    // iterate over resolve properties resolving any models
    return Promise.map(_.keys(this.query.args.resolve), property => {
        return this.resolveProperty(data, property, this.query.args.resolve[property])
    }, {
        concurrency: this.query.model.concurrency,
    })
    // discard map result
    .then(() => undefined)
}

/**
 * @function resolveAllProperty
 *
 * resolve property that references a model
 *
 * @param {object} data
 * @param {string} property
 * @param {object} resolveValueArgs
 *
 * @returns {Promise|undefined}
 */
function resolveProperty (data, property, resolveValueArgs) {
    // get resolve value args
    var resolveValueArgs = this.resolveValueArgs(data, property, resolveValueArgs)
    // skip if args not defined
    if (!defined(resolveValueArgs)) {
        return
    }
    // get resolve value instance
    var resolveValue = new ImmutableCoreModelResolveValue(resolveValueArgs)
    // resolve value(s)
    return resolveValue.resolveValue()
}

/**
 * @function resolveValueArgs
 *
 * get args for resolveValue call
 *
 * @param {object} data
 * @param {string} property
 * @param {object} resolveValueArgs
 *
 * @returns {object|undefined}
 */
function resolveValueArgs (data, property, resolveValueArgs) {
    // make sure that args are object
    resolveValueArgs = typeof resolveValueArgs === 'object' ? resolveValueArgs : {}
    // set true if property is id colum
    var isIdColumn = false
    // set true if id co lumn is original id
    var isOriginalId = false
    // set true if property is plural
    var isPlural = property.slice(-1) === 's'
    // it model property is not set then derive from property
    if (!defined(resolveValueArgs.modelProperty)) {
        // make sure property does not have `s` on end
        resolveValueArgs.modelProperty = isPlural
            ? property.slice(0, -1)
            : property
    }
    // set id flags for model property
    if (resolveValueArgs.modelProperty.slice(-2) === 'Id') {
        // column is id column
        isIdColumn = true
        // check if column is originalId
        isOriginalId = resolveValueArgs.modelProperty.slice(-10) === 'OriginalId'
    }
    // if model name is defined validate
    if (defined(resolveValueArgs.modelName)) {
        // throw error on invalid model name
        if (!this.query.model.hasModel(resolveValueArgs.modelName)) {
            throw this.query.error(`invalid modelName ${resolveValueArgs.modelName} in resolve`)
        }
    }
    else {
        if (isIdColumn) {
            // get model name by removing the id
            resolveValueArgs.modelName = isOriginalId
                ? resolveValueArgs.modelProperty.slice(0, -10)
                : resolveValueArgs.modelProperty.slice(0, -2)
        }
        // property is a model name
        else {
            resolveValueArgs.modelName = resolveValueArgs.modelProperty
        }
        // skip unless property has a valid model name
        if (!this.query.model.hasModel(resolveValueArgs.modelName)) {
            return
        }
    }
    // get model instance
    resolveValueArgs.model = this.query.model.getModel(resolveValueArgs.modelName)
    // get id column
    resolveValueArgs.idColumn = resolveValueArgs.model.columnName('id')
    // skip if model has no id column
    if (!defined(resolveValueArgs.idColumn)) {
        return
    }
    // set flags if not defined
    if (!defined(resolveValueArgs.isIdColumn)) {
        resolveValueArgs.isIdColumn = isIdColumn
    }
    if (!defined(resolveValueArgs.isOriginalId)) {
        resolveValueArgs.isOriginalId = isOriginalId
    }
    if (!defined(resolveValueArgs.isPlural)) {
        resolveValueArgs.isPlural = isPlural
    }
    // set common args
    resolveValueArgs.data = data
    resolveValueArgs.property = property
    resolveValueArgs.query = this.query

    return resolveValueArgs
}
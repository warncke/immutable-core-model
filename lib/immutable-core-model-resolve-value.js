'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const defined = require('if-defined')

/* exports */
module.exports = ImmutableCoreModelResolveValue

/* costants */

// regex to match id columns
const idRegExp = /^[a-f0-9]{32}$/

/**
 * @function ImmutableCoreModelResolveValue
 *
 * resolve ImmutableCoreModelRecord(s) from array, object, or string
 * containing an object id
 *
 * @param {object} args
 * @param {object} args.data
 * @param {string} args.idColumn
 * @param {boolean} args.isIdColumn
 * @param {boolean} args.isOriginalId
 * @param {boolean} args.isPlural
 * @param {ImmutableCoreModel} args.model
 * @param {modelProperty} args.modelProperty
 * @param {string} args.property
 * @param {object} args.queryArgs
 *
 * @returns {ImmutableCoreModelQueryResolve}
 */
function ImmutableCoreModelResolveValue (args) {
    // store args
    this.data = args.data
    this.idColumn = args.idColumn
    this.isIdColumn = args.isIdColumn
    this.isOriginalId = args.isOriginalId
    this.isPlural = args.isPlural
    this.model = args.model
    this.modelProperty = args.modelProperty
    this.property = args.property
    this.query = args.query
    this.queryArgs = args.queryArgs
    this.value = _.get(this.data, this.property)
    // get property that will be used to set value from args
    if (defined(args.setProperty)) {
        this.setProperty = args.setProperty
    }
    // use default property for setting value
    else {
        // if resolving id column then set property with model name
        if (this.isIdColumn) {
            // if original property is plural then use plural name
            this.setProperty = this.isPlural ? `${this.model.name}s` : this.model.name
        }
        // otherwise use same property name
        else {
            this.setProperty = this.property
        }
    }
}

/* public methods */
ImmutableCoreModelResolveValue.prototype = {
    getQueryArgs: getQueryArgs,
    resolveArray: resolveArray,
    resolveObject: resolveObject,
    resolveString: resolveString,
    resolveValue: resolveValue,
    // class properties
    class: 'ImmutableCoreModelResolveValue',
    ImmutableCoreModelResolveValue: true,
}

/**
 * @function getQueryArgs
 *
 * build query args
 *
 * @returns {Promise}
 */
function getQueryArgs (ids) {
    // build query args
    var queryArgs = {
        allow: this.query.args.allow,
        session: this.query.session,
        where: {},
    }
    // set ids for query
    queryArgs.where[this.idColumn] = ids
    // if query is for list of ids set all flag
    if (Array.isArray(ids)) {
        queryArgs.all = true
    }
    // otherwise set limit 1
    else {
        queryArgs.limit = 1
    }
    // if query is for original id then set current flag
    if (this.isOriginalId) {
        queryArgs.current = true
    }
    // if custom query args are set then merge
    if (typeof this.queryArgs === 'object') {
        _.merge(queryArgs, this.queryArgs)
    }

    return queryArgs
}

/**
 * @function resolveArray
 *
 * resolve array value to records
 *
 * @returns {Promise}
 */
function resolveArray () {
    // get list of ids from value
    var ids = _.filter(this.value, value => value.match(idRegExp))
    // if there are no ids then resolve with original value
    if (ids.length === 0) {
        return Promise.resolve(this.value)
    }
    // do query
    return this.model.query(this.getQueryArgs(ids))
}

/**
 * @function resolveObject
 *
 * resolve object value to records
 *
 * @returns {Promise}
 */
function resolveObject () {
    // get list of ids from values
    var ids = _.filter(_.keys(this.value), value => value.match(idRegExp))
    // if there are no ids then resolve with original values
    if (ids.length === 0) {
        return Promise.resolve(this.value)
    }
    // do query
    return this.model.query(this.getQueryArgs(ids)).then(results => {
        // resolve with data
        return _.keyBy(results, this.isOriginalId ? 'originalId' : 'id')
    })
}

/**
 * @function resolveString
 *
 * resolve string value to record
 *
 * @returns {Promise}
 */
function resolveString () {
    // resolve with original value unless value is id
    if (!this.value.match(idRegExp)) {
        return Promise.resolve(value)
    }
    // do query
    return this.model.query(this.getQueryArgs(this.value))
}

/**
 * @function resolveValue
 *
 * resolve data value pointed to by property
 *
 * @returns {Promise}
 */
function resolveValue () {
    // promise to resolve with value
    var promise
    // resolve string value
    if (typeof this.value === 'string') {
        promise = this.resolveString()
    }
    // resolve array value
    else if (Array.isArray(this.value)) {
        promise = this.resolveArray()
    }
    // resolve object value
    else if (this.value && typeof this.value === 'object') {
        promise = this.resolveObject()
    }
    // do nothing
    else {
        return Promise.resolve()
    }
    // wait for promise to resolve then set value in data
    return promise.then(value => {
        // set resolved value
        _.set(this.data, this.setProperty, value)
    })
}
'use strict'

/* native modules */
const assert = require('assert')
const util = require('util')

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const deepExtend = require('deep-extend')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelInstance

/* constats */
const MAX_RETRY = 3

/**
 * @function ImmutableCoreModelInstance
 *
 * create a new object instance from raw data object either returned by
 * database or created in the same format.
 *
 * this function does not do any validation on arguments because it is assumed
 * that it will only be used internally by other methods that are already doing
 * validation.
 *
 * ImmutableCoreModel creates its own version of this class for each model with
 * custom methods added for actions. Those custom version are all the same
 * and do not do anything besides calling the init method.
 *
 * @param {object} args
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function ImmutableCoreModelInstance (args) {
    // initialize new instance
    this.init(args)
}

/* public functions */
ImmutableCoreModelInstance.prototype = {
    action: action,
    current: current,
    empty: empty,
    init: init,
    inspect: inspect,
    isConflictError: isConflictError,
    toJSON: toJSON,
    update: update,
    updateMeta: updateMeta,
}

/**
 * @function action
 *
 * performs action specified by name
 *
 * @param {string} name
 * @param {object} args
 *
 * @returns {Promise}
 */
function action (name, args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // get model for action
    var model = this.model.actionModels[name]
    // require model
    assert.ok(model, 'no model for action '+name)
    // build args for creating new action instance
    var createArgs = {
        accountId: args.accountId || this.accountId,
        session: args.session || this.session,
    }
    // if action is inverse then it needs to reference the id of action
    if (model.isInverse) {
        createArgs[model.action.model.columnName('id')] = this.raw[model.action.model.columnName('id')]
    }
    // otherwise action references parent model
    else {
        createArgs[this.model.columnName('id')] = this.id
    }
    // create new entry for model that corresponds to action
    return model.createMeta(createArgs)
    // merge result into object
    .then(res => {
        // create a copy of the raw data from the current instance
        var raw = _.clone(this.raw)
        // merge results into raw data
        _.merge(raw, res.raw)
        // return a new instance with result data
        return this.model.newInstance({
            model: this.model,
            raw: raw,
            session: args.session || this.session,
        })
    })
}

/**
 * @function current
 *
 * do query for current instance of object
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function current (args) {
    return this.model.query({
        current: true,
        limit: 1,
        where: {
            id: this.id,
        },
        session: args && args.session || this.session,
    })
}

/**
 * @function empty
 *
 * empty object data
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function empty (args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // to empty object data must be set to null
    args.data = null
    // use update method to empty
    return this.updateMeta(args)
}

/**
 * @function init
 *
 * called by instantiator to initialize new instance
 *
 * @param {object} args
 */
function init (args) {
    // get values from args
    this.model = args.model
    this.promise = args.promise
    this.raw = args.raw
    this.session = args.session
    // list of instance properties used for toJSON which is what is exposed
    // via HTTP api
    this.properties = []
    // add default properties to instance
    _.each(this.model.defaultColumns, (defaultName, columnName) => {
        // since anything can be written to data it is possible to have name
        // conflicts here between properties and methods - for now silently
        // ignore these and leave methods intact
        // TODO: more robust approach
        if (this[defaultName]) {
            return
        }
        // ad property using default name (e.g. id, createTime) to object
        this[defaultName] = this.raw[columnName]
        // add to properties
        this.properties.push(defaultName)
    })
    // add action properties to object
    _.each(this.model.actions, (action, name) => {
        // if model has actions then make sure instance has actions
        if (!this.actions) {
            this.actions = {}
            // add actions to properties
            this.properties.push('actions')
        }
        // create entry for action
        var actionData = this.actions[name] = {}
        // add acton data to instance
        _.each(action.model.defaultColumns, (defaultName, columnName) => {
            actionData[defaultName] = this.raw[columnName]
        })
        // if action has inverse then add data for it as well
        if (action.inverse) {
            // create entry for inverse
            var inverseData = this.actions[action.inverseName] = {}
            // add inverse data to instance
            _.each(action.inverse.defaultColumns, (defaultName, columnName) => {
                inverseData[defaultName] = this.raw[columnName]
            })
        }
        // if action has an isProperty then set it
        if (action.isProperty) {
            // by default action has not been performed
            this[action.isProperty] = false
            // if action id exists then action was performed
            if (this.raw[action.model.columnName('id')]) {
                this[action.isProperty] = true
            }
            // if action has inverse and its id exists then reverse
            if (action.inverse && this.raw[action.inverse.columnName('id')]) {
                this[action.isProperty] = false
            }
            // add isProperty to properties
            this.properties.push(action.isProperty)
        }
        // if action has a wasProperty the set it
        if (action.wasProperty) {
            // set wasProperty based on whether or not the action id is defined
            this[action.wasProperty] = this.raw[action.inverse.columnName('id')]
                ? true
                : false
            // add wasProperty to properties
            this.properties.push(action.wasProperty)
        }
    })
    // whenever queries are done for non-current records they are join with
    // child records so if childId is not defined then record is current
    this.isCurrent = this.raw.childId ? false : true
    // add isCurrent to properties
    this.properties.push('isCurrent')
}

/**
 * @function inspect
 *
 * generate output for util.inspect used by node.js console.log
 *
 * returns inspect of object with model, raw (database result), and session
 * omitted.
 *
 * @param {integer} depth
 * @param {object} options
 *
 * @returns {string}
 */
function inspect (depth, options) {
    var out = '[immutable.model.'+this.model.name+'] '
    var obj = _.omit(this, ['action', 'current', 'empty', 'init', 'inspect', 'isConflictError', 'model', 'promise', 'session', 'toJSON', 'update', 'updateMeta'])
    return out + util.inspect(obj)
}

/**
 * @function isConflictError
 *
 * return true if argument is error from conflicting revision - i.e. a unique
 * key constraint violation on the parentId column for the instance model
 *
 * @param {Error} err
 *
 * @returns {boolean}
 */
function isConflictError (err) {
    // return false if err is not an object
    if (typeof err !== 'object') {
        return false
    }
    // return false if error does not have mysql duplicate key code
    if (err.code !== 1062) {
        return false
    }
    // return false if duplicate key error is not on parent id column
    if (err.message.indexOf(this.model.columnName('parentId')) === -1) {
        return false
    }
    // if all negative tests pass return true
    return true
}

/**
 * @function toJSON
 *
 * return data that will be serialized by JSON.encode
 *
 * @returns {object}
 */
function toJSON () {
    return _.pick(this, this.properties)
}

/**
 * @function update
 *
 * create and return new revision of object - args will be used as data along
 * with original session
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function update (data) {
    return this.updateMeta({data: data})
}

/**
 * @function updateMeta
 *
 * create and return new revision of object - args data will be merged into
 * existing data.
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function updateMeta (args) {
    // data for new revision
    var data
    // if data was assed in args then merge into existing data - if data
    // is set to null then object will be emptied
    if (args.data !== null) {
        // map of updated firstOnly conlumns
        var updateColumns = {}
        // error that will be returned if set
        var error
        // iterate over extra columns and check firstOnly and immutable
        // conditions
        _.each(this.model.extraColumns, (spec, name) => {
            // if property is immutable do not allow value to change
            if (spec.immutable && args.data[name] !== this.data[name]) {
                error = new Error('[immutable.model.'+this.model.name+'] cannot modify immutable property '+name)
            }
            // if property is set on first insert only and it has changed
            // then add to list to update
            if (spec.firstOnly && args.data[name] !== undefined && args.data[name] !== this.data[name]) {
                // and to map of firstOnly columns to update
                updateColumns[name] = true
            }
        })
        // if error reject
        if (error) {
            return Promise.reject(error)
        }
        // create clone or existing object data to merge update into
        data = _.cloneDeep(this.data)
        // merge update data into existing data
        deepExtend(data, args.data)
    }
    // args for create
    var createArgs = {
        // use accountId from original object unless accountId in args
        accountId: args.accountId || this.accountId,
        // object data
        data: data,
        // set original id from current instance
        originalId: this.originalId,
        // id of this instance is parentId for revision
        parentId: this.id,
        // use session from this instance unless set in args
        session: args.session || this.session,
        // map of firstOnly columns to update
        updateColumns: updateColumns,
        // perform validation
        validate: args.validate,
    }
    debug('createMeta retry', args.retry)
    // attempt to create new instance
    return this.model.createMeta(createArgs)
    // catch errors
    .catch(err => {
        // if force is not set then throw error
        if (!args.force) {
            throw err
        }
        // only force retry on revision conflicts not other errors
        if (!this.isConflictError(err)) {
            throw err
        }
        // should retry now so make sure that retry counter is set
        if (!args.retry) {
            args.retry = 0
        }
        // increment retry counter
        args.retry++
        // do not retry if limit exceeded
        if (args.retry > MAX_RETRY) {
            throw err
        }
        // get current instance
        return this.model.query({
            current: 1,
            limit: 1,
            session: createArgs.session,
            where: {originalId: createArgs.originalId},
        })
        .then(current => {
            // call updateMeta on the current instance with the same args
            // and retry incremented
            return current.updateMeta(args)
        })
    })
}
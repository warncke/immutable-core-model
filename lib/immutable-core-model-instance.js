'use strict'

/* native modules */
const assert = require('assert')
const util = require('util')

/* npm modules */
const _ = require('lodash')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelInstance

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
    empty: empty,
    init: init,
    inspect: inspect,
    toJSON: toJSON,
    update: update,
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
async function action (name, args) {
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
    return model.create(createArgs)
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
 * @function empty
 *
 * empty object data
 *
 * @param {object} args
 *
 * @returns {string}
 */
async function empty (args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // to empty object data must be set to null
    args.data = null
    // use update method to empty
    return this.update(args)
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
    this.raw = args.raw
    this.session = args.session
    // add default properties to instance
    _.each(this.model.defaultColumns, (defaultName, columnName) => {
        this[defaultName] = this.raw[columnName]
    })
    // add action properties to object
    _.each(this.model.actions, (spec, name) => {
        // if action has an isProperty then set it
        if (spec.isProperty) {
            // by default action has not been performed
            this[spec.isProperty] = false
            // if action id exists then action was performed
            if (this.raw[spec.model.columnName('id')]) {
                this[spec.isProperty] = true
            }
            // if action has inverse and its id exists then reverse
            if (spec.inverse && this.raw[spec.inverse.columnName('id')]) {
                this[spec.isProperty] = false
            }
        }
        // if action has been performed then set action data on instance
        if (this[spec.isProperty]) {
            //console.log(this.raw)
            //process.exit()
        }
        // if action has a wasProperty the set it
        if (spec.wasProperty) {
            // set isProperty based on whether or not the action id is defined
            this[spec.wasProperty] = this.raw[spec.inverse.columnName('id')]
                ? true
                : false
        }
    })
}

/**
 * @function inspect
 *
 * generate output for util.inspect used by node.js console.log
 *
 * @param {integer} depth
 * @param {object} options
 *
 * @returns {string}
 */
function inspect (depth, options) {
    return '[immutable.model.'+this.model.name+'] '+util.inspect(this.raw)
}

/**
 * @function toJSON
 *
 * return data that will be serialized by JSON.encode
 *
 * @returns {object}
 */
function toJSON () {
    return this.data
}

/**
 * @function update
 *
 * create and return new revision of object - args data will be merged into
 * existing data.
 *
 * @param {object} args
 *
 * @returns {string}
 */
async function update (args) {
    // data for new revision
    var data
    // if data was assed in args then merge into existing data - if data
    // is set to null then object will be emptied
    if (args.data !== null) {
        // map of updated firstOnly conlumns
        var updateColumns = {}
        // iterate over extra columns and check any unique firstOnly columns
        // to see if data was updated and needs to be inserted
        _.each(this.model.extraColumns, (spec, name) => {
            // skip unless first only
            if (!spec.firstOnly) {
                return
            }
            // check if args value matches current data value
            if (args.data[name] !== undefined && args.data[name] !== this.data[name]) {
                // and to map of firstOnly columns to update
                updateColumns[name] = true
            }
        })
        // create clone or existing object data to merge update into
        data = _.cloneDeep(this.data)
        // merge update data into existing data
        _.merge(data, args.data)
    }
    // create new instance
    return this.model.create({
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
    })
}
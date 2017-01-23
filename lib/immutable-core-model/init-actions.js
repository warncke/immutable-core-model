'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const changeCase = require('change-case')

/* exports */
module.exports = initActions

/* constants */

// default action specification
const defaultActionSpec = {
    inverse: true,
    model: {
        columns: {
            accountId: false,
            data: false,
            originalId: false,
            parentId: false,
        },
        isAction: true,
    },
}

/**
 * @function initActions
 *
 * called by new ImmutableCoreModel to add associated actions
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initActions (args) {
    // dry flag indicating whether the current model is an action or not
    this.isAction = args.isAction ? true : false
    // if the model being created is an action then it cannot have actions
    if (this.isAction) {
        // set isInverse flag
        this.isInverse = args.isInverse ? true : false
        // add associated action
        this.action = args.action
        // if model is an action then it must belong to parent model
        assert.equal(typeof args.model, 'object', 'action must have model')
        // store parent model - database will be used for queries
        this.model = args.model
        // do no initialize actions for an action model
        return
    }
    // map of actions by action name
    this.actions = {}
    // map of actions by isProperty
    this.actionIsProperties = {}
    // map of action models by name - includes both actions and inverse
    this.actionModels = {}
    // iterate over actions specified in args and add them
    _.each(args.actions, (spec, name) => {
        // create new action with specified name based on default spec
        var action = this.actions[name] = _.cloneDeep(defaultActionSpec)
        // if the spec is an object that merge options over defaults
        if (typeof spec === 'object') {
            _.merge(action, spec)
        }
        // otherwise evaluate spec as a boolean that determines whether or not
        // to create an inverse of the object
        else {
            action.inverse = spec ? true : false
        }
        // set name for action model if not set
        if (!action.model.name) {
            // default is name of parent model with upper case action name
            action.model.name = this.name+changeCase.pascalCase(name)
        }
        // set name for property that shows if action has been performed
        if (!action.isProperty) {
            // default is: isActioned e.g. isDeleted isPublished
            action.isProperty = 'is'+changeCase.pascalCase(name)
                // if name ends in e then add d otherwise add ed
                + (name.match(/e$/) ? 'd' : 'ed')
        }
        // action isProperties must not conflict with column names
        assert.ok(!this.columns[action.isProperty], action.isProperty+' action conflicts with column')
        // add is property to map
        this.actionIsProperties[action.isProperty] = action
        // set name for property that shows if action was reverse
        if (!action.wasProperty && action.inverse) {
            // default was: wasActioned e.g. wasDeleted wasPublished
            action.wasProperty = 'was'+changeCase.pascalCase(name)
                // if name ends in e then add d otherwise add ed
                + (name.match(/e$/) ? 'd' : 'ed')
        }
        // for the delete action the default is to not select deleted records
        if (name === 'delete' && action.defaultWhere !== true && action.defaultWhere !== null) {
            action.defaultWhere = false
        }
        // get id column for parent model
        var parentIdColumn = this.columnName('id')
        // set parent id as column on action model
        var parentColumn = action.model.columns[parentIdColumn] = {type: 'id'}
        // if the action can only be performed once then parent column
        // should have a unique index
        if (args.once) {
            parentColumn.unique = true
        }
        // otherwise parent column should have non-unique index
        else {
            // TODO: implement multiple actions
            // parentColumn.index = true
            parentColumn.unique = true
        }
        // add action reference to model
        action.model.action = action
        // add parent model to args for action mode
        action.model.model = this
        // create model for action
        this.actionModels[name] = action.model = this.new(action.model)
        // if inverse is true then initialize inverse specification
        if (action.inverse) {
            // set model for inverse to default action model
            action.inverse = _.cloneDeep(defaultActionSpec.model)
            // if inverse options where set in args then merge over default
            if (typeof spec === 'object' && typeof spec.inverse === 'object') {
                _.merge(action.inverse, spec.inverse)
            }
            // set name for inverse
            if (!action.inverseName) {
                action.inverseName = 'un'+changeCase.pascalCase(name)
            }
            // set name for inverse model
            if (!action.inverse.name) {
                // default is parent model name with Un + action name added
                // e.g. fooUnDelete
                action.inverse.name = this.name+changeCase.pascalCase(action.inverseName)
            }
            // set isInverse flag on action
            action.inverse.isInverse = true
            // get id column for action
            var actionIdColumn = action.model.columnName('id')
            // create column for action id on the inverse table
            action.inverse.columns[actionIdColumn] = {
                type: 'id',
                // only allow action to be inverted once
                unique: true,
            }
            // add parent action to inverse
            action.inverse.action = action
            // add parent model to args for action model
            action.inverse.model = this
            // create model for inverse
            this.actionModels[action.inverseName] = action.inverse = this.new(action.inverse)
        }

    })
}
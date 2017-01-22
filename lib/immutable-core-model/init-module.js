'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const debug = require('debug')('immutable-core-model')

/* application modules */
const immutable = require('immutable-core')

/* exports */
module.exports = initModule

/**
 * @function initModule
 *
 * called by new ImmutableCoreModel to create module and set options
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initModule (args) {
    debug('new ImmutableCoreModel', args)
    // require object for args
    assert.equal(typeof args, 'object', 'argument must be object')
    // require name for model
    assert.equal(typeof args.name, 'string', 'name required')
    // set model name
    this.name = args.name
    // module name is model name with Model appended
    this.moduleName = args.name+'Model'
    // create new immutable module for model - this will throw error
    // if moduleName is already defined
    this.module = immutable.module(this.moduleName, {})
    // default compression to true
    this.compression = args.compression === false ? false : true
    // database connection object
    this.databaseObj = undefined
    // set to true if model is an action for another model
    this.isAction = false
    // parent model for action models
    this.model = undefined
    // set database connection if passed in args
    if (args.database) {
        this.database(args.database)
    }
}
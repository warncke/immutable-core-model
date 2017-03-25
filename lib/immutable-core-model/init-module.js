'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const changeCase = require('change-case')
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
    // create title from name
    this.title = changeCase.titleCase(this.name)
    // create path from name
    this.path = changeCase.paramCase(this.name)
    // module name is model name with Model appended
    this.moduleName = args.name+'Model'
    // create new immutable module for model - this will throw error
    // if moduleName is already defined
    this.module = immutable.module(this.moduleName, {})
    // get module meta data
    var meta = this.module.meta()
    // add info to module meta
    meta.class = 'ImmutableCoreModel'
    meta.instance = this
    // default compression to true
    this.compression = args.compression === undefined
        // use global default if flag not set
        ? this.global().defaultCompression
        // convert arg to boolean
        : !!args.compression
    // database connection object
    this.databaseObj = undefined
    // charset to use when creating table - this only applies when mode is
    // first syncd and will not be changed
    this.charset = args.charset || this.global().defaultCharset
    // database engine to use when creating table - this only applies when model
    // is first syncd and will not be changed
    this.engine = args.engine || this.global().defaultEngine
    // set to true if model is an action for another model
    this.isAction = false
    // parent model for action models
    this.model = undefined
    // controller object will be set when controller created for model
    this.controller = undefined
    // set database connection if passed in args
    if (args.database) {
        this.database(args.database)
    }
}
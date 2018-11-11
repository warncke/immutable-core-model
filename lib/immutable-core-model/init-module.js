'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const changeCase = require('change-case')
const debug = require('debug')('immutable-core-model')
const defined = require('if-defined')
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
    // add info to module meta
    this.module.meta.class = 'ImmutableCoreModel'
    this.module.meta.instance = this
    // and model to global registers
    this.global().models[this.name] = this
    // set to true if model is an action for another model
    this.isAction = false
    // parent model for action models
    this.model = undefined
    // controller object will be set when controller created for model
    this.controller = undefined
    // transformation functions keyed by property name
    this.transform = {}
    // get transform functions from args
    _.each(args.transform, (transform, property) => {
        // require function
        assert.equal(typeof transform, 'function', `tranform must be function for ${this.name} ${property}`)
        // set transform function
        this.transform[property] = transform
    })

    /* cache */

    if (defined(args.redis)) {
        this.redis(args.redis)
    }

    /* database */

    // database is now deprecated so this will throw error
    if (defined(args.database)) {
        this.database(args.database)
    }

    /* binaryIds */

    // use setting from env if set
    if (defined(process.env.DEFAULT_BINARY_IDS)) {
        this.binaryIds = process.env.DEFAULT_BINARY_IDS === 'true' || process.env.DEFAULT_BINARY_IDS === '1' ? true : false
    }
    // use binary ids setting for model if set
    else if (defined(args.binaryIds)) {
        this.binaryIds = !!args.binaryIds
    }
    // use global setting
    else {
        this.binaryIds = this.global().defaultBinaryIds
    }

    /* compression */

    // use setting from env
    if (defined(process.env.DEFAULT_COMPRESSION)) {
        this.compression = process.env.DEFAULT_COMPRESSION === 'true' || process.env.DEFAULT_COMPRESSION === '0' ? true : false
    }
    // use compresion setting for model if set
    else if (defined(args.compression)) {
        this.compression = !!args.compression
    }
    // use global setting
    else {
        this.compression = this.global().defaultCompression
    }

    /* insert delayed */

    // use insert delayed setting for model if set
    if (args.insertDelayed !== undefined) {
        this.insertDelayed = args.insertDelayed
    }
    // use global setting
    else if (process.env.DEFAULT_INSERT_DELAYED) {
        this.insertDelayed = process.env.DEFAULT_INSERT_DELAYED === 'true' ? true : false
    }
    // use global setting
    else {
        this.insertDelayed = this.global().insertDelayed
    }

    /* concurrency */

    // use concurrency setting from args if set
    if (parseInt(args.concurrency)) {
        this.concurrency = parseInt(args.concurrency)
    }
    // use global setting
    else {
        this.concurrency = this.global().concurrency
    }

    /* charset */

    // charset to use when creating table - this only applies when mode is
    // first syncd and will not be changed
    this.charset = args.charset || process.env.DEFAULT_CHARSET || this.global().defaultCharset

    /* database engine */

    // database engine to use when creating table - this only applies when model
    // is first syncd and will not be changed
    this.engine = args.engine || process.env.DEFAULT_ENGINE || this.global().defaultEngine

    /* elasticsearch configuration */

    // if elasticsearch is true then client will be set later and is required
    if (args.elasticsearch === true) {
        this.elasticsearchClient = true
    }
    // set elasticsearch client
    else if (args.elasticsearch) {
        this.elasticsearch(args.elasticsearch)
    }
    else {
        this.elasticsearchClient = null
    }
    // retain deleted records - default false
    this.esDeleted = !!args.esDeleted
    // set index name - default to model path
    this.esIndex = args.esIndex || this.path
    // set type selector - if not defined model name will also be used for type
    this.esType = args.esType

    /* mysql */

    if (defined(args.mysql)) {
        this.mysql(args.mysql)
    }
    else {
        this.mysqlClient = null
    }
}
'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const changeCase = require('change-case')
const debug = require('debug')('immutable-core-model')
const defined = require('if-defined')
const immutable = require('immutable-core')

/* application modules */
const ImmutableCoreModelCache = require('../immutable-core-model-cache')

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

    /* cache configuration */

    if (args.redis) {
        // promisify redis if not already promisified
        if (!defined(args.redis.mgetAsync)) {
            throw new Error('redis must be promisified')
        }
        // create new cache instance
        this.cache = new ImmutableCoreModelCache({
            model: this,
            redis: args.redis,
        })
    }

    /* database configuration */

    // database client object
    this.databaseClient = undefined
    // set database client if passed in args
    if (args.database) {
        this.database(args.database)
    }
    // use compresion setting for model if set
    if (args.compression !== undefined) {
        this.compression = !!args.compression
    }
    // use setting from env
    else if (process.env.DEFAULT_COMPRESSION) {
        this.compression = process.env.DEFAULT_COMPRESSION === 'true' ? true : false
    }
    // use global setting
    else {
        this.compression = this.global().defaultCompression
    }
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
    // use concurrency setting from args if set
    if (parseInt(args.concurrency)) {
        this.concurrency = parseInt(args.concurrency)
    }
    // use global setting
    else {
        this.concurrency = this.global().concurrency
    }

    // charset to use when creating table - this only applies when mode is
    // first syncd and will not be changed
    this.charset = args.charset || process.env.DEFAULT_CHARSET || this.global().defaultCharset
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
    // retain deleted records - default false
    this.esDeleted = !!args.esDeleted
    // set index name - default to model path
    this.esIndex = args.esIndex || this.path
    // set type selector - if not defined model name will also be used for type
    this.esType = args.esType
}
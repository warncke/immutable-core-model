'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

/* application modules */
const ImmutableAI = require('immutable-ai')
const ImmutableCoreModelRecord = require('./immutable-core-model-record')
const ImmutableCoreModelLocal = require('./immutable-core-model-local')
const createSecondary = require('./immutable-core-model/create-secondary')
const dataModule = require('./immutable-core-model/data-module')
const defined = require('if-defined')
const initAccessControl = require('./immutable-core-model/init-access-control')
const initActions = require('./immutable-core-model/init-actions')
const initColumns = require('./immutable-core-model/init-columns')
const initCreate = require('./immutable-core-model/init-create')
const initGlobal = require('./immutable-core-model/init-global')
const initIndexes = require('./immutable-core-model/init-indexes')
const initJsonSchema = require('./immutable-core-model/init-json-schema')
const initModule = require('./immutable-core-model/init-module')
const initRelations = require('./immutable-core-model/init-relations')
const initQuery = require('./immutable-core-model/init-query')
const initViews = require('./immutable-core-model/init-views')
const relation = require('./immutable-core-model/relation')
const schema = require('./immutable-core-model/schema')
const search = require('./immutable-core-model/search')
const sql = require('./sql')
const syncModule = require('./immutable-core-model/sync-module')
const validate = require('./immutable-core-model/validate')

/* exports */
module.exports = ImmutableCoreModel

/**
 * @function ImmutableCoreModel
 *
 * create a new model instance
 *
 * @param {object} args
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function ImmutableCoreModel (args) {
    // store copy of original args
    this.args = _.cloneDeep(args)
    // initialize global data
    this.initGlobal(args)
    // create module and set options
    this.initModule(args)
    // initialize column spec for model
    this.initColumns(args)
    // initialize multi-column indexes
    this.initIndexes(args)
    // create and validate JSON schema
    this.initJsonSchema(args)
    // add create method to module
    this.initCreate(args)
    // add query method to module
    this.initQuery(args)
    // add associated actions
    this.initActions(args)
    // initialize any model views
    this.initViews(args)
    // initialize related models
    this.initRelations(args)
    // initialize access control
    this.initAccessControl(args)
}

/* public functions */
ImmutableCoreModel.prototype = {
    // local
    columnName: columnName,
    database: database,
    elasticsearch: elasticsearch,
    getModel: getModel,
    global: getGlobal,
    hasModel: hasModel,
    new: newModel,
    newInstance: newInstance,
    session: session,
    // createSecondary
    createSecondary: createSecondary,
    // data module
    decodeData: dataModule.decodeData,
    encodeData: dataModule.encodeData,
    // init modules
    initAccessControl: initAccessControl,
    initActions: initActions,
    initColumns: initColumns,
    initCreate: initCreate,
    initGlobal: initGlobal,
    initIndexes: initIndexes,
    initJsonSchema: initJsonSchema,
    initModule: initModule,
    initRelations: initRelations,
    initQuery: initQuery,
    initViews: initViews,
    // relation
    relation: relation,
    // schema
    schema: schema,
    // search
    search: search,
    // sync module
    alterColumn: syncModule.alterColumn,
    alterTable: syncModule.alterTable,
    createColumn: syncModule.createColumn,
    createElasticsearchIndex: syncModule.createElasticsearchIndex,
    createTable: syncModule.createTable,
    sync: syncModule.sync,
    // validate
    validate: validate,
    // class properties
    class: 'ImmutableCoreModel',
    ImmutableCoreModel: true,
}

// initialize ImmutableAI with ImmutableCoreModel instance
ImmutableAI.immutableCoreModel(ImmutableCoreModel)

/**
 * @function reset
 *
 * reset global data
 *
 * @returns {ImmutableCoreModel}
 */
ImmutableCoreModel.reset = function () {
    // clear existing global data
    global.__immutable_core_model__ = undefined
    // reinitialize global data
    initGlobal()
}

// method to set default charset
ImmutableCoreModel.defaultCharset = defaultCharset
// method to set default database engine
ImmutableCoreModel.defaultEngine = defaultEngine
// method to set default insert delayed setting
ImmutableCoreModel.defaultInsertDelayed = defaultInsertDelayed
// get/set global elasticsearch client
ImmutableCoreModel.elasticsearchGlobal = elasticsearchGlobal
// return global data
ImmutableCoreModel.global = getGlobal
// check if model exists
ImmutableCoreModel.hasModel = hasModel
// get model by name
ImmutableCoreModel.model = getModel
// get all models
ImmutableCoreModel.models = getModels

/**
 * @function columnName
 *
 * get correct column name from alias (e.g. id => fooId) - return undefined or
 * throw error if column name does not exist
 *
 * @param {string} columnName
 * @param {boolean} throwError
 *
 * @returns {undefined|string}
 *
 * @throws {Error}
 */
function columnName (columnName, throwError) {
    // if column name exists return
    if (this.columns[columnName]) {
        return columnName
    }
    // if column name is alias the return full column name
    if (this.defaultColumnsInverse[columnName]) {
        return this.defaultColumnsInverse[columnName]
    }
    // column name does not exist - throw error if flag set
    if (throwError) {
        throw new Error('no column '+columnName)
    }
}

/**
 * @function database
 *
 * get/set database connection to be used for model queries
 *
 * @param {object} database
 *
 * @returns {ImmutableCoreModel}
 *
 * @throws {Error}
 */
function database (database) {
    // set database if passed in
    if (defined(database)) {
        // do not allow setting database on action model
        if (this.isAction) {
            throw new Error('cannot set database on action model')
        }
        // validate database object
        requireValidDatabase(database)
        // store database
        this.databaseClient = database
    }
    // get database either from local instance or parent model
    var databaseClient = this.isAction
        ? this.model.databaseClient
        : this.databaseClient
    // throw error if database not defined
    assert.ok(databaseClient, 'database required')
    // return database connection object
    return databaseClient
}

/**
 * @function defaultCharset
 *
 * get/set global default charset used when creating tables
 *
 * @param {string|undefined} charset
 *
 * @returns {ImmutableCoreModel|string}
 */
function defaultCharset (charset) {
    // set charset
    if (defined(charset)) {
        getGlobal().defaultCharset = charset
        // return class when setting
        return ImmutableCoreModel
    }
    // return engine
    return getGlobal().defaultCharset
}

/**
 * @function defaultEngine
 *
 * get/set global default database engine used when creating tables
 *
 * @param {string|undefined} engine
 *
 * @returns {ImmutableCoreModel|string}
 */
function defaultEngine (engine) {
    // set engine
    if (defined(engine)) {
        getGlobal().defaultEngine = engine
        // return class when setting
        return ImmutableCoreModel
    }
    // return engine
    return getGlobal().defaultEngine
}

/**
 * @function defaultInsertDelayed
 *
 * get/set global default insert delayed setting for MyISAM tables
 *
 * @param {string|undefined} insertDelayed
 *
 * @returns {ImmutableCoreModel|string}
 */
function defaultInsertDelayed (insertDelayed) {
    // set insertDelayed
    if (defined(insertDelayed)) {
        getGlobal().defaultInsertDelayed = !!insertDelayed
        // return class when setting
        return ImmutableCoreModel
    }
    // return insertDelayed
    return getGlobal().defaultInsertDelayed
}

/**
 * @function elasticsearch
 *
 * get/set the elasticsearch client for a model
 *
 * @param {object|undefined} elasticsearchClient
 *
 * @returns {boolean|object}
 *
 * @throws {Error}
 */
function elasticsearch (elasticsearchClient) {
    // set client if passed
    if (defined(elasticsearchClient)) {
        // set client on model - throws error on invalid client
        this.elasticsearchClient = requireValidElasticsearchClient(elasticsearchClient)
        // return model when setting value
        return this
    }
    // return client if nothing passed
    else {
        // if client is set to true then check if global client exists
        if (this.elasticsearchClient === true) {
            // get global client if set
            var elasticsearchGlobal = ImmutableCoreModel.elasticsearchGlobal()
            // require client to be set
            assert.ok(elasticsearchGlobal, 'elasticsearch required for '+this.name)
            // if global client is set then set it locally
            this.elasticsearchClient = elasticsearchGlobal
        }
        // return current client setting
        return this.elasticsearchClient
    }
}

/**
 * @function elasticsearchGlobal
 *
 * get/set the elasticsearch global client. returns class instance when
 * setting client or client when called with undefined.
 *
 * @param {object|undefined} elasticsearchClient
 *
 * @returns {ImmutableCoreModel|boolean|object}
 */
function elasticsearchGlobal (elasticsearchClient) {
    // set client
    if (defined(elasticsearchClient)) {
        // set global client - throws error on invalid client
        ImmutableCoreModel.global().defaultElasticsearchClient = requireValidElasticsearchClient(elasticsearchClient)
        // return model when setting value
        return ImmutableCoreModel
    }
    else {
        return ImmutableCoreModel.global().defaultElasticsearchClient
    }
}

/**
 * @function getGlobal
 *
 * return global data object
 *
 * @returns {object}
 */
function getGlobal () {
    return global.__immutable_core_model__
}

/**
 * @function getModel
 *
 * get model by name. throws error if model not defined.
 *
 * @param {string} name
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function getModel (name) {
    // get global models register
    var models = getGlobal().models
    // require model to be defined
    assert.ok(defined(models[name]), 'model not found '+name)
    // return model
    return models[name]
}

/**
 * @function getModels
 *
 * get all models indexed by name.
 *
 * @returns {object}
 */
function getModels (name) {
    // return global models register
    return getGlobal().models
}

/**
 * @function hasModel
 *
 * return true if model exists.
 *
 * @param {string} name
 *
 * @returns {boolean}
 */
function hasModel (name) {
    // get global models register
    var models = getGlobal().models
    // return true if model exists
    return defined(models[name])
}

/**
 * @function newInstance
 *
 * instantiate a new ImmutableCoreModelRecord
 *
 * @param {object} args
 *
 * @returns {ImmutableCoreModelRecord}
 */
function newInstance (args) {
    return new ImmutableCoreModelRecord(args)
}


/**
 * @function newModel
 *
 * instantiate a new ImmutableCoreModel
 *
 * @param {object} args
 *
 * @returns {ImmutableCoreModel}
 */
function newModel (args) {
    return new ImmutableCoreModel(args)
}

/**
 * @function session
 *
 * return a new local instance of model that provides the create, query, and
 * select methods. When these methods are called the provided session will be
 * used as the session for database queries unless passed in the args for the
 * call.
 *
 * @param {object} session
 *
 * @returns {object}
 */
function session (session) {
    // create new object with proxied functions - this may be better to do
    // with native proxies
    return new ImmutableCoreModelLocal({
        model: this,
        session: session,
    })
}

/**
 * @function requireValidDatabase
 *
 * validate database client argument
 *
 * @param {object} database
 *
 * @returns {object}
 *
 * @throws {Error}
 */

function requireValidDatabase (database) {
    // throw error on invalid database client
    assert.equal(typeof database, 'object', 'database must be object')
    assert.equal(typeof database.query, 'function', 'database must have query method')
    // return validated database
    return database
}

/**
 * @function requireValidElasticsearchClient
 *
 * validate elasticsearch client
 *
 * @param {object} elasticsearchClient
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function requireValidElasticsearchClient (elasticsearchClient) {
    // validate client
    assert.ok(typeof elasticsearchClient === 'object', 'object required for elasticsearch')
    assert.ok(typeof elasticsearchClient.delete === 'function', 'delete method required for elasticsearch')
    assert.ok(typeof elasticsearchClient.create === 'function', 'index method required for elasticsearch')
    assert.ok(typeof elasticsearchClient.search === 'function', 'search method required for elasticsearch')
    assert.ok(typeof elasticsearchClient.indices === 'object', 'indices object required for elasticsearch')
    assert.ok(typeof elasticsearchClient.indices.create === 'function', 'indices.create method required for elasticsearch')
    // return validated client
    return elasticsearchClient
}
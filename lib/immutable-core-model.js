'use strict'

/* native modules */
const assert = require('assert')
const _ = require('lodash')

/* application modules */
const ImmutableCoreModelLocal = require('./immutable-core-model-local')
const dataModule = require('./immutable-core-model/data-module')
const initActions = require('./immutable-core-model/init-actions')
const initColumns = require('./immutable-core-model/init-columns')
const initCreate = require('./immutable-core-model/init-create')
const initGlobal = require('./immutable-core-model/init-global')
const initIndexes = require('./immutable-core-model/init-indexes')
const initJsonSchema = require('./immutable-core-model/init-json-schema')
const initModule = require('./immutable-core-model/init-module')
const initNewInstance = require('./immutable-core-model/init-new-instance')
const initRelations = require('./immutable-core-model/init-relations')
const initQuery = require('./immutable-core-model/init-query')
const initViews = require('./immutable-core-model/init-views')
const relation = require('./immutable-core-model/relation')
const schema = require('./immutable-core-model/schema')
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
    // create and add newInstance method
    this.initNewInstance(args)
    // initialize any model views
    this.initViews(args)
    // initialize related models
    this.initRelations(args)
}

/* public functions */
ImmutableCoreModel.prototype = {
    // local
    columnName: columnName,
    database: database,
    global: getGlobal,
    new: newModel,
    session: session,
    // data-module
    decodeData: dataModule.decodeData,
    encodeData: dataModule.encodeData,
    // init modules
    initActions: initActions,
    initColumns: initColumns,
    initCreate: initCreate,
    initGlobal: initGlobal,
    initIndexes: initIndexes,
    initJsonSchema: initJsonSchema,
    initModule: initModule,
    initNewInstance: initNewInstance,
    initRelations: initRelations,
    initQuery: initQuery,
    initViews: initViews,
    // relation
    relation: relation,
    // schema
    schema: schema,
    // sync-module
    alterColumn: syncModule.alterColumn,
    alterTable: syncModule.alterTable,
    createColumn: syncModule.createColumn,
    createTable: syncModule.createTable,
    sync: syncModule.sync,
    // validate
    validate: validate,
}

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

// list of properties object must have to look like ImmutableCoreModel
const looksLikeProperties = {
    // properties
    name: 'string',
    moduleName: 'string',
    // methods
    columnName: 'function',
    database: 'function',
    createMeta: 'function',
    query: 'function',
    session: 'function',
}

// method to check if object looks like ImmutableCoreModel
ImmutableCoreModel.looksLike = looksLike

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
    if (database !== undefined) {
        // do not allow setting database on action model
        if (this.isAction) {
            throw new Error('cannot set database on action model')
        }
        // validate database object
        requireValidDatabase(database)
        // store database
        this.databaseObj = database
    }
    // get database either from local instance or parent model
    var databaseObj = this.isAction ? this.model.databaseObj : this.databaseObj
    // throw error if database not defined
    assert.ok(databaseObj, 'database required')
    // return database connection object
    return databaseObj
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
 * @function looksLike
 *
 * check if object looks like ImmutableCoreObject based on properties
 *
 * @returns {boolean}
 */
function looksLike (obj) {
    // require object
    if (typeof obj !== 'object') {
        return false
    }
    // flag will be set false if any properties do not match
    var looksLike = true
    // check each property
    _.each(looksLikeProperties, (type, name) => {
        // check if property matches
        if (looksLike && typeof obj[name] !== type) {
            looksLike = false
        }
    })
    // return result
    return looksLike
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
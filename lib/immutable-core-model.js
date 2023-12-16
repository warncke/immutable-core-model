'use strict'

/* npm modules */
const ImmutableAI = require('immutable-ai')
const MySQL2 = require('mysql2/promise')
const _ = require('lodash')
const defined = require('if-defined')

/* application modules */
const ImmutableCoreModelCache = require('./immutable-core-model-cache')
const ImmutableCoreModelRecord = require('./immutable-core-model-record')
const ImmutableCoreModelLocal = require('./immutable-core-model-local')
const createSecondary = require('./immutable-core-model/create-secondary')
const dataModule = require('./immutable-core-model/data-module')
const initAccessControl = require('./immutable-core-model/init-access-control')
const initActions = require('./immutable-core-model/init-actions')
const initColumns = require('./immutable-core-model/init-columns')
const initCreate = require('./immutable-core-model/init-create')
const initGlobal = require('./immutable-core-model/init-global')
const initIds = require('./immutable-core-model/init-ids')
const initIndexes = require('./immutable-core-model/init-indexes')
const initJsonSchema = require('./immutable-core-model/init-json-schema')
const initModule = require('./immutable-core-model/init-module')
const initRelations = require('./immutable-core-model/init-relations')
const initQuery = require('./immutable-core-model/init-query')
const initViews = require('./immutable-core-model/init-views')
const maxRecordNumber = require('./immutable-core-model/max-record-number')
const relation = require('./immutable-core-model/relation')
const schema = require('./immutable-core-model/schema')
const search = require('./immutable-core-model/search')
const sql = require('./sql')
const syncModule = require('./immutable-core-model/sync-module')
const validateModule = require('./immutable-core-model/validate-module')

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
    // create columnsId
    this.initIds()
}

/* public methods */
ImmutableCoreModel.prototype = {
    // local
    assert: assert,
    columnName: columnName,
    database: database,
    opensearch: opensearch,
    error: error,
    getModel: getModel,
    global: getGlobal,
    hasModel: hasModel,
    mysql: mysql,
    new: newModel,
    newInstance: newInstance,
    redis: redis,
    requireValidMysqlClient: requireValidMysqlClient,
    requireValidOpensearchClient: requireValidOpensearchClient,
    session: session,
    // imported methods
    alterColumn: syncModule.alterColumn,
    alterTable: syncModule.alterTable,
    createColumn: syncModule.createColumn,
    createOpensearchIndex: syncModule.createOpensearchIndex,
    createSecondary: createSecondary,
    createTable: syncModule.createTable,
    decodeData: dataModule.decodeData,
    encodeData: dataModule.encodeData,
    initAccessControl: initAccessControl,
    initActions: initActions,
    initColumns: initColumns,
    initCreate: initCreate,
    initGlobal: initGlobal,
    initIds: initIds,
    initIndexes: initIndexes,
    initJsonSchema: initJsonSchema,
    initModule: initModule,
    initRelations: initRelations,
    initQuery: initQuery,
    initViews: initViews,
    maxRecordNumber: maxRecordNumber,
    relation: relation,
    schema: schema,
    search: search,
    sync: syncModule.sync,
    validate: validateModule.validate,
    validateData: validateModule.validateData,
    validateDeleted: validateModule.validateDeleted,
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
    // return class
    return ImmutableCoreModel
}

// create new mysql2 connection with default connection params
ImmutableCoreModel.createMysqlConnection = createMysqlConnection
// get/set default binaryIds value
ImmutableCoreModel.defaultBinaryIds = defaultBinaryIds
// get/set default charset
ImmutableCoreModel.defaultCharset = defaultCharset
// get/set default compression value
ImmutableCoreModel.defaultCompression = defaultCompression
// get/set default database engine
ImmutableCoreModel.defaultEngine = defaultEngine
// get/set default insert delayed setting
ImmutableCoreModel.defaultInsertDelayed = defaultInsertDelayed
// get/set global opensearch client
ImmutableCoreModel.opensearchGlobal = opensearchGlobal
// return global data
ImmutableCoreModel.global = getGlobal
// check if model exists
ImmutableCoreModel.hasModel = hasModel
// get model by name
ImmutableCoreModel.model = getModel
// get all models
ImmutableCoreModel.models = getModels

/**
 * @function assert
 *
 * throw error if value is not true
 *
 * @param {boolean} assertValue
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @throws {Error}
 */
function assert (assertValue, message, err) {
    if (!assertValue) {
        throw defined(this) ? this.error(message, err) : error(message, err)
    }
}

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
    if (defined(this.columns[columnName])) {
        return columnName
    }
    // if column name is alias the return full column name
    else if (defined(this.defaultColumnsInverse[columnName])) {
        return this.defaultColumnsInverse[columnName]
    }
    // column name does not exist - throw error if flag set
    else if (throwError) {
        throw new Error('no column '+columnName)
    }
}

/**
 * @function createMysqlConnection
 *
 * create new mysql2 connection with default connection params
 *
 * @param {object} connectionParams
 *
 * @returns {Promise<Connection>}
 */
async function createMysqlConnection (connectionParams) {
    // set required defaults 
    connectionParams = _.merge(connectionParams, {
        bigNumberStrings: true,
        dateStrings: true,
        namedPlaceholders: true,
        rowsAsArray: false,
        supportBigNumbers: true,
    })

    return defined(connectionParams.connectionLimit)
        ? MySQL2.createPool(connectionParams)
        : MySQL2.createConnection(connectionParams)
}

/**
 * @function database
 *
 * database is deprecated.
 *
 * @param {object} database
 *
 * @returns {ImmutableCoreModel}
 *
 * @throws {Error}
 */
function database (database) {
    throw new Error('database is deprecated - use mysql instead')
}

/**
 * @function defaultBinaryIds
 *
 * get/set global default for binaryIds setting
 *
 * @param {boolean|undefined} binaryIds
 *
 * @returns {ImmutableCoreModel|boolean}
 */
function defaultBinaryIds (binaryIds) {
    // set binaryIds
    if (defined(binaryIds)) {
        getGlobal().defaultBinaryIds = !!binaryIds
        // return class when setting
        return ImmutableCoreModel
    }
    // return default binaryIds
    return getGlobal().defaultBinaryIds
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
 * @function defaultCompression
 *
 * get/set global default for compression setting
 *
 * @param {boolean|undefined} binaryIds
 *
 * @returns {ImmutableCoreModel|boolean}
 */
function defaultCompression (compression) {
    // set binaryIds
    if (defined(compression)) {
        getGlobal().defaultCompression = !!compression
        // return class when setting
        return ImmutableCoreModel
    }
    // return default compression
    return getGlobal().defaultCompression
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
 * @function opensearch
 *
 * get/set the opensearch client for a model
 *
 * @param {object|undefined} opensearchClient
 *
 * @returns {boolean|object}
 *
 * @throws {Error}
 */
function opensearch (opensearchClient) {
    // set client if passed
    if (defined(opensearchClient)) {
        // set client on model - throws error on invalid client
        this.opensearchClient = this.requireValidOpensearchClient(opensearchClient)
        // return model when setting value
        return this
    }
    // if client is set to true then check if global client exists
    if (this.opensearchClient === true) {
        // if global client is set then set it locally
        this.opensearchClient = this.requireValidOpensearchClient(ImmutableCoreModel.opensearchGlobal())
    }
    // return current client setting
    return this.opensearchClient
}

/**
 * @function opensearchGlobal
 *
 * get/set the opensearch global client. returns class instance when
 * setting client or client when called with undefined.
 *
 * @param {object|undefined} opensearchClient
 *
 * @returns {ImmutableCoreModel|boolean|object}
 */
function opensearchGlobal (opensearchClient) {
    // set client
    if (defined(opensearchClient)) {
        // set global client
        ImmutableCoreModel.global().defaultOpensearchClient =  opensearchClient
        // return model when setting value
        return ImmutableCoreModel
    }
    else {
        return ImmutableCoreModel.global().defaultOpensearchClient
    }
}

/**
 * @function error
 *
 * create/update error object with query data
 *
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @returns {Error}
 */
function error (message, error) {
    // get model name
    var modelName = defined(this) && defined(this.name) ? this.name : 'ImmutableCoreModel'
    // build custom error message
    message = `${modelName} error` + (
        typeof message === 'string'
            ? `: ${message}`
            : ''
    )
    // use error object passed in
    if (defined(error)) {
        // create data object with original message
        error.data = {
            error: {
                code: error.code,
                message: error.message,
            },
        }
    }
    // create new error message
    else {
        error = new Error(message)
        error.data = {}
    }

    return error
}

/**
 * @function getGlobal
 *
 * return global data object
 *
 * @returns {object}
 */
function getGlobal () {
    if (!global.__immutable_core_model__) {
        initGlobal()
    }
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
    assert(defined(models[name]), `${name} not defined`)
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
 * @function mysql
 *
 * get/set mysql connection
 *
 * @param {Connection|undefined} mysqlClient
 *
 * @returns {ImmutableCoreModel|Connection}
 *
 * @throws {Error}
 */
function mysql (mysqlClient) {
    // set client if passed
    if (defined(mysqlClient)) {
        // set client on model - throws error on invalid client
        this.mysqlClient = this.requireValidMysqlClient(mysqlClient)
        // return model when setting value
        return this
    }
    // return current client setting
    return this.mysqlClient
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
 * @function redis
 *
 * set redis cache client
 *
 * @param {object} redis
 *
 * @returns {ImmutableCoreModel}
 */
function redis (redis) {
    // redis is being set
    if (defined(redis)) {
        // create new cache instance
        this.cache = new ImmutableCoreModelCache({
            model: this,
            redis: redis,
        })
        // return model on set
        return this
    }
    // get existing redis client if any
    else if (defined(this.cache)) {
        return this.cache.redis
    }
}

/**
 * @function requireValidMysqlClient
 *
 * validate mysql client argument
 *
 * @param {object} mysql
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function requireValidMysqlClient (mysql) {
    // throw error on invalid mysql client
    this.assert(typeof mysql === 'object', 'mysql must be object')
    this.assert(typeof mysql.query === 'function', 'mysql must have query method')
    // return validated mysql client
    return mysql
}

/**
 * @function requireValidOpensearchClient
 *
 * validate opensearch client
 *
 * @param {object} opensearchClient
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function requireValidOpensearchClient (opensearchClient) {
    // validate client
    this.assert(typeof opensearchClient === 'object', 'opensearch required')
    this.assert(typeof opensearchClient.delete === 'function', 'delete method required for opensearch')
    this.assert(typeof opensearchClient.create === 'function', 'index method required for opensearch')
    this.assert(typeof opensearchClient.search === 'function', 'search method required for opensearch')
    this.assert(typeof opensearchClient.indices === 'object', 'indices object required for opensearch')
    this.assert(typeof opensearchClient.indices.create === 'function', 'indices.create method required for opensearch')
    // return validated client
    return opensearchClient
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
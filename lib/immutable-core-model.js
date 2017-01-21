'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const ImmutableCoreModelLocal = require('./immutable-core-model-local')
const Promise = require('bluebird')
const _ = require('lodash')
const changeCase = require('change-case')
const debug = require('debug')('immutable-core-model')
const deepEqual = require('deep-equal')
const immutable = require('immutable-core')
const jsonStableStringify = require('json-stable-stringify')
const microTimestamp = require('micro-timestamp')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')
const snappy = require('snappy')
const stableId = require('stable-id')

/* application modules */
const ImmutableCoreModelInstance = require('./immutable-core-model-instance')
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModel

// default columns
const defaultColumns = {
    accountId: {
        index: true,
        null: false,
        type: 'id',
    },
    createTime: {
        index: true,
        null: false,
        type: 'time',
    },
    data: {
        null: false,
        type: 'data',
    },
    id: {
        primary: true,
        null: false,
        type: 'id',
    },
    originalId: {
        index: true,
        null: false,
        type: 'id',
    },
    parentId: {
        type: 'id',
        unique: true,
    },
    sessionId: {
        index: true,
        null: false,
        type: 'id',
    },
}

// default column spec
const defaultColumnSpec = {
    // create index
    index: true,
}

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
    // set database connection if passed in args
    if (args.database) {
        this.setDatabase(args.database)
    }
    // column specs indexed by column name
    this.columns = {}
    // map of default columns (columnName => defaultName)
    this.defaultColumns = {}
    // add default columns
    _.each(defaultColumns, (spec, defaultName) => {
        // give column name model name as prefix
        var name = this.name + changeCase.pascalCase(defaultName)
        // set new column name with default spec for column
        this.columns[name] = _.cloneDeep(spec)
        // map name to default name
        this.defaultColumns[name] = defaultName
    })
    // if columns are set in args then validate, otherwise empty object
    if (args.columns) {
        // validate columns which can modify existing columns if extra
        // columns delete or modify default columns
        this.extraColumns = requireValidColumns(this, args.columns)
        // merge extra columns into all columns
        _.merge(this.columns, this.extraColumns)
    }
    else {
        this.extraColumns = {}
    }
    // create reverse mapping of default columns (defaultName => columnName)
    this.defaultColumnsInverse = _.invert(this.defaultColumns)
    // create sorted list of column names for generating queries
    this.columnNames = _.sortBy(_.keys(this.columns))
    // if multi-column indexes are set then validate
    this.indexes = args.indexes
        ? requireValidIndexes(args.indexes)
        : []
    // module method name for creating new record
    var createMethodName = this.name+'Create'
    // add create method to module and to object instance
    this.create = immutable.method(this.moduleName+'.'+createMethodName, args => create(this, args))
    // module method name for querying records
    var queryMethodName = this.name+'Query'
    // add query method to module and to object instance
    this.query = immutable.method(this.moduleName+'.'+queryMethodName, args => query(this, args))
}

/* public functions */
ImmutableCoreModel.prototype = {
    alterColumn: alterColumn,
    alterTable: alterTable,
    columnName: columnName,
    createColumn: createColumn,
    createTable: createTable,
    decodeData: decodeData,
    encodeData: encodeData,
    session: session,
    setDatabase: setDatabase,
    schema: schema,
    sync: sync,
}

/**
 * @function alterColumn
 *
 * alter an existing column - currently only adding indexes is
 * supported
 *
 * @param {object} args
 *
 * @returns {Promise}
 */

async function alterColumn (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for alterColumn')
    // get existing schema
    var schema = requireValidSchema(args.schema)
    // get name of column to be altered
    var columnName = args.column
    // get column spec from model
    var modelSpec = this.columns[columnName]
    // get column spec from schema
    var schemaSpec = schema.columns[columnName]
    // compare model column spec to schema and do nothing if they match
    if (deepEqual(modelSpec, schemaSpec)) {
        return
    }
    // do not allow changing type
    assert.ok(modelSpec.type === schemaSpec.type, 'column type cannot be changed')
    // if the model does not have an index then nothing else to do
    if (!modelSpec.index && !modelSpec.unique) {
        return
    }
    // if schema has an index then it must match model or this is an error
    if (schemaSpec.index || schemaSpec.unique) {
        assert.ok(schemaSpec.index === modelSpec.index && schemaSpec.unique === modelSpec.unique, 'index type cannot be changed')
    }
    // get sql to create index
    var createIndexSql = sql.createIndex(this, {
        name: columnName,
        spec: modelSpec,
    })
    // debug
    debug(createIndexSql)
    // attempt to create column
    return this.database.query(createIndexSql, {}, {}, args.session)
}

/**
 * @function alterTable
 *
 * alter an existing table
 *
 * @param {object} args
 *
 * @returns {Promise}
 */

async function alterTable (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for alterTable')
    // get existing schema
    var schema = requireValidSchema(args.schema)
    // iterate over columns in model spec checking if they match schema
    return Promise.each(_.keys(this.columns), name => {
        // get column spec
        var spec = this.columns[name]
        // column exists
        if (schema.columns[name]) {
            // attempt to alter existing column if model does not match schema
            return this.alterColumn({
                column: name,
                schema: schema,
                session: args.session,
            })
        }
        // column does not exist
        else {
            // attempt to add column to table
            return this.createColumn({
                column: {
                    name: name,
                    spec: spec,
                },
                session: args.session,
            })
        }
    })
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
 * @function create
 *
 * create a new model instance
 *
 * @param {object} model
 * @param {object} args
 *
 * @returns {Promise}
 */
async function create (model, args) {
    // require model
    assert.equal(typeof model, 'object', 'model must be object')
    // require object for args
    assert.equal(typeof args, 'object', 'argument must be object')
    // require database
    assert.ok(model.database, 'database required for create')
    // get model columns
    var columns = model.columns
    // get mapping of columns to default columns
    var defaultColumns = model.defaultColumns
    // get inverse default column mapping
    var defaultColumnsInverse = model.defaultColumnsInverse
    // make sure data is object
    var data = requireValidOptionalObject(args.data)
    // make sure session is object
    var session = requireValidOptionalObject(args.session)
    // raw instance data that will be inserted into database
    var raw = {}
    // set account id
    if (defaultColumnsInverse.accountId) {
        // set accountId based on explicit arg or use session accountId if set
        raw[defaultColumnsInverse.accountId] = args.accountId || session.accountId
    }
    // set create time
    if (defaultColumnsInverse.createTime) {
        // set createTime to explicit arg, session requestTimestamp
        // or current value
        raw[defaultColumnsInverse.createTime] = args.creteTime || session.requestTimestamp || microTimestamp()
    }
    // set data
    if (defaultColumnsInverse.data) {
        raw[defaultColumnsInverse.data] = data
    }
    // set original id
    if (defaultColumnsInverse.originalId) {
        raw[defaultColumnsInverse.originalId] = args.originalId
    }
    // set parent id
    if (defaultColumnsInverse.parentId) {
        raw[defaultColumnsInverse.parentId] = args.parentId
    }
    // set session id
    if (defaultColumnsInverse.sessionId) {
        raw[defaultColumnsInverse.sessionId] = session.sessionId
    }
    // set id
    if (defaultColumnsInverse.id) {
        raw[defaultColumnsInverse.id] = stableId(raw)
        // set original id if not already set
        if (defaultColumnsInverse.originalId && !raw[defaultColumnsInverse.originalId]) {
            raw[defaultColumnsInverse.originalId] = raw[defaultColumnsInverse.id]
        }
    }
    // add any extra columns using values from data - since these values are
    // already in data they are not used for calculating the id
    _.each(model.extraColumns, (spec, name) => {
        // get value from data using path from spec
        raw[name] = _.get(data, spec.path)
    })
    // after calculating id the actual data column needs to be set
    // this will be replaced with object data after insert
    if (defaultColumnsInverse.data) {
        raw[defaultColumnsInverse.data] = model.encodeData(data)
    }
    // get insert sql
    var insertSql = sql.insert(model)
    // debug
    debug(insertSql)
    // attempt insert
    return model.database.query(insertSql, raw, {}, args.session)
    // if query resolved then insert was success
    .then(res => {
        // reset data to object
        if (defaultColumnsInverse.data) {
            raw[defaultColumnsInverse.data] = data
        }
        // resolve with new instance
        return new ImmutableCoreModelInstance({
            model: model,
            raw: raw,
            session: session,
        })
    })
}

/**
 * @function createColumn
 *
 * create a new column on an existing table
 *
 * @param {object} args
 *
 * @returns {Promise}
 */

async function createColumn (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for createColumn')
    // get create column sql
    var createColumnSql = sql.createColumn(this, args.column)
    // debug
    debug(createColumnSql)
    // attempt to create column
    return this.database.query(createColumnSql, {}, {}, args.session)
}

/**
 * @function createTable
 *
 * create a new table
 *
 * @param {object} args
 *
 * @returns {Promise}
 */

async function createTable (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for createTable')
    // get create table sql
    var createTableSql = sql.createTable(this)
    // debug
    debug(createTableSql)
    // attempt to create table
    return this.database.query(createTableSql, {}, {}, args.session)
}

/**
 * @function decodeData
 *
 * decode data stored in database and return object
 *
 * @param {string|Buffer} data
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function decodeData (data) {
    // decompress if compresion in use
    if (this.compression) {
        data = snappy.uncompressSync(Buffer.from(data, 'base64'))
    }
    // return JSON parsed data
    return JSON.parse(data)
}

/**
 * @function encodeData
 *
 * encode object to Buffer for storage in database
 *
 * @param {object} data
 *
 * @returns {string|Buffer}
 *
 * @throws {Error}
 */
function encodeData (data) {
    // json encode data
    data = jsonStableStringify(data)
    // compress if compression in use
    if (this.compression) {
        data = snappy.compressSync(data).toString('base64')
    }
    // return encoded data
    return data
}

/**
 * @function query
 *
 * do query
 *
 * @param {object} model
 * @param {object} args
 *
 * @returns {Promise}
 */
async function query (model, args) {
    // debug query args
    debug(args)
    // require model
    assert.equal(typeof model, 'object', 'model must be object')
    // require object for args
    assert.equal(typeof args, 'object', 'argument must be object')
    // require database
    assert.ok(model.database, 'database required for create')
    // get select sql
    var select = sql.select(model, args)
    // debug
    debug(select)
    // attempt query
    return model.database.query(select.sql, select.params, args.options, args.session)
    // build response for query
    .then(res => {
        // if query is for a single record then either return the record
        // or undefined if not found
        if (args.limit === 1) {
            // resolve with undefined it no record found
            if (!res.length) {
                return
            }
            // get raw data
            var raw = res[0]
            // get data column to decode data
            var dataColumn = model.columnName('data')
            // decode data column
            raw[dataColumn] = model.decodeData(raw[dataColumn])
            // resolve with new model instance
            return new ImmutableCoreModelInstance({
                model: model,
                raw: raw,
                session: args.session,
            })
        }
        // otherwise return new result object
        else {
            throw new Error('multi record results not yet supported')
        }
    })
}


/**
 * @function schema
 *
 * returns schema for model table in database or undefined if table does
 * not exists
 *
 * @param {object} args
 *
 * @returns {undefined|object}
 */
async function schema (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for schema')
    // get colunmn and index information from database
    return Promise.all([
        this.database.query(sql.describe(this), {}, {}, args.session),
        this.database.query(sql.showIndexes(this), {}, {}, args.session)

    ])
    // build schema from database response
    .then(res => {
        // get columns and indexes from describe and show index queries
        var [columns, indexes] = res
        // schema data
        var schema = {
            columns: {},
            indexes: [],
        }
        // build column data
        _.each(columns, dbColumn => {
            var column = schema.columns[dbColumn.Field] = {}
            // require valid type
            assert.ok(sql.columnTypesInverse[dbColumn.Type], 'unrecognized column type '+dbColumn.Type)
            // map database to internal type
            column.type = sql.columnTypesInverse[dbColumn.Type]
            // is column nullable
            if (dbColumn.Null === 'NO') {
                column.null = false
            }
            // set default if not null
            if (dbColumn.Default) {
                column.default = dbColumn.Default
                // convert boolean
                if (column.type === 'boolean') {
                    column.default = column.default === '1' ? true : false
                }
            }
        })
        // map of indexes by key name since keys may cover multiple columns
        var indexesByKey = {}
        // build map of indexes by key name
        _.each(indexes, dbIndex => {
            // create entry for index if it does not already exist
            if (!indexesByKey[dbIndex.Key_name]) {
                indexesByKey[dbIndex.Key_name] = {
                    columns: {}
                }
            }
            // get entry for index
            var index = indexesByKey[dbIndex.Key_name]
            // add column with sequence in index
            index.columns[dbIndex.Column_name] = parseInt(dbIndex.Seq_in_index)
            // add unique flag if true
            if (dbIndex.Non_unique === '0') {
                index.unique = true
            }
        })
        // add indexes to schema
        _.each(indexesByKey, (index, name) => {
            var indexColumns = _.keys(index.columns)
            // multi-column index
            if (indexColumns.length > 1) {
                // sort index columns by the Seq_in_index value - these may
                // always be in order so this may not be needed
                indexColumns = _.sortBy(indexColumns, indexColumn => index.columns[indexColumn])
                // create schema index entry
                var schemaIndex = {
                    columns: indexColumns,
                }
                // set unique flag
                if (index.unique) {
                    schemaIndex.unique = true
                }
                // add index to schema
                schema.indexes.push(schemaIndex)
            }
            // single column index
            else {
                // get first and only column
                var indexColumn = indexColumns[0]
                // PRIMARY KEY
                if (name === 'PRIMARY') {
                    schema.columns[indexColumn].primary = true
                }
                // unique index
                else if (index.unique) {
                    schema.columns[indexColumn].unique = true
                }
                // non-unique index
                else {
                    schema.columns[indexColumn].index = true
                }
            }
        })
        // resolve with schema
        return schema
    })
    .catch(err => {
        // reject on anything besides a table does not exist error
        // if table does not exist resolve with undefined
        if (err.code !== 1146) {
            return Promise.reject(err)
        }
    })
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
 * @function setDatabase
 *
 * set database connection to be used for model queries
 *
 * @param {object} database
 *
 * @returns {ImmutableCoreModel}
 *
 * @throws {Error}
 */
function setDatabase (database) {
    // set db connection
    this.database = requireValidDatabase(database)
}

/**
 * @function sync
 *
 * checks that database matches model spec and attempts update if possible
 *
 * @param {object} args
 */
async function sync (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for sync')
    // create or update table
    return this.schema(args).then(schema => {
        // if table exists then update table
        if (schema) {
            // add schema to args
            args.schema = schema
            // attempt to alter table to match schema
            return this.alterTable(args)
        }
        // otherwise attempt to create table
        else {
            return this.createTable(args)
        }
    })
}

/* private functions */

/**
 * @function requireValidColumns
 *
 * validate columns from model specification
 *
 * @param {object} ImmutableCoreModel
 * @param {object} extraColumns
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function requireValidColumns (model, extraColumns) {
    assert.equal(typeof extraColumns, 'object', 'columns must be object')
    // clone arg since it may be modified
    extraColumns = _.cloneDeep(extraColumns)
    // validate each column definition
    _.each(extraColumns, (spec, name) => {
        // spec is for default column
        if (model.columns[name]) {
            // if spec is false then remove default column
            if (spec === false) {
                delete model.columns[name]
                delete model.defaultColumns[name]
                delete extraColumns[name]
            }
            // otherwise override default values with spec
            else {
                _.merge(model.columns[name], spec)
            }
        }
        // spec is for extra column
        else {
            // get validated spec
            extraColumns[name] = requireValidColumn(name, spec)
        }
    })
    // return validated columns
    return extraColumns
}

/**
 * @function requireValidColumn
 *
 * validate column from model specification
 *
 * @param {string} name
 * @param {object} spec
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function requireValidColumn (name, spec) {
    // if spec is a string then convert to object using string
    // as type and name as the path for getting value from data
    if (typeof spec === 'string') {
        // capture type
        var type = spec
        // create new spec with default spect
        spec = _.cloneDeep(defaultColumnSpec)
        // set type
        spec.type = type
        // use the column name as path
        spec.path = name
    }
    // require spec to be object
    assert.equal(typeof spec, 'object', 'column spec must be object')
    // require valid type
    assert.ok(sql.columnTypes[spec.type], 'invalid type: '+spec.type)
    // return validated spec
    return spec
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
 * @function requireValidIndexes
 *
 * validate indexes argument
 *
 * @param {object} database
 *
 * @returns {object}
 *
 * @throws {Error}
 */

function requireValidIndexes (indexes) {
    // throw error on invalid indexes option
    assert.ok(Array.isArray(indexes), 'indexes must be array')
    // validate each index spec
    _.each(indexes, index => {
        // require columns to be array
        assert.ok(Array.isArray(index.columns), 'index columns must be array')
        // require multiple columns
        assert.ok(index.columns.length > 1, 'index must have at least 2 columns')
    })
    // return validated indexes
    return indexes
}

/**
 * @function requireValidSchema
 *
 * validate schema argument
 *
 * @param {object} schema
 *
 * @returns {object}
 *
 * @throws {Error}
 */

function requireValidSchema (schema) {
    // throw error on invalid schema object
    assert.equal(typeof schema, 'object', 'schema must be object')
    assert.equal(typeof schema.columns, 'object', 'schema columns must be object')
    assert.ok(Array.isArray(schema.indexes), 'schema indexes must be array')
    // require validated schema
    return schema
}
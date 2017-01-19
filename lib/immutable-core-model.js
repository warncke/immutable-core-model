'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const changeCase = require('change-case')
const debug = require('debug')('immutable-core-model')
const immutable = require('immutable-core')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
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
    // set database connection if passed in args
    if (args.database) {
        this.setDatabase(args.database)
    }
    // column specs indexed by column name
    this.columns = {}
    // add default columns
    _.each(defaultColumns, (spec, name) => {
        // give column name model name as prefix
        name = this.name + changeCase.pascalCase(name)
        // set new column name with default spec for column
        this.columns[name] = _.cloneDeep(spec)
    })
    // if columns are set in args then validate, otherwise empty object
    if (args.columns) {
        _.merge(this.columns, requireValidColumns(this.columns, args.columns))
    }
    // if multi-column indexes are set then validate
    this.indexes = args.indexes
        ? requireValidIndexes(args.indexes)
        : []


}

/* public functions */
ImmutableCoreModel.prototype = {
    alterTable: alterTable,
    createTable: createTable,
    setDatabase: setDatabase,
    schema: schema,
    sync: sync,
}

async function alterTable (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // require database to do sync
    assert.ok(this.database, 'database required for alterTable')
}

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
 * @param {object} defaultColumns
 * @param {object} extraColumns
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function requireValidColumns (defaultColumns, extraColumns) {
    assert.equal(typeof extraColumns, 'object', 'columns must be object')
    // clone arg since it may be modified
    extraColumns = _.cloneDeep(extraColumns)
    // validate each column definition
    _.each(extraColumns, (spec, name) => {
        // spec is for default column
        if (defaultColumns[name]) {
            // if spec is false then remove default column
            if (spec === false) {
                delete defaultColumns[name]
                delete extraColumns[name]
            }
            // otherwise override default values with spec
            else {
                _.merge(defaultColumns[name], spec)
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
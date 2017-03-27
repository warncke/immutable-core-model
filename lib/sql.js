'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

/* application modules */
const SqlSelect = require('./sql/select')

/* global variables */

// allowed column types and SQL definitions
const columnTypes = {
    boolean: 'TINYINT(1)',
    data: 'MEDIUMBLOB',
    id: 'BINARY(16)',
    number: 'DECIMAL(36,9)',
    string: 'VARCHAR(255)',
    time: 'DATETIME(6)',
}
// invert column types and convert to lower case for mapping back mysql
// schema data to internal types
const columnTypesInverse = _.invert(
    _.mapValues(columnTypes, v => v.toLowerCase())
)

/* exports */
module.exports = {
    columnTypes: columnTypes,
    columnTypesInverse: columnTypesInverse,
    createColumn: createColumn,
    createIndex: createIndex,
    createTable: createTable,
    describe: describe,
    insert: insert,
    quoteName: quoteName,
    select: select,
    showCreateTable: showCreateTable,
    showIndexes: showIndexes,
    updateExtraColumns: updateExtraColumns,
}

/**
 * @function createColumn
 *
 * generate sql for ALTER TABLE ADD COLUMN statement
 *
 * @param {ImmutableCoreModel} model
 * @param {object} column
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createColumn (model, column) {
    // build query
    var sql = 'ALTER TABLE '+quoteName(model.name)
        + ' ADD COLUMN '+createTableColumn(column.name, column.spec)
    // column has unique index
    if (column.spec.unique) {
        sql = sql+', ADD '+createTableUniqueKey(column.name, column.spec)
    }
    // column has non-unique index
    else if (column.spec.index) {
        sql = sql+', ADD '+createTableKey(column.name, column.spec)
    }
    // reture sql string
    return sql
}

/**
 * @function createIndex
 *
 * generate sql for ALTER TABLE ADD INDEX statement
 *
 * @param {ImmutableCoreModel} model
 * @param {object} column
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createIndex (model, column) {
    // build query
    var sql = 'ALTER TABLE '+quoteName(model.name)
    // column has unique index
    if (column.spec.unique) {
        sql = sql+' ADD '+createTableUniqueKey(column.name, column.spec)
    }
    // column has non-unique index
    else if (column.spec.index) {
        sql = sql+' ADD '+createTableKey(column.name, column.spec)
    }
    // reture sql string
    return sql
}

/**
 * @function createTable
 *
 * generate sql for CREATE TABLE statement
 *
 * @param {ImmutableCoreModel} model
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTable (model) {
    var columnSql = []
    var keySql = []
    var primaryKeySql = []
    var uniqueKeySql = []
    // iterate over column names in alpha order generating sql for
    // columns and indexes
    _.each(model.columns, (spec, name) => {
        // create column sql
        columnSql.push(createTableColumn(name, spec))
        // column has index
        if (spec.index || spec.primary || spec.unique) {
            // index is primary
            if (spec.primary) {
                primaryKeySql.push(createTablePrimaryKey(name, spec))
            }
            // index is unique
            else if (spec.unique) {
                uniqueKeySql.push(createTableUniqueKey(name, spec))
            }
            // index is not unique
            else {
                keySql.push(createTableKey(name, spec))
            }
        }
    })
    // require table to have at most one primary key
    assert.ok(primaryKeySql.length <= 1, model.name+': table must not have more than one primary key')
    // add any multi-column indexes
    _.each(model.indexes, (spec) => {
        // index is unique
        if (spec.unique) {
            uniqueKeySql.push(createTableUniqueKeyMulti(spec))
        }
        // index is not unique
        else {
            keySql.push(createTableKeyMulti(spec))
        }
    })
    // return create table sql
    return 'CREATE TABLE '+quoteName(model.name)+' ('
        + columnSql.concat(primaryKeySql, uniqueKeySql, keySql).join(', ')
        + ') ENGINE='+model.engine+' DEFAULT CHARSET='+model.charset
}

/**
 * @function describe
 *
 * generate sql for DESCRIBE statement
 *
 * @param {ImmutableCoreModel} model
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function describe (model) {
    return 'DESCRIBE '+quoteName(model.name)
}

/**
 * @function insert
 *
 * generate sql for INSERT statement
 *
 * @param {ImmutableCoreModel} model
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function insert (model) {
    return 'INSERT '+(model.insertDelayed && model.engine === 'MyISAM' ? 'DELAYED ' : '')+'INTO '+quoteName(model.name)
        +' ('+_.map(model.columnNames, quoteName).join(', ')+')'
        +' VALUES ('
        +_.map(
            model.columnNames,
            columnName => placeholder(model, columnName, model.columns[columnName])
        ).join(', ')
        +')'
}

/**
 * @function placeholder
 *
 * create placeholder for value based on column type
 *
 * @params {object} model
 * @params {string} name
 * @params {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function placeholder (model, name, spec) {
    // if colum is id then needs to be wrapped in UNHEX
    if (spec.type === 'id') {
        return 'UNHEX(:'+name+')'
    }
    // if column is data and compression is in use it is hex
    else if (spec.type === 'data' && model.compression) {
        return 'FROM_BASE64(:'+name+')'
    }
    else {
        return ':'+name
    }
}

/**
 * @function quoteName
 *
 * quote name for table/column/index
 *
 * @params {string} name
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function quoteName (name) {
    // require name to be string
    assert.equal(typeof name, 'string', 'name must be string')
    // do not allow quote symbol in name - all other name validation is
    // left to the database
    assert.ok(!name.match(/`/), 'invalid name')
    // return quoted name
    return '`'+name+'`'
}

/**
 * @function select
 *
 * generate sql for SELECT statement
 *
 * @param {ImmutableCoreModel} model
 * @param {object} args
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function select (model, args) {
    return new SqlSelect(model, args)
}

/**
 * @function showCreateTable
 *
 * generate sql for SHOW CREATE TABLE statement
 *
 * @param {ImmutableCoreModel} model
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function showCreateTable (model) {
    return 'SHOW CREATE TABLE '+quoteName(model.name)
}

/**
 * @function showIndexes
 *
 * generate sql for SHOW INDEX statement
 *
 * @param {ImmutableCoreModel} model
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function showIndexes (model) {
    return 'SHOW INDEX FROM '+quoteName(model.name)
}

/* private functions */

/**
 * @function createTableColumn
 *
 * generate column sql for CREATE TABLE
 *
 * @param {string} name
 * @param {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTableColumn (name, spec) {
    // require spec to be object
    assert.equal(typeof spec, 'object', name+' spec must be object')
    // require valid type
    assert.ok(columnTypes[spec.type], 'invalid type: '+spec.type)
    // build sql string
    var sql = quoteName(name)+' '+columnTypes[spec.type]
    // add not null if null specifically set to false
    if (spec.null === false) {
        sql = sql+' NOT NULL'
    }
    // add default value if set
    if (spec.default !== undefined) {
        // use unquoteNamed value for number type
        if (spec.type === 'number') {
            sql = sql+' DEFAULT '+spec.default
        }
        // use 0/1 for boolean
        else if (spec.type === 'boolean') {
            sql = sql+' DEFAULT '+(spec.default ? '1' : '0')
        }
        // otherwise use quoteNamed value
        else {
            sql = sql+' DEFAULT \''+spec.default+'\''
        }
    }
    // return sql string
    return sql
}

/**
 * @function createTableKey
 *
 * generate index sql for CREATE TABLE
 *
 * @param {string} name
 * @param {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTableKey (name, spec) {
    // require spec to be object
    assert.equal(typeof spec, 'object', name+' spec must be object')
    // return key sql
    return 'KEY ('+quoteName(name)+')'
}

/**
 * @function createTableKeyMulti
 *
 * generate multi-column non-unique index sql for CREATE TABLE
 *
 * @param {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTableKeyMulti (spec) {
    // require spec to be object
    assert.equal(typeof spec, 'object', 'spec must be object')
    // require columns to be array
    assert.ok(Array.isArray(spec.columns), 'index columns must be array')
    // return key sql
    return 'KEY ('+_.map(spec.columns, quoteName).join(', ')+')'
}

/**
 * @function createTablePrimaryKey
 *
 * generate unique index sql for CREATE TABLE
 *
 * @param {string} name
 * @param {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTablePrimaryKey (name, spec) {
    // require spec to be object
    assert.equal(typeof spec, 'object', name+' spec must be object')
    // return key sql
    return 'PRIMARY KEY ('+quoteName(name)+')'
}

/**
 * @function createTableUniqueKey
 *
 * generate unique index sql for CREATE TABLE
 *
 * @param {string} name
 * @param {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTableUniqueKey (name, spec) {
    // require spec to be object
    assert.equal(typeof spec, 'object', name+' spec must be object')
    // return key sql
    return 'UNIQUE KEY ('+quoteName(name)+')'
}

/**
 * @function createTableUniqueKeyMulti
 *
 * generate multi-column unique index sql for CREATE TABLE
 *
 * @param {object} spec
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function createTableUniqueKeyMulti (spec) {
    // require spec to be object
    assert.equal(typeof spec, 'object', 'spec must be object')
    // require columns to be array
    assert.ok(Array.isArray(spec.columns), 'index columns must be array')
    // return key sql
    return 'UNIQUE KEY ('+_.map(spec.columns, quoteName).join(', ')+')'
}

/**
 * @function updateExtraColumns
 *
 * create sql to UPDATE extra columns on table and build params object for query
 *
 * @param {object} model
 * @param {object} data
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function updateExtraColumns (model, instance) {
    // columns to update
    var updateColumns = []
    // placeholder => value params for query
    var params = {}
    // add instance id to params
    params.id = instance.id
    // build list of columns to update and param values
    _.each(model.extraColumns, (spec, name) => {
        // add data value to params
        params[name] = instance.data[spec.path]
        // add update sql
        if (spec.type === 'id') {
            updateColumns.push(quoteName(name)+' = UNHEX(:'+name+')')
        }
        else {
            updateColumns.push(quoteName(name)+' = :'+name)
        }
    })
    // build sql string
    var sql = 'UPDATE '+quoteName(model.name)+' SET '
        +updateColumns.join(', ')
        +' WHERE '+quoteName(model.columnName('id'))+' = UNHEX(:id)';
    // return sql and params to perform query
    return {
        params: params,
        sql: sql,
    }
}
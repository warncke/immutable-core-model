'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

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
    showIndexes: showIndexes,
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
    // require table to have one primary key
    assert.equal(primaryKeySql.length, 1, model.name+': table must have single primary key')
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
        + ') ENGINE=InnoDB DEFAULT CHARSET=utf8'
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
    return 'INSERT INTO '+quoteName(model.name)
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
    // require model to be object
    assert.equal(typeof model, 'object', 'model must be object')
    // require args to be object
    assert.equal(typeof args, 'object', 'args must be object')
    // main model table
    var primaryTable = model.name
    var primaryAlias = primaryTable.charAt(0)
    // map of aliases to table
    var aliases = {
        primaryAlias: primaryTable,
    }
    // map of column names to the alias for table column is in
    var columnAliases = {}
    // list of columns to select, either from args or all
    var columns = Array.isArray(args.select) && args.select.length
        ? args.select
        : _.keys(model.columns)
    // convert column names to sql
    columns = _.map(columns, columnName => {
        // validate column name - throw error
        columnName = model.columnName(columnName, true)
        // get column spec
        var spec = model.columns[columnName]
        // encode binary column id values as hex
        if (spec.type === 'id') {
            return 'HEX('+primaryAlias+'.'+quoteName(columnName)+') as '+quoteName(columnName)
        }
        // if compression is enabled then get data columns as hex
        else if (spec.type === 'data' && model.compression) {
            return 'TO_BASE64('+primaryAlias+'.'+quoteName(columnName)+') as '+quoteName(columnName)
        }
        // use plain column name
        else {
            return primaryAlias+'.'+quoteName(columnName)
        }
    })
    // params for values to be substituted into where query
    var params = {}
    // list of condition statements for select
    var where = []
    // iterate over where args adding where clauses that will be joined
    // together with AND for WHERE statement
    _.each(args.where, (value, columnName) => {
        // validate column name - throw error
        columnName = model.columnName(columnName, true)
        // get column spec
        var spec = model.columns[columnName]
        // get param name for value placeholder
        var paramName = selectParamName(params, columnName)
        // if value is a string then do a simple column = :value
        if (typeof value === 'string' || typeof value === 'number') {
            // set value for param placeholder
            params[paramName] = value
            // create sql
            var whereSql = spec.type === 'id'
                // unhex the argument value to match binary id column
                ? primaryAlias+'.'+columnName+' = UNHEX(:'+paramName+')'
                : primaryAlias+'.'+columnName+' = :'+paramName
            // add sql to list of where clauses
            where.push(whereSql)
        }
        // query type not supported
        else {
            throw new Error('invalid where value type '+typeof value)
        }
    })
    // order conditions
    var order = []
    // build order conditions
    if (Array.isArray(args.order) && args.order.length) {
        // order is array of array
        if (Array.isArray(args.order[0])) {
            _.each(args.order, orderArg => {
                var direction = ''
                // check if last element is asc/desc
                if (orderArg[orderArg.length - 1].match(/^asc|desc$/i)) {
                    var direction = orderArg.pop().toUpperCase()
                }
                // join columns together and add direction
                order.push(
                    _.map(
                        orderArg, columnName => model.columnName(columnName, true)
                    ).join(', ')+' '+direction
                )
            })
        }
        // order is array
        else {
            var direction = ''
            // check if last element is asc/desc
            if (args.order[args.order.length - 1].match(/^asc|desc$/i)) {
                var direction = args.order.pop().toUpperCase()
            }
            // join columns together and add direction
            order.push(
                _.map(
                    args.order, columnName => model.columnName(columnName, true)
                ).join(', ')+' '+direction
            )
        }
    }
    // build select statment
    var selectSql = 'SELECT '+columns.join(', ')
        +' FROM '+primaryTable+' '+primaryAlias
        // add where clause
        + (where.length ? ' WHERE '+where.join(' AND ') : '')
        // add order clause
        + (order.length ? ' ORDER BY '+order.join(', ') : '')
        // add limit clause
        + (args.limit ? ' LIMIT '+requireValidInt(args.limit) : '')
        // add offset clause
        + (args.offset ? ' OFFSET '+requireValidInt(args.offset) : '')
    // return query string and param values
    return {
        sql: selectSql,
        params: params,
    }
}

/**
 * @function selectParamName
 *
 * @params {object} params
 * @params {object} columnName
 *
 * @returns {string}
 */
function selectParamName (params, columnName) {
    var i = 0
    // get placeholder name based on column name with counter
    // added if the same column name is used multiple times
    while (i < 99) {
        // use column name as base for param name
        var paramName = columnName
        // if param name is in use append counter
        if (i > 0) {
            paramName = paramName + i
        }
        // if param name is not in use then use it
        if (!params[paramName]) {
            return paramName
        }
        // increment counter
        i++
    }
    // if placeholder could not be found throw error
    throw new Error('max paramName exceeded '+columName)
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
    assert.equal(typeof spec, 'object', 'spec must be object')
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
    assert.equal(typeof spec, 'object', 'spec must be object')
    // return key sql
    return 'KEY ('+quoteName(name)+')'
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
    assert.equal(typeof spec, 'object', 'spec must be object')
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
    assert.equal(typeof spec, 'object', 'spec must be object')
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
 * @function requireValidInt
 *
 * get valid column name
 *
 * @param {any} val
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function requireValidInt (val) {
    // get int
    val = parseInt(val)
    // require int
    assert.ok(!Number.isNaN(val), 'integer required')
    // return validated integer
    return val
}
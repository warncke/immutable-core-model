'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const changeCase = require('change-case')
const defined = require('if-defined')

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = initColumns

/* constants */

// default columns
const defaultColumns = {
    accountId: {
        index: true,
        null: false,
        type: 'id',
    },
    c: {
        default: 0,
        null: false,
        type: 'smallint',
        unsigned: true,
    },
    createTime: {
        index: true,
        null: false,
        type: 'time',
    },
    d: {
        default: false,
        null: false,
        type: 'boolean',
    },
    data: {
        null: false,
        type: 'data',
    },
    id: {
        unique: true,
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
    n: {
        auto: true,
        null: false,
        type: 'int',
        unsigned: true,
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
 * @function initColumns
 *
 * called by new ImmutableCoreModel to initialize column spec for model
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initColumns (args) {
    // column specs indexed by column name
    this.columns = {}
    // map of default columns (columnName => defaultName)
    this.defaultColumns = {}
    // inverse mapping (defaultName => columnName)
    this.defaultColumnsInverse = {}
    // add default columns
    _.each(defaultColumns, (spec, defaultName) => {
        // prefix all columns besides system columns with model name
        var name = defaultName.length === 1
            ? defaultName
            : this.name + changeCase.pascalCase(defaultName)
        // set new column name with default spec for column
        this.columns[name] = _.cloneDeep(spec)
        // map column name to default name
        this.defaultColumns[name] = defaultName
        // map default name to column name
        this.defaultColumnsInverse[defaultName] = name
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
    // if there is no data column then delete c column
    if (!defined(this.defaultColumnsInverse.data)) {
        delete this.columns.c
        delete this.defaultColumns.c
        delete this.defaultColumnsInverse.c
    }
    // if there is n column then make it first
    if (defined(this.columns.n)) {
        this.columns.n.first = true
        // if there is c column make it second
        if (this.columns.c) {
            this.columns.c.after = 'n'
        }
    }
    // otherwise if there is c column make it first
    else if (defined(this.columns.c)) {
        this.columns.c.first = true
    }
    // if compression flag is set then set default c value to 1
    if (defined(this.columns.c) && this.compression) {
        this.columns.c.default = 1
    }
    // get column names without system columns which go first
    var columnNames = _.filter(_.keys(this.columns), columnName => {
        return columnName.length === 1 ? false : true
    }).sort()
    // add d(eleted) column
    if (defined(this.columns.d)) {
        columnNames.unshift('d')
    }
    // add (c)ompression column
    if (defined(this.columns.c)) {
        columnNames.unshift('c')
    }
    // get list of column names to insert before adding row n(um)
    this.insertColumnNames = _.clone(columnNames)
    // add row (n)um column
    if (defined(this.columns.n)) {
        columnNames.unshift('n')
    }
    // create sorted list of column names for generating queries
    this.columnNames = columnNames
    // set id based on data hash on
    this.idDataOnly = args.idDataOnly ? true : false
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
        // check if name is a default column name
        var defaultColumnName = model.columnName(name)
        // spec is for default column
        if (defaultColumnName) {
            // if spec is false then remove default column
            if (spec === false) {
                // delete all entries for default column
                delete model.columns[defaultColumnName]
                delete model.defaultColumnsInverse[model.defaultColumns[defaultColumnName]]
                delete model.defaultColumns[defaultColumnName]
                // delete original entry in extra columns
                delete extraColumns[name]
            }
            // otherwise override default values with spec
            else {
                // merge spec over default
                _.merge(model.columns[defaultColumnName], spec)
                // delete original entry in extra columns
                delete extraColumns[name]
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
    // require object
    assert(spec && typeof spec === 'object', 'column spec must be obect for '+name)
    // default path to name
    if (typeof spec.path !== 'string') {
        spec.path = name
    }
    // if column is unique and firstOnly is not defined then default true
    if (spec.unique && spec.firstOnly === undefined) {
        spec.firstOnly = true
    }
    // if firstOnly is true then colum must be nullable
    if (spec.firstOnly && spec.null === 'false') {
        throw new Error(name+' must be nullable')
    }
    // require valid type
    assert.ok(sql.columnTypes[spec.type], name+' invalid type: '+spec.type)
    // return validated spec
    return spec
}
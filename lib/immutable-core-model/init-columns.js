'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const changeCase = require('change-case')

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
        // give column name model name as prefix
        var name = this.name + changeCase.pascalCase(defaultName)
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
    // create sorted list of column names for generating queries
    this.columnNames = _.sortBy(_.keys(this.columns))
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
                delete model.defaultColumns[defaultColumnName]
                delete model.defaultColumnsInverse[name]
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
    // require spec to be object
    assert.equal(typeof spec, 'object', name+' column spec must be object')
    // require valid type
    assert.ok(sql.columnTypes[spec.type], name+' invalid type: '+spec.type)
    // return validated spec
    return spec
}
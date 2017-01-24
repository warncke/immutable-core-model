'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const deepEqual = require('deep-equal')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = {
    alterColumn: alterColumn,
    alterTable: alterTable,
    createColumn: createColumn,
    createTable: createTable,
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
    return this.database().query(createIndexSql, {}, {}, args.session)
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
    // get create column sql
    var createColumnSql = sql.createColumn(this, args.column)
    // debug
    debug(createColumnSql)
    // attempt to create column
    return this.database().query(createColumnSql, {}, {}, args.session)
    // if new column was created then need to re-validate column data
    // to populate the new column
    .then(() => {
        this.needsValidate = true
    })
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
    // get create table sql
    var createTableSql = sql.createTable(this)
    // debug
    debug(createTableSql)
    // attempt to create table
    return this.database().query(createTableSql, {}, {}, args.session)
}

/**
 * @function sync
 *
 * checks that database matches model spec and attempts update if possible
 *
 * @param {object} args
 */
async function sync (args) {
    // set validation properties
    this.needsValidate = false
    this.validated = false
    this.updated = 0
    // get args object
    args = requireValidOptionalObject(args)
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
    // sync action models
    .then(() => Promise.each(_.values(this.actions), action => {
        // sync action
        return action.model.sync()
        // sync inverse action if any
        .then(() => {
            if (action.inverse) {
                return action.inverse.sync()
            }
        })
    }))
    // run validate after complete sync if needed
    .then(() => {
        if (this.needsValidate) {
            return this.validate(args)
        }
    })
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
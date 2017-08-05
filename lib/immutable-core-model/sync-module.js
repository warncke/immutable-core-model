'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const defined = require('if-defined')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = {
    alterColumn: alterColumn,
    alterTable: alterTable,
    createColumn: createColumn,
    createElasticsearchIndex: createElasticsearchIndex,
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
 *
 * @throws {Error}
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
    // do not allow changing type
    assert.ok(modelSpec.type === schemaSpec.type, 'column type cannot be changed')
    // if indexes are the same then do nothing
    if (modelSpec.index === schemaSpec.index && modelSpec.primary === schemaSpec.primary && modelSpec.unique === schemaSpec.unique) {
        return
    }
    // if the model does not have an index then nothing else to do
    if (!modelSpec.index && !modelSpec.primary && !modelSpec.unique) {
        return
    }
    // sql to update index for column
    var updateIndexSql
    // convert primary to unique
    if (schemaSpec.primary && modelSpec.unique) {
        // get sql
        updateIndexSql = sql.convertPrimaryToUnique(this, {
            name: columnName,
            spec: modelSpec,
        })
    }
    // add index
    else {
        // check that index type is not being changed
        assert.ok(!schemaSpec.index && !schemaSpec.primary && !schemaSpec.unique, 'index type cannot be changed')
        // get sql
        updateIndexSql = sql.createIndex(this, {
            name: columnName,
            spec: modelSpec,
        })
    }
    // debug
    debug(updateIndexSql)
    // attempt to create column
    await this.database().query(updateIndexSql, {}, {}, args.session)
}

/**
 * @function alterTable
 *
 * alter an existing table
 *
 * @param {object} args
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */

async function alterTable (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // get existing schema
    var schema = requireValidSchema(args.schema)
    // modify existing columns
    await Promise.each(this.columnNames, async name => {
        // skip unless column exists
        if (!schema.columns[name]) {
            return
        }
        // attempt to alter existing column if model does not match schema
        await this.alterColumn({
            column: name,
            schema: schema,
            session: args.session,
        })
    })
    // create new columns
    await Promise.each(this.columnNames, async name => {
        // skip if column exists
        if (schema.columns[name]) {
            return
        }
        // get spec
        var spec = this.columns[name]
        // attempt to add column to table
        await this.createColumn({
            column: {
                name: name,
                spec: spec,
            },
            session: args.session,
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
 *
 * @throws {Error}
 */
async function createColumn (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // get create column sql
    var createColumnSql = sql.createColumn(this, args.column)
    // debug
    debug(createColumnSql)
    // attempt to create column
    await this.database().query(createColumnSql, {}, {}, args.session)
    // if new column was created then need to re-validate column data
    // to populate the new column
    this.needsValidate = true
    // add flag if d column was created to migrate values if needed
    if (args.column.name === 'd') {
        this.dColumnCreated = true
    }
}

/**
 * @function createElasticsearchIndex
 *
 * create elasticsearch index if elasticsearch set for model. throws error if
 * elasticsearch is true and no client is set.
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
async function createElasticsearchIndex () {
    // get client
    var elasticsearchClient = this.elasticsearch()
    // check if index exists
    var exists = await elasticsearchClient.indices.exists({
        index: this.esIndex,
    })
    // skip if index exists
    if (exists) {
        return
    }
    // create index
    await elasticsearchClient.indices.create({
        index: this.esIndex,
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
 *
 * @throws {Error}
 */

async function createTable (args) {
    // get args object
    args = requireValidOptionalObject(args)
    // get create table sql
    var createTableSql = sql.createTable(this)
    // debug
    debug(createTableSql)
    // attempt to create table
    await this.database().query(createTableSql, {}, {}, args.session)
}

/**
 * @function sync
 *
 * checks that database matches model spec and attempts update if possible
 *
 * @param {object} args
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
async function sync (args) {
    // set validation properties
    this.needsValidate = false
    this.validated = false
    this.updated = 0
    // get args object
    args = requireValidOptionalObject(args)
    // create elasticsearch index
    if (this.elasticsearch()) {
        await this.createElasticsearchIndex()
    }
    // get existing schema
    var schema = await this.schema(args)
    // if table exists then update table
    if (schema) {
        // add schema to args
        args.schema = schema
        // attempt to alter table to match schema
        await this.alterTable(args)
    }
    // otherwise attempt to create table
    else {
        await this.createTable(args)
    }
    // run validate after complete sync if needed
    if (this.needsValidate || defined(process.env.VALIDATE)) {
        await this.validate(args)
    }
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
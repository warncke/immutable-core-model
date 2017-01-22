'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const Promise = require('bluebird')
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('../sql')

/* exports */
module.exports = schema

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
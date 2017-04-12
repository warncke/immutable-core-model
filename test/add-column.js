'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const immutable = require('immutable-core')

const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - add column', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    beforeEach(function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        return database.query('DROP TABLE IF EXISTS foo')
    })

    it('should add new columns', function () {
        // full table schema including all default columns
        var expectedSchema = {
            charset: 'utf8',
            columns: {
                fooAccountId: {
                    type: 'id',
                    null: false,
                    index: true
                },
                fooCreateTime: {
                    type: 'time',
                    null: false,
                    index: true
                },
                fooData: {
                    type: 'data',
                    null: false
                },
                fooId: {
                    type: 'id',
                    null: false,
                    primary: true
                },
                fooOriginalId: {
                    type: 'id',
                    null: false,
                    index: true
                },
                fooParentId: {
                    type: 'id',
                    unique: true
                },
                fooSessionId: {
                    type: 'id',
                    null: false,
                    index: true
                },
                bam: {
                    type: 'boolean',
                    index: true
                },
                bar: {
                    type: 'string',
                    index: true
                },
                foo: {
                    type: 'number',
                    index: true
                }
            },
            engine: 'InnoDB',
            indexes: [],
        };
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // created updated schema
        .then(() => {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            // create updated model
            var fooModel = new ImmutableCoreModel({
                columns: {
                    bam: 'boolean',
                    bar: 'string',
                    foo: 'number',
                },
                database: database,
                name: 'foo',
            })
            // sync with database
            return fooModel.sync()
        })
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema, expectedSchema)
        })
    })

    it('should add new string column with default value', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: 'TEST',
            type: 'string',
        };
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // created updated schema
        .then(() => {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            // create updated model
            var fooModel = new ImmutableCoreModel({
                columns: {
                    foo: fooSchema,
                },
                database: database,
                name: 'foo',
            })
            // sync with database
            return fooModel.sync()
        })
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should add new number column with default value', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: '95.750000000',
            type: 'number',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // created updated schema
        .then(() => {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            // create updated model
            var fooModel = new ImmutableCoreModel({
                columns: {
                    foo: fooSchema,
                },
                database: database,
                name: 'foo',
            })
            // sync with database
            return fooModel.sync()
        })
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should add new boolean column with default value', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: false,
            type: 'boolean',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // created updated schema
        .then(() => {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            // create updated model
            var fooModel = new ImmutableCoreModel({
                columns: {
                    foo: fooSchema,
                },
                database: database,
                name: 'foo',
            })
            // sync with database
            return fooModel.sync()
        })
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should add new column with non-unique index', function () {
        // expected schema for extra column foo
        var fooSchema = {
            index: true,
            type: 'string',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // created updated schema
        .then(() => {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            // create updated model
            var fooModel = new ImmutableCoreModel({
                columns: {
                    foo: fooSchema,
                },
                database: database,
                name: 'foo',
            })
            // sync with database
            return fooModel.sync()
        })
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should add new column with unique index', function () {
        // expected schema for extra column foo
        var fooSchema = {
            type: 'string',
            unique: true,
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // created updated schema
        .then(() => {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            // create updated model
            var fooModel = new ImmutableCoreModel({
                columns: {
                    foo: fooSchema,
                },
                database: database,
                name: 'foo',
            })
            // sync with database
            return fooModel.sync()
        })
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

})
'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

chai.use(chaiAsPromised)
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

describe('immutable-core-model - alter column', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    beforeEach(function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        // drop any test tables if they exist
        return database.query('DROP TABLE IF EXISTS foo')
    })

    it('should add non-unique index with no previous index', function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
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
                    foo: {
                        index: true,
                        type: 'string',
                    },
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
            assert.deepEqual(schema.columns.foo, {
                index: true,
                type: 'string',
            })
        })
    })

    it('should add unique index with no previous index', function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
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
                    foo: {
                        type: 'string',
                        unique: true,
                    },
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
            assert.deepEqual(schema.columns.foo, {
                type: 'string',
                unique: true,
            })
        })
    })

    it('should throw error if attempting to change column type', function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
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
                    foo: {
                        type: 'number',
                    },
                },
                database: database,
                name: 'foo',
            })
            // sync with database - should reject
            return assert.isRejected(fooModel.sync())
        })
    })

    it('should throw error if attempting to change from non-unique to unique index', function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    index: true,
                    type: 'string',
                },
            },
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
                    foo: {
                        type: 'string',
                        unique: true,
                    },
                },
                database: database,
                name: 'foo',
            })
            // sync with database - should reject
            return assert.isRejected(fooModel.sync())
        })
    })

    it('should throw error if attempting to change from unique to non-unique index', function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                },
            },
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
                    foo: {
                        index: true,
                        type: 'string',
                    },
                },
                database: database,
                name: 'foo',
            })
            // sync with database - should reject
            return assert.isRejected(fooModel.sync())
        })
    })

})
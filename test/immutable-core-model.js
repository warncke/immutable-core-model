'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiSubset = require('chai-subset')
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

describe('immutable-model', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    beforeEach(function () {
        // reset immutable so that model modules are recreated with every test
        immutable.reset()
        // drop any test tables if they exist
        return database.query('DROP TABLE IF EXISTS foo')
    })

    it('should create a new model instance', function () {
        // full table schema including all default columns
        var expectedSchema = {
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
            indexes: [
                {
                    columns: ['bam','bar'],
                    'unique': true
                }
            ]
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                bam: 'boolean',
                bar: 'string',
                foo: 'number',
            },
            database: database,
            indexes: [
                {
                    columns: ['bam', 'bar'],
                    unique: true,
                },
            ],
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema, expectedSchema)
        })
    })

    it('should allow removing default columns', function () {
        var expectedSchema = {
            fooData: {
                type: 'data',
                null: false
            },
            fooId: {
                type: 'id',
                null: false,
                primary: true
            }
        }
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                fooAccountId: false,
                fooCreateTime: false,
                fooOriginalId: false,
                fooParentId: false,
                fooSessionId: false,
            },
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns, expectedSchema)
        })
    })

    it('should allow overriding default columns', function () {
        var expectedSchema = {
            fooData: {
                type: 'string',
                index: true,
            },
            fooId: {
                type: 'id',
                null: false,
                primary: true
            }
        }
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                fooAccountId: false,
                fooCreateTime: false,
                fooData: {
                    type: 'string',
                    null: true,
                    index: true,
                },
                fooOriginalId: false,
                fooParentId: false,
                fooSessionId: false,
            },
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns, expectedSchema)
        })
    })

    it('should allow setting default value for string', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: 'TEST',
            type: 'string',
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema
            },
            database: database,
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should allow setting default value for number', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: '95.750000000',
            type: 'number',
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema
            },
            database: database,
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should allow setting default false for boolean', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: false,
            type: 'boolean',
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema
            },
            database: database,
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should allow setting default true for boolean', function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: true,
            type: 'boolean',
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema
            },
            database: database,
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should allow creating non-unique column index', function () {
        // expected schema for extra column foo
        var fooSchema = {
            index: true,
            type: 'string',
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema
            },
            database: database,
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should allow creating unique column index', function () {
        // expected schema for extra column foo
        var fooSchema = {
            type: 'string',
            unique: true,
        };
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema
            },
            database: database,
            name: 'foo',
        })
        // check that immutable module created
        assert.ok(immutable.hasModule('fooModel'), 'immutable module created')
        // sync with database
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

})
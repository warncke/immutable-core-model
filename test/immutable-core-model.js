'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const _ = require('lodash')
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

describe('immutable-core-model', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
    })

    it('should create a new model instance', async function () {
        // full table schema including all default columns
        var expectedSchema = {
            columns: {
                n: {
                    null: false,
                    primary: true,
                    type: 'int',
                    unsigned: true,
                },
                c: {
                    default: '1',
                    null: false,
                    type: 'smallint',
                    unsigned: true,
                },
                d: {
                    default: false,
                    null: false,
                    type: 'boolean',
                },
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
                    unique: true
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
            ],
            charset: 'utf8',
            engine: 'InnoDB',
        }
        // default columns
        var expectedDefaultColumns = {
            n: 'n',
            c: 'c',
            d: 'd',
            fooAccountId: 'accountId',
            fooCreateTime: 'createTime',
            fooData: 'data',
            fooId: 'id',
            fooOriginalId: 'originalId',
            fooParentId: 'parentId',
            fooSessionId: 'sessionId',
        }
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
        // check default columns
        assert.deepEqual(fooModel.defaultColumns, expectedDefaultColumns)
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema, expectedSchema)
    })

    it('should allow removing default columns', async function () {
        var expectedSchema = {
            fooData: {
                type: 'data',
                null: false
            },
            fooId: {
                type: 'id',
                null: false,
                unique: true
            }
        }
        // default columns
        var expectedDefaultColumns = {
            fooData: 'data',
            fooId: 'id',
        }
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
                c: false,
                d: false,
                accountId: false,
                createTime: false,
                originalId: false,
                parentId: false,
                sessionId: false,
            },
            database: database,
            name: 'foo',
        })
        // check default columns
        assert.deepEqual(fooModel.defaultColumns, expectedDefaultColumns)
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns, expectedSchema)
    })

    it('should allow overriding default columns', async function () {
        var expectedSchema = {
            fooData: {
                type: 'string',
                index: true,
            },
            fooId: {
                type: 'id',
                null: false,
                unique: true
            }
        }
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
                c: false,
                d: false,
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns, expectedSchema)
    })

    it('should allow setting default value for string', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: 'TEST',
            type: 'string',
        }
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should allow setting default value for number', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: '95.750000000',
            type: 'number',
        }
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should allow setting default false for boolean', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: false,
            type: 'boolean',
        }
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should allow setting default true for boolean', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: true,
            type: 'boolean',
        }
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should allow creating non-unique column index', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            index: true,
            type: 'string',
        }
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should allow creating unique column index', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            type: 'string',
            unique: true,
        }
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
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should compress large data objects', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync with database
        await fooModel.sync()
        // create big data object
        var big = {foo: []}
        // add 100 objects to foo
        _.times(100, i => {
            big.foo.push({bar: i})
        })
        // create object with lots of data
        var origFoo = await fooModel.createMeta({
            data: big,
            session: session,
        })
        // get back foo
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {id: origFoo.id},
        })
        // compare results
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should work with compression disabled', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            compression: false,
            database: database,
            name: 'foo',
        })
        // sync with database
        await fooModel.sync()
        // create big data object
        var big = {foo: []}
        // add 100 objects to foo
        _.times(100, i => {
            big.foo.push({bar: i})
        })
        // create object with lots of data
        var origFoo = await fooModel.createMeta({
            data: big,
            session: session,
        })
        // get back foo
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {id: origFoo.id},
        })
        // compare results
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should create non-unique multi column index', async function () {
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
                },
            ],
            name: 'foo',
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.indexes, [{
            columns: ['bam', 'bar'],
        }])
    })

    it('should have class properties on model', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            name: 'foo',
        })
        // check for class properties
        assert.isTrue(fooModel.ImmutableCoreModel)
        assert.strictEqual(fooModel.class, 'ImmutableCoreModel')
    })

})
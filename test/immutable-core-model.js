'use strict'

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
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        // drop any test tables if they exist
        return Promise.all([
            database.query('DROP TABLE IF EXISTS foo'),
            database.query('DROP TABLE IF EXISTS fooDelete'),
            database.query('DROP TABLE IF EXISTS fooUnDelete'),
        ])
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
            ],
            charset: 'utf8',
            engine: 'InnoDB',
        }
        // default columns
        var expectedDefaultColumns = {
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
        // default columns
        var expectedDefaultColumns = {
            fooData: 'data',
            fooId: 'id',
        }
        // create model
        var fooModel = new ImmutableCoreModel({
            columns: {
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
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.columns.foo, fooSchema)
        })
    })

    it('should compress large data objects', async function () {
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should work with compression disabled', async function () {
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('create model with associated action', function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            actions: {
                delete: true,
            },
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // test foo model has delete/un-delete action
        .then(() => {
            assert.ok(fooModel.actions.delete)
            assert.ok(fooModel.actions.delete.inverse)
        })
        // get schema for delete
        .then(() => fooModel.actions.delete.model.schema())
        // validate delete schema
        .then(schema => {
            assert.deepEqual(schema, {
                columns: {
                    fooDeleteCreateTime: { type: 'time', null: false, index: true },
                    fooDeleteId: { type: 'id', null: false, primary: true },
                    fooDeleteSessionId: { type: 'id', null: false, index: true },
                    fooId: { type: 'id', unique: true }
                },
                indexes: [],
                charset: 'utf8',
                engine: 'InnoDB',
            })
        })
        // get schema for un-delete
        .then(() => fooModel.actions.delete.inverse.schema())
        // validate un-delete schema
        .then(schema => {
            assert.deepEqual(schema, {
                columns: {
                    fooUnDeleteCreateTime: { type: 'time', null: false, index: true },
                    fooUnDeleteId: { type: 'id', null: false, primary: true },
                    fooUnDeleteSessionId: { type: 'id', null: false, index: true },
                    fooDeleteId: { type: 'id', unique: true }
                },
                indexes: [],
                charset: 'utf8',
                engine: 'InnoDB',
            })
        })
    })

    it('create model action with data', function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            actions: {
                delete: {
                    model: {
                        columns: {
                            data: {
                                type: 'data'
                            },
                        },
                    },
                },
            },
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // test foo model has delete/un-delete action
        .then(() => {
            assert.ok(fooModel.actions.delete)
            assert.ok(fooModel.actions.delete.inverse)
        })
        // get schema for delete
        .then(() => fooModel.actions.delete.model.schema())
        // validate delete schema
        .then(schema => {
            assert.deepEqual(schema, {
                columns: {
                    fooDeleteCreateTime: { type: 'time', null: false, index: true },
                    fooDeleteData: { type: 'data', null: false },
                    fooDeleteId: { type: 'id', null: false, primary: true },
                    fooDeleteSessionId: { type: 'id', null: false, index: true },
                    fooId: { type: 'id', unique: true }
                },
                indexes: [],
                charset: 'utf8',
                engine: 'InnoDB',
            })
        })
    })

    it('create model inverse action with data', function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            actions: {
                delete: {
                    inverse: {
                        columns: {
                            data: {
                                type: 'data'
                            },
                        },
                    },
                },
            },
            database: database,
            name: 'foo',
        })
        // sync with database
        return fooModel.sync()
        // test foo model has delete/un-delete action
        .then(() => {
            assert.ok(fooModel.actions.delete)
            assert.ok(fooModel.actions.delete.inverse)
        })
        // get schema for un-delete
        .then(() => fooModel.actions.delete.inverse.schema())
        // validate un-delete schema
        .then(schema => {
            assert.deepEqual(schema, {
                columns: {
                    fooUnDeleteCreateTime: { type: 'time', null: false, index: true },
                    fooUnDeleteData: { type: 'data', null: false },
                    fooUnDeleteId: { type: 'id', null: false, primary: true },
                    fooUnDeleteSessionId: { type: 'id', null: false, index: true },
                    fooDeleteId: { type: 'id', unique: true }
                },
                indexes: [],
                charset: 'utf8',
                engine: 'InnoDB',
            })
        })
    })

    it('should create non-unique multi column index', function () {
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
        return fooModel.sync()
        // get schema
        .then(() => fooModel.schema())
        // test that schema matches spec
        .then(schema => {
            assert.deepEqual(schema.indexes, [{
                columns: ['bam', 'bar'],
            }])
        })
    })

    it('should have class properties on model', function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            name: 'foo',
        })
        // check for class properties
        assert.isTrue(fooModel.ImmutableCoreModel)
        assert.strictEqual(fooModel.class, 'ImmutableCoreModel')
    })

})
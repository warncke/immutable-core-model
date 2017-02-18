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

describe('immutable-core-model - schema', function () {

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
        return database.query('DROP TABLE IF EXISTS foo')
    })

    it('should create a model with a schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        // get schema
        var schema = fooModel.global().validator.getSchema(fooModel.schemaId)
        var schemaData = fooModel.global().validator.getSchema(fooModel.schemaDataId)
        // schema should be a function
        assert.isFunction(schema)
        assert.isFunction(schemaData)
    })

    it('should throw error on invalid schema', function () {
        try {
            // create model with schema
            var fooModel = new ImmutableCoreModel({
                database: database,
                name: 'foo',
                properties: {
                    foo: {
                        type: 'xxx'
                    },
                },
            })
        }
        catch (err) {
            var threw = err
        }

        assert.isDefined(threw)
    })

    it('should create model instance that matches schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate data
        assert.strictEqual(foo.data.foo, 'foo')
    })

    it('should validate data schema', async function () {
        // create model with schema
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        // get schema validator
        var schemaData = fooModel.global().validator.getSchema(fooModel.schemaDataId)
        // schema should be a function
        assert.isFunction(schemaData)
        // schema should validate
        assert.isTrue(schemaData({foo: 'foo'}))
    })

    it('should coerce scalar values', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 0},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate data
        assert.strictEqual(foo.data.foo, '0')
    })

    it('should coerce arrays', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'array'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 0},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate data
        assert.deepEqual(foo.data.foo, [0])
    })

    it('should not remove extra properties', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'array'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate data
        assert.strictEqual(foo.data.bar, 'bar')
    })

    it('should remove extra properties when additionalProperties:false', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            additionalProperties: false,
            properties: {
                foo: {
                    type: 'array'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate data
        assert.isUndefined(foo.data.bar)
    })

    it('should update a model instance that matches schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: session,
            })
            // update
            foo = await foo.update({
                foo: 'bar'
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate data
        assert.strictEqual(foo.data.foo, 'bar')
    })

    it('should throw error when creating instance that does not match schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            required: 'foo'
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should not throw error when creating instance that does not match schema and validate:false on model', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            validate: false,
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: false},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should not throw error when creating instance that does not match schema and validate:false on create', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: false},
                session: session,
                validate: false,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should throw error when missing required (string) property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string',
                },
            },
            required: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should throw error when missing required (array) property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: ['string'],
                },
            },
            required: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should not throw error when missing non-required property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should throw error when updating an instance that does not match schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            required: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: session,
            })
            // update
            foo = await foo.update({
                foo: undefined,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should not throw error when updating instance that does not match schema and validate:false', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                }
            },
            required: ['foo'],
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: session,
            })
            // update
            foo = await foo.updateMeta({
                data: {foo: false},
                validate: false,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should not throw error when missing required property that has default', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string',
                    default: 'foo',
                },
            },
            required: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }

        // check that default value set
        assert.strictEqual(foo.data.foo, 'foo')
    })

    it('should require not null default columns', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            required: 'foo',
        })
        // get global validator
        var validator = fooModel.global().validator
        // validate data - should be false
        assert.isFalse(validator.validate(fooModel.schemaId, {}))
        // there should be 5 missing required coluns
        assert.strictEqual(validator.errors.length, 5)
    })

})
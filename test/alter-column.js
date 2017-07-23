'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

chai.use(chaiAsPromised)
const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'

const testCache = process.env.TEST_CACHE === '1' ? true : false

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

    // connect to redis if TEST_CACHE enabled
    if (testCache) {
        var redis = Redis.createClient({
            host: redisHost,
            port: redisPort,
        })
    }

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
    })

    it('should add non-unique index with no previous index', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
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
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, {
            index: true,
            type: 'string',
        })
    })

    it('should add unique index with no previous index', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
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
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.deepEqual(schema.columns.foo, {
            type: 'string',
            unique: true,
        })
    })

    it('should throw error if attempting to change column type', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
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
            redis: redis,
        })
        var thrown
        // sync with database - should throw error
        try {
            await fooModel.sync()
        }
        catch (err) {
            thrown = err
        }
        // check error
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'column type cannot be changed')
    })

    it('should throw error if attempting to change from non-unique to unique index', async function () {
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
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
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
            redis: redis,
        })
        var thrown
        // sync with database - should throw error
        try {
            await fooModel.sync()
        }
        catch (err) {
            thrown = err
        }
        // check error
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'index type cannot be changed')
    })

    it('should throw error if attempting to change from unique to non-unique index', async function () {
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
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
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
            redis: redis,
        })
        var thrown
        // sync with database - should throw error
        try {
            await fooModel.sync()
        }
        catch (err) {
            thrown = err
        }
        // check error
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'index type cannot be changed')
    })

})
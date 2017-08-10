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

describe('immutable-core-model-local - persist', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // connect to redis if TEST_CACHE enabled
    if (testCache) {
        var redis = Redis.createClient({
            host: redisHost,
            port: redisPort,
        })
    }

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    var glboalFooModel, fooModel

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // create initial model
        glboalFooModel = new ImmutableCoreModel({
            columns: {
                accountId: false,
                d: false,
                originalId: false,
                parentId: false,
            },
            database: database,
            idDataOnly: true,
            name: 'foo',
            redis: redis,
        })
        // create local foo model with session for select queries
        fooModel = glboalFooModel.session(session)
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await glboalFooModel.sync()
    })

    it('should throw duplicate key error when creating same data twice', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            roles: ['all', 'authenticated'],
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            roles: ['all', 'authenticated'],
            sessionId: '33333333333333333333333333333333',
        }
        // catch expected error
        try {
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: sessionA,
            })
            // create second foo instance with different session but same
            // data - should throw duplicate key error
            await fooModel.createMeta({
                data: {foo: 'foo'},
                session: sessionB,
            })

        }
        catch (err) {
            var threwErr = err
        }
        // check thrown error
        assert.match(threwErr.message, /Duplicate entry/)
    })

    it('should not throw error when persisting data twice', async function () {
        // create first data entry and catpure value
        var foo = await fooModel.create({foo: 'foo'})
        // persist foo which should be duplicate
        var fooId = await fooModel.persist({foo: 'foo'})
        // persist should resolve with string id
        assert.isString(fooId)
        // id should match original
        assert.strictEqual(foo.id, fooId)
    })

});
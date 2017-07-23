'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const _ = require('lodash')
const chai = require('chai')
const immutable = require('immutable-core')

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

describe('immutable-core-model - access id', function () {

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
    var session

    beforeEach(async function () {
        // fake session to use for testing
        session = {
            accessIdName: 'barId',
            accountId: '11111111111111111111111111111111',
            accessId: '33333333333333333333333333333333',
            roles: ['all', 'authenticated', 'foo'],
            sessionId: '22222222222222222222222222222222',
        }
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

    it('should create instance with custom accessId', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessIdName: 'barId',
            columns: {
                barId: 'id',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create instance
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
        // test created instance
        assert.isDefined(foo)
        assert.strictEqual(foo.data.barId, session.accessId)
    })

    it('should create instance when accessId missing from session if column nullable', async function () {
        delete session.accessId
        // create model
        var fooModel = new ImmutableCoreModel({
            accessIdName: 'barId',
            columns: {
                barId: 'id',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create instance
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
        // test created instance
        assert.isDefined(foo)
    })

})
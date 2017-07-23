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

describe('immutable-core-model - engine and charset', function () {

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

    afterEach(function () {
        // clear env vars
        delete process.env.DEFAULT_CHARSET
        delete process.env.DEFAULT_ENGINE
    })

    it('should use default engine and charset', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'InnoDB')
        assert.strictEqual(schema.charset, 'utf8')
    })

    it('should set engine and charset globally', async function () {
        // set global engine and charset
        ImmutableCoreModel
            .defaultCharset('latin1')
            .defaultEngine('MyISAM')
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'MyISAM')
        assert.strictEqual(schema.charset, 'latin1')
    })

    it('should set engine and charset in model args', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            charset: 'latin1',
            database: database,
            engine: 'MyISAM',
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'MyISAM')
        assert.strictEqual(schema.charset, 'latin1')
    })

    it('should set engine and charset from env', async function () {
        // set global engine and charset
        process.env.DEFAULT_CHARSET = 'latin1'
        process.env.DEFAULT_ENGINE = 'MyISAM'
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'MyISAM')
        assert.strictEqual(schema.charset, 'latin1')
    })

})
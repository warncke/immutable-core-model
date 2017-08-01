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

describe('immutable-core-model - update', function () {

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

    it('should create model with immutable property', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    immutable: true,
                    type: 'string',
                }
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })

        try {
            // this should throw error
            await foo.update({foo: 'bam'})
        }
        catch (err) {
            var threw = err
        }

        assert.isDefined(threw)
        // verify error message
        assert.strictEqual(threw.message, `foo#${foo.id} record error: cannot modify immutable property foo`)
    })

    it('should throw error when updating old instance', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })

        try {
            // first update should succeed
            var updateFoo = await foo.update({foo: 'bam'})
            // second update should throw error
            await foo.update({foo: 'bar'})
        }
        catch (err) {
            var threw = err
        }
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {foo: 'bam'})
        // check that error thrown on second update
        assert.isDefined(threw)
        assert.strictEqual(threw.code, 1062)
    })

    it('should force update old instance', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })
        // first update should succeed
        var updateFoo = await foo.update({foo: 'bam'})
        // second update should succeed with force
        updateFoo = await foo.updateMeta({
            data: {foo: 'bar'},
            force: true,
        })
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {foo: 'bar'})
    })

    it('should merge data by default', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })
        // first update should succeed
        var updateFoo = await foo.updateMeta({
            data: {bar: 'bam'},
        })
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {foo: 'bar', bar: 'bam'})
    })

    it('should overwrite instead of merging with merge:false', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })
        // first update should succeed
        var updateFoo = await foo.updateMeta({
            data: {bar: 'bam'},
            merge: false,
        })
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {bar: 'bam'})
    })

})
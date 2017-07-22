'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const _ = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

chai.use(chaiAsPromised)
const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - cache select', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // connect to redis
    var redis = Redis.createClient({
        host: redisHost,
        port: redisPort,
    })

    // models
    var fooModel, fooModelGlobal, barModel, barModelGlobal
    // records
    var origBam, origBar, origFoo

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        await redis.flushdb()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        // create bar model related to foo
        barModelGlobal = new ImmutableCoreModel({
            columns: {
                fooId: 'id',
            },
            database: database,
            name: 'bar',
            redis: redis,
            relations: {
                foo: {},
            },
        })
        // sync with database
        await barModelGlobal.sync()
        // get local models
        fooModel = fooModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
        // create new bam instance
        origBam = await fooModel.create({
            bar: "0.000000000",
            foo: 'bam',
        })
        // create related
        await origBam.create('bar', {foo: 1})
        await origBam.create('bar', {foo: 2})
        // create new bar instance
        origBar = await fooModel.create({
            bar: "1.000000000",
            foo: 'bar',
        })
        // create new foo instance
        origFoo = await fooModel.create({
            bar: "2.000000000",
            foo: 'foo',
        })
        // create related
        await origFoo.create('bar', {foo: 3})
        await origFoo.create('bar', {foo: 4})
    })

    it('should cache queries with single id', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isTrue(foo._cached)
        assert.deepEqual(foo.ids, [origBar.id, origFoo.id])
    })

    it('should not return cached result if new record created', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isTrue(foo._cached)
        assert.deepEqual(foo.ids, [origBar.id, origFoo.id])
        // insert new record
        var baz = await fooModel.create({
            bar: 3,
            foo: 'baz'
        })
        // query should not be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isUndefined(foo._cached)
        assert.deepEqual(foo.ids, [origBar.id, origFoo.id, baz.id])
    })

    it('should not cache results when cache:false option set', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            cache: false,
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        foo = await fooModel.query({
            cache: false,
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isUndefined(foo._cached)
    })

})
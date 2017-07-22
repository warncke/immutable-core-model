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

describe('immutable-core-model - cache id', function () {

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
        // do first query to get record cached
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        var fooCached = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // check cached flag
        assert.isTrue(fooCached.raw._cached)
    })

    it('should cache queries with array of ids', async function () {
        // do first query to get record cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        var foosCached = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // check cached flag
        assert.isTrue(foosCached[0].raw._cached)
        assert.isTrue(foosCached[1].raw._cached)
    })

    it('should partially cache queries with array of ids', async function () {
        // do first query to get records cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should have 2 records cached and 1 not cached
        var foosCached = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id, origBam.id]
            },
        })
        // check cached flag
        assert.isTrue(foosCached[0].raw._cached)
        assert.isTrue(foosCached[1].raw._cached)
        assert.isUndefined(foosCached[2].raw._cached)
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // third query should have all records cached
        foosCached = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id, origBam.id]
            },
        })
        // check cached flag
        assert.isTrue(foosCached[0].raw._cached)
        assert.isTrue(foosCached[1].raw._cached)
        assert.isTrue(foosCached[2].raw._cached)
    })

    it('should use id cache with result each', async function () {
        // do first query to get records cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id, origBam.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // do query for all records with result
        var result = await fooModel.select.order.by.createTime
        // get records using each
        var context = await result.each((record, num, context) => {
            // check that record data matches
            context[num] = record
        })
        // check records
        assert.isTrue(context[0].raw._cached)
        assert.deepEqual(context[0].data, origBam.data)
        assert.strictEqual(context[0].id, origBam.id)
        assert.strictEqual(context[0].originalId, origBam.originalId)
        assert.strictEqual(context[0].parentId, origBam.parentId)
        assert.strictEqual(context[0].createTime, origBam.createTime)

        assert.isTrue(context[1].raw._cached)
        assert.deepEqual(context[1].data, origBar.data)
        assert.strictEqual(context[1].id, origBar.id)
        assert.strictEqual(context[1].originalId, origBar.originalId)
        assert.strictEqual(context[1].parentId, origBar.parentId)
        assert.strictEqual(context[1].createTime, origBar.createTime)

        assert.isTrue(context[2].raw._cached)
        assert.deepEqual(context[2].data, origFoo.data)
        assert.strictEqual(context[2].id, origFoo.id)
        assert.strictEqual(context[2].originalId, origFoo.originalId)
        assert.strictEqual(context[2].parentId, origFoo.parentId)
        assert.strictEqual(context[2].createTime, origFoo.createTime)
    })

    it('should use id cache with result fetch', async function () {
        // do first query to get records cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id, origBam.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // do query for all records with result
        var result = await fooModel.select.order.by.createTime
        // get records using each
        var records = await result.fetch(3)
        // check records
        assert.isTrue(records[0].raw._cached)
        assert.deepEqual(records[0].data, origBam.data)
        assert.strictEqual(records[0].id, origBam.id)
        assert.strictEqual(records[0].originalId, origBam.originalId)
        assert.strictEqual(records[0].parentId, origBam.parentId)
        assert.strictEqual(records[0].createTime, origBam.createTime)

        assert.isTrue(records[1].raw._cached)
        assert.deepEqual(records[1].data, origBar.data)
        assert.strictEqual(records[1].id, origBar.id)
        assert.strictEqual(records[1].originalId, origBar.originalId)
        assert.strictEqual(records[1].parentId, origBar.parentId)
        assert.strictEqual(records[1].createTime, origBar.createTime)

        assert.isTrue(records[2].raw._cached)
        assert.deepEqual(records[2].data, origFoo.data)
        assert.strictEqual(records[2].id, origFoo.id)
        assert.strictEqual(records[2].originalId, origFoo.originalId)
        assert.strictEqual(records[2].parentId, origFoo.parentId)
        assert.strictEqual(records[2].createTime, origFoo.createTime)
    })

    it('should use id cache with select all', async function () {
        // do first query to get records cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id, origBam.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // do query for all records with result
        var records = await fooModel.select.all.order.by.createTime

        // check records
        assert.isTrue(records[0].raw._cached)
        assert.deepEqual(records[0].data, origBam.data)
        assert.strictEqual(records[0].id, origBam.id)
        assert.strictEqual(records[0].originalId, origBam.originalId)
        assert.strictEqual(records[0].parentId, origBam.parentId)
        assert.strictEqual(records[0].createTime, origBam.createTime)

        assert.isTrue(records[1].raw._cached)
        assert.deepEqual(records[1].data, origBar.data)
        assert.strictEqual(records[1].id, origBar.id)
        assert.strictEqual(records[1].originalId, origBar.originalId)
        assert.strictEqual(records[1].parentId, origBar.parentId)
        assert.strictEqual(records[1].createTime, origBar.createTime)

        assert.isTrue(records[2].raw._cached)
        assert.deepEqual(records[2].data, origFoo.data)
        assert.strictEqual(records[2].id, origFoo.id)
        assert.strictEqual(records[2].originalId, origFoo.originalId)
        assert.strictEqual(records[2].parentId, origFoo.parentId)
        assert.strictEqual(records[2].createTime, origFoo.createTime)
    })

    it('should query related record with cache', async function () {
        // do first query to get records cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id, origBam.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // do second query which should have foo cached and load bar
        var foos = await fooModel.query({
            all: true,
            order: ['createTime'],
            with: {
                'bar': {
                    order: ['createTime'],
                },
            },
        })
        // check results
        assert.deepEqual(_.map(foos[0].related.bar, 'data.foo'), [1,2])
        assert.deepEqual(_.map(foos[1].related.bar, 'data.foo'), [])
        assert.deepEqual(_.map(foos[2].related.bar, 'data.foo'), [3,4])
        // bar records should not be cached
        assert.isUndefined(foos[0].related.bar[0].raw._cached)
        assert.isUndefined(foos[0].related.bar[1].raw._cached)
        assert.isUndefined(foos[2].related.bar[0].raw._cached)
        assert.isUndefined(foos[2].related.bar[1].raw._cached)
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // do third query and bar records should be cached
        var foos = await fooModel.query({
            all: true,
            order: ['createTime'],
            with: {
                'bar': {
                    order: ['createTime'],
                },
            },
        })
        // check results
        assert.isTrue(foos[0].related.bar[0].raw._cached)
        assert.isTrue(foos[0].related.bar[1].raw._cached)
        assert.isTrue(foos[2].related.bar[0].raw._cached)
        assert.isTrue(foos[2].related.bar[1].raw._cached)
    })

    it('should not cache when cache:false', async function () {
        // do first query to get record cached
        var foos = await fooModel.query({
            all: true,
            cache: false,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        var foosCached = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // check cached flag
        assert.isUndefined(foosCached[0].raw._cached)
        assert.isUndefined(foosCached[1].raw._cached)
    })

    it('should not return cached when cache:false', async function () {
        // do first query to get record cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        var foosCached = await fooModel.query({
            all: true,
            cache: false,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // check cached flag
        assert.isUndefined(foosCached[0].raw._cached)
        assert.isUndefined(foosCached[1].raw._cached)
    })

    it('should not return cached when schema changed', async function () {
        // do first query to get record cached
        var foos = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bam: 'string',
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        // get local foo
        fooModel = fooModelGlobal.session(session)
        // second query should be cached
        var foosCached = await fooModel.query({
            all: true,
            session: session,
            where: {
                id: [origFoo.id, origBar.id]
            },
        })
        // check cached flag
        assert.isUndefined(foosCached[0].raw._cached)
        assert.isUndefined(foosCached[1].raw._cached)
    })

})
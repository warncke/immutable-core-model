'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const ImmutableCoreModelView = require('immutable-core-model-view')
const Promise = require('bluebird')
const Redis = require('redis')
const _ = require('lodash')
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

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - cache views', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    var redis = Redis.createClient({
        host: redisHost,
        port: redisPort,
    })

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    var fooModel, fooModelGlobal

    var origBam, origBar, origFoo, origRecords

    // create data and views that will be used for all tests
    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await fooModelGlobal.sync()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // get local fooModel
        fooModel = fooModelGlobal.session(session)
        // create new bam instance
        origBam = await fooModel.create({
            bar: "0.000000000",
            foo: 'bam',
        })
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
        // list of original records in order added
        origRecords = [origBam, origBar, origFoo]
    })

    // reset models and re-create views for each test 
    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModelView.reset()
        ImmutableCoreModel.reset()
        // flush redis
        await redis.flushdb()
        // create collection model view
        new ImmutableCoreModelView({
            each: function (modelView, record, number, context) {
                // index data by foo property
                context[record.foo] = record
            },
            post: function (context) {
                // modify and return context
                context.post = true
                return context
            },
            pre: function () {
                // create initial context
                return {pre: true}
            },
            name: 'bar',
            type: 'collection',
        })
        // create async collection view
        new ImmutableCoreModelView({
            each: function (args) {
                var record = args.record
                // will be mrerged to context
                var context = {}
                // index data by foo property
                context[record.foo+'Async'] = record
                // return data to merge
                return context
            },
            post: function (args) {
                // return data that will be merged to context
                return {postAsync: true}
            },
            pre: function () {
                // create initial context
                return {preAsync: true}
            },
            name: 'barAsync',
            synchronous: false,
            type: 'collection',
        })
        // create record model view
        new ImmutableCoreModelView({
            each: function (modelView, record) {
                record.foo = record.foo+' food'
            },
            name: 'foo',
            type: 'record',
        })
        // create async record model view
        new ImmutableCoreModelView({
            each: function (args) {
                var record  = args.record
                record.foo = record.foo+' foodAsync'
                return record
            },
            name: 'fooAsync',
            synchronous: false,
            type: 'record',
        })
    })

    describe('with sync record view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                database: database,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'foo',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should cache view result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isTrue(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
        })

        it('should return partially cached result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
        })

        it('should cache raw record when caching view record', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food'])
            // second query without view should be cached
            var foo = await fooModel.select.one.where.id.eq(origBam.id).view(false)
            // check result
            assert.isTrue(foo.raw._cached)
            assert.strictEqual(foo.data.foo, 'bam')
        })
    })

    describe('with async record view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                database: database,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'fooAsync',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should cache view result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync', 'bar foodAsync'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isTrue(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync', 'bar foodAsync'])
        })

        it('should return partially cached result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync', 'bar foodAsync'])
        })

        it('should cache raw record when caching view record', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync'])
            // second query without view should be cached
            var foo = await fooModel.select.one.where.id.eq(origBam.id).view(false)
            // check result
            assert.isTrue(foo.raw._cached)
            assert.strictEqual(foo.data.foo, 'bam')
        })
    })

})
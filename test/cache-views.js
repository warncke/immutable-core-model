'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const ImmutableCoreModelView = require('immutable-core-model-view')
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

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe.only('immutable-core-model - cache views', function () {

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

    var origBam, origBar, origFoo, origRecords

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        await redis.flushdb()
        // create initial model
        var fooModelGlobal = new ImmutableCoreModel({
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
        var fooModel = fooModelGlobal.session(session)
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

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModelView.reset()
        ImmutableCoreModel.reset()
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

    it('should cache view result', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
            views: {
                default: 'foo',
            }
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.session(session).select.by.id(origBam.id)
        // view should be applied
        assert.strictEqual(foo.data.foo, origBam.data.foo+' food')
    })

})
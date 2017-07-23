'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
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

describe('immutable-core-model - query with relations', function () {

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

    // models to create
    var fooModelGlobal, bamModelGlobal, barModelGlobal
    // local models with session
    var fooModel, bamModel, barModel

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
            relations: {
                bar: {via: 'bam'},
            },
        })
        // create bam model
        bamModelGlobal = new ImmutableCoreModel({
            columns: {
                barId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                fooId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                data: false,
                originalId: false,
                parentId: false,
            },
            database: database,
            name: 'bam',
            redis: redis,
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'bar',
            redis: redis,
        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        await database.query('DROP TABLE IF EXISTS bam')
        await database.query('DROP TABLE IF EXISTS bar')
        // sync with database
        await fooModelGlobal.sync()
        await bamModelGlobal.sync()
        await barModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
        bamModel = bamModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
    })

    it('should query related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        await foo.create('bar', {foo: 'bam'})
        await foo.create('bar', {foo: 'bar'})
        await foo.create('bar', {foo: 'foo'})
        // load foo with related records
        var foo = await fooModel.query({
            limit: 1,
            where: {id: foo.id},
            with: {
                'bar': {
                    order: ['createTime'],
                },
            },
        })
        // foo should have related records
        assert.strictEqual(foo.related.bar.length, 3)
        assert.strictEqual(foo.related.bar[0].data.foo, 'bam')
        assert.strictEqual(foo.related.bar[1].data.foo, 'bar')
        assert.strictEqual(foo.related.bar[2].data.foo, 'foo')
    })

    it('should query related models for multiple records', async function () {
        // create foo instance
        var foo1 = await fooModel.create({foo: 'foo1'})
        // create related
        await foo1.create('bar', {foo: 'bam'})
        await foo1.create('bar', {foo: 'bar'})
        // create foo instance
        var foo2 = await fooModel.create({foo: 'foo1'})
        // create related
        await foo2.create('bar', {foo: 'bam'})
        await foo2.create('bar', {foo: 'baz'})
        // load foo with related records
        var foos = await fooModel.query({
            all: true,
            order: ['createTime'],
            with: {
                'bar': {
                    order: ['createTime'],
                },
            },
        })
        // validate data
        assert.strictEqual(foos.length, 2)
        assert.strictEqual(foos[0].related.bar.length, 2)
        assert.strictEqual(foos[0].related.bar[0].data.foo, 'bam')
        assert.strictEqual(foos[0].related.bar[1].data.foo, 'bar')
        assert.strictEqual(foos[1].related.bar.length, 2)
        assert.strictEqual(foos[1].related.bar[0].data.foo, 'bam')
        assert.strictEqual(foos[1].related.bar[1].data.foo, 'baz')
    })

})
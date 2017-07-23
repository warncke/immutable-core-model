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

describe('immutable-core-model - relations via id', function () {

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

    before(async function () {
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

    it('should create related model and via', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        var bar = await foo.create('bar', {foo: 'bar'})
        // load via
        var via = await bamModel.select.one.by.fooId(foo.id)
        // check that bar and via created and ids match
        assert.isObject(bar)
        assert.isObject(via)
        assert.strictEqual(via.fooId, foo.id)
        assert.strictEqual(via.barId, bar.id)
    })

    it('should create related model and via from opposite model', async function () {
        // create bar instance
        var bar = await barModel.create({foo: 'bar'})
        // create related
        var foo = await bar.create('foo', {foo: 'foo'})
        // load via
        var via = await bamModel.select.one.by.barId(bar.id)
        // check that bar and via created and ids match
        assert.isObject(bar)
        assert.isObject(via)
        assert.strictEqual(via.fooId, foo.id)
        assert.strictEqual(via.barId, bar.id)
    })

    it('should select related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        await foo.create('bar', {foo: 'bam'})
        await foo.create('bar', {foo: 'bar'})
        // load related
        var result = await foo.select('bar')
        // check result
        assert.strictEqual(result.length, 2)
    })

    it('should select inverse related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        var bar = await foo.create('bar', {foo: 'bam'})
        // load related
        var result = await bar.select('foo')
        // check result
        assert.strictEqual(result.length, 1)
    })

    it('should query related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        await foo.create('bar', {foo: 'bam'})
        await foo.create('bar', {foo: 'bar'})
        await foo.create('bar', {foo: 'foo'})
        // load related desc
        var result = await foo.query({
            order: ['createTime', 'DESC'],
            relation: 'bar',
        })
        // fetch results
        var desc = await result.fetch(3)
        // load related asc
        var result = await foo.query({
            order: ['createTime'],
            relation: 'bar',
        })
        // fetch results
        var asc = await result.fetch(3)
        // check result
        assert.strictEqual(asc.length, 3)
        assert.strictEqual(asc[0].data.foo, 'bam')
        assert.strictEqual(asc[1].data.foo, 'bar')
        assert.strictEqual(asc[2].data.foo, 'foo')
        assert.strictEqual(desc.length, 3)
        assert.strictEqual(desc[0].data.foo, 'foo')
        assert.strictEqual(desc[1].data.foo, 'bar')
        assert.strictEqual(desc[2].data.foo, 'bam')
    })

})
'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const elasticsearch = require('elasticsearch')
const immutable = require('immutable-core')
const nullFunction = require('null-function')

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

const esHost = process.env.ES_HOST || 'localhost:9200'

describe('immutable-core-model - elasticsearch create', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // connect to redis if TEST_CACHE enabled
    if (testCache) {
        var redis = Redis.createClient({
            host: redisHost,
            port: redisPort,
        })
    }

    // create elasticsearch connection for testing
    const elasticsearchClient = new elasticsearch.Client({
        host: esHost,
    })

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
        // clean up elasticsearch
        await elasticsearchClient.indices.delete({
            index: 'foo'
        }).catch(nullFunction)
        // clean up database tables
        await database.query('DROP TABLE IF EXISTS foo')

    })

    it('should create document when creating record', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {foo: 1},
            session: session,
        })
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearchClient.get({
            id: foo.originalId,
            index: 'foo',
            type: 'foo',
        })
        // validate record
        assert.isObject(res)
        assert.strictEqual(res._index, 'foo')
        assert.strictEqual(res._type, 'foo')
        assert.strictEqual(res._id, foo.originalId)
        assert.deepEqual(res._source, {
            accountId: session.accountId,
            createTime: foo.createTime,
            d: '0',
            data: foo.data,
            id: foo.id,
            originalId: foo.originalId,
            sessionId: session.sessionId,
        })
    })

    it('should update document when updating record', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {foo: 1},
            session: session,
        })
        // update foo
        var newFoo = await foo.update({foo: 2})
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearchClient.get({
            id: foo.originalId,
            index: 'foo',
            type: 'foo',
        })
        // validate record
        assert.isObject(res)
        assert.strictEqual(res._index, 'foo')
        assert.strictEqual(res._type, 'foo')
        assert.strictEqual(res._id, foo.originalId)
        assert.deepEqual(res._source, {
            accountId: session.accountId,
            createTime: newFoo.createTime,
            d: '0',
            data: newFoo.data,
            id: newFoo.id,
            originalId: newFoo.originalId,
            parentId: newFoo.parentId,
            sessionId: session.sessionId,
        })
    })

    it('should set type from data', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            esType: 'bar.bam',
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {
                bar: { bam: 'myFoo' },
                foo: 1,
            },
            session: session,
        })
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearchClient.get({
            id: foo.originalId,
            index: 'foo',
            type: 'myFoo',
        })
        // validate record
        assert.isObject(res)
        assert.deepEqual(res._source.data, foo.data)
    })

    it('should default to name when type not in data', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            esType: 'bar.bam',
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {
                foo: 1,
            },
            session: session,
        })
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearchClient.get({
            id: foo.originalId,
            index: 'foo',
            type: 'foo',
        })
        // validate record
        assert.isObject(res)
        assert.deepEqual(res._source.data, foo.data)
    })

})
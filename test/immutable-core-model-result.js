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

describe('immutable-core-model-result', function () {

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

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
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
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await fooModelGlobal.sync()
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
    })

    it('should return result object when doing multi-record query', async function () {
        // do query for all records
        var result = await fooModel.query({
            session: session,
        })
        // check that result has records
        assert.strictEqual(result.length, 3)
    })

    it('should iterate over rows with each', async function () {
        // query all rows
        var result = await fooModel.query({
            session: session,
        })
        // set fetchNum to 1 so that it does a query for each iteration
        result.fetchNum = 1
        // iterate over records
        var context = await result.each((record, number, context) => {
            // check that number fetched matches loop
            assert.strictEqual(result.fetched, number + 1)
            // keep track of objects fetched in context
            context[record.data.foo] = record.data.bar
        })
        // expect result iteration to be done
        assert.isTrue(result.done)
        // check that results fetched and context returned
        assert.deepEqual(context, {
            bam: '0.000000000',
            bar: '1.000000000',
            foo: '2.000000000',
        })
    })

    it('should fetch multiple rows and buffer', async function () {
        // query all rows
        var result = await fooModel.query({
            session: session,
        })
        // iterate over records
        var context = await result.each((record, number, context) => {
            // all rows should be fetched before first call
            assert.strictEqual(result.fetched, 3)
            // keep track of objects fetched in context
            context[record.data.foo] = record.data.bar
        })
        // expect result iteration to be done
        assert.isTrue(result.done)
        // check that results fetched and context returned
        assert.deepEqual(context, {
            bam: '0.000000000',
            bar: '1.000000000',
            foo: '2.000000000',
        })
    })

    it('should order iteration correctly', async function () {
        // query all rows
        var result = await fooModel.query({
            order: ['bar'],
            session: session,
        })
        // iterate over records
        var context = await result.each((record, number, context) => {
            // check that order is correct (0,1,2)
            assert.strictEqual(parseInt(record.data.bar), number)
        })
        // expect result iteration to be done
        assert.isTrue(result.done)
    })

    it('should fetch records with limit', async function () {
        // query all rows
        var result = await fooModel.query({
            order: 'createTime',
            session: session,
        })
        // fetch 2 records
        var records = await result.fetch(2)
        // validate records
        assert.deepEqual(records[0].data, {
            bar: "0.000000000",
            foo: 'bam',
        })
        assert.deepEqual(records[1].data, {
            bar: "1.000000000",
            foo: 'bar',
        })
    })

    it('should fetch records with limit and offset', async function () {
        // query all rows
        var result = await fooModel.query({
            order: 'createTime',
            session: session,
        })
        // fetch max 2 records, starting with 3rd record
        var records = await result.fetch(2, 2)
        // should get 1
        assert.strictEqual(records.length, 1)
        // validate records
        assert.deepEqual(records[0].data, {
            bar: "2.000000000",
            foo: 'foo',
        })
    })

    it('should have class properties', async function () {
        // query all rows
        var result = await fooModel.query({
            order: 'createTime',
            session: session,
        })
        // check for class properties
        assert.isTrue(result.ImmutableCoreModelResult)
        assert.strictEqual(result.class, 'ImmutableCoreModelResult')
    })

})
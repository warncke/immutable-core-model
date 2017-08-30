'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
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

const testCache = process.env.TEST_CACHE === '1' ? true : false

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - query resolve only', function () {

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
    // instances
    var foo, bam1, bam2, bar1, bar2, origBam1, origBam2, origBar1, origBar2

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
        // create instances that will be linked to foo
        origBam1 = await bamModel.create({bam: 1})
        origBam2 = await bamModel.create({bam: 2})
        origBar1 = await barModel.create({bar: 1})
        origBar2 = await barModel.create({bar: 2})
        // create updates to each instance
        bam1 = await origBam1.update({bam: 10})
        bam2 = await origBam2.update({bam: 20})
        bar1 = await origBar1.update({bar: 10})
        bar2 = await origBar2.update({bar: 20})
    })

    describe('with array of ids identified by model name', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bam: [bam1.id, bam2.id],
                bars: [bar2.originalId, bar1.originalId],
            })

        })

        it('should resolve property with property:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    bam: true,
                },
                where: {id: foo.id}
            })
            // check results
            assert.deepEqual(_.map(res.data.bam, 'id'), [bam1.id, bam2.id])
            assert.deepEqual(res.data.bars, [bar2.originalId, bar1.originalId])
        })

        it('should resolve property with custom setProperty', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    bam: {setProperty: 'foo'},
                },
                where: {id: foo.id}
            })
            // check results
            assert.deepEqual(_.map(res.data.foo, 'id'), [bam1.id, bam2.id])
            assert.deepEqual(res.data.bam, [bam1.id, bam2.id])
            assert.deepEqual(res.data.bars, [bar2.originalId, bar1.originalId])
        })

        it('should resolve current property with originalId', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    bam: true,
                    bars: {isOriginalId: true},
                },
                where: {id: foo.id}
            })
            // check results
            assert.deepEqual(_.map(res.data.bam, 'id'), [bam1.id, bam2.id])
            assert.deepEqual(_.map(res.data.bars, 'originalId'), [bar2.originalId, bar1.originalId])
        })

    })

    describe('with an id object identified by id', function () {

        var bars

        beforeEach(async function () {
            bars = {}
            bars[bar1.originalId] = true
            bars[bar2.originalId] = true
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({barOriginalId: bars})
        })

        it('should resolve exact objects with isOriginalId:false', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    barOriginalId: {isOriginalId: false},
                },
                where: {id: foo.id}
            })
            // check results
            assert.isDefined(res.data.bar[bar1.originalId])
            assert.isDefined(res.data.bar[bar2.originalId])
        })

    })

    describe('with array of objects that contain id column', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bams: [
                    {bamId: origBam1.id},
                    {bamId: origBam2.id},
                ],
                bars: [
                    {barOriginalId: bar1.originalId},
                    {barOriginalId: bar2.originalId},
                ],
            })
        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    bams: true,
                },
                where: {id: foo.id}
            })
            // check results
            assert.isDefined(res.data.bams[0].data)
            assert.strictEqual(res.data.bams[0].data.bam, 1);
            assert.isDefined(res.data.bams[1].data)
            assert.strictEqual(res.data.bams[1].data.bam, 2);
        })

    })

    describe('with an id object identified by property name for different model', function () {

        var bars

        beforeEach(async function () {
            bars = {}
            bars[bar1.originalId] = true
            bars[bar2.originalId] = true
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({foo: bars})
        })

        it('should resolve exact objects with modelName', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    foo: {modelName: 'bar'},
                },
                where: {id: foo.id}
            })
            // check results
            assert.isDefined(res.data.foo[bar1.originalId])
            assert.isDefined(res.data.foo[bar2.originalId])
        })

        it('should resolve current objects with modelProperty', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: {
                    foo: {modelProperty: 'barOriginalId'},
                },
                where: {id: foo.id}
            })
            // check results
            assert.isDefined(res.data.bar[bar1.originalId])
            assert.isDefined(res.data.bar[bar2.originalId])
        })

    })

})
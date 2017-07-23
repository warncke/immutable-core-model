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

describe('immutable-core-model - delete instance', function () {

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
        roles: ['all'],
        sessionId: '22222222222222222222222222222222',
    }

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo, origGrr

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
            accessControlRules: [
                'list:deleted:any:1',
                'read:deleted:any:1',
                'unDelete:deleted:any:1',
            ],
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
        // get local foo model
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
        // create new grr instance
        origGrr = await fooModel.create({
            bar: "3.000000000",
            foo: 'grr',
        })
        // delete grr
        origGrr.delete()
    })

    it('should have action properties', async function () {
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // foo should have action properties
        assert.isFalse(foo.isDeleted)
    })

    it('should have action methods', async function () {
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // foo should have action methods
        assert.strictEqual(typeof foo.delete, 'function')
        assert.strictEqual(typeof foo.unDelete, 'function')
        assert.strictEqual(typeof foo.undelete, 'function')
    })

    it('should query deleted instance', async function () {
        var all = await fooModel.query({
            all: true,
            session: session,
            where: {
                isDeleted: true,
            },
        })
        // check return
        assert.strictEqual(all.length, 1)
        assert.deepEqual(all[0].data, origGrr.data)
    })

    it('should query not-deleted instances', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: {
                isDeleted: false,
            },
        })
        // check return
        assert.strictEqual(all.length, 3)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should query both deleted and not-deleted instances', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: {
                isDeleted: null,
            },
        })
        // check return
        assert.strictEqual(all.length, 4)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

    it('should select deleted instance', async function () {
        var all = await fooModel.select.all
            .where.isDeleted(true)
        // check return
        assert.strictEqual(all.length, 1)
        assert.deepEqual(all[0].data, origGrr.data)
    })

    it('should select not-deleted instances', async function () {
        var all = await fooModel.select.all
            .where.isDeleted(false)
            .order.by.createTime
        // check return
        assert.strictEqual(all.length, 3)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should query both deleted and not-deleted instances', async function () {
        var all = await fooModel.select.all
            .where.isDeleted(null)
            .order.by.createTime
        // check return
        assert.strictEqual(all.length, 4)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

    it('should have result sets with both deleted and not-deleted instances', async function () {
        // get result set
        var result = await fooModel.select
            .where.isDeleted(null)
            .order.by.createTime
        // get records
        var all = await result.fetch(4)
        // check return
        assert.strictEqual(all.length, 4)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

    it('should delete record', async function () {
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // delete foo
        foo = await foo.delete()
        // foo should be deleted
        assert.isTrue(foo.isDeleted)
    })

    it('should undelete record', async function () {
        var foo = await fooModel.query({
            current: true,
            limit: 1,
            session: session,
            where: {
                id: origFoo.id,
                isDeleted: null,
            },
        })
        // make sure foo is deleted
        if (!foo.isDeleted) {
            foo = await foo.delete()
        }
        // foo should be deleted
        assert.isTrue(foo.isDeleted)
        // undelete foo
        foo = await foo.undelete()
        // foo should not be deleted
        assert.isFalse(foo.isDeleted)
    })

    it('delete another instance', async function () {
        var bar = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origBar.id
            },
        })
        // delete bar
        bar = await bar.delete()
        // bar should be deleted
        assert.isTrue(bar.isDeleted)
    })

    it('should not return deleted records in queries', async function () {
        var foos = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
        })
        // results should not include deleted record
        assert.strictEqual(foos.length, 2)
        assert.deepEqual(foos[0].data, origBam.data)
        assert.deepEqual(foos[1].data, origFoo.data)
    })
})
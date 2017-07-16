'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

chai.use(chaiAsPromised)
const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - query', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // variable to populate in before
    var fooModel, origBam, origBar, origFoo, origGrr

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await fooModel.sync()
        // create instances with different data values for testing
        origBam = await fooModel.createMeta({
            data: {
                bar: "0.000000000",
                foo: 'bam',
            },
            session: session,
        })
        origBar = await fooModel.createMeta({
            data: {
                bar: "1.000000000",
                foo: 'bar',
            },
            session: session,
        })
        origFoo = await fooModel.createMeta({
            data: {
                bar: "2.000000000",
                foo: 'foo',
            },
            session: session,
        })
    })

    it('should do query by id', async function () {
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // verify that objects match
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should do query by string column', async function () {
        var bar = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                foo: 'bar'
            },
        })
        // verify that objects match
        assert.deepEqual(bar.data, origBar.data)
    })

    it('should do query by number column', async function () {
        var bam = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                bar: 0
            },
        })
        // verify that objects match
        assert.deepEqual(bam.data, origBam.data)
    })

    it('should query all', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
        })
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should order desc', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime', 'desc'],
            session: session,
        })
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origFoo.data, origBar.data, origBam.data]
        )
    })

    it('should order with multiple clauses', async function () {
        var all = await fooModel.query({
            all: true,
            order: [
                ['sessionId', 'accountId', 'asc'],
                ['createTime', 'desc'],
            ],
            session: session,
        })
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origFoo.data, origBar.data, origBam.data]
        )
    })

    it('should do in query with array', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { id: [
                origBam.id,
                origBar.id,
                origFoo.id,
            ] },
        })
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do in query', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { id: { in: [
                origBam.id,
                origBar.id,
                origFoo.id,
            ] } },
        })
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do not in query', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: {
                id: { not: { in: [
                    origBam.id,
                    origBar.id,
                ] } },
            },
        })
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do like query', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { foo: { like: 'ba%' } },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do not like query', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { foo: { not: { like: 'ba%' } } },
        })
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do greater than', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: {gt: 0} },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do not greater than', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: { not: {gt: 0} } },
        })
        // there should be 1 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origBam.data]
        )
    })

    it('should do greater than or equal', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: { gte: 1 } },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do less than', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: { lt: 2 } },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do not less than', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: { not: {lt: 2} } },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do less than or equal', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: { lte: 1 } },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do between', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { bar: { between: [0, 1] } },
        })
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do where null', async function () {
        // create new foo instance with null foo property
        origGrr = await fooModel.createMeta({
            data: {
                bar: "3.000000000",
            },
            session: session,
        })
        // do query for foo null
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { foo: null },
        })
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origGrr.data]
        )
    })

    it('should do not null', async function () {
        // create new foo instance with null foo property
        origGrr = await fooModel.createMeta({
            data: {
                bar: "3.000000000",
            },
            session: session,
        })
        // do query for foo null
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { foo: { not: null } },
        })
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do equals query', async function () {
        var all = await fooModel.query({
            all: true,
            session: session,
            where: { foo: { eq: 'bar' } },
        })
        // there should be 1 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origBar.data]
        )
    })

    it('should do not equals query', async function () {
        var all = await fooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            where: { foo: { not: { eq: 'bar' } } },
        })
        // there should be 2 results - does not return origGrr with null foo
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origFoo.data]
        )
    })

})
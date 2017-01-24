'use strict'

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

describe('immutable-core-model - select', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    // reset immutable so that model modules are recreated with every test
    immutable.reset().strictArgs(false)
    // create initial model
    var glboalFooModel = new ImmutableCoreModel({
        columns: {
            bar: 'number',
            foo: 'string',
        },
        database: database,
        name: 'foo',
    })
    // create local foo model with session for select queries
    var fooModel = glboalFooModel.session(session)

    // variable to populate in before
    var origBam
    var origBar
    var origFoo
    var origGrr

    before(async function () {
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await glboalFooModel.sync()
            // create instances with different data values for testing
            origBam = await glboalFooModel.createMeta({
                data: {
                    bar: "0.000000000",
                    foo: 'bam',
                },
                session: session,
            })
            origBar = await glboalFooModel.createMeta({
                data: {
                    bar: "1.000000000",
                    foo: 'bar',
                },
                session: session,
            })
            origFoo = await glboalFooModel.createMeta({
                data: {
                    bar: "2.000000000",
                    foo: 'foo',
                },
                session: session,
            })
        }
        catch (err) {
            throw err
        }
    })

    it('should do query by id', async function () {
        try {
            var foo = await fooModel.select.by.id(origFoo.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should do query by string column', async function () {
        try {
            var bar = await fooModel.select.one.by.foo('bar')
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(bar.data, origBar.data)
    })

    it('should do query by number column', async function () {
        try {
            var bam = await fooModel.select.one.by.bar(0)
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(bam.data, origBam.data)
    })

    it('should query all with order', async function () {
        try {
            var all = await fooModel.select.all.order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should query all with limit after order', async function () {
        try {
            var all = await fooModel.select.all
                .order.by.createTime
                .limit(2).query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should query all with limit and offset after order', async function () {
        try {
            var all = await fooModel.select.all
                .order.by.createTime
                .limit(2).offset(1).query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should throw error when setting limit(1) after select.all', async function () {
        try {
            var all = await fooModel.select.all
                .order.by.createTime
                .limit(1).query()
        }
        catch (err) {
            var error = err.message
        }
        // check that error thrown
        assert.match(error, /limit\(1\) not allowed with select\.all/)
    })

    it('should order desc', async function () {
        try {
            var all = await fooModel.select.all.order.by.createTime.desc.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origFoo.data, origBar.data, origBam.data]
        )
    })

    it('should order with multiple clauses', async function () {
        try {
            var all = await fooModel.select.all
                .order.by.sessionId.accountId.asc
                .createTime.desc.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origFoo.data, origBar.data, origBam.data]
        )
    })

    it('should order with multiple clauses and limit', async function () {
        try {
            var all = await fooModel.select.all
                .order.by.sessionId.accountId.asc
                .createTime.desc
                .limit(2).query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origFoo.data, origBar.data]
        )
    })

    it('should do in query', async function () {
        try {
            var all = await fooModel.select.all
                .where.id.in([origBam.id, origBar.id, origFoo.id])
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do in query with limit and offset', async function () {
        try {
            var all = await fooModel.select.all
                .where.id.in([origBam.id, origBar.id, origFoo.id])
                .order.by.createTime
                .limit(2).offset(1).query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do not in query', async function () {
        try {
            var all = await fooModel.select.all
                .where.id.not.in([origBam.id, origBar.id])
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do like query', async function () {
        try {
            var all = await fooModel.select.all
                .where.foo.like('ba%')
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do not like query', async function () {
        try {
            var all = await fooModel.select.all
                .where.foo.not.like('ba%')
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do greater than', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.gt(0)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do not greater than', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.not.gt(0)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 1 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origBam.data]
        )
    })

    it('should do greater than or equal', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.gte(1)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do less than', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.lt(2)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do not less than', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.not.lt(2)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do less than or equal', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.lte(1)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do between', async function () {
        try {
            var all = await fooModel.select.all
                .where.bar.between([0,1])
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do where null', async function () {
        try {
            // create new foo instance with null foo property
            origGrr = await fooModel.createMeta({
                data: {
                    bar: "3.000000000",
                },
                session: session,
            })
            // do query for foo null
            var all = await fooModel.select.all
                .where.foo.null
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origGrr.data]
        )
    })

    it('should do where is null', async function () {
        try {
            // do query for foo null
            var all = await fooModel.select.all
                .where.foo.is.null
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origGrr.data]
        )
    })

    it('should do not null', async function () {
        try {
            // do query for foo null
            var all = await fooModel.select.all
                .where.foo.not.null
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do is not null', async function () {
        try {
            // do query for foo null
            var all = await fooModel.select.all
                .where.foo.is.not.null
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do equals query', async function () {
        try {
            var all = await fooModel.select.all
                .where.foo.eq('bar')
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 1 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origBar.data]
        )
    })

    it('should do not equals query', async function () {
        try {
            var all = await fooModel.select.all
                .where.foo.not.eq('bar')
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 2 results - does not return origGrr with null foo
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origFoo.data]
        )
    })

    it('should do select with order and no where', async function () {
        try {
            // do query for foo null
            var all = await fooModel.select.all
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should be 4 results
        assert.strictEqual(all.length, 4)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

})
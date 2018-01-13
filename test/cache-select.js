'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - cache select', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv({redis: true})
    })

    beforeEach(async function () {
        await reset(database, redis)
    })

    after(async function () {
        await database.close()
    })

    // models
    var fooModel, fooModelGlobal, barModel, barModelGlobal
    // records
    var origBam, origBar, origFoo

    beforeEach(async function () {
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
        // sync with database
        await fooModelGlobal.sync()
        // create bar model related to foo
        barModelGlobal = new ImmutableCoreModel({
            columns: {
                fooId: 'id',
            },
            database: database,
            name: 'bar',
            redis: redis,
            relations: {
                foo: {},
            },
        })
        // sync with database
        await barModelGlobal.sync()
        // get local models
        fooModel = fooModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
        // create new bam instance
        origBam = await fooModel.create({
            bar: "0.000000000",
            foo: 'bam',
        })
        // create related
        await origBam.create('bar', {foo: 1})
        await origBam.create('bar', {foo: 2})
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
        // create related
        await origFoo.create('bar', {foo: 3})
        await origFoo.create('bar', {foo: 4})
    })

    it('should cache queries with single id', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isTrue(foo._cached)
        assert.deepEqual(foo.ids, [origBar.id, origFoo.id])
    })

    it('should not return cached result if new record created', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isTrue(foo._cached)
        assert.deepEqual(foo.ids, [origBar.id, origFoo.id])
        // insert new record
        var baz = await fooModel.create({
            bar: 3,
            foo: 'baz'
        })
        // query should not be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isUndefined(foo._cached)
        assert.deepEqual(foo.ids, [origBar.id, origFoo.id, baz.id])
    })

    it('should not cache results when cache:false option set', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            cache: false,
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // second query should be cached
        foo = await fooModel.query({
            cache: false,
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isUndefined(foo._cached)
    })

    it('should not return cached when schema changed', async function () {
        // do first query to get query cached
        var foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // wait to make sure async cache set has time to complete
        await Promise.delay(100)
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bam: 'string',
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        // get local foo
        fooModel = fooModelGlobal.session(session)
        // second query should be cached
        foo = await fooModel.query({
            order: 'createTime',
            where: {
                bar: { gte: 1 },
            },
        })
        // check result
        assert.isUndefined(foo._cached)
    })

})
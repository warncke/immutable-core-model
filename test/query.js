'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - query', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.end()
    })

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo, origGrr

    before(async function () {
        await reset(mysql, redis)
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
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

    it('should do query by id', async function () {
        var foo = await fooModel.query({
            limit: 1,
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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
            order: 'createTime',
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

    it('should do query with plain object result', async function () {
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: origFoo.id
            },
        })
        var fooPlain = await fooModel.query({
            limit: 1,
            plain: true,
            where: {
                id: origFoo.id
            },
        })
        // verify that objects match
        assert.deepEqual(fooPlain, foo.toJSON())
    })

    it('should do query plain object from result set', async function () {
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: origFoo.id
            },
        })
        var foos = await fooModel.query({
            plain: true,
            where: {
                id: {in: [origBam.id, origBar.id, origFoo.id]}
            },
        })

        foos = await foos.all()

        // verify that objects match
        assert.deepEqual(foos[2], foo.toJSON())
    })
})
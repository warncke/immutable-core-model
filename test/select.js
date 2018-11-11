'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - select', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.close()
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
        var foo = await fooModel.select.by.id(origFoo.id)
        // verify that objects match
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should do query by string column', async function () {
        var bar = await fooModel.select.one.by.foo('bar')
        // verify that objects match
        assert.deepEqual(bar.data, origBar.data)
    })

    it('should do query by number column', async function () {
        var bam = await fooModel.select.one.by.bar(0)
        // verify that objects match
        assert.deepEqual(bam.data, origBam.data)
    })

    it('should query all with order', async function () {
        var all = await fooModel.select.all.order.by.createTime
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should query all with limit after order', async function () {
        var all = await fooModel.select.all
            .order.by.createTime
            .limit(2)
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should query all with limit and offset after order', async function () {
        var all = await fooModel.select.all
            .order.by.createTime
            .limit(2).offset(1)
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
                .limit(1)
        }
        catch (err) {
            var error = err.message
        }
        // check that error thrown
        assert.match(error, /limit\(1\) not allowed with select\.all/)
    })

    it('should order desc', async function () {
        var all = await fooModel.select.all.order.by.createTime.desc
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origFoo.data, origBar.data, origBam.data]
        )
    })

    it('should order with multiple clauses', async function () {
        var all = await fooModel.select.all
            .order.by.sessionId.accountId.asc
            .createTime.desc
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origFoo.data, origBar.data, origBam.data]
        )
    })

    it('should order with multiple clauses and limit', async function () {
        var all = await fooModel.select.all
            .order.by.sessionId.accountId.asc
            .createTime.desc
            .limit(2)
        // there should be 3 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origFoo.data, origBar.data]
        )
    })

    it('should do in query', async function () {
        var all = await fooModel.select.all
            .where.id.in([origBam.id, origBar.id, origFoo.id])
            .order.by.createTime
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do in query with limit and offset', async function () {
        var all = await fooModel.select.all
            .where.id.in([origBam.id, origBar.id, origFoo.id])
            .order.by.createTime
            .limit(2).offset(1)
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do not in query', async function () {
        var all = await fooModel.select.all
            .where.id.not.in([origBam.id, origBar.id])
            .order.by.createTime
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do like query', async function () {
        var all = await fooModel.select.all
            .where.foo.like('ba%')
            .order.by.createTime
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do not like query', async function () {
        var all = await fooModel.select.all
            .where.foo.not.like('ba%')
            .order.by.createTime
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do greater than', async function () {
        var all = await fooModel.select.all
            .where.bar.gt(0)
            .order.by.createTime
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do not greater than', async function () {
        var all = await fooModel.select.all
            .where.bar.not.gt(0)
            .order.by.createTime
        // there should be 1 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origBam.data]
        )
    })

    it('should do greater than or equal', async function () {
        var all = await fooModel.select.all
            .where.bar.gte(1)
            .order.by.createTime
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBar.data, origFoo.data]
        )
    })

    it('should do less than', async function () {
        var all = await fooModel.select.all
            .where.bar.lt(2)
            .order.by.createTime
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do not less than', async function () {
        var all = await fooModel.select.all
            .where.bar.not.lt(2)
            .order.by.createTime
        // there should be 2 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origFoo.data]
        )
    })

    it('should do less than or equal', async function () {
        var all = await fooModel.select.all
            .where.bar.lte(1)
            .order.by.createTime
        // there should be 2 results
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origBar.data]
        )
    })

    it('should do between', async function () {
        var all = await fooModel.select.all
            .where.bar.between([0,1])
            .order.by.createTime
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
        var all = await fooModel.select.all
            .where.foo.null
            .order.by.createTime
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origGrr.data]
        )
    })

    it('should do where is null', async function () {
        // do query for foo null
        var all = await fooModel.select.all
            .where.foo.is.null
            .order.by.createTime
        // there should be 1 result
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origGrr.data]
        )
    })

    it('should do not null', async function () {
        // do query for foo null
        var all = await fooModel.select.all
            .where.foo.not.null
            .order.by.createTime
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do is not null', async function () {
        // do query for foo null
        var all = await fooModel.select.all
            .where.foo.is.not.null
            .order.by.createTime
        // there should be 3 results
        assert.strictEqual(all.length, 3)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should do equals query', async function () {
        var all = await fooModel.select.all
            .where.foo.eq('bar')
            .order.by.createTime
        // there should be 1 results
        assert.strictEqual(all.length, 1)
        // verify that objects match
        assert.deepEqual(
            [all[0].data],
            [origBar.data]
        )
    })

    it('should do not equals query', async function () {
        var all = await fooModel.select.all
            .where.foo.not.eq('bar')
            .order.by.createTime
        // there should be 2 results - does not return origGrr with null foo
        assert.strictEqual(all.length, 2)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data],
            [origBam.data, origFoo.data]
        )
    })

    it('should do select with order and no where', async function () {
        // do query for foo null
        var all = await fooModel.select.all
            .order.by.createTime
        // there should be 4 results
        assert.strictEqual(all.length, 4)
        // verify that objects match
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

    it('should do call error callback in then', async function () {
        var thrown
        // do query for foo null
        await fooModel.select.required.where.id.eq('xxx').then(
            res => {},
            err => { thrown = err}
        )
        // check error
        assert.isDefined(thrown)
    })

    it('should return promise if then is undefined', async function () {
        // do query for foo null
        return fooModel.select.where.id.eq(origBam.id).then().then(res => {
            // check error
            assert.isDefined(res)
            assert.strictEqual(res.length, 1)
        })
    })

    it('should execute using query()', async function () {
        // do query for foo null
        var res = await fooModel.select.where.id.eq(origBam.id).query()
        // check error
        assert.isDefined(res)
        assert.strictEqual(res.length, 1)
    })

    it('should do isCurrent check with select.where', async function () {
        // do query for foo null
        var res = await fooModel.select.one.isCurrent.where.id.eq(origBam.id)
        // check error
        assert.isDefined(res)
        assert.isTrue(res.isCurrent)
    })

    it('should do isCurrent check with select.by.id', async function () {
        // do query for foo null
        var res = await fooModel.select.isCurrent.by.id(origBam.id)
        // check error
        assert.isDefined(res)
        assert.isTrue(res.isCurrent)
    })

    it('should select plain object', async function () {
        var foo = await fooModel.select.by.id(origFoo.id)
        var fooPlain = await fooModel.select.plain.by.id(origFoo.id)
        // verify that objects match
        assert.deepEqual(fooPlain, foo.toJSON())
    })

})
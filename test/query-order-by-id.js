'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - query result ordered by ids', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(mysql, redis)
    })

    after(async function () {
        await mysql.close()
    })

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo

    beforeEach(async function () {
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
        // create local foo model
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

    it('should order by ids with id param as array of ids', async function () {
        // select foos by id
        var foos = await fooModel.select.by.id([origFoo.id, origBar.id, origBam.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [origFoo.id, origBar.id, origBam.id])
        // select foos by id
        foos = await fooModel.select.by.id([origBar.id, origFoo.id, origBam.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [origBar.id, origFoo.id, origBam.id])
    })

    it('should order by ids with id in query', async function () {
        // select foos by id
        var foos = await fooModel.select.all.where.id.in([origFoo.id, origBar.id, origBam.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [origFoo.id, origBar.id, origBam.id])
        // select foos by id
        foos = await fooModel.select.all.where.id.in([origBar.id, origFoo.id, origBam.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [origBar.id, origFoo.id, origBam.id])
    })

    it('should order by ids when select result set', async function () {
        // select foos by id
        var res = await fooModel.select.where.id.in([origFoo.id, origBar.id, origBam.id])
        // check order of result
        assert.deepEqual(res.ids, [origFoo.id, origBar.id, origBam.id])
        // select foos by id
        res = await fooModel.select.where.id.in([origBar.id, origFoo.id, origBam.id])
        // check order of result
        assert.deepEqual(res.ids, [origBar.id, origFoo.id, origBam.id])
    })

    it('should order by queried ids when selecting current revision with array of ids', async function () {
        var newBam = await origBam.update({bar: 10})
        var newBar = await origBar.update({bar: 20})
        var newFoo = await origFoo.update({bar: 30})
        // select current records by old id
        var foos = await fooModel.select.current.by.id([origFoo.id, origBar.id, origBam.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [newFoo.id, newBar.id, newBam.id])
        // select current records by old id
        foos = await fooModel.select.current.by.id([origFoo.id, origBam.id, origBar.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [newFoo.id, newBam.id, newBar.id])
    })

    it('should order by queried ids when selecting current revision with id in query', async function () {
        var newBam = await origBam.update({bar: 10})
        var newBar = await origBar.update({bar: 20})
        var newFoo = await origFoo.update({bar: 30})
        // select current records by old id
        var foos = await fooModel.select.all.current.where.id.in([origFoo.id, origBar.id, origBam.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [newFoo.id, newBar.id, newBam.id])
        // select current records by old id
        foos = await fooModel.select.all.current.where.id.in([origFoo.id, origBam.id, origBar.id])
        // check order of result
        assert.deepEqual(_.map(foos, 'id'), [newFoo.id, newBam.id, newBar.id])
    })

    it('should order by queried ids when selecting current revision as result set', async function () {
        var newBam = await origBam.update({bar: 10})
        var newBar = await origBar.update({bar: 20})
        var newFoo = await origFoo.update({bar: 30})
        // select current records by old id
        var res = await fooModel.select.current.where.id.in([origFoo.id, origBar.id, origBam.id])
        // check order of result
        assert.deepEqual(res.ids, [newFoo.id, newBar.id, newBam.id])
        // select current records by old id
        res = await fooModel.select.current.where.id.in([origFoo.id, origBam.id, origBar.id])
        // check order of result
        assert.deepEqual(res.ids, [newFoo.id, newBam.id, newBar.id])
    })

})
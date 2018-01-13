'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - query join relations', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await database.close()
    })

    // models to create
    var fooModelGlobal, bamModelGlobal, barModelGlobal
    // local models with session
    var fooModel, bamModel, barModel
    // foo instance
    var foo1, foo2, foo3
    // bar instances
    var bar1, bar2, bar3

    before(async function () {
        await reset(database, redis)
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
            columns: {
                barId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                fooId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                d: false,
                data: false,
                originalId: false,
                parentId: false,
            },
            database: database,
            name: 'bam',
            redis: redis,
            relations: {
                bar: {},
                foo: {},
            }
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'bar',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        await bamModelGlobal.sync()
        await barModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
        bamModel = bamModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
        // create foo instance
        foo1 = await fooModel.create({foo: 'foo1'})
        foo2 = await fooModel.create({foo: 'foo2'})
        foo3 = await fooModel.create({foo: 'foo3'})
        // create related
        bar1 = await foo1.create('bar', {foo: 'a'})
        bar2 = await foo2.create('bar', {foo: 'b'})
        bar3 = await foo3.create('bar', {foo: 'c'})
    })

    it('should order by joined model', async function () {
        // load foo with related records
        var res = await fooModel.query({
            all: true,
            join: ['bar'],
            order: ['bar.foo'],
        })
        // check result
        assert.deepEqual(_.map(res, 'id'), [foo1.id, foo2.id, foo3.id])
    })

    it('should order by joined model desc', async function () {
        // load foo with related records
        var res = await fooModel.query({
            all: true,
            join: ['bar'],
            order: ['bar.foo', 'desc'],
        })
        // check result
        assert.deepEqual(_.map(res, 'id'), [foo3.id, foo2.id, foo1.id])
    })

    it('should do where query on joined model', async function () {
        // load foo with related records
        var res = await fooModel.query({
            one: true,
            join: ['bar'],
            where: {'bar.foo': 'a'},
        })
        // check result
        assert.strictEqual(res.id, foo1.id)
    })

    it('should not select joined columns by default', async function () {
        // load foo with related records
        var res = await fooModel.query({
            one: true,
            join: ['bar'],
            where: {'bar.foo': 'a'},
        })
        // check result
        assert.deepEqual(res.raw, {
            n: '1',
            c: '1',
            d: '0',
            fooAccountId: foo1.accountId,
            fooCreateTime: foo1.createTime,
            fooData: { foo: 'foo1' },
            fooId: foo1.id,
            fooOriginalId: foo1.originalId,
            fooParentId: undefined,
            fooSessionId: foo1.sessionId,
       })
    })

})
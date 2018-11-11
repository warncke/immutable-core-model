'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - query with relations', function () {

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

    // models to create
    var fooModelGlobal, bamModelGlobal, barModelGlobal
    // local models with session
    var fooModel, bamModel, barModel

    beforeEach(async function () {
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
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
            mysql: mysql,
            name: 'bam',
            redis: redis,
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'bar',
            redis: redis,
        })
        // sync with mysql
        await fooModelGlobal.sync()
        await bamModelGlobal.sync()
        await barModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
        bamModel = bamModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
    })

    it('should query related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        await foo.create('bar', {foo: 'bam'})
        await foo.create('bar', {foo: 'bar'})
        await foo.create('bar', {foo: 'foo'})
        // load foo with related records
        var foo = await fooModel.query({
            limit: 1,
            where: {id: foo.id},
            with: {
                'bar': {
                    order: ['createTime'],
                },
            },
        })
        // foo should have related records
        assert.strictEqual(foo.related.bar.length, 3)
        assert.strictEqual(foo.related.bar[0].data.foo, 'bam')
        assert.strictEqual(foo.related.bar[1].data.foo, 'bar')
        assert.strictEqual(foo.related.bar[2].data.foo, 'foo')
    })

    it('should query related models for multiple records', async function () {
        // create foo instance
        var foo1 = await fooModel.create({foo: 'foo1'})
        // create related
        await foo1.create('bar', {foo: 'bam'})
        await foo1.create('bar', {foo: 'bar'})
        // create foo instance
        var foo2 = await fooModel.create({foo: 'foo1'})
        // create related
        await foo2.create('bar', {foo: 'bam'})
        await foo2.create('bar', {foo: 'baz'})
        // load foo with related records
        var foos = await fooModel.query({
            all: true,
            order: ['createTime'],
            with: {
                'bar': {
                    order: ['createTime'],
                },
            },
        })
        // validate data
        assert.strictEqual(foos.length, 2)
        assert.strictEqual(foos[0].related.bar.length, 2)
        assert.strictEqual(foos[0].related.bar[0].data.foo, 'bam')
        assert.strictEqual(foos[0].related.bar[1].data.foo, 'bar')
        assert.strictEqual(foos[1].related.bar.length, 2)
        assert.strictEqual(foos[1].related.bar[0].data.foo, 'bam')
        assert.strictEqual(foos[1].related.bar[1].data.foo, 'baz')
    })

})
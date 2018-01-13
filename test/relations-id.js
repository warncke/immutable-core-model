'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - relations with id', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await database.close()
    })

    // models to create
    var fooModelGlobal, barModelGlobal
    // local models with session
    var fooModel, barModel

    before(async function () {
        await reset(database, redis)
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
            relations: {
                bar: {},
            },
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            columns: {
                fooId: {
                    index: true,
                    null: true,
                    type: 'id',
                },
            },
            database: database,
            name: 'bar',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        await barModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
    })

    it('should create related model and via', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        var related = await foo.create('bar', {foo: 'bar'})
        // load related
        var bar = await barModel.select.one.by.fooId(foo.id)
        // check that related was created
        assert.isObject(bar)
        assert.strictEqual(bar.data.fooId, foo.id)
    })

    it('should create related model and via from opposite model', async function () {
        // create bar instance
        var bar = await barModel.create({foo: 'bar'})
        // create related
        var related = await bar.create('foo', {foo: 'foo'})
        // load related
        var foo = await fooModel.select.by.id(related.id)
        // check that related was created
        assert.isObject(foo)
    })

    it('should select related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        await foo.create('bar', {foo: 'bam'})
        await foo.create('bar', {foo: 'bar'})
        // load related
        var result = await foo.select('bar')
        // check result
        assert.strictEqual(result.length, 2)
    })

    it('should query related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        await foo.create('bar', {foo: 'bam'})
        await foo.create('bar', {foo: 'bar'})
        await foo.create('bar', {foo: 'foo'})
        // load related desc
        var result = await foo.query({
            order: ['createTime', 'DESC'],
            relation: 'bar',
        })
        // fetch results
        var desc = await result.fetch(3)
        // load related asc
        var result = await foo.query({
            order: ['createTime'],
            relation: 'bar',
        })
        // fetch results
        var asc = await result.fetch(3)
        // check result
        assert.strictEqual(asc.length, 3)
        assert.strictEqual(asc[0].data.foo, 'bam')
        assert.strictEqual(asc[1].data.foo, 'bar')
        assert.strictEqual(asc[2].data.foo, 'foo')
        assert.strictEqual(desc.length, 3)
        assert.strictEqual(desc[0].data.foo, 'foo')
        assert.strictEqual(desc[1].data.foo, 'bar')
        assert.strictEqual(desc[2].data.foo, 'bam')
    })

})
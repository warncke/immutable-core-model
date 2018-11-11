'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - relations with original id', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.close()
    })

    // models to create
    var fooModelGlobal, barModelGlobal
    // local models with session
    var fooModel, barModel

    before(async function () {
        await reset(mysql, redis)
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            relations: {
                bar: {},
            },
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            columns: {
                fooOriginalId: {
                    index: true,
                    null: true,
                    type: 'id',
                },
            },
            mysql: mysql,
            name: 'bar',
            redis: redis,
        })
        // sync with mysql
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
        var bar = await barModel.select.one.by.fooOriginalId(foo.originalId)
        // check that related was created
        assert.isObject(bar)
        assert.strictEqual(bar.data.fooOriginalId, foo.originalId)
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
        // create revision of instance
        foo = await foo.update({foo: 'bar'})
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
        var desc = await result.fetch(6)
        // load related asc
        var result = await foo.query({
            order: ['createTime'],
            relation: 'bar',
        })
        // fetch results
        var asc = await result.fetch(6)
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
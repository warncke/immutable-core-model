'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - relations via original id', function () {

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
                barOriginalId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                fooOriginalId: {
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
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
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
    })

    it('should create related model and via', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        var bar = await foo.create('bar', {foo: 'bar'})
        // load via
        var via = await bamModel.select.one.by.fooOriginalId(foo.originalId)
        // check that bar and via created and ids match
        assert.isObject(bar)
        assert.isObject(via)
        assert.strictEqual(via.fooOriginalId, foo.originalId)
        assert.strictEqual(via.barOriginalId, bar.originalId)
    })

    it('should create related model and via from opposite model', async function () {
        // create bar instance
        var bar = await barModel.create({foo: 'bar'})
        // create related
        var foo = await bar.create('foo', {foo: 'foo'})
        // load via
        var via = await bamModel.select.one.by.barOriginalId(bar.originalId)
        // check that bar and via created and ids match
        assert.isObject(bar)
        assert.isObject(via)
        assert.strictEqual(via.fooOriginalId, foo.originalId)
        assert.strictEqual(via.barOriginalId, bar.originalId)
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

    it('should select inverse related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        var bar = await foo.create('bar', {foo: 'bam'})
        // load related
        var result = await bar.select('foo')
        // check result
        assert.strictEqual(result.length, 1)
    })

    it('should query related models', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create revision of foo
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
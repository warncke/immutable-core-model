'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model-local', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.end()
    })

    // variables to populate
    var globalFooModel, origBar, origFoo

    before(async function () {
        await reset(mysql, redis)
        // create global model instance
        globalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await globalFooModel.sync()
    })

    it('should create local model instance with session context', function () {
        var fooModel = globalFooModel.session(session)
        // check for methods
        assert.strictEqual(typeof fooModel.create, 'function')
        assert.strictEqual(typeof fooModel.query, 'function')
        assert.strictEqual(typeof fooModel.select, 'object')
    })

    it('should create instance with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // create new bar instance with create
        origBar = await fooModel.create({
            bar: "1.000000000",
            foo: 'bar',
        })
        // create new foo instance with createMeta
        origFoo = await fooModel.createMeta({
            data: {
                bar: "2.000000000",
                foo: 'foo',
            },
        })
    })

    it('should do query with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // do query
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: origFoo.id
            }
        })
        // check that model matches
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should do select with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // do query
        var bar = await fooModel.select.by.id(origBar.id)
        // check that model matches
        assert.deepEqual(bar.data, origBar.data)
    })

    it('should have class properties', async function () {
        var fooModel = globalFooModel.session(session)
        // check for class properties
        assert.isTrue(fooModel.ImmutableCoreModelLocal)
        assert.strictEqual(fooModel.class, 'ImmutableCoreModelLocal')
    })

})
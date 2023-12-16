'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - transform', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(mysql, redis)
    })

    after(async function () {
        await mysql.end()
    })

    it('should transform value', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            transform: {
                bam: (value, model, args) => {
                    return 'bar'
                }
            },
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
    })

    it('should call transform with model and args', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            transform: {
                bam: (value, model, args) => {
                    // check model
                    assert.isTrue(model.ImmutableCoreModel)
                    // check args
                    assert.isObject(args.session)
                    assert.isObject(args.data)
                    assert.deepEqual(args.data, {bam: 'foo'})
                    return 'bar'
                }
            },
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
    })

    it('should transform nested property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            transform: {
                'bam.baz': (value, model, args) => {
                    return 'bar'
                }
            },
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: { bam: {baz: 'foo'} },
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, { bam: {baz: 'bar'} })
    })

    it('should not call transform for undefined value', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            transform: {
                'bam.baz': (value, model, args) => {
                    assert.fail()
                }
            },
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should not be transformed
        assert.deepEqual(foo.data, {bam: 'foo'})
    })

    it('should transform value when updating record', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            transform: {
                bam: (value, model, args) => {
                    return 'bar'
                }
            },
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
        // update foo
        foo = await foo.update({
            bam: 'baz'
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
    })

})
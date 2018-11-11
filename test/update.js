'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - update', function () {

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

    it('should create model with immutable property', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    immutable: true,
                    type: 'string',
                }
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })

        try {
            // this should throw error
            await foo.update({foo: 'bam'})
        }
        catch (err) {
            var threw = err
        }

        assert.isDefined(threw)
        // verify error message
        assert.strictEqual(threw.message, `foo#${foo.id} record error: cannot modify immutable property foo`)
    })

    it('should throw error when updating old instance', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })

        try {
            // first update should succeed
            var updateFoo = await foo.update({foo: 'bam'})
            // second update should throw error
            await foo.update({foo: 'bar'})
        }
        catch (err) {
            var threw = err
        }
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {foo: 'bam'})
        // check that error thrown on second update
        assert.isDefined(threw)
        assert.strictEqual(threw.errno, 1062)
    })

    it('should force update old instance', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })
        // first update should succeed
        var updateFoo = await foo.update({foo: 'bam'})
        // second update should succeed with force
        updateFoo = await foo.updateMeta({
            data: {foo: 'bar'},
            force: true,
        })
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {foo: 'bar'})
    })

    it('should merge data by default', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })
        // first update should succeed
        var updateFoo = await foo.updateMeta({
            data: {bar: 'bam'},
        })
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {foo: 'bar', bar: 'bam'})
    })

    it('should overwrite instead of merging with merge:false', async function () {
        // create foo model with immutable property
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session,
        })
        // first update should succeed
        var updateFoo = await foo.updateMeta({
            data: {bar: 'bam'},
            merge: false,
        })
        // check that first update succeeded
        assert.deepEqual(updateFoo.data, {bar: 'bam'})
    })

})
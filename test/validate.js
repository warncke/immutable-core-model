'use strict'

/* npm modules */
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - validate', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.end()
    })

    // variable to populate in before
    var fooModel, origBam, origBar, origFoo, origGrr

    before(async function () {
        await reset(mysql, redis)
        // create foo with no columns
        fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new bam instance
        origBam = await fooModel.createMeta({
            data: {
                bar: "0.000000000",
                foo: 'bam',
            },
            session: session,
        })
        // create new bar instance
        origBar = await fooModel.createMeta({
            data: {
                bar: "1.000000000",
                foo: 'bar',
            },
            session: session,
        })
        // create new foo instance
        origFoo = await fooModel.createMeta({
            data: {
                bar: "2.000000000",
                foo: 'foo',
            },
            session: session,
        })
        // create new grr instance
        origGrr = await fooModel.createMeta({
            data: {
                bar: "3.000000000",
                foo: 'grr',
            },
            session: session,
        })
    })

    it('should validate column data when adding column', async function () {
        // reset immutable so that model modules are recreated
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        await fooModel.sync()
        // validate flag should be true
        assert.isTrue(fooModel.needsValidate)
        // validate should be done
        assert.isTrue(fooModel.validated)
        // four records should be updated
        assert.strictEqual(fooModel.updated, 4)
    })

    it('should validate column data when VALIDATE env variable set', async function () {
        // reset immutable so that model modules are recreated
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // set VALIDATE env var
        process.env.VALIDATE = '1'
        // execute sync
        await fooModel.sync()
        // delete flag
        delete process.env.VALIDATE
        // validate flag should be true
        assert.isFalse(fooModel.needsValidate)
        // validate should be done
        assert.isTrue(fooModel.validated)
        // four records should be updated
        assert.strictEqual(fooModel.updated, 0)
    })

    it('should not validate when schema has not changed', async function () {
        // reset immutable so that model modules are recreated
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        await fooModel.sync()
        // validate flag should be false
        assert.isFalse(fooModel.needsValidate)
        assert.isFalse(fooModel.validated)
    })

    it('should not update when validate called and data correct', async function () {
        // reset immutable so that model modules are recreated
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        await fooModel.sync()
        // manually call validate
        await fooModel.validate()
        // validate flag should be false
        assert.isFalse(fooModel.needsValidate)
        assert.isTrue(fooModel.validated)
        assert.strictEqual(fooModel.updated, 0)
    })

})
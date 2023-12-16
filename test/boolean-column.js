'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - boolean column', function () {

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

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo, origGrr

    beforeEach(async function () {
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bar: 'boolean',
                foo: 'boolean',
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // drop any test tables if they exist
        await mysql.query('DROP TABLE IF EXISTS foo')
        // sync with mysql
        await fooModelGlobal.sync()
        // get local foo model
        fooModel = fooModelGlobal.session(session)
        // create new bam instance
        origBam = await fooModel.create({
            bar: true,
            foo: false,
        })
    })

    it('should store boolean column as 1/0', async function () {
        var bam = await fooModel.select.by.id(origBam.id)
        // check values
        assert.strictEqual(bam.raw.bar, 1)
        assert.strictEqual(bam.raw.foo, 0)
    })

    it('should correct incorrect value', async function () {
        // set column to incorrect value
        await mysql.query('UPDATE foo SET bar = 0, foo = 1')
        // run validate to correct values
        await fooModelGlobal.validate({session: session})
        // fetch value
        var bam = await fooModel.select.by.id(origBam.id)
        // check values
        assert.strictEqual(bam.raw.bar, 1)
        assert.strictEqual(bam.raw.foo, 0)
    })

})
'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model-select', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.close()
    })

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo

    before(async function () {
        await reset(mysql, redis)
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModelGlobal.sync()
        // get local foo model
        fooModel = fooModelGlobal.session(session)  
        // create new bam instance
        origBam = await fooModel.create({
            bar: "0.000000000",
            foo: 'bam',
        })
        // create new bar instance
        origBar = await fooModel.create({
            bar: "1.000000000",
            foo: 'bar',
        })
        // create new foo instance
        origFoo = await fooModel.create({
            bar: "2.000000000",
            foo: 'foo',
        })
    })

    it('should select by id', async function () {
        // select foo by id
        var foo = await fooModel.select.by.id(origFoo.id)
        // check that return matches original
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should select one by column', async function () {
        // select foo by id
        var foo = await fooModel.select.one.by.foo('bar')
        // check that return matches original
        assert.deepEqual(foo.data, origBar.data)
    })

})
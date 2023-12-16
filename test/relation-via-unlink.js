'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - relations via unlink', function () {

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
                data: false,
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

    it('should delete via relation record', async function () {
        // create foo instance
        var foo = await fooModel.create({foo: 'foo'})
        // create related
        var bar = await foo.create('bar', {foo: 'bar'})
        var baz = await foo.create('bar', {foo: 'baz'})
        // load relation record
        var bam = await bamModel.query({
            one: true,
            where: {
                barId: bar.id,
                fooId: foo.id,
            }
        })
        // delete relation record
        await bam.delete()
        // query all bar records related to foo
        var bars = await foo.select('bar').then(res => res.all())
        // there should only be one result
        assert.strictEqual(bars.length, 1)
        assert.strictEqual(bars[0].id, baz.id)
    })

})
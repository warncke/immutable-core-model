'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - relations via unlink', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(database, redis)
    })

    after(async function () {
        await database.close()
    })

    // models to create
    var fooModelGlobal, bamModelGlobal, barModelGlobal
    // local models with session
    var fooModel, bamModel, barModel

    beforeEach(async function () {
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
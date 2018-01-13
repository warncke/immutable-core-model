'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - toJSON', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await database.close()
    })

    // variable to populate in before
    var fooModel, fooModelGlobal, origBam, origBar, origFoo, origGrr

    before(async function () {
        await reset(database, redis)
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        // get local fooModel
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
        // create new grr instance
        origGrr = await fooModel.create({
            bar: "3.000000000",
            foo: 'grr',
        })
    })

    it('should have formatted toJSON object', async function () {
        var foo = await fooModel.query({
            isCurrent: true,
            limit: 1,
            session: session,
            where: {
                id: origFoo.id
            },
        })
        // get object that will be encoded to JSON
        var json = foo.toJSON()
        // check properties
        assert.strictEqual(json.id, origFoo.id)
        assert.strictEqual(json.isCurrent, true)
        assert.deepEqual(json.data, {bar: '2.000000000', foo: 'foo'})
    })

})
'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - elasticsearch search', function () {
    // extend timeout to allow elasticsearch time to index
    this.timeout(10000)

    var database, elasticsearch, redis, reset, session

    before(async function () {
        [database, redis, reset, session, elasticsearch] = await initTestEnv({elasticsearch: true})
    })

    beforeEach(async function () {
        await reset(database, redis, elasticsearch)
    })

    after(async function () {
        await database.close()
    })

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    beforeEach(async function () {
        // create model with elasticsearch
        globalFooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearch,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await globalFooModel.sync()
        // create local instance
        fooModel = globalFooModel.session(session)
        // create some foo instances
        foo1 = await fooModel.create({foo: 'bam'})
        foo2 = await fooModel.create({foo: 'bar'})
        foo3 = await fooModel.create({foo: 'bar'})
        // wait a second for elasticsearch
        await Promise.delay(1000)
    })

    it('should search', async function () {
        var res = await fooModel.search({
            index: 'foo',
            raw: true,
        })
        // validate response
        assert.isObject(res)
        assert.isObject(res.hits)
        assert.isArray(res.hits.hits)
    })

})
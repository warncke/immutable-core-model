'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe.only('immutable-core-model - opensearch search', function () {
    // extend timeout to allow opensearch time to index
    this.timeout(10000)

    var mysql, opensearch, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session, opensearch] = await initTestEnv({opensearch: true})
    })

    beforeEach(async function () {
        await reset(mysql, redis, opensearch)
    })

    after(async function () {
        await mysql.end()
    })

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    beforeEach(async function () {
        // create model with opensearch
        globalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: opensearch,
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
        // wait a second for opensearch
        await Promise.delay(1000)
    })

    it('should search', async function () {
        var res = await fooModel.search({
            index: 'foo',
            raw: true,
        })
        res = res.body
        // validate response
        assert.isObject(res)
        assert.isObject(res.hits)
        assert.isArray(res.hits.hits)
    })

})
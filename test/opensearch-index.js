'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - opensearch index', function () {

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

    it('should create index on model sync', async function () {
        // create model with opensearch
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: opensearch,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // wait a second for index to be created
        await Promise.delay(1000)
        // check if index exists
        var res = await opensearch.indices.exists({
            index: 'foo'
        })
        // check that index exists
        assert.isTrue(res.body)
    })

    it('should create index with custom name', async function () {
        // create model with opensearch
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: opensearch,
            osIndex: 'not-foo',
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // wait a second for index to be created
        await Promise.delay(1000)
        // check if index exists
        var res = await opensearch.indices.exists({
            index: 'not-foo'
        })
        // check that index exists
        assert.isTrue(res.body)
    })

})
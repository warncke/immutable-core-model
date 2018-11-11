'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - elasticsearch index', function () {

    var mysql, elasticsearch, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session, elasticsearch] = await initTestEnv({elasticsearch: true})
    })

    beforeEach(async function () {
        await reset(mysql, redis, elasticsearch)
    })

    after(async function () {
        await mysql.close()
    })

    it('should create index on model sync', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            elasticsearch: elasticsearch,
            name: 'foo',
            redis: redis,
        })
        // sync model
        fooModel.sync()
        // wait a second for index to be created
        await Promise.delay(1000)
        // check if index exists
        var exists = await elasticsearch.indices.exists({
            index: 'foo'
        })
        // check that index exists
        assert.isTrue(exists)
    })

    it('should create index with custom name', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            elasticsearch: elasticsearch,
            esIndex: 'not-foo',
            name: 'foo',
            redis: redis,
        })
        // sync model
        fooModel.sync()
        // wait a second for index to be created
        await Promise.delay(1000)
        // check if index exists
        var exists = await elasticsearch.indices.exists({
            index: 'not-foo'
        })
        // check that index exists
        assert.isTrue(exists)
    })

})
'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - elasticsearch create', function () {

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

    it('should create document when creating record', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearch,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {foo: 1},
            session: session,
        })
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearch.get({
            id: foo.originalId,
            index: 'foo',
            type: 'foo',
        })
        // validate record
        assert.isObject(res)
        assert.strictEqual(res._index, 'foo')
        assert.strictEqual(res._type, 'foo')
        assert.strictEqual(res._id, foo.originalId)
        assert.deepEqual(res._source, {
            accountId: session.accountId,
            createTime: foo.createTime,
            d: '0',
            data: foo.data,
            id: foo.id,
            originalId: foo.originalId,
            sessionId: session.sessionId,
        })
    })

    it('should update document when updating record', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearch,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {foo: 1},
            session: session,
        })
        // update foo
        var newFoo = await foo.update({foo: 2})
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearch.get({
            id: foo.originalId,
            index: 'foo',
            type: 'foo',
        })
        // validate record
        assert.isObject(res)
        assert.strictEqual(res._index, 'foo')
        assert.strictEqual(res._type, 'foo')
        assert.strictEqual(res._id, foo.originalId)
        assert.deepEqual(res._source, {
            accountId: session.accountId,
            createTime: newFoo.createTime,
            d: '0',
            data: newFoo.data,
            id: newFoo.id,
            originalId: newFoo.originalId,
            parentId: newFoo.parentId,
            sessionId: session.sessionId,
        })
    })

    it('should set type from data', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearch,
            esType: 'bar.bam',
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {
                bar: { bam: 'myFoo' },
                foo: 1,
            },
            session: session,
        })
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearch.get({
            id: foo.originalId,
            index: 'foo',
            type: 'myFoo',
        })
        // validate record
        assert.isObject(res)
        assert.deepEqual(res._source.data, foo.data)
    })

    it('should default to name when type not in data', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearch,
            esType: 'bar.bam',
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create new record
        var foo = await fooModel.createMeta({
            data: {
                foo: 1,
            },
            session: session,
        })
        // wait a second for record to be available
        await Promise.delay(1000)
        // get from elasticsearch
        var res = await elasticsearch.get({
            id: foo.originalId,
            index: 'foo',
            type: 'foo',
        })
        // validate record
        assert.isObject(res)
        assert.deepEqual(res._source.data, foo.data)
    })

})
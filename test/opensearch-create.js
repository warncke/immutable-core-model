'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - opensearch create', function () {

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

    it('should create document when creating record', async function () {
        // create model with opensearch
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: opensearch,
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
        // get from opensearch
        var res = await opensearch.get({
            id: foo.originalId,
            index: 'foo',
        })
        res = res.body
        // validate record
        assert.isObject(res)
        assert.strictEqual(res._index, 'foo')
        assert.strictEqual(res._id, foo.originalId)
        assert.deepEqual(res._source, {
            accountId: session.accountId,
            createTime: foo.createTime,
            d: 0,
            data: foo.data,
            id: foo.id,
            originalId: foo.originalId,
            sessionId: session.sessionId,
        })
    })

    it.skip('should update document when updating record', async function () {
        // create model with opensearch
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: opensearch,
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
        // get from opensearch
        var res = await opensearch.get({
            id: foo.originalId,
            index: 'foo',
        })
        res = res.body
        // validate record
        assert.isObject(res)
        assert.strictEqual(res._index, 'foo')
        assert.strictEqual(res._id, foo.originalId)
        assert.deepEqual(res._source, {
            accountId: session.accountId,
            createTime: newFoo.createTime,
            d: 0,
            data: newFoo.data,
            id: newFoo.id,
            originalId: newFoo.originalId,
            parentId: newFoo.parentId,
            sessionId: session.sessionId,
        })
    })
})
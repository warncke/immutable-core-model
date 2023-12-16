'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - revisions', function () {

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

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    beforeEach(async function () {
        // create initial model
        globalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // create local model with session
        fooModel = globalFooModel.session(session)
        // sync with mysql
        await globalFooModel.sync()
        // insert first record
        foo1 = await fooModel.create({foo: 'foo'})
        // create revision
        foo2 = await foo1.update({foo: 'bar'})
        // create another revision
        foo3 = await foo2.update({foo: 'bam'})
    })

    it('should only return the current revision of an object by default', async function () {
        // get all foos
        var foos = await fooModel.query({
            all: true
        })
        // there should only be one record returned
        assert.strictEqual(foos.length, 1)
        // record should be current revision
        assert.deepEqual(foos[0].data, foo3.data)
    })

    it('should only return all revisions if option set', async function () {
        // get all foos
        var foos = await fooModel.query({
            all: true,
            allRevisions: true,
            order: ['createTime'],
        })
        // there should only be one record returned
        assert.strictEqual(foos.length, 3)
        // record should be current revision
        assert.deepEqual(foos[0].data, foo1.data)
        assert.deepEqual(foos[1].data, foo2.data)
        assert.deepEqual(foos[2].data, foo3.data)
    })

    it('should return exact revision specified by id', async function () {
        // query for old revision
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // record should match
        assert.deepEqual(foo.data, foo1.data)
    })

    it('should return current revision when selecting by id with current', async function () {
        // query for old revision
        var foo = await fooModel.query({
            current: true,
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // record should match
        assert.deepEqual(foo.data, foo3.data)
    })

    it('should set isCurrent false on old revision with isCurrent:true', async function () {
        // query for old revision
        var foo = await fooModel.query({
            isCurrent: true,
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // foo should not be current
        assert.isFalse(foo.isCurrent)
    })

    it('should have current method that returns current instance', async function () {
        // query for old revision
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // query for current revision
        foo = await foo.current()
        // foo should be current
        assert.strictEqual(foo.id, foo3.id)
    })

    it('should select current instance', async function () {
        // select current with old id
        var foo = await fooModel.select.current.by.id(foo1.id)
        // foo should be current
        assert.strictEqual(foo.id, foo3.id)
    })

})
'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access control delete', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(mysql, redis)
    })

    after(async function () {
        await mysql.close()
    })

    it('should deny access to delete', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'delete:any:0'
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // capture error
        var error
        try {
            // sync model
            await fooModel.sync()
            // foo create should succeed
            var foo = await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
            // foo delete should fail
            await foo.delete()
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to delete own', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'delete:any:0',
                'delete:own:1',
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        try {
            // sync model
            await fooModel.sync()
            // foo create should succeed
            var foo = await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
            // foo delete should succeed
            foo = await foo.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that foo deleted
        assert.strictEqual(foo.isDeleted, true)
    })

    it('should deny access to undelete', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'undelete:any:0'
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // capture error
        var error
        try {
            // sync model
            await fooModel.sync()
            // foo create should succeed
            var foo = await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
            // foo delete should succeed
            foo = await foo.delete()
            // undelete should fail
            foo = await foo.undelete()
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to delete own', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'undelete:any:0',
                'undelete:own:1',
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        try {
            // sync model
            await fooModel.sync()
            // foo create should succeed
            var foo = await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
            // foo delete should succeed
            foo = await foo.delete()
            // undelete should succeed
            foo = await foo.undelete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that foo deleted
        assert.strictEqual(foo.isDeleted, false)
    })

})
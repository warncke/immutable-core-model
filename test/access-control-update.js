'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access control update', function () {

    var mysql, redis, reset, session

    // fake sessions to use for testing
    var session1 = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated', 'foo'],
        sessionId: '22222222222222222222222222222222',
    }
    var session2 = {
        accountId: '33333333333333333333333333333333',
        roles: ['all', 'authenticated', 'bar'],
        sessionId: '44444444444444444444444444444444',
    }
    var session3 = {
        accountId: '55555555555555555555555555555555',
        roles: ['all', 'authenticated'],
        sessionId: '66666666666666666666666666666666',
    }

    // model instance
    var fooModel
    // record instances
    var bam, bar, baz

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.end()
    })

    beforeEach(async function () {
        await reset(mysql, redis)
        // create model
        fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
                'list:any:1',
                'read:any:1',
                ['foo', 'update:own:1'],
                ['foo', 'chown:own:1'],
                ['bar', 'update:any:1'],
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create one record with each session
        bam = await fooModel.createMeta({
            data: {foo: 'bam'},
            session: session1,
        })
        bar = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session2,
        })
        baz = await fooModel.createMeta({
            data: {foo: 'baz'},
            session: session3,
        })
    })

    it('should deny access to update', async function () {
        // capture error
        var error
        try {
            // attempt to update - should be denied
            await baz.update({foo: 'bar'})
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to update own', async function () {
        // get own record
        var res = await bam.update({foo: 'bar'})
        // check record
        assert.strictEqual(res.data.foo, 'bar')
    })

    it('should deny access to chown even when update allowed', async function () {
        // capture error
        var error
        try {
            // attempt to update - should be denied
            await bar.updateMeta({accountId: '11111111111111111111111111111111'})
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to chown', async function () {
        // get own record
        var res = await bam.updateMeta({accountId: '33333333333333333333333333333333'})
        // check record
        assert.strictEqual(res.accountId, '33333333333333333333333333333333')
    })

    it('should not update other record with only own access', async function () {
        // capture error
        var error
        try {
            // get other record
            var res = await fooModel.query({
                limit: 1,
                where: {id: bar.id},
                session: session1,
            })
            // update - should fail
            await res.update({foo: 'bar'})
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should update other record', async function () {
        // get other record
        var res = await fooModel.query({
            limit: 1,
            where: {id: baz.id},
            session: session2,
        })
        // update - should succeed
        res = await res.update({foo: 'bar'})
        // check record
        assert.strictEqual(res.data.foo, 'bar')
    })

})
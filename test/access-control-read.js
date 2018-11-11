'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access control read', function () {

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
        await reset(mysql, redis)
        // create model
        fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
                ['foo', 'read:own:1'],
                ['bar', 'read:any:1'],
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

    it('should deny access to read', async function () {
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id},
                session: session3,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to read own', async function () {
        // get own record
        var res = await fooModel.query({
            limit: 1,
            where: {id: bam.id},
            session: session1,
        })
        // check record
        assert.strictEqual(res.id, bam.id)
    })

    it('should not read other record with only own access', async function () {
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: bar.id},
                session: session1,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to read any', async function () {
        // get other record
        var res = await fooModel.query({
            limit: 1,
            where: {id: bam.id},
            session: session2,
        })
        // check record
        assert.strictEqual(res.id, bam.id)
    })

})
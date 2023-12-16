'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access control states', function () {

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
    var fooModel, fooModelGlobal
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
                'read:own:1',
                'delete:own:1',
                'update:own:1',
                ['foo', 'read:deleted:own:1'],
                ['bar', 'read:deleted:any:1'],
                ['foo', 'undelete:any:1']
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

    it('should deny access to deleted records', async function () {
        // delete record
        baz = await baz.delete()
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id, isDeleted: true},
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

    it('should allow access to own deleted records', async function () {
        // delete record
        bam = await bam.delete()
        // query all foo records
        var res = await fooModel.query({
            limit: 1,
            where: {id: bam.id, isDeleted: true},
            session: session1,
        })
        // test error
        assert.isObject(res)
        assert.strictEqual(res.id, bam.id)
    })

    it('should allow access to any deleted records', async function () {
        // delete record
        bam = await bam.delete()
        // query all foo records
        var res = await fooModel.query({
            limit: 1,
            where: {id: bam.id, isDeleted: true},
            session: session2,
        })
        // test error
        assert.isObject(res)
        assert.strictEqual(res.id, bam.id)
    })

})
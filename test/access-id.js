'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access id', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        // fake session to use for testing
        session = {
            accessIdName: 'barId',
            accountId: '11111111111111111111111111111111',
            accessId: '33333333333333333333333333333333',
            roles: ['all', 'authenticated', 'foo'],
            sessionId: '22222222222222222222222222222222',
        }
        await reset(database, redis)
    })

    after(async function () {
        await database.close()
    })

    it('should create instance with custom accessId', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessIdName: 'barId',
            columns: {
                barId: 'id',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create instance
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
        // test created instance
        assert.isDefined(foo)
        assert.strictEqual(foo.data.barId, session.accessId)
    })

    it('should create instance when accessId missing from session if column nullable', async function () {
        delete session.accessId
        // create model
        var fooModel = new ImmutableCoreModel({
            accessIdName: 'barId',
            columns: {
                barId: 'id',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create instance
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
        // test created instance
        assert.isDefined(foo)
    })

})
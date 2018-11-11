'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access control create', function () {

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

    it('should deny access to create', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: ['0'],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // capture error
        var error
        try {
            await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to create', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                ['foo', 'create:1'],
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync model
        await fooModel.sync()
        // create should be success
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
        // test created instance
        assert.isDefined(foo)
        assert.strictEqual(foo.data.foo, true)
    })

})
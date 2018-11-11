'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model-local - persist', function () {

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

    var glboalFooModel, fooModel

    beforeEach(async function () {
        // create initial model
        glboalFooModel = new ImmutableCoreModel({
            columns: {
                accountId: false,
                d: false,
                originalId: false,
                parentId: false,
            },
            mysql: mysql,
            idDataOnly: true,
            name: 'foo',
            redis: redis,
        })
        // create local foo model with session for select queries
        fooModel = glboalFooModel.session(session)
        // sync with mysql
        await glboalFooModel.sync()
    })

    it('should throw duplicate key error when creating same data twice', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            roles: ['all', 'authenticated'],
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            roles: ['all', 'authenticated'],
            sessionId: '33333333333333333333333333333333',
        }
        // catch expected error
        try {
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: sessionA,
            })
            // create second foo instance with different session but same
            // data - should throw duplicate key error
            await fooModel.createMeta({
                data: {foo: 'foo'},
                session: sessionB,
            })

        }
        catch (err) {
            var threwErr = err
        }
        // check thrown error
        assert.match(threwErr.message, /Duplicate entry/)
    })

    it('should not throw error when persisting data twice', async function () {
        // create first data entry and catpure value
        var foo = await fooModel.create({foo: 'foo'})
        // persist foo which should be duplicate
        var fooId = await fooModel.persist({foo: 'foo'})
        // persist should resolve with string id
        assert.isString(fooId)
        // id should match original
        assert.strictEqual(foo.id, fooId)
    })

});
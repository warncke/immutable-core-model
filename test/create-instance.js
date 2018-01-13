'use strict'

/* npm modules */
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - create instance', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(database, redis)
    })

    after(async function () {
        await database.close()
    })

    it('should create a new object instance', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // check instance values
        assert.strictEqual(foo.accountId, '11111111111111111111111111111111')
        assert.deepEqual(foo.data, {foo: 'foo'})
        assert.strictEqual(foo.sessionId, '22222222222222222222222222222222')
        // id should match original id since this is first revision
        assert.strictEqual(foo.id, foo.originalId)
    })

    it('should create a new object instance and not return response when flag set', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            response: false,
            session: session,
        })
        // response should be undefined but no error thrown
        assert.strictEqual(foo, undefined)
    })

    it('should create a new object instance and return id only when flag set', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            responseIdOnly: true,
            session: session,
        })
        // response should be undefined but no error thrown
        assert.match(foo, /^[a-f0-9]{32}$/)
    })

    it('should create a new object instance with no wait', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
            wait: false,
        })
        // should have promise that will be resolved once insert completes
        assert.isDefined(foo.promise)
        // check instance values
        assert.strictEqual(foo.accountId, '11111111111111111111111111111111')
        assert.deepEqual(foo.data, {foo: 'foo'})
        assert.strictEqual(foo.sessionId, '22222222222222222222222222222222')
        // id should match original id since this is first revision
        assert.strictEqual(foo.id, foo.originalId)
        // wait for insert promise to complete
        var res = await foo.promise
        // check result
        assert.strictEqual(res.info.affectedRows, '1')
    })

    it('should create a new object instance and not return response when flag set and not waiting', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            response: false,
            session: session,
            wait: false,
        })
        // response should be undefined but no error thrown
        assert.strictEqual(foo, undefined)
    })

    it('should create a new object instance and return id only when flag set and not waiting', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            responseIdOnly: true,
            session: session,
            wait: false,
        })
        // response should be undefined but no error thrown
        assert.match(foo, /^[a-f0-9]{32}$/)
    })


    it('should update an object instance', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // get original id
        var originalId = foo.originalId
        // update instance
        foo = await foo.update({foo: 'bar'})
        // check instance values
        assert.deepEqual(foo.data, {foo: 'bar'})
        // should use session and account id from original if no session
        assert.strictEqual(foo.accountId, '11111111111111111111111111111111')
        assert.strictEqual(foo.sessionId, '22222222222222222222222222222222')
        // id should have changed
        assert.notEqual(foo.id, originalId)
        // original and parent id should both be the first id
        assert.strictEqual(foo.originalId, originalId)
        assert.strictEqual(foo.parentId, originalId)
    })

    it('should update accountId and sessionId on object', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // get original id
        var originalId = foo.originalId
        // update instance
        foo = await foo.updateMeta({
            accountId: '22222222222222222222222222222222',
            session: {
                roles: [],
                sessionId: '33333333333333333333333333333333'
            }
        })
        // should have updated accountId and sessionId
        assert.strictEqual(foo.accountId, '22222222222222222222222222222222')
        assert.strictEqual(foo.sessionId, '33333333333333333333333333333333')
    })

    it('should empty object', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // get original id
        var originalId = foo.originalId
        // update instance
        foo = await foo.empty()
        // should use session and account id from original if no session
        assert.strictEqual(foo.accountId, '11111111111111111111111111111111')
        assert.strictEqual(foo.sessionId, '22222222222222222222222222222222')
        // id should have changed
        assert.notEqual(foo.id, originalId)
        // original and parent id should both be the first id
        assert.strictEqual(foo.originalId, originalId)
        assert.strictEqual(foo.parentId, originalId)
        // data should be empty
        assert.deepEqual(foo.data, {})
    })

    it('should set accountId and sessionId while emptying object', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // get original id
        var originalId = foo.originalId
        // update instance
        foo = await foo.empty({
            accountId: '22222222222222222222222222222222',
            session: {
                roles: [],
                sessionId: '33333333333333333333333333333333',
            }
        })
        // should have updated accountId and sessionId
        assert.strictEqual(foo.accountId, '22222222222222222222222222222222')
        assert.strictEqual(foo.sessionId, '33333333333333333333333333333333')
        // data should be empty
        assert.deepEqual(foo.data, {})
    })

    it('should set id based on data only if idDataOnly flag set', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            roles: [],
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            roles: [],
            sessionId: '33333333333333333333333333333333',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            idDataOnly: true,
            name: 'foo',
            redis: redis,
        })
        try {
            // sync with database
            await fooModel.sync()
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

        assert.match(threwErr.message, /Duplicate entry/)
    })

    it('should ignore duplicate key errors on create when flag set', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            roles: [],
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            roles: [],
            sessionId: '33333333333333333333333333333333',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            idDataOnly: true,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: sessionA,
        })
        // create second foo instance with different session but same
        // data - should throw duplicate key error
        foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            duplicate: true,
            session: sessionB,
        })
        // check data
        assert.deepEqual(foo.data, {foo: 'foo'})
    })

    it('should ignore duplicate key errors and not return response when flag set', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            roles: [],
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            roles: [],
            sessionId: '33333333333333333333333333333333',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            idDataOnly: true,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: sessionA,
        })
        // create second foo instance with different session but same
        // data - should throw duplicate key error
        foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            duplicate: true,
            response: false,
            session: sessionB,
        })
        // check data
        assert.strictEqual(foo, undefined)
    })

    it('should have class properties on instance', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // check for class properties
        assert.isTrue(foo.ImmutableCoreModelRecord)
        assert.strictEqual(foo.class, 'ImmutableCoreModelRecord')
    })

})
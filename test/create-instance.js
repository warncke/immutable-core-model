'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

chai.use(chaiAsPromised)
const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - create instance', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        // drop any test tables if they exist
        return database.query('DROP TABLE IF EXISTS foo')
    })

    it('should create a new object instance', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should create a new object instance and not return response when flag set', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should create a new object instance and return id only when flag set', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                responseIdOnly: true,
                session: session,
            })
            // response should be undefined but no error thrown
            assert.match(foo, /^[A-Z0-9]{32}$/)
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should create a new object instance with no wait', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
        // wait for insert promise to complete
        return foo.promise.then(function (res) {
            assert.strictEqual(res.info.affectedRows, '1')
        })
    })

    it('should create a new object instance and not return response when flag set and not waiting', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should create a new object instance and return id only when flag set and not waiting', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
            assert.match(foo, /^[A-Z0-9]{32}$/)
        }
        catch (err) {
            assert.ifError(err)
        }
    })


    it('should update an object instance', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should update accountId and sessionId on object', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
                    sessionId: '33333333333333333333333333333333'
                }
            })
            // should have updated accountId and sessionId
            assert.strictEqual(foo.accountId, '22222222222222222222222222222222')
            assert.strictEqual(foo.sessionId, '33333333333333333333333333333333')
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should empty object', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should set accountId and sessionId while emptying object', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        try {
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
                    sessionId: '33333333333333333333333333333333'
                }
            })
            // should have updated accountId and sessionId
            assert.strictEqual(foo.accountId, '22222222222222222222222222222222')
            assert.strictEqual(foo.sessionId, '33333333333333333333333333333333')
            // data should be empty
            assert.deepEqual(foo.data, {})
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should set id based on data only if idDataOnly flag set', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            sessionId: '33333333333333333333333333333333'
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            idDataOnly: true,
            name: 'foo',
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
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            sessionId: '33333333333333333333333333333333'
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            idDataOnly: true,
            name: 'foo',
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
            foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                duplicate: true,
                session: sessionB,
            })

        }
        catch (err) {
            assert.ifError(err)
        }
        // check data
        assert.deepEqual(foo.data, {foo: 'foo'})
    })

    it('should ignore duplicate key errors and not return response when flag set', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            sessionId: '33333333333333333333333333333333'
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            idDataOnly: true,
            name: 'foo',
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
            foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                duplicate: true,
                response: false,
                session: sessionB,
            })

        }
        catch (err) {
            assert.ifError(err)
        }
        // check data
        assert.strictEqual(foo, undefined)
    })

    it('should have class properties on instance', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check for class properties
        assert.isTrue(foo.ImmutableCoreModelInstance)
        assert.strictEqual(foo.class, 'ImmutableCoreModelInstance')
    })

})
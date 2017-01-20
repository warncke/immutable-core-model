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

describe('immutable-model - create instance', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '1111',
        sessionId: '2222',
    }

    beforeEach(function () {
        // reset immutable so that model modules are recreated with every test
        immutable.reset().strictArgs(false)
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
            var foo = await fooModel.create({
                data: {foo: 'foo'},
                session: session,
            })
            // check instance values
            assert.strictEqual(foo.accountId(), '1111')
            assert.deepEqual(foo.data(), {foo: 'foo'})
            assert.strictEqual(foo.sessionId(), '2222')
            // id should match original id since this is first revision
            assert.strictEqual(foo.id(), foo.originalId())
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
            var foo = await fooModel.create({
                data: {foo: 'foo'},
                session: session,
            })
            // get original id
            var originalId = foo.originalId()
            // update instance
            foo = await foo.update({
                data: {foo: 'bar'}
            })
            // check instance values
            assert.deepEqual(foo.data(), {foo: 'bar'})
            // should use session and account id from original if no session
            assert.strictEqual(foo.accountId(), '1111')
            assert.strictEqual(foo.sessionId(), '2222')
            // id should have changed
            assert.notEqual(foo.id(), originalId)
            // original and parent id should both be the first id
            assert.strictEqual(foo.originalId(), originalId)
            assert.strictEqual(foo.parentId(), originalId)
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
            var foo = await fooModel.create({
                data: {foo: 'foo'},
                session: session,
            })
            // get original id
            var originalId = foo.originalId()
            // update instance
            foo = await foo.update({
                accountId: '2222',
                session: {
                    sessionId: '3333'
                }
            })
            // should have updated accountId and sessionId
            assert.strictEqual(foo.accountId(), '2222')
            assert.strictEqual(foo.sessionId(), '3333')
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
            var foo = await fooModel.create({
                data: {foo: 'foo'},
                session: session,
            })
            // get original id
            var originalId = foo.originalId()
            // update instance
            foo = await foo.empty()
            // should use session and account id from original if no session
            assert.strictEqual(foo.accountId(), '1111')
            assert.strictEqual(foo.sessionId(), '2222')
            // id should have changed
            assert.notEqual(foo.id(), originalId)
            // original and parent id should both be the first id
            assert.strictEqual(foo.originalId(), originalId)
            assert.strictEqual(foo.parentId(), originalId)
            // data should be empty
            assert.deepEqual(foo.data(), {})
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
            var foo = await fooModel.create({
                data: {foo: 'foo'},
                session: session,
            })
            // get original id
            var originalId = foo.originalId()
            // update instance
            foo = await foo.empty({
                accountId: '2222',
                session: {
                    sessionId: '3333'
                }
            })
            // should have updated accountId and sessionId
            assert.strictEqual(foo.accountId(), '2222')
            assert.strictEqual(foo.sessionId(), '3333')
            // data should be empty
            assert.deepEqual(foo.data(), {})
        }
        catch (err) {
            assert.ifError(err)
        }
    })

})
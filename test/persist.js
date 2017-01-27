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

describe('immutable-core-model-local - persist', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    // reset immutable so that model modules are recreated with every test
    immutable.reset().strictArgs(false)
    // create initial model
    var glboalFooModel = new ImmutableCoreModel({
        columns: {
            accountId: false,
            originalId: false,
            parentId: false,
        },
        database: database,
        idDataOnly: true,
        name: 'foo',
    })
    // create local foo model with session for select queries
    var fooModel = glboalFooModel.session(session)

    beforeEach(async function () {
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await glboalFooModel.sync()
        }
        catch (err) {
            throw err
        }
    })

    it('should throw duplicate key error when creating same data twice', async function () {
        var sessionA = {
            accountId: '11111111111111111111111111111111',
            sessionId: '22222222222222222222222222222222',
        }
        var sessionB = {
            accountId: '22222222222222222222222222222222',
            sessionId: '33333333333333333333333333333333'
        }
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

        assert.match(threwErr.message, /Duplicate entry/)
    })

    it('should not throw error when persisting data twice', async function () {
        try {
            // create first data entry and catpure value
            var foo = await fooModel.create({foo: 'foo'})
            // persist foo which should be duplicate
            var fooId = await fooModel.persist({foo: 'foo'})
        }
        catch (err) {
            assert.ifError(err)
        }
        // persist should resolve with string id
        assert.isString(fooId)
        // id should match original
        assert.strictEqual(foo.id, fooId)
    })

});
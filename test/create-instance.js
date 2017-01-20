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
                data: {foo: 'bar'},
                session: session,
            })
            // check instance values
            assert.strictEqual(foo.accountId(), '1111')
            assert.deepEqual(foo.data(), {foo: 'bar'})
            assert.strictEqual(foo.sessionId(), '2222')
            // id should match original id since this is first revision
            assert.strictEqual(foo.id(), foo.originalId())
        }
        catch (err) {
            assert.ifError(err)
        }
    })

})
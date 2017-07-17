'use strict'

const ImmutableAccessControl = require('immutable-access-control')
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

describe('immutable-core-model - unique index', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    var fooModel, fooModelGlobal

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                }
            },
            database: database,
            name: 'foo',
        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await fooModelGlobal.sync()
        // get local fooModel
        fooModel = fooModelGlobal.session(session)
    })

    it('should not create two objects with the same unique value', async function () {
        // insert first record
        await fooModel.create({foo: 'foo'})
        // inserting second record should throw error
        try {
            await fooModel.create({foo: 'foo'})
        }
        catch (err) {
            var threwError = true
        }
        assert.isTrue(threwError, 'second insert with unique index threw error')
    })

    it('should create revision with the same unique value', async function () {
        // insert first record
        var foo = await fooModel.create({foo: 'foo'})
        // create new revision with same foo value
        foo = await foo.update({bar: 'bar'})
        // verify that foo value still set in data
        assert.strictEqual(foo.data.foo, 'foo')
        // foo should not be set in raw data
        assert.strictEqual(foo.raw.foo, undefined)
    })

    it('should update unique value if data changes', async function () {
        // insert first record
        var foo = await fooModel.create({foo: 'foo'})
        // create new revision with same foo value
        foo = await foo.update({bar: 'bar'})
        // create new revision with new foo value
        foo = await foo.update({foo: 'foo2'})
        // verify that foo value still set in data
        assert.strictEqual(foo.data.foo, 'foo2')
        // foo should be set in raw data when updated
        assert.strictEqual(foo.raw.foo, 'foo2')
    })

})
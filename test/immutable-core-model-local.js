'use strict'

const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
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

describe('immutable-core-model-local', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    // reset immutable so that model modules are recreated with every test
    immutable.reset().strictArgs(false)
    // create global model instance
    var globalFooModel = new ImmutableCoreModel({
        database: database,
        name: 'foo',
    })

    // variables to populate in tests
    var origBar
    var origFoo

    before(async function () {
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await globalFooModel.sync()
        }
        catch (err) {
            throw err
        }
    })

    it('should create local model instance with session context', function () {
        var fooModel = globalFooModel.session(session)
        // check for methods
        assert.strictEqual(typeof fooModel.create, 'function')
        assert.strictEqual(typeof fooModel.query, 'function')
        assert.strictEqual(typeof fooModel.select, 'function')
    })

    it('should create instance with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // create new bar instance
        origBar = await fooModel.create({
            data: {
                bar: "1.000000000",
                foo: 'bar',
            },
            session: session,
        })
        // create new foo instance
        origFoo = await fooModel.create({
            data: {
                bar: "2.000000000",
                foo: 'foo',
            },
            session: session,
        })
    })

    it('should do query with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // do query
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: origFoo.id()
            }
        })
        // check that model matches
        assert.deepEqual(foo.raw, origFoo.raw)
    })

    it('should do select with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // do query
        var bar = await fooModel.select.by.id(origBar.id())
        // check that model matches
        assert.deepEqual(bar.raw, origBar.raw)
    })

})
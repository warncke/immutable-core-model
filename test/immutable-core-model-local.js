 'use strict'

const ImmutableAccessControl = require('immutable-access-control')
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
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // variables to populate
    var globalFooModel, origBar, origFoo

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create global model instance
        globalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await globalFooModel.sync()
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
        // create new bar instance with create
        origBar = await fooModel.create({
            bar: "1.000000000",
            foo: 'bar',
        })
        // create new foo instance with createMeta
        origFoo = await fooModel.createMeta({
            data: {
                bar: "2.000000000",
                foo: 'foo',
            },
        })
    })

    it('should do query with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // do query
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: origFoo.id
            }
        })
        // check that model matches
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should do select with local model', async function () {
        var fooModel = globalFooModel.session(session)
        // do query
        var bar = await fooModel.select.by.id(origBar.id)
        // check that model matches
        assert.deepEqual(bar.data, origBar.data)
    })

    it('should have class properties', async function () {
        var fooModel = globalFooModel.session(session)
        // check for class properties
        assert.isTrue(fooModel.ImmutableCoreModelLocal)
        assert.strictEqual(fooModel.class, 'ImmutableCoreModelLocal')
    })

})
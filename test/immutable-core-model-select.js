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

describe('immutable-core-model-select', function () {

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
    var fooModel = new ImmutableCoreModel({
        columns: {
            bar: 'number',
            foo: 'string',
        },
        database: database,
        name: 'foo',
    })

    // variables to populate in before
    var origBam
    var origBar
    var origFoo

    before(async function () {
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await fooModel.sync()
            // create new bam instance
            origBam = await fooModel.createMeta({
                data: {
                    bar: "0.000000000",
                    foo: 'bam',
                },
                session: session,
            })
            // create new bar instance
            origBar = await fooModel.createMeta({
                data: {
                    bar: "1.000000000",
                    foo: 'bar',
                },
                session: session,
            })
            // create new foo instance
            origFoo = await fooModel.createMeta({
                data: {
                    bar: "2.000000000",
                    foo: 'foo',
                },
                session: session,
            })
        }
        catch (err) {
            throw err
        }
    })

    it('should select by id', async function () {
        // create new query builder
        var select = new ImmutableCoreModelSelect({
            model: fooModel,
            session: session,
        })
        // select foo by id
        var foo = await select.by.id(origFoo.id)
        // check that return matches original
        assert.deepEqual(foo.data, origFoo.data)
    })

    it('should select one by column', async function () {
        // create new query builder
        var select = new ImmutableCoreModelSelect({
            model: fooModel,
            session: session,
        })
        // select foo by id
        var foo = await select.one.by.foo('bar')
        // check that return matches original
        assert.deepEqual(foo.data, origBar.data)
    })

    it('should select specific columns', async function () {
        // create new query builder
        var select = new ImmutableCoreModelSelect({
            model: fooModel,
            session: session,
        })
        // select foo by id
        var foo = await select(['data']).by.id(origFoo.id)
        // check result
        assert.deepEqual(foo.data, { bar: '2.000000000', foo: 'foo' })
    })

})
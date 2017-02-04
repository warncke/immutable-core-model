'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const ImmutableCoreModelView = require('immutable-core-model-view')
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

describe('immutable-core-model - views', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    var origBam, origBar, origFoo

    before(async function () {
        // reset immutable global data
        immutable.reset().strictArgs(false)
        // create initial model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await glboalFooModel.sync()
            // create instances with different data values for testing
            origBam = await glboalFooModel.createMeta({
                data: {
                    bar: "0.000000000",
                    foo: 'bam',
                },
                session: session,
            })
            origBar = await glboalFooModel.createMeta({
                data: {
                    bar: "1.000000000",
                    foo: 'bar',
                },
                session: session,
            })
            origFoo = await glboalFooModel.createMeta({
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

    beforeEach(async function () {
        // reset immutable global data
        immutable.reset().strictArgs(false)
        // reset global model view register
        ImmutableCoreModelView.reset()
        // create collection model view
        new ImmutableCoreModelView({
            each: function (modelView, record, number, context) {
                // index data by foo property
                context[record.data.foo] = record.data
            },
            name: 'bar',
            type: 'collection',
        })
        // create record model view
        new ImmutableCoreModelView({
            each: function (modelView, record) {
                record.foo = record.foo+' food'
            },
            name: 'foo',
            type: 'record',
        })
    })

    it('should create model with model view', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'foo',
            }
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.session(session).select.by.id(origBam.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.strictEqual(foo.data.foo, origBam.data.foo+' food')
    })

})
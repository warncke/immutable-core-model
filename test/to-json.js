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

describe('immutable-core-model - toJSON', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // variable to populate in before
    var fooModel, origBam, origBar, origFoo, origGrr

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        fooModel = new ImmutableCoreModel({
            actions: {
                delete: true,
            },
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await Promise.all([
                database.query('DROP TABLE IF EXISTS foo'),
                database.query('DROP TABLE IF EXISTS fooDelete'),
                database.query('DROP TABLE IF EXISTS fooUnDelete'),
            ])
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
            // create new grr instance
            origGrr = await fooModel.createMeta({
                data: {
                    bar: "3.000000000",
                    foo: 'grr',
                },
                session: session,
            })
            // delete grr
            origGrr.delete()
        }
        catch (err) {
            throw err
        }
    })

    it('should have formatted toJSON object', async function () {
        try {
            var foo = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    id: origFoo.id
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // get object that will be encoded to JSON
        var json = foo.toJSON()
        // check properties
        assert.strictEqual(json.id, origFoo.id)
        assert.strictEqual(json.isDeleted, false)
        assert.strictEqual(json.wasDeleted, false)
        assert.strictEqual(json.isCurrent, true)
        assert.deepEqual(json.data, {bar: '2.000000000', foo: 'foo'})
        assert.isObject(json.actions)
        assert.isObject(json.actions.delete)
        assert.isObject(json.actions.unDelete)
    })

})
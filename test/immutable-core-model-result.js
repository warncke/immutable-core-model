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

describe('immutable-core-model - result', function () {

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

    // variable to populate in before
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
            origBam = await fooModel.create({
                data: {
                    bar: "0.000000000",
                    foo: 'bam',
                },
                session: session,
            })
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
        }
        catch (err) {
            throw err
        }
    })

    it('should return result object when doing multi-record query', async function () {
        try {
            var result = await fooModel.query({
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that result has records
        assert.strictEqual(result.length, 3)
    })

    it('should iterate over rows with each', async function () {
        try {
            // query all rows
            var result = await fooModel.query({
                session: session,
            })
            // set fetchNum to 1 so that it does a query for each iteration
            result.fetchNum = 1
            // iterate over records
            var context = await result.each((record, number, context) => {
                // check that number fetched matches loop
                assert.strictEqual(result.fetched, number + 1)
                // keep track of objects fetched in context
                context[record.data.foo] = record.data.bar
            })
            // expect result iteration to be done
            assert.isTrue(result.done)
            // check that results fetched and context returned
            assert.deepEqual(context, {
                bam: '0.000000000',
                bar: '1.000000000',
                foo: '2.000000000',
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should fetch multiple rows and buffer', async function () {
        try {
            // query all rows
            var result = await fooModel.query({
                session: session,
            })
            // iterate over records
            var context = await result.each((record, number, context) => {
                // all rows should be fetched before first call
                assert.strictEqual(result.fetched, 3)
                // keep track of objects fetched in context
                context[record.data.foo] = record.data.bar
            })
            // expect result iteration to be done
            assert.isTrue(result.done)
            // check that results fetched and context returned
            assert.deepEqual(context, {
                bam: '0.000000000',
                bar: '1.000000000',
                foo: '2.000000000',
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

    it('should order iteration correctly', async function () {
        try {
            // query all rows
            var result = await fooModel.query({
                order: ['bar'],
                session: session,
            })
            // iterate over records
            var context = await result.each((record, number, context) => {
                // check that order is correct (0,1,2)
                assert.strictEqual(parseInt(record.data.bar), number)
            })
            // expect result iteration to be done
            assert.isTrue(result.done)
        }
        catch (err) {
            assert.ifError(err)
        }
    })

})
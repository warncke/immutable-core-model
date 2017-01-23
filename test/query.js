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

describe('immutable-core-model - query', function () {

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

    it('should do query by id', async function () {
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
        // verify that objects match
        assert.deepEqual(foo.raw, origFoo.raw)
    })

    it('should do query by string column', async function () {
        try {
            var bar = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    foo: 'bar'
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(bar.raw, origBar.raw)
    })

    it('should do query by number column', async function () {
        try {
            var bam = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    bar: 0
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(bam.raw, origBam.raw)
    })

    it('should query all', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(
            [all[0].raw, all[1].raw, all[2].raw],
            [origBam.raw, origBar.raw, origFoo.raw]
        )
    })

    it('should order desc', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                order: ['createTime', 'desc'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(
            [all[0].raw, all[1].raw, all[2].raw],
            [origFoo.raw, origBar.raw, origBam.raw]
        )
    })

    it('should order with multiple clauses', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                order: [
                    ['sessionId', 'accountId', 'asc'],
                    ['createTime', 'desc'],
                ],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(
            [all[0].raw, all[1].raw, all[2].raw],
            [origFoo.raw, origBar.raw, origBam.raw]
        )
    })

    it('should do in query', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
                where: {
                    id: [
                        origBam.id,
                        origBar.id,
                        origFoo.id,
                    ],
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // verify that objects match
        assert.deepEqual(
            [all[0].raw, all[1].raw, all[2].raw],
            [origBam.raw, origBar.raw, origFoo.raw]
        )
    })

})
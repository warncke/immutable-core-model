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

describe('immutable-core-model - delete instance', function () {

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

    // variable to populate in before
    var origBam
    var origBar
    var origFoo

    before(async function () {
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

    it('should have action properties', async function () {
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
        // foo should have action properties
        assert.isFalse(foo.isDeleted)
        assert.isFalse(foo.wasDeleted)
    })

    it('should have action methods', async function () {
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
        // foo should have action methods
        assert.strictEqual(typeof foo.delete, 'function')
        assert.strictEqual(typeof foo.unDelete, 'function')
    })

    it('should delete instance', async function () {
        try {
            var foo = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    id: origFoo.id
                },
            })
            // delete foo
            foo = await foo.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should be deleted
        assert.isTrue(foo.isDeleted)
    })

    it('should un-delete instance', async function () {
        try {
            var foo = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    id: origFoo.id
                },
            })
            // foo should be deleted
            assert.isTrue(foo.isDeleted)
            // delete foo
            foo = await foo.unDelete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should not be deleted
        assert.isFalse(foo.isDeleted)
        // foo should have been deleted before
        assert.isTrue(foo.wasDeleted)
    })

    it('should delete instance again', async function () {
        try {
            var foo = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    id: origFoo.id
                },
            })
            // delete foo
            foo = await foo.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should be deleted
        assert.isTrue(foo.isDeleted)
    })

    it('should not return deleted records in queries', async function () {
        try {
            var foos = await fooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // results should not include deleted record

    })
})
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

    // variable to populate in before
    var fooModel, origBam, origBar, origFoo, origGrr

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
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

    it('should query deleted instance', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                session: session,
                where: {
                    isDeleted: true,
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 1)
        assert.deepEqual(all[0].data, origGrr.data)
    })

    it('should query not-deleted instances', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
                where: {
                    isDeleted: false,
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 3)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should query both deleted and not-deleted instances', async function () {
        try {
            var all = await fooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
                where: {
                    isDeleted: null,
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 4)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

    it('should select deleted instance', async function () {
        try {
            var all = await fooModel.session(session).select.all
                .where.isDeleted(true).query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 1)
        assert.deepEqual(all[0].data, origGrr.data)
    })

    it('should select not-deleted instances', async function () {
        try {
            var all = await fooModel.session(session).select.all
                .where.isDeleted(false)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 3)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data],
            [origBam.data, origBar.data, origFoo.data]
        )
    })

    it('should query both deleted and not-deleted instances', async function () {
        try {
            var all = await fooModel.session(session).select.all
                .where.isDeleted(null)
                .order.by.createTime.query()
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 4)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
    })

    it('should have result sets with both deleted and not-deleted instances', async function () {
        try {
            // get result set
            var result = await fooModel.session(session).select
                .where.isDeleted(null)
                .order.by.createTime.query()
            // get records
            var all = await result.fetch(4)
        }
        catch (err) {
            assert.ifError(err)
        }
        // check return
        assert.strictEqual(all.length, 4)
        assert.deepEqual(
            [all[0].data, all[1].data, all[2].data, all[3].data],
            [origBam.data, origBar.data, origFoo.data, origGrr.data]
        )
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
                    id: origFoo.id,
                    isDeleted: true,
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

    it('should have delete and undelete data properties', async function () {
        try {
            var foo = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    id: origFoo.id,
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that action data is set
        assert.property(foo, 'actions')
        assert.property(foo.actions, 'delete')
        assert.property(foo.actions, 'unDelete')
        assert.property(foo.actions.delete, 'createTime')
        assert.property(foo.actions.delete, 'id')
        assert.property(foo.actions.delete, 'sessionId')
        assert.property(foo.actions.unDelete, 'createTime')
        assert.property(foo.actions.unDelete, 'id')
        assert.property(foo.actions.unDelete, 'sessionId')
    })

    it('delete another instance', async function () {
        try {
            var bar = await fooModel.query({
                limit: 1,
                session: session,
                where: {
                    id: origBar.id
                },
            })
            // delete bar
            bar = await bar.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // bar should be deleted
        assert.isTrue(bar.isDeleted)
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
        assert.strictEqual(foos.length, 2)
        assert.deepEqual(foos[0].data, origBam.data)
        assert.deepEqual(foos[1].data, origFoo.data)
    })
})
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

describe('immutable-core-model - revisions', function () {

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
    var globalFooModel = new ImmutableCoreModel({
        database: database,
        name: 'foo',
    })
    // create local model with session
    var fooModel = globalFooModel.session(session)

    // will be pouplated in before
    var foo1, foo2, foo3

    before(async function () {
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await globalFooModel.sync()
            // insert first record
            foo1 = await fooModel.create({
                data: {foo: 'foo'}
            })
            // create revision
            foo2 = await foo1.update({
                data: {foo: 'bar'}
            })
            // create another revision
            foo3 = await foo2.update({
                data: {foo: 'bam'}
            })
        }
        catch (err) {
            throw err
        }
    })

    it('should only return the current revision of an object by default', async function () {
        try {
            // get all foos
            var foos = await fooModel.query({
                all: true
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should only be one record returned
        assert.strictEqual(foos.length, 1)
        // record should be current revision
        assert.deepEqual(foos[0].data, foo3.data)
    })

    it('should only return all revisions if option set', async function () {
        try {
            // get all foos
            var foos = await fooModel.query({
                all: true,
                allRevisions: true,
                order: ['createTime'],
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // there should only be one record returned
        assert.strictEqual(foos.length, 3)
        // record should be current revision
        assert.deepEqual(foos[0].data, foo1.data)
        assert.deepEqual(foos[1].data, foo2.data)
        assert.deepEqual(foos[2].data, foo3.data)
    })

    it('should return exact revision specified by id', async function () {
        try {
            // query for old revision
            var foo = await fooModel.query({
                limit: 1,
                where: {
                    id: foo1.id
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // record should match
        assert.deepEqual(foo.data, foo1.data)
    })

    it('should return current revision when selecting by id with current', async function () {
        try {
            // query for old revision
            var foo = await fooModel.query({
                current: true,
                limit: 1,
                where: {
                    id: foo1.id
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // record should match
        assert.deepEqual(foo.data, foo3.data)
    })

    it('should set isCurrent false on old revision', async function () {
        try {
            // query for old revision
            var foo = await fooModel.query({
                limit: 1,
                where: {
                    id: foo1.id
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should not be current
        assert.isFalse(foo.isCurrent)
    })

    it('should have current method that returns current instance', async function () {
        try {
            // query for old revision
            var foo = await fooModel.query({
                limit: 1,
                where: {
                    id: foo1.id
                },
            })
            // query for current revision
            foo = await foo.current()
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should be current
        assert.isTrue(foo.isCurrent)
    })

    it('should select current instance', async function () {
        try {
            // select current with old id
            var foo = await fooModel.select.current.by.id(foo1.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should be current
        assert.isTrue(foo.isCurrent)
    })

})
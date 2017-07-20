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

describe('immutable-core-model - revisions', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        globalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // create local model with session
        fooModel = globalFooModel.session(session)
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await globalFooModel.sync()
        // insert first record
        foo1 = await fooModel.create({foo: 'foo'})
        // create revision
        foo2 = await foo1.update({foo: 'bar'})
        // create another revision
        foo3 = await foo2.update({foo: 'bam'})
    })

    it('should only return the current revision of an object by default', async function () {
        // get all foos
        var foos = await fooModel.query({
            all: true
        })
        // there should only be one record returned
        assert.strictEqual(foos.length, 1)
        // record should be current revision
        assert.deepEqual(foos[0].data, foo3.data)
    })

    it('should only return all revisions if option set', async function () {
        // get all foos
        var foos = await fooModel.query({
            all: true,
            allRevisions: true,
            order: ['createTime'],
        })
        // there should only be one record returned
        assert.strictEqual(foos.length, 3)
        // record should be current revision
        assert.deepEqual(foos[0].data, foo1.data)
        assert.deepEqual(foos[1].data, foo2.data)
        assert.deepEqual(foos[2].data, foo3.data)
    })

    it('should return exact revision specified by id', async function () {
        // query for old revision
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // record should match
        assert.deepEqual(foo.data, foo1.data)
    })

    it('should return current revision when selecting by id with current', async function () {
        // query for old revision
        var foo = await fooModel.query({
            current: true,
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // record should match
        assert.deepEqual(foo.data, foo3.data)
    })

    it('should set isCurrent false on old revision with isCurrent:true', async function () {
        // query for old revision
        var foo = await fooModel.query({
            isCurrent: true,
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // foo should not be current
        assert.isFalse(foo.isCurrent)
    })

    it('should have current method that returns current instance', async function () {
        // query for old revision
        var foo = await fooModel.query({
            limit: 1,
            where: {
                id: foo1.id
            },
        })
        // query for current revision
        foo = await foo.current()
        // foo should be current
        assert.strictEqual(foo.id, foo3.id)
    })

    it('should select current instance', async function () {
        // select current with old id
        var foo = await fooModel.select.current.by.id(foo1.id)
        // foo should be current
        assert.strictEqual(foo.id, foo3.id)
    })

})
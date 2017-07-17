'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const immutable = require('immutable-core')

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

describe('immutable-core-model - validate', function () {

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
        // create foo with no columns
        fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync model
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
    })

    it('should validate column data when adding column', async function () {
        // reset immutable so that model modules are recreated
        immutable.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        await fooModel.sync()
        // validate flag should be true
        assert.isTrue(fooModel.needsValidate)
        // validate should be done
        assert.isTrue(fooModel.validated)
        // four records should be updated
        assert.strictEqual(fooModel.updated, 4)
    })

    it('should not validate when schema has not changed', async function () {
        // reset immutable so that model modules are recreated
        immutable.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        await fooModel.sync()
        // validate flag should be false
        assert.isFalse(fooModel.needsValidate)
        assert.isFalse(fooModel.validated)
    })

    it('should not update when validate called and data correct', async function () {
        // reset immutable so that model modules are recreated
        immutable.reset()
        ImmutableCoreModel.reset()
        // create updated foo model with columns
        fooModel = new ImmutableCoreModel({
            columns: {
                bar: 'number',
                foo: 'string',
            },
            database: database,
            name: 'foo',
        })
        await fooModel.sync()
        // manually call validate
        await fooModel.validate()
        // validate flag should be false
        assert.isFalse(fooModel.needsValidate)
        assert.isTrue(fooModel.validated)
        assert.strictEqual(fooModel.updated, 0)
    })

})
'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const _ = require('lodash')
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

describe('immutable-core-model - n/c columns', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    var fooModel

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // create foo model without n,c columns
        var fooModel = new ImmutableCoreModel({
            columns: {
                c: false,
                id: {
                    unique: false,
                    primary: true,
                },
                n: false,
            },
            database: database,
            name: 'foo',
        })
        // sync db
        await fooModel.sync()
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
    })

    it('should convert id from primary to unique', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.isUndefined(schema.columns.fooId.primary)
        assert.isTrue(schema.columns.fooId.unique)
        assert.isTrue(schema.columns.n.primary)
    })

    it('should create c column if it does not exist', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
            },
            database: database,
            name: 'foo',
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.c.type, 'smallint')
        assert.strictEqual(schema.columns.c.unsigned, true)
    })

    it('c column should default to 1 with compression:true', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
            },
            database: database,
            name: 'foo',
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.c.default, '1')
    })

    it('c column should default to 0 with compression:false', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
            },
            compression: false,
            database: database,
            name: 'foo',
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.c.default, '0')
    })

    it('should create n column if it does not exist', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                c: false,
            },
            database: database,
            name: 'foo',
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.n.type, 'int')
        assert.strictEqual(schema.columns.n.primary, true)
    })

})
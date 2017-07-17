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

describe('immutable-core-model - access control create', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated', 'foo'],
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
    })

    it('should deny access to create', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: ['0'],
            database: database,
            name: 'foo',
        })
        // capture error
        var error
        try {
            await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to create', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                ['foo', 'create:1'],
            ],
            database: database,
            name: 'foo',
        })
        // sync model
        await fooModel.sync()
        // create should be success
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
        // test created instance
        assert.isDefined(foo)
        assert.strictEqual(foo.data.foo, true)
    })

})
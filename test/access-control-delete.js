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

describe.skip('immutable-core-model - access control delete', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated', 'foo'],
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        return Promise.all([
            database.query('DROP TABLE IF EXISTS foo'),
            database.query('DROP TABLE IF EXISTS fooDelete'),
        ])
    })

    it('should deny access to delete', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'delete:any:0'
            ],
            actions: {
                delete: false,
            },
            database: database,
            name: 'foo',
        })
        // capture error
        var error
        try {
            // sync model
            await fooModel.sync()
            // foo create should succeed
            var foo = await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
            // foo delete should fail
            await foo.delete()
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to delete', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'delete:any:0',
                'delete:own:1',
            ],
            actions: {
                delete: false,
            },
            database: database,
            name: 'foo',
        })
        try {
            // sync model
            await fooModel.sync()
            // foo create should succeed
            var foo = await fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
            // foo delete should succeed
            foo = await foo.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that foo deleted
        assert.strictEqual(foo.isDeleted, true)
    })

})
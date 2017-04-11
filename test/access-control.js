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

describe('immutable-core-model - access control', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
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

    it('should create model with default access control provider', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // check that access control provider set
        assert.isObject(fooModel.accessControl)
        // validate class
        assert.isTrue(fooModel.accessControl.ImmutableAccessControl)
    })

    it('should accept custom access control provider', async function () {
        // create mock access control provider
        var accessControl = {
            ImmutableAccessControl: true,
        }
        // create model
        var fooModel = new ImmutableCoreModel({
            accessControl: accessControl,
            database: database,
            name: 'foo',
        })
        // check that access control provider set
        assert.deepEqual(fooModel.accessControl, accessControl)
    })

    it('should throw error on invalid access control provider', async function () {
        // set access control object with class flag
        assert.throws(function () {
            var fooModel = new ImmutableCoreModel({
                accessControl: {},
                database: database,
                name: 'foo',
            })
        })
    })

    it('should set access control rules with default all role', async function () {
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
            ],
            database: database,
            name: 'foo',
        })
        // check rules
        assert.deepEqual(fooModel.accessControl.rules, {model: {model: {foo: {
            allow: { all: 0 }, action: { create: { allow: { all: 1 } } }
        }}}})
    })

    it('should set access control rules with custom roles', async function () {
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                ['authenticated', 'read:any:1']
            ],
            database: database,
            name: 'foo',
        })
        // check rules
        assert.deepEqual(fooModel.accessControl.rules, {model: {model: {foo: {
            allow: { all: 0 }, action: { read: { any: { allow: { authenticated: 1 } } } }
        }}}})
    })

    it('should set custom access id column', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            accessIdName: 'barId',
            columns: {
                barId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
            },
            database: database,
            name: 'foo',
        })
        // check that name set
        assert.deepEqual(fooModel.accessControl.accessIdNames, {foo: 'barId'})
    })

    it('should throw error if column does not exist for access id name', async function () {
        // create model with bad access id name
        assert.throws(function () {
            var fooModel = new ImmutableCoreModel({
                accessIdName: 'barId',
                database: database,
                name: 'foo',
            })
        })
    })

    it('should allow access to models by default', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        try {
            // sync with database
            await fooModel.sync()
            // create record
            var foo = fooModel.createMeta({
                data: {foo: true},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
    })

})
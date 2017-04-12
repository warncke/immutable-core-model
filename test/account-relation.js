'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
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

describe('immutable-core-model - relations to account table', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // models to create
    var accountModelGlobal, accountModel, authModelGlobal, authModel

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create account model
        accountModelGlobal = new ImmutableCoreModel({
            // disable default columns
            columns: {
                accountAccountId: false,
                data: false,
                originalId: false,
                parentId: false,
                sessionId: false,
            },
            database: database,
            name: 'account',
            relations: {
                auth: {},
            },
        })
        // create auth model
        authModelGlobal = new ImmutableCoreModel({
            // allow auth records to be deleted but not un-deleted
            actions: {
                delete: false,
            },
            // add queryable columns for auth provider id and name
            columns: {
                authProviderId: {
                    type: 'string',
                },
                authProviderName: {
                    type: 'string',
                },
            },
            database: database,
            indexes: [
                {
                    columns: ['authProviderName', 'authProviderId'],
                },
            ],
            name: 'auth',
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS account')
            await database.query('DROP TABLE IF EXISTS auth')
            // sync with database
            await accountModelGlobal.sync()
            await authModelGlobal.sync()
            // get local instances
            accountModel = accountModelGlobal.session(session)
            authModel = authModelGlobal.session(session)
        }
        catch (err) {
            throw err
        }
    })

    it('should query models related to account model', async function () {
        try {
            // create account
            var account = await accountModel.create({})
            // create related record
            var auth = await account.create('auth', {
                authProviderId: 'foo',
                authProviderName: 'bar'
            })
            // query related auth accounts
            var authsResult = await account.select('auth')
            // fetch records
            var relatedAuth = await authsResult.fetch(1)
        }
        catch (err) {
            assert.ifError(err)
        }
        // test that related auth fetched
        assert.isArray(relatedAuth)
        assert.strictEqual(relatedAuth.length, 1)
        assert.strictEqual(relatedAuth[0].id, auth.id)
    })

    it('should inverse query models related to account model', async function () {
        try {
            // create account
            var account = await accountModel.create({})
            // create related record
            var auth = await account.create('auth', {
                authProviderId: 'foo',
                authProviderName: 'bar'
            })
            // query related account accounts
            var accountsResult = await auth.select('account')
            // fetch records
            var relatedAccount = await accountsResult.fetch(1)
        }
        catch (err) {
            assert.ifError(err)
        }
        // test that related auth fetched
        assert.isArray(relatedAccount)
        assert.strictEqual(relatedAccount.length, 1)
        assert.strictEqual(relatedAccount[0].id, account.id)
    })

})
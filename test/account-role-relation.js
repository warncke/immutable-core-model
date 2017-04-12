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

describe('immutable-core-model - via relation to account table', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // models to create
    var accountModelGlobal, accountModel, roleModelGlobal, roleModel, roleAccountModelGlobal, roleAccountModel

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
                role: {via: 'roleAccount'},
            },
        })
        // create role model
        roleModelGlobal = new ImmutableCoreModel({
            actions: {
                delete: false,
            },
            columns: {
                roleName: {
                    immutable: true,
                    type: 'string',
                    unique: true,
                },
            },
            database: database,
            name: 'role',
        })
        // create role account model
        roleAccountModelGlobal = new ImmutableCoreModel({
            actions: {
                delete: false,
            },
            columns: {
                accountId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                data: false,
                originalId: false,
                parentId: false,
                roleId: {
                    index: true,
                    null: false,
                    type: 'id',
                }
            },
            database: database,
            name: 'roleAccount',
            relations: {
                role: {},
            }
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS account')
            await database.query('DROP TABLE IF EXISTS role')
            await database.query('DROP TABLE IF EXISTS roleAccount')
            // sync with database
            await accountModelGlobal.sync()
            await roleModelGlobal.sync()
            await roleAccountModelGlobal.sync()
            // get local instances
            accountModel = accountModelGlobal.session(session)
            roleModel = roleModelGlobal.session(session)
            roleAccountModel = roleAccountModelGlobal.session(session)
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
            var role = await account.create('role', {foo: 'bar'})
            // query related
            var result = await account.select('role')
            // fetch records
            var records = await result.fetch(1)
        }
        catch (err) {
            assert.ifError(err)
        }
        // test related
        assert.isArray(records)
        assert.strictEqual(records.length, 1)
        assert.strictEqual(records[0].id, role.id)
    })

    it('should query models related to account model inverse', async function () {
        try {
            // create account
            var account = await accountModel.create({})
            // create related record
            var role = await account.create('role', {foo: 'bar'})
            // query related
            var result = await role.select('account')
            // fetch records
            var records = await result.fetch(1)
        }
        catch (err) {
            assert.ifError(err)
        }
        // test related
        assert.isArray(records)
        assert.strictEqual(records.length, 1)
        assert.strictEqual(records[0].id, account.id)
    })

    it('should query account with related model', async function () {
        try {
            // create account
            var account = await accountModel.create({})
            // create related record
            var role = await account.create('role', {foo: 'bar'})
            // query related
            var accountWithRole = await accountModel.query({
                limit: 1,
                where: { id: account.id },
                with: { role: true },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // test related
        assert.isObject(accountWithRole.related)
        assert.isArray(accountWithRole.related.role)
        assert.strictEqual(accountWithRole.related.role.length, 1)
        assert.strictEqual(accountWithRole.related.role[0].id, role.id)
    })

})
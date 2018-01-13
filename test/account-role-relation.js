'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - via relation to account table', function () {

    var database, redis, reset, session

    // models to create
    var accountModelGlobal, accountModel, roleModelGlobal, roleModel, roleAccountModelGlobal, roleAccountModel

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
        await reset(database, redis)
        // create account model
        accountModelGlobal = new ImmutableCoreModel({
            // disable default columns
            columns: {
                accountAccountId: false,
                d: false,
                data: false,
                originalId: false,
                parentId: false,
                sessionId: false,
            },
            database: database,
            name: 'account',
            redis: redis,
            relations: {
                role: {via: 'roleAccount'},
            },
        })
        // create role model
        roleModelGlobal = new ImmutableCoreModel({
            columns: {
                roleName: {
                    immutable: true,
                    type: 'string',
                    unique: true,
                },
            },
            database: database,
            name: 'role',
            redis: redis,
        })
        // create role account model
        roleAccountModelGlobal = new ImmutableCoreModel({
            columns: {
                accountId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                d: false,
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
            redis: redis,
            relations: {
                role: {},
            }
        })
        // sync with database
        await accountModelGlobal.sync()
        await roleModelGlobal.sync()
        await roleAccountModelGlobal.sync()
        // get local instances
        accountModel = accountModelGlobal.session(session)
        roleModel = roleModelGlobal.session(session)
        roleAccountModel = roleAccountModelGlobal.session(session)
    })

    after(async function () {
        await database.close()
    })

    it('should query models related to account model', async function () {
        // create account
        var account = await accountModel.create({})
        // create related record
        var role = await account.create('role', {foo: 'bar'})
        // query related
        var result = await account.select('role')
        // fetch records
        var records = await result.fetch(1)
        // test related
        assert.isArray(records)
        assert.strictEqual(records.length, 1)
        assert.strictEqual(records[0].id, role.id)
    })

    it('should query models related to account model inverse', async function () {
        // create account
        var account = await accountModel.create({})
        // create related record
        var role = await account.create('role', {foo: 'bar'})
        // query related
        var result = await role.select('account')
        // fetch records
        var records = await result.fetch(1)
        // test related
        assert.isArray(records)
        assert.strictEqual(records.length, 1)
        assert.strictEqual(records[0].id, account.id)
    })

    it('should query account with related model', async function () {
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
        // test related
        assert.isObject(accountWithRole.related)
        assert.isArray(accountWithRole.related.role)
        assert.strictEqual(accountWithRole.related.role.length, 1)
        assert.strictEqual(accountWithRole.related.role[0].id, role.id)
    })

})
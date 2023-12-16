'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - relations to account table', function () {

    var mysql, redis, reset, session

    // models to create
    var accountModelGlobal, accountModel, authModelGlobal, authModel

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
        await reset(mysql, redis)
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
            mysql: mysql,
            name: 'account',
            redis: redis,
            relations: {
                auth: {},
            },
        })
        // create auth model
        authModelGlobal = new ImmutableCoreModel({
            // add queryable columns for auth provider id and name
            columns: {
                authProviderId: {
                    type: 'string',
                },
                authProviderName: {
                    type: 'string',
                },
            },
            mysql: mysql,
            indexes: [
                {
                    columns: ['authProviderName', 'authProviderId'],
                },
            ],
            name: 'auth',
            redis: redis,
        })
        // sync with mysql
        await accountModelGlobal.sync()
        await authModelGlobal.sync()
        // get local instances
        accountModel = accountModelGlobal.session(session)
        authModel = authModelGlobal.session(session)
    })

    after(async function () {
        await mysql.end()
    })

    it('should query models related to account model', async function () {
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
        // test that related auth fetched
        assert.isArray(relatedAuth)
        assert.strictEqual(relatedAuth.length, 1)
        assert.strictEqual(relatedAuth[0].id, auth.id)
    })

    it('should inverse query models related to account model', async function () {
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
        // test that related auth fetched
        assert.isArray(relatedAccount)
        assert.strictEqual(relatedAccount.length, 1)
        assert.strictEqual(relatedAccount[0].id, account.id)
    })

})
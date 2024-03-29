'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - access control', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(mysql, redis)
    })

    after(async function () {
        await mysql.end()
    })

    it('setting custom access control provider deprecated', async function () {
        // create mock access control provider
        var accessControl = {
            ImmutableAccessControl: true,
        }
        // create model - should throw
        assert.throws(() => new ImmutableCoreModel({
            accessControl: accessControl,
            mysql: mysql,
            name: 'foo',
            redis: redis,
        }))
    })

    it('should set access control rules with default all role', async function () {
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get global access control instance
        var accessControl = ImmutableAccessControl.getGlobal()
        // check rules
        assert.deepEqual(accessControl.rules, {model: {model: {foo: {
            allow: { all: 0 }, action: { create: { allow: { all: 1 } } }
        }}}})
    })

    it('should set access control rules with custom roles', async function () {
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                ['authenticated', 'read:any:1']
            ],
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get global access control instance
        var accessControl = ImmutableAccessControl.getGlobal()
        // check rules
        assert.deepEqual(accessControl.rules, {model: {model: {foo: {
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get global access control instance
        var accessControl = ImmutableAccessControl.getGlobal()
        // check that name set
        assert.deepEqual(accessControl.accessIdNames, {foo: 'barId'})
    })

    it('should throw error if column does not exist for access id name', async function () {
        // create model with bad access id name
        assert.throws(function () {
            var fooModel = new ImmutableCoreModel({
                accessIdName: 'barId',
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
        })
    })

    it('should allow access to models by default', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create record
        var foo = await fooModel.createMeta({
            data: {foo: true},
            session: session,
        })
    })

})
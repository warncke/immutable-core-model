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

describe('immutable-core-model - access model', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    var foo1, foo2, fooBar, fooModel, fooModelGlobal, fooBarModel, fooBarModelGlobal,
        session

    beforeEach(async function () {
        // fake session to use for testing
        session = {
            accessIdName: 'barId',
            accessModel: 'fooBar',
            accountId: '11111111111111111111111111111111',
            accessId: '33333333333333333333333333333333',
            roles: ['all', 'authenticated', 'foo'],
            sessionId: '22222222222222222222222222222222',
        }
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        await database.query('DROP TABLE IF EXISTS fooBar')
        await database.query('DROP TABLE IF EXISTS fooDelete')
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            accessIdName: 'barId',
            accessModel: 'fooBar',
            database: database,
            name: 'foo',
        })
        // get local foo model
        fooModel = fooModelGlobal.session(session)
        // sync model
        await fooModelGlobal.sync()
        // create fooBar model
        fooBarModelGlobal = new ImmutableCoreModel({
            actions: {
                delete: false,
            },
            columns: {
                barId: 'id',
                fooId: 'id',
            },
            database: database,
            name: 'fooBar',
        })
        // get local fooBar model
        fooBarModel = fooBarModelGlobal.session(session)
        // sync model
        await fooBarModelGlobal.sync()
        // create foo record
        foo1 = await fooModel.create({foo: 1})
        foo2 = await fooModel.create({foo: 2})
        // create fooBar record giving session access to foo
        fooBar = await fooBarModel.create({
            barId: session.accessId,
            fooId: foo1.id,
        })
    })

    describe('with no access control rules', function () {

        it('should list all records ', async function () {
            var foos = await fooModel.select.all.order.by.createTime.query()
            // check result
            assert.deepEqual(_.map(foos, 'id'), [foo1.id, foo2.id])
        })

    })

    describe('with access:own', function () {

        beforeEach(function () {
            // get global access control instance
            var accessControl = new ImmutableAccessControl()
            // limit access to list/read own foo records
            accessControl.setRules([
                ['all', 'model:foo:0'],
                ['all', 'model:foo:list:own:1'],
                ['all', 'model:foo:read:own:1'],
            ])
        })

        it('should list only records with matching accessId', async function () {
            var foos = await fooModel.select.all.order.by.createTime.query()
            // check result
            assert.deepEqual(_.map(foos, 'id'), [foo1.id])
        })

        it('should not read a non owned record', async function () {
            var foo = await fooModel.select.by.id(foo2.id)
            // check result
            assert.isUndefined(foo)
        })

    })

    describe('with access:own and deleted access record', function () {

        beforeEach(async function () {
            // get global access control instance
            var accessControl = new ImmutableAccessControl()
            // limit access to list/read own foo records
            accessControl.setRules([
                ['all', 'model:foo:0'],
                ['all', 'model:foo:list:own:1'],
                ['all', 'model:foo:read:own:1'],
            ])
            // delete access record
            await fooBar.delete()
        })

        it('should list no records', async function () {
            var foos = await fooModel.select.all.order.by.createTime.query()
            // check result
            assert.strictEqual(foos.length, 0)
        })

    })

    describe('with access:own and deleted and not deleted access record', function () {

        beforeEach(async function () {
            // get global access control instance
            var accessControl = new ImmutableAccessControl()
            // limit access to list/read own foo records
            accessControl.setRules([
                ['all', 'model:foo:0'],
                ['all', 'model:foo:list:own:1'],
                ['all', 'model:foo:read:own:1'],
            ])
            // delete access record
            await fooBar.delete()
            // create another fooBar record giving session access to foo
            await fooBarModel.create({
                barId: session.accessId,
                fooId: foo1.id,
            })
        })

        it('should list no records', async function () {
            var foos = await fooModel.select.all.order.by.createTime.query()
            // check result
            assert.deepEqual(_.map(foos, 'id'), [foo1.id])
        })

    })

})
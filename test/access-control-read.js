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

describe('immutable-core-model - access control read', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake sessions to use for testing
    var session1 = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated', 'foo'],
        sessionId: '22222222222222222222222222222222',
    }
    var session2 = {
        accountId: '33333333333333333333333333333333',
        roles: ['all', 'authenticated', 'bar'],
        sessionId: '44444444444444444444444444444444',
    }
    var session3 = {
        accountId: '55555555555555555555555555555555',
        roles: ['all', 'authenticated'],
        sessionId: '66666666666666666666666666666666',
    }

    // model instance
    var fooModel
    // record instances
    var bam, bar, baz

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        await database.query('DROP TABLE IF EXISTS fooDelete')
        // create model
        fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
                ['foo', 'read:own:1'],
                ['bar', 'read:any:1'],
            ],
            actions: {
                delete: false,
            },
            database: database,
            name: 'foo',
        })
        // sync model
        await fooModel.sync()
        // create one record with each session
        bam = await fooModel.createMeta({
            data: {foo: 'bam'},
            session: session1,
        })
        bar = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session2,
        })
        baz = await fooModel.createMeta({
            data: {foo: 'baz'},
            session: session3,
        })
    })

    it('should deny access to read', async function () {
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id},
                session: session3,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to read own', async function () {
        try {
            // get own record
            var res = await fooModel.query({
                limit: 1,
                where: {id: bam.id},
                session: session1,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check record
        assert.strictEqual(res.id, bam.id)
    })

    it('should not read other record with only own access', async function () {
        try {
            // get other record
            var res = await fooModel.query({
                limit: 1,
                where: {id: bar.id},
                session: session1,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // should return nothing
        assert.isUndefined(res)
    })

    it('should allow access to read any', async function () {
        try {
            // get other record
            var res = await fooModel.query({
                limit: 1,
                where: {id: bam.id},
                session: session2,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check record
        assert.strictEqual(res.id, bam.id)
    })

})
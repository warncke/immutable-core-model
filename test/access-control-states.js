'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const _ = require('lodash')
const chai = require('chai')
const immutable = require('immutable-core')

const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'

const testCache = process.env.TEST_CACHE === '1' ? true : false

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe('immutable-core-model - access control states', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // connect to redis if TEST_CACHE enabled
    if (testCache) {
        var redis = Redis.createClient({
            host: redisHost,
            port: redisPort,
        })
    }

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
    var fooModel, fooModelGlobal
    // record instances
    var bam, bar, baz

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // create model
        fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
                'read:own:1',
                'delete:own:1',
                'update:own:1',
                ['foo', 'read:deleted:own:1'],
                ['bar', 'read:deleted:any:1'],
                ['foo', 'undelete:any:1']
            ],
            database: database,
            name: 'foo',
            redis: redis,
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

    it('should deny access to deleted records', async function () {
        // delete record
        baz = await baz.delete()
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id, isDeleted: true},
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

    it('should allow access to own deleted records', async function () {
        // delete record
        bam = await bam.delete()
        // query all foo records
        var res = await fooModel.query({
            limit: 1,
            where: {id: bam.id, isDeleted: true},
            session: session1,
        })
        // test error
        assert.isObject(res)
        assert.strictEqual(res.id, bam.id)
    })

    it('should allow access to any deleted records', async function () {
        // delete record
        bam = await bam.delete()
        // query all foo records
        var res = await fooModel.query({
            limit: 1,
            where: {id: bam.id, isDeleted: true},
            session: session2,
        })
        // test error
        assert.isObject(res)
        assert.strictEqual(res.id, bam.id)
    })

})
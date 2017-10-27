'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const _ = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

chai.use(chaiAsPromised)
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

describe('immutable-core-model - select by unique', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // connect to redis
    var redis = Redis.createClient({
        host: redisHost,
        port: redisPort,
    })

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // models
    var fooModel, fooModelGlobal
    // records
    var origFoo, newFoo

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        await redis.flushdb()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                },
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModelGlobal.sync()
        // get local model
        fooModel = fooModelGlobal.session(session)
        // create foo record
        origFoo = await fooModel.create({foo: 'foo', bar: 1})
        // revise foo record
        newFoo = await origFoo.update({bar: 2})
    })

    it('should select record by unique column', async function () {
        // do query by unique colum foo
        var foo = await fooModel.select.by.foo('foo')
        // record should be found
        assert.isDefined(foo)
        // second record should be returned
        assert.strictEqual(foo.id, newFoo.id)
    })

    it('should select record by unique column and id', async function () {
        // do query by unique colum foo
        var foo = await fooModel.query({
            one: true,
            where: {
                foo: 'foo',
                id: origFoo.id,
            }
        })
        // record should be found
        assert.isDefined(foo)
        // second record should be returned
        assert.strictEqual(foo.id, origFoo.id)
    })

    it('should select all revisions by unique column', async function () {
        // do query by unique colum foo
        var foo = await fooModel.query({
            all: true,
            allRevisions: true,
            where: {
                foo: 'foo',
            }
        })
        // record should be found
        assert.isDefined(foo)
        // should be two records
        assert.strictEqual(foo.length, 2)
    })

})
'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const Redis = require('redis')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const immutable = require('immutable-core')

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

describe('immutable-core-model - query required', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // connect to redis if TEST_CACHE enabled
    if (testCache) {
        var redis = Redis.createClient({
            host: redisHost,
            port: redisPort,
        })
    }

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // models to create
    var foo, fooModel, fooModelGlobal


    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,

        })
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await fooModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
    })

    it('should throw error with required:true and no results', async function () {
        // arguments for test query
        var queryArgs = {
            required: true,
            where: {id: 'foo'},
        }
        // capture thrown error
        var thrown
        // catch error
        try {
            // load foo with related records
            var res = await fooModel.query(queryArgs)
        }
        catch (err) {
            thrown = err
        }
        // check result
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'foo query error: no records found')
    })

    it('should throw error with required:true and no results with select by id', async function () {
        // arguments for test query
        var queryArgs = {
            required: true,
            where: {id: 'foo'},
        }
        // capture thrown error
        var thrown
        // catch error
        try {
            // load foo with related records
            var res = await fooModel.select.required.by.id('foo')
        }
        catch (err) {
            thrown = err
        }
        // check result
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'foo query error: no records found')
    })

    it('should throw error with required:true and no results with select where', async function () {
        // arguments for test query
        var queryArgs = {
            required: true,
            where: {id: 'foo'},
        }
        // capture thrown error
        var thrown
        // catch error
        try {
            // load foo with related records
            var res = await fooModel.select.required.where.id.eq('foo').query()
        }
        catch (err) {
            thrown = err
        }
        // check result
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'foo query error: no records found')
    })

})
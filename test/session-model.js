'use strict'

const ImmutableAccessControl = require('immutable-access-control')
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

describe('immutable-core-model - session model', function () {

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

    // will be pouplated in before
    var foo1, globalSessionModel, sessionModel

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // create initial model
        globalSessionModel = new ImmutableCoreModel({
            columns: {
                accountId: false,
                data: false,
                originalId: false,
                parentId: false,
                sessionSessionId: false,
            },
            database: database,
            name: 'session',
            redis: redis,
        })
        // create local model with session
        sessionModel = globalSessionModel.session(session)
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS session')
        // sync with database
        await globalSessionModel.sync()
        // insert first record
        foo1 = await globalSessionModel.createMeta({
            id: '01000000000000000000000000000000',
            session: session,
        })
    })

    it('should select session by id', async function () {
        var session = await sessionModel.select.by.id(foo1.id)
        // check data
        assert.isDefined(session)
        assert.strictEqual(session.id, foo1.id)
    })

})
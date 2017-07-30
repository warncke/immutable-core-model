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

describe('immutable-core-model - d column', function () {

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

    var fooModel, fooDeleteModel

    var bam, bar, baz, foo

    describe('with delete table', function () {

        beforeEach(async function () {
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            ImmutableAccessControl.reset()
            // flush redis
            if (redis) {
                await redis.flushdb()
            }
            // drop test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            await database.query('DROP TABLE IF EXISTS fooDelete')
            // create foo model without d column
            var fooModel = new ImmutableCoreModel({
                columns: {
                    d: false,
                },
                database: database,
                name: 'foo',
                redis: redis,
            })
            // create foo delete model to simulate old action table
            var fooDeleteModel = new ImmutableCoreModel({
                columns: {
                    c: false,
                    d: false,
                    n: false,
                    accountId: false,
                    data: false,
                    originalId: false,
                    parentId: false,
                    fooId: 'id',
                },
                database: database,
                name: 'fooDelete',
                redis: redis,
            })
            // sync db
            await fooModel.sync()
            await fooDeleteModel.sync()
            // get local models
            fooModel = fooModel.session(session)
            fooDeleteModel = fooDeleteModel.session(session)
            // create three foo records
            bam = await fooModel.create({foo: 'bam'})
            bar = await fooModel.create({foo: 'bar'})
            baz = await fooModel.create({foo: 'baz'})
            foo = await fooModel.create({foo: 'foo'})
            // create delete record for two of them
            await fooDeleteModel.create({fooId: bam.id})
            await fooDeleteModel.create({fooId: bar.id})
            await fooDeleteModel.create({fooId: baz.id})
            // create new revision of baz
            baz = await baz.update({foo: 'baz2'})
            // reset global data
            immutable.reset()
            ImmutableCoreModel.reset()
            ImmutableAccessControl.reset()
        })

        it('should delete records when adding d column', async function () {
            // update foo model with n column
            var fooModel = new ImmutableCoreModel({
                database: database,
                name: 'foo',
                redis: redis,
            })
            // sync db
            await fooModel.sync()
            // get schema
            var schema = await fooModel.schema()
            // check schema
            assert.isDefined(schema.columns.d)
            // select all records which should exclude deleted
            var res = await fooModel.session(session).select.all.order.createTime
            // should only be one response
            assert.strictEqual(res.length, 2)
            assert.strictEqual(res[0].id, foo.id)
            assert.strictEqual(res[1].id, baz.id)
        })

    })

})
'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const elasticsearch = require('elasticsearch')
const immutable = require('immutable-core')
const nullFunction = require('null-function')

chai.use(chaiAsPromised)
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

const esHost = process.env.ES_HOST || 'localhost:9200'

describe('immutable-core-model - elasticsearch action', function () {
    // extend timeout for async replication delay
    this.timeout(4000)

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)
    // create elasticsearch connection for testing
    const elasticsearchClient = new elasticsearch.Client({
        host: esHost,
    })

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // clean up elasticsearch
        await elasticsearchClient.indices.delete({
            index: 'foo'
        }).catch(nullFunction)
        // clean up database tables
        await database.query('DROP TABLE IF EXISTS foo')
        await database.query('DROP TABLE IF EXISTS fooDelete')
        await database.query('DROP TABLE IF EXISTS fooPublish')
        await database.query('DROP TABLE IF EXISTS fooUnDelete')
    })

    it('should update document when performing action', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            actions: {
                publish: false,
            },
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
        })
        try {
            // sync model
            await fooModel.sync()
            // create new record
            var foo = await fooModel.createMeta({
                data: {foo: 1},
                session: session,
            })
            // perform action
            foo.publish()
            // wait a second for record to be available
            await Promise.delay(1000)
            // get from elasticsearch
            var res = await elasticsearchClient.get({
                id: foo.originalId,
                index: 'foo',
                type: 'foo',
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate record
        assert.isObject(res)
        assert.isTrue(res._source.isPublished)
    })

    it('should delete document', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            actions: {
                delete: false,
            },
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
        })
        try {
            // sync model
            await fooModel.sync()
            // create new record
            var foo = await fooModel.createMeta({
                data: {foo: 1},
                session: session,
            })
            // wait a second for record to be deleted
            await Promise.delay(1000)
            // perform action
            await foo.delete()
            // wait a second for record to be deleted
            await Promise.delay(1000)
            // get from elasticsearch
            var res = await elasticsearchClient.get({
                id: foo.originalId,
                index: 'foo',
                type: 'foo',
            })
        }
        catch (err) {
            var error = err
        }
        // should be 404
        assert.strictEqual(error.status, 404)
    })

    it('should unDelete document', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            accessControlRules: [
                'list:deleted:any:1',
                'read:deleted:any:1',
                'unDelete:deleted:any:1',
            ],
            actions: {
                delete: true,
            },
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
        })
        try {
            // sync model
            await fooModel.sync()
            // create new record
            var foo = await fooModel.createMeta({
                data: {foo: 1},
                session: session,
            })
            // wait a second for record to be deleted
            await Promise.delay(1000)
            // perform action
            foo = await foo.delete()
            // wait a second for record to be deleted
            await Promise.delay(1000)
            // undelete record
            foo = await foo.unDelete()
            // wait a second for record to be available
            await Promise.delay(1000)
            // get from elasticsearch
            var res = await elasticsearchClient.get({
                id: foo.originalId,
                index: 'foo',
                type: 'foo',
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate record
        assert.isObject(res)
        assert.isTrue(res._source.wasDeleted)
    })

})
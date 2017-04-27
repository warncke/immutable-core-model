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

describe('immutable-core-model - elasticsearch index', function () {

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
        // clean up database tables
        await database.query('DROP TABLE IF EXISTS foo')
        // clean up elasticsearch
        await elasticsearchClient.indices.delete({
            index: 'foo'
        }).catch(nullFunction)
        await elasticsearchClient.indices.delete({
            index: 'not-foo'
        }).catch(nullFunction)
    })

    it('should create index on model sync', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
        })
        try {
            // sync model
            fooModel.sync()
            // wait a second for index to be created
            await Promise.delay(1000)
            // check if index exists
            var exists = await elasticsearchClient.indices.exists({
                index: 'foo'
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that index exists
        assert.isTrue(exists)
    })

    it('should create index with custom name', async function () {
        // create model with elasticsearch
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            esIndex: 'not-foo',
            name: 'foo',
        })
        try {
            // sync model
            fooModel.sync()
            // wait a second for index to be created
            await Promise.delay(1000)
            // check if index exists
            var exists = await elasticsearchClient.indices.exists({
                index: 'not-foo'
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that index exists
        assert.isTrue(exists)
    })

})
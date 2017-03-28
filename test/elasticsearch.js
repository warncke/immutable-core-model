'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const elasticsearch = require('elasticsearch')
const immutable = require('immutable-core')

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

describe('immutable-core-model - elasticsearch', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)
    // create elasticsearch connection for testing
    const elasticsearchClient = new elasticsearch.Client({
        host: esHost,
    })

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
    })

    it('should create a new model with an elasticsearch client', function () {
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
        })
        // get client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearchClient)
    })

    it('should get/set client on model', function () {
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // set client - should return instance
        assert.deepEqual(fooModel.elasticsearch(elasticsearchClient), fooModel)
        // get client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearchClient)
    })

    it('should get/set global client', function () {
         // set client - should return instance
        assert.deepEqual(ImmutableCoreModel.elasticsearchGlobal(elasticsearchClient), ImmutableCoreModel)
        // get client
        assert.deepEqual(ImmutableCoreModel.elasticsearchGlobal(), elasticsearchClient)
    })

    it('should use global client when elasticsearch true and setting after model creation', function () {
        // create model that requires elasticsearch client to be set
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: true,
            name: 'foo',
        })
        // set global elasticsearch client
        ImmutableCoreModel.elasticsearchGlobal(elasticsearchClient)
        // model should have client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearchClient)
    })

    it('should use global client when elasticsearch true and setting before model creation', function () {
        // set global elasticsearch client
        ImmutableCoreModel.elasticsearchGlobal(elasticsearchClient)
        // create model that requires elasticsearch client to be set
        var fooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: true,
            name: 'foo',
        })
        // model should have client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearchClient)
    })

    it('should not use global client when elasticsearch not true', function () {
        // create model that requires elasticsearch client to be set
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // set global elasticsearch client
        ImmutableCoreModel.elasticsearchGlobal(elasticsearchClient)
        // model should have client
        assert.deepEqual(fooModel.elasticsearch(), undefined)
    })

    it('should throw error on invalid elasticsearch on model creation', function () {
        assert.throws(function () {
            // create model with invalid client
            var fooModel = new ImmutableCoreModel({
                database: database,
                elasticsearch: {},
                name: 'foo',
            })
        })
    })

    it('should throw error seting invalid elasticsearch on model', function () {
        assert.throws(function () {
            var fooModel = new ImmutableCoreModel({
                database: database,
                name: 'foo',
            })
            // set invalid client
            fooModel.elasticsearch({})
        })
    })

    it('should throw error seting invalid elasticsearch globally', function () {
        assert.throws(function () {
            // set invalid client
            ImmutableCoreModel.elasticsearchGlobal({})
        })
    })

})
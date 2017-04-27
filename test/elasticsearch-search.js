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

describe('immutable-core-model - elasticsearch search', function () {
    // extend timeout to allow elasticsearch time to index
    this.timeout(10000)

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

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    before(async function () {
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
        // create model with elasticsearch
        globalFooModel = new ImmutableCoreModel({
            database: database,
            elasticsearch: elasticsearchClient,
            name: 'foo',
        })
        // sync model
        await globalFooModel.sync()
        // create local instance
        fooModel = globalFooModel.session(session)
        // create some foo instances
        foo1 = await fooModel.create({foo: 'bam'})
        foo2 = await fooModel.create({foo: 'bar'})
        foo3 = await fooModel.create({foo: 'bar'})
        // wait a second for elasticsearch
        await Promise.delay(1000)
    })

    it('should search', async function () {
        try {
            var res = await fooModel.search({
                index: 'foo',
                raw: true,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // validate response
        assert.isObject(res)
        assert.isObject(res.hits)
        assert.isArray(res.hits.hits)
    })

})
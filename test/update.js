'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
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

describe('immutable-core-model - update', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(async function () {
        try {
            // reset immutable
            immutable.reset().strictArgs(false)
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
        }
        catch (err) {
            throw err
        }
    })

    it('should create model with immutable property', async function () {
        try {
            // create foo model with immutable property
            var fooModel = new ImmutableCoreModel({
                columns: {
                    foo: {
                        immutable: true,
                        type: 'string',
                    }
                },
                database: database,
                name: 'foo',
            })
            // sync model
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'bar'},
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }

        try {
            // this should throw error
            await foo.update({foo: 'bam'})
        }
        catch (err) {
            var threw = err
        }

        assert.isDefined(threw)
        // verify error message
        assert.strictEqual(threw.message, '[immutable.model.foo] cannot modify immutable property foo')
    })

})
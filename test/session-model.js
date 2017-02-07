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

describe('immutable-core-model - session model', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        sessionId: '22222222222222222222222222222222',
    }

    // reset immutable so that model modules are recreated with every test
    immutable.reset().strictArgs(false)
    // create initial model
    var globalSessionModel = new ImmutableCoreModel({
        columns: {
            accountId: false,
            data: false,
            originalId: false,
            parentId: false,
            sessionSessionId: false,
        },
        database: database,
        name: 'session',
    })
    // create local model with session
    var sessionModel = globalSessionModel.session(session)

    // will be pouplated in before
    var foo1

    before(async function () {
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS session')
            // sync with database
            await globalSessionModel.sync()
            // insert first record
            foo1 = await globalSessionModel.createMeta({
                id: '01000000000000000000000000000000',
                session: session,
            })
        }
        catch (err) {
            throw err
        }
    })

    it('should select session by id', async function () {
        try {
            var session = await sessionModel.select.by.id(foo1.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // check data
        assert.isDefined(session)
        assert.strictEqual(session.id, foo1.id)
    })

})
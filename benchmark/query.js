'use strict'

/* npm modules */
const Promise = require('bluebird')
const benchmark = require('benchmark')
const immutable = require('immutable-core')

/* application modules*/
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const sql = require('../lib/sql')

/* setup database and model for test */

// use the same params for all connections
const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

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
var fooModel = new ImmutableCoreModel({
    columns: {
        bar: 'number',
        foo: 'string',
    },
    // compression: false,
    database: database,
    name: 'foo',
})

// variable to populate in before
var origBam
var origBar
var origFoo

runBefore().then(async function () {

    var iterations = 1000000

    var start = new Date().getTime()

    await testModelQuery(iterations)
    // await testSqlQueryBuilder(iterations)

    var stop = new Date().getTime()

    console.log((stop-start)+'ms elapsed '+((stop-start)/iterations)+' ms/call');
})
.catch(console.error)
.then(process.exit)

async function testModelQuery (iterations) {
    for (var i = 0; i < iterations; i++) {
        var foo = await fooModel.query({
            limit: 1,
            session: session,
            where: {
                id: origFoo.id()
            },
        })
    }
}

async function testSqlQueryBuilder (iterations) {
    for (var i = 0; i < iterations; i++) {
        var select = sql.select(fooModel, {
            where: {
                id: origFoo.id(),
            }
        })
    }
}

async function runBefore () {
    // setup data to perform queries
    try {
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        // sync with database
        await fooModel.sync()
        // create new bam instance
        origBam = await fooModel.create({
            data: {
                bar: 0,
                foo: 'bam',
            },
            session: session,
        })
        // create new bar instance
        origBar = await fooModel.create({
            data: {
                bar: 1,
                foo: 'bar',
            },
            session: session,
        })
        // create new foo instance
        origFoo = await fooModel.create({
            data: {
                bar: 2,
                foo: 'foo',
            },
            session: session,
        })
    }
    catch (err) {
        throw err
    }
}
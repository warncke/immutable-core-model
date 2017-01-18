'use strict'

const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const assert = require('chai').assert

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

describe('immutable-model', function () {

    // create database connection to use for testing
    var db = new ImmutableDatabaseMariaSQL(connectionParams)

    it('', function () {

    })

})
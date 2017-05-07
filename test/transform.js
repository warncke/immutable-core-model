'use strict'

const ImmutableAccessControl = require('immutable-access-control')
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

describe('immutable-core-model - transform', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    beforeEach(function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        return database.query('DROP TABLE IF EXISTS foo')
    })

    it('should transform value', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            transform: {
                bam: (value, model, args) => {
                    return 'bar'
                }
            },
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
    })

    it('should call transform with model and args', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            transform: {
                bam: (value, model, args) => {
                    // check model
                    assert.isTrue(model.ImmutableCoreModel)
                    // check args
                    assert.isObject(args.session)
                    assert.isObject(args.data)
                    assert.deepEqual(args.data, {bam: 'foo'})
                    return 'bar'
                }
            },
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
    })

    it('should transform nested property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            transform: {
                'bam.baz': (value, model, args) => {
                    return 'bar'
                }
            },
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: { bam: {baz: 'foo'} },
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, { bam: {baz: 'bar'} })
    })

    it('should not call transform for undefined value', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            transform: {
                'bam.baz': (value, model, args) => {
                    assert.fail()
                }
            },
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should not be transformed
        assert.deepEqual(foo.data, {bam: 'foo'})
    })

    it('should transform value when updating record', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            transform: {
                bam: (value, model, args) => {
                    return 'bar'
                }
            },
        })
        // sync with database
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bam: 'foo'},
            session: session,
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
        // update foo
        foo = await foo.update({
            bam: 'baz'
        })
        // foo should be transofrmed to bar
        assert.deepEqual(foo.data, {bam: 'bar'})
    })

})
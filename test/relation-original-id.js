'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
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

describe('immutable-core-model - relations with original id', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // models to create
    var fooModelGlobal, barModelGlobal
    // local models with session
    var fooModel, barModel

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            relations: {
                bar: {},
            },
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            columns: {
                fooOriginalId: {
                    index: true,
                    null: true,
                    type: 'id',
                },
            },
            database: database,
            name: 'bar',
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            await database.query('DROP TABLE IF EXISTS bar')
            // sync with database
            await fooModelGlobal.sync()
            await barModelGlobal.sync()
            // get local instances
            fooModel = fooModelGlobal.session(session)
            barModel = barModelGlobal.session(session)
        }
        catch (err) {
            throw err
        }
    })

    it('should create related model and via', async function () {
        try {
            // create foo instance
            var foo = await fooModel.create({foo: 'foo'})
            // create related
            var related = await foo.create('bar', {foo: 'bar'})
            // load related
            var bar = await barModel.select.one.by.fooOriginalId(foo.originalId)
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that related was created
        assert.isObject(bar)
        assert.strictEqual(bar.data.fooOriginalId, foo.originalId)
    })

    it('should create related model and via from opposite model', async function () {
        try {
            // create bar instance
            var bar = await barModel.create({foo: 'bar'})
            // create related
            var related = await bar.create('foo', {foo: 'foo'})
            // load related
            var foo = await fooModel.select.by.id(related.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // check that related was created
        assert.isObject(foo)
    })

    it('should select related models', async function () {
        try {
            // create foo instance
            var foo = await fooModel.create({foo: 'foo'})
            // create related
            await foo.create('bar', {foo: 'bam'})
            await foo.create('bar', {foo: 'bar'})
            // load related
            var result = await foo.select('bar')
        }
        catch (err) {
            assert.ifError(err)
        }
        // check result
        assert.strictEqual(result.length, 2)
    })

    it('should query related models', async function () {
        try {
            // create foo instance
            var foo = await fooModel.create({foo: 'foo'})
            // create revision of instance
            foo = await foo.update({foo: 'bar'})
            // create related
            await foo.create('bar', {foo: 'bam'})
            await foo.create('bar', {foo: 'bar'})
            await foo.create('bar', {foo: 'foo'})
            // load related desc
            var result = await foo.query({
                order: ['createTime', 'DESC'],
                relation: 'bar',
            })
            // fetch results
            var desc = await result.fetch(6)
            // load related asc
            var result = await foo.query({
                order: ['createTime'],
                relation: 'bar',
            })
            // fetch results
            var asc = await result.fetch(6)
        }
        catch (err) {
            assert.ifError(err)
        }
        // check result
        assert.strictEqual(asc.length, 3)
        assert.strictEqual(asc[0].data.foo, 'bam')
        assert.strictEqual(asc[1].data.foo, 'bar')
        assert.strictEqual(asc[2].data.foo, 'foo')
        assert.strictEqual(desc.length, 3)
        assert.strictEqual(desc[0].data.foo, 'foo')
        assert.strictEqual(desc[1].data.foo, 'bar')
        assert.strictEqual(desc[2].data.foo, 'bam')
    })

})
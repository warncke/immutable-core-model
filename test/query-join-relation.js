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

describe.skip('immutable-core-model - query join relations', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    // models to create
    var fooModelGlobal, bamModelGlobal, barModelGlobal
    // local models with session
    var fooModel, bamModel, barModel
    // foo instance
    var foo
    // bar instances
    var barBam, barBar, barFoo

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
                bar: {via: 'bam'},
            },
        })
        // create bam model
        bamModelGlobal = new ImmutableCoreModel({
            columns: {
                barId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                fooId: {
                    index: true,
                    null: false,
                    type: 'id',
                },
                data: false,
                originalId: false,
                parentId: false,
            },
            database: database,
            name: 'bam',
            relations: {
                bar: {},
                foo: {},
            }
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            database: database,
            name: 'bar',
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            await database.query('DROP TABLE IF EXISTS bam')
            await database.query('DROP TABLE IF EXISTS bar')
            // sync with database
            await fooModelGlobal.sync()
            await bamModelGlobal.sync()
            await barModelGlobal.sync()
            // get local instances
            fooModel = fooModelGlobal.session(session)
            bamModel = bamModelGlobal.session(session)
            barModel = barModelGlobal.session(session)
            // create foo instance
            foo = await fooModel.create({foo: 'foo'})
            // create related
            barBam = await foo.create('bar', {foo: 'bam'})
            barBar = await foo.create('bar', {foo: 'bar'})
            barFoo = await foo.create('bar', {foo: 'foo'})
        }
        catch (err) {
            throw err
        }
    })

    it('should join related models with order', async function () {
        try {
            // load foo with related records
            var res = await fooModel.query({
                all: true,
                order: ['bar.createTime'],
                raw: true,
                where: {id: foo.id},
                join: ['bar'],
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check result
        assert.deepEqual(res[0].barData, {foo: 'bam'})
        assert.deepEqual(res[1].barData, {foo: 'bar'})
        assert.deepEqual(res[2].barData, {foo: 'foo'})
    })

    it('should join related models with order desc', async function () {
        try {
            // load foo with related records
            var res = await fooModel.query({
                all: true,
                order: ['bar.createTime', 'desc'],
                raw: true,
                where: {id: foo.id},
                join: ['bar'],
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check result
        assert.deepEqual(res[0].barData, {foo: 'foo'})
        assert.deepEqual(res[1].barData, {foo: 'bar'})
        assert.deepEqual(res[2].barData, {foo: 'bam'})
    })

    it('should select columns with joined models', async function () {
        try {
            // load foo with related records
            var res = await fooModel.query({
                all: true,
                order: ['bar.createTime'],
                raw: true,
                select: ['bar.data'],
                where: {
                    'bar.id': barBam.id,
                    id: foo.id
                },
                join: ['bar'],
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // check result
        assert.strictEqual(res.length, 1)
        assert.deepEqual(res[0].barData, {foo: 'bam'})
    })

})
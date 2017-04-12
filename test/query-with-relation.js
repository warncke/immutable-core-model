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

describe('immutable-core-model - query with relations', function () {

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
        }
        catch (err) {
            throw err
        }
    })

    it('should query related models', async function () {
        try {
            // create foo instance
            var foo = await fooModel.create({foo: 'foo'})
            // create related
            await foo.create('bar', {foo: 'bam'})
            await foo.create('bar', {foo: 'bar'})
            await foo.create('bar', {foo: 'foo'})
            // load foo with related records
            var foo = await fooModel.query({
                limit: 1,
                where: {id: foo.id},
                with: {
                    'bar': {
                        order: ['createTime'],
                    },
                },
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // foo should have related records
        assert.strictEqual(foo.related.bar.length, 3)
        assert.strictEqual(foo.related.bar[0].data.foo, 'bam')
        assert.strictEqual(foo.related.bar[1].data.foo, 'bar')
        assert.strictEqual(foo.related.bar[2].data.foo, 'foo')
    })

})
'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCoreModelSelect = require('../lib/immutable-core-model-select')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const _ = require('lodash')
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

describe('immutable-core-model - query join relations', function () {

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
    var foo1, foo2, foo3
    // bar instances
    var bar1, bar2, bar3

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
            columns: {
                foo: 'string',
            },
            database: database,
            name: 'bar',
        })
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
        foo1 = await fooModel.create({foo: 'foo1'})
        foo2 = await fooModel.create({foo: 'foo2'})
        foo3 = await fooModel.create({foo: 'foo3'})
        // create related
        bar1 = await foo1.create('bar', {foo: 'a'})
        bar2 = await foo2.create('bar', {foo: 'b'})
        bar3 = await foo3.create('bar', {foo: 'c'})
    })

    it('should order by joined model', async function () {
        // load foo with related records
        var res = await fooModel.query({
            all: true,
            join: ['bar'],
            order: ['bar.foo'],
        })
        // check result
        assert.deepEqual(_.map(res, 'id'), [foo1.id, foo2.id, foo3.id])
    })

    it('should order by joined model desc', async function () {
        // load foo with related records
        var res = await fooModel.query({
            all: true,
            join: ['bar'],
            order: ['bar.foo', 'desc'],
        })
        // check result
        assert.deepEqual(_.map(res, 'id'), [foo3.id, foo2.id, foo1.id])
    })

    it('should do where query on joined model', async function () {
        // load foo with related records
        var res = await fooModel.query({
            one: true,
            join: ['bar'],
            where: {'bar.foo': 'a'},
        })
        // check result
        assert.strictEqual(res.id, foo1.id)
    })

    it('should not select joined columns by default', async function () {
        // load foo with related records
        var res = await fooModel.query({
            one: true,
            join: ['bar'],
            where: {'bar.foo': 'a'},
        })
        // check result
        assert.deepEqual(res.raw, {
            n: '1',
            c: '1',
            d: '0',
            fooAccountId: foo1.accountId,
            fooCreateTime: foo1.createTime,
            fooData: { foo: 'foo1' },
            fooId: foo1.id,
            fooOriginalId: foo1.originalId,
            fooParentId: undefined,
            fooSessionId: foo1.sessionId,
       })
    })

})
'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const ImmutableCoreModelView = require('immutable-core-model-view')
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

describe('immutable-core-model - views', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake session to use for testing
    var session = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated'],
        sessionId: '22222222222222222222222222222222',
    }

    var origBam, origBar, origFoo, origRecords

    before(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // create initial model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // setup data to perform queries
        try {
            // drop any test tables if they exist
            await database.query('DROP TABLE IF EXISTS foo')
            // sync with database
            await glboalFooModel.sync()
            // create instances with different data values for testing
            origBam = await glboalFooModel.createMeta({
                data: {
                    bar: "0.000000000",
                    foo: 'bam',
                },
                session: session,
            })
            origBar = await glboalFooModel.createMeta({
                data: {
                    bar: "1.000000000",
                    foo: 'bar',
                },
                session: session,
            })
            origFoo = await glboalFooModel.createMeta({
                data: {
                    bar: "2.000000000",
                    foo: 'foo',
                },
                session: session,
            })
            // list of original records in order added
            origRecords = [origBam, origBar, origFoo]
        }
        catch (err) {
            throw err
        }
    })

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModelView.reset()
        ImmutableCoreModel.reset()
        // create collection model view
        new ImmutableCoreModelView({
            each: function (modelView, record, number, context) {
                // index data by foo property
                context[record.foo] = record
            },
            post: function (context) {
                // modify and return context
                context.post = true
                return context
            },
            pre: function () {
                // create initial context
                return {pre: true}
            },
            name: 'bar',
            type: 'collection',
        })
        // create async collection view
        new ImmutableCoreModelView({
            each: function (args) {
                var record = args.record
                // will be mrerged to context
                var context = {}
                // index data by foo property
                context[record.foo+'Async'] = record
                // return data to merge
                return context
            },
            post: function (args) {
                // return data that will be merged to context
                return {postAsync: true}
            },
            pre: function () {
                // create initial context
                return {preAsync: true}
            },
            name: 'barAsync',
            synchronous: false,
            type: 'collection',
        })
        // create record model view
        new ImmutableCoreModelView({
            each: function (modelView, record) {
                record.foo = record.foo+' food'
            },
            name: 'foo',
            type: 'record',
        })
        // create async record model view
        new ImmutableCoreModelView({
            each: function (args) {
                var record  = args.record
                record.foo = record.foo+' foodAsync'
                return record
            },
            name: 'fooAsync',
            synchronous: false,
            type: 'record',
        })
    })

    it('should create model with model view', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'foo',
            }
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.session(session).select.by.id(origBam.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.strictEqual(foo.data.foo, origBam.data.foo+' food')
    })

    it('should query all with record view', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'foo',
            }
        })
        // get all records which should have foo model view applied
        try {
            var records = await glboalFooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.strictEqual(records[0].data.foo, origBam.data.foo+' food')
        assert.strictEqual(records[1].data.foo, origBar.data.foo+' food')
        assert.strictEqual(records[2].data.foo, origFoo.data.foo+' food')
    })

    it('should apply record view to result set', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'foo',
            }
        })
        // get result set which should have foo model view applied
        try {
            var result = await glboalFooModel.query({
                order: ['createTime'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied to result set
        return result.each(function (record, number) {
            assert.strictEqual(record.data.foo, origRecords[number].data.foo+' food')
        })
    })

    it('should return collection view for single record', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'bar',
            }
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.session(session).select.by.id(origBam.id)
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.deepEqual(foo, {
            bam: origBam.data,
            post: true,
            pre: true,
        })
    })

    it('should return collection view for query all', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'bar',
            }
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.deepEqual(foo, {
            bam: origBam.data,
            bar: origBar.data,
            foo: origFoo.data,
            post: true,
            pre: true,
        })
    })

    it('should return collection view for result set', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            views: {
                default: 'bar',
            }
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.query({
                order: ['createTime'],
                session: session,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.deepEqual(foo, {
            bam: origBam.data,
            bar: origBar.data,
            foo: origFoo.data,
            post: true,
            pre: true,
        })
    })

    it('should apply multiple views with select', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.session(session).select.view('foo', 'bar')
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.deepEqual(foo, {
            'bam food': {bar: '0.000000000', foo: 'bam food'},
            'bar food': {bar: '1.000000000', foo: 'bar food'},
            'foo food': {bar: '2.000000000', foo: 'foo food'},
            post: true,
            pre: true,
        })
    })

    it('should apply multiple views with query', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.query({
                all: true,
                order: ['createTime'],
                session: session,
                view: ['foo', 'bar'],
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.deepEqual(foo, {
            'bam food': {bar: '0.000000000', foo: 'bam food'},
            'bar food': {bar: '1.000000000', foo: 'bar food'},
            'foo food': {bar: '2.000000000', foo: 'foo food'},
            post: true,
            pre: true,
        })
    })

    it('should apply sync and async record views', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.session(session).select.one
                .where.id.eq(origBam.id)
                .view('foo', 'fooAsync')
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.strictEqual(foo.data.foo, 'bam food foodAsync')
    })

    it('should apply sync and async collection views', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
        })
        // get single record which should have foo model view applied
        try {
            var foo = await glboalFooModel.session(session).select.view('bar', 'barAsync')
        }
        catch (err) {
            assert.ifError(err)
        }
        // view should be applied
        assert.deepEqual(foo, {
            bam: origBam.data,
            bamAsync: origBam.data,
            bar: origBar.data,
            barAsync: origBar.data,
            foo: origFoo.data,
            fooAsync: origFoo.data,
            post: true,
            postAsync: true,
            pre: true,
            preAsync: true,
        })
    })

})
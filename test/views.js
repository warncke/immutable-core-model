'use strict'

/* npm modules */
const ImmutableCore = require('immutable-core')
const ImmutableCoreModelView = require('immutable-core-model-view')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - views', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.close()
    })

    var origBam, origBar, origFoo, origRecords

    before(async function () {
        await reset(mysql, redis)
        // create initial model
        var fooModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModelGlobal.sync()
        // flush redis
        if (redis) {
            await redis.flushdb()
        }
        // get local fooModel
        var fooModel = fooModelGlobal.session(session)
        // create new bam instance
        origBam = await fooModel.create({
            bar: "0.000000000",
            foo: 'bam',
        })
        // create new bar instance
        origBar = await fooModel.create({
            bar: "1.000000000",
            foo: 'bar',
        })
        // create new foo instance
        origFoo = await fooModel.create({
            bar: "2.000000000",
            foo: 'foo',
        })
        // list of original records in order added
        origRecords = [origBam, origBar, origFoo]
    })

    beforeEach(async function () {
        // reset global data
        ImmutableCore.reset()
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
                var record = _.cloneDeep(args.record)
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
            views: {
                default: 'foo',
            }
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.session(session).select.by.id(origBam.id)
        // view should be applied
        assert.strictEqual(foo.data.foo, origBam.data.foo+' food')
    })

    it('should query all with record view', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            views: {
                default: 'foo',
            }
        })
        // get all records which should have foo model view applied
        var records = await glboalFooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
        })
        // view should be applied
        assert.strictEqual(records[0].data.foo, origBam.data.foo+' food')
        assert.strictEqual(records[1].data.foo, origBar.data.foo+' food')
        assert.strictEqual(records[2].data.foo, origFoo.data.foo+' food')
    })

    it('should apply record view to result set', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            views: {
                default: 'foo',
            }
        })
        // get result set which should have foo model view applied
        var result = await glboalFooModel.query({
            order: ['createTime'],
            session: session,
        })
        // view should be applied to result set
        await result.each(function (record, number) {
            assert.strictEqual(record.data.foo, origRecords[number].data.foo+' food')
        })
    })

    it('should return collection view for single record', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            views: {
                default: 'bar',
            }
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.session(session).select.by.id(origBam.id)
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
            views: {
                default: 'bar',
            }
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
        })
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
            views: {
                default: 'bar',
            }
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.query({
            order: ['createTime'],
            session: session,
        })
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.session(session).select.view('foo', 'bar')
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.query({
            all: true,
            order: ['createTime'],
            session: session,
            view: ['foo', 'bar'],
        })
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
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.session(session).select.one
            .where.id.eq(origBam.id)
            .view('foo', 'fooAsync')
        // view should be applied
        assert.strictEqual(foo.data.foo, 'bam food foodAsync')
    })

    it('should apply sync and async collection views', async function () {
        // create foo model
        var glboalFooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // get single record which should have foo model view applied
        var foo = await glboalFooModel.session(session).select.view('bar', 'barAsync')
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
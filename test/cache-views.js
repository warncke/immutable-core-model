'use strict'

/* npm modules */
const ImmutableCore = require('immutable-core')
const ImmutableCoreModelView = require('immutable-core-model-view')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - cache views', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv({redis: true})
    })

    after(async function () {
        await mysql.end()
        await redis.quit()
    })

    var fooModel, fooModelGlobal

    var origBam, origBar, origFoo, origRecords

    // reset models and re-create views for each test 
    beforeEach(async function () {
        await reset(mysql, redis)
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModelGlobal.sync()
        // get local fooModel
        fooModel = fooModelGlobal.session(session)
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
        // reset model so each test can create model with different views
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // list of original records in order added
        origRecords = [origBam, origBar, origFoo]
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
        // create no cache record model view
        new ImmutableCoreModelView({
            cache: false,
            each: function (modelView, record) {
                record.foo = record.foo+' food'
            },
            name: 'fooNoCache',
            type: 'record',
        })
    })

    describe('with sync record view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'foo',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should cache view result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isTrue(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
        })

        it('should return partially cached result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
        })

        it('should cache raw record when caching view record', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food'])
            // second query without view should be cached
            var foo = await fooModel.select.one.where.id.eq(origBam.id).view(false)
            // check result
            assert.isTrue(foo.raw._cached)
            assert.strictEqual(foo.data.foo, 'bam')
        })
    })

    describe('with async record view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'fooAsync',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should cache view result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync', 'bar foodAsync'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isTrue(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync', 'bar foodAsync'])
        })

        it('should return partially cached result when requesting multiple ids', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync', 'bar foodAsync'])
        })

        it('should cache raw record when caching view record', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam foodAsync'])
            // second query without view should be cached
            var foo = await fooModel.select.one.where.id.eq(origBam.id).view(false)
            // check result
            assert.isTrue(foo.raw._cached)
            assert.strictEqual(foo.data.foo, 'bam')
        })
    })

    describe('with sync collection view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'bar',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should cache view result when requesting multiple ids', async function () {
            // expected result
            var expected = {
                pre: true,
                bam: { bar: '0.000000000', foo: 'bam' },
                bar: { bar: '1.000000000', foo: 'bar' },
                post: true,
            }
            // first query should not be cached
            var res = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(res._cached)
            assert.deepEqual(res, expected)
            // second query should be cached
            res = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(res._cachedView)
            delete  res._cachedView
            assert.deepEqual(res, expected)
        })

        it('should cache raw record when caching view record', async function () {
            // first query should not be cached
            var res = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(res._cachedView)
            assert.deepEqual(res, { pre: true, bam: { bar: '0.000000000', foo: 'bam' }, post: true })
            // second query without view should be cached
            var foo = await fooModel.select.one.where.id.eq(origBam.id).view(false)
            // check result
            assert.isTrue(foo.raw._cached)
            assert.strictEqual(foo.data.foo, 'bam')
        })

        it('should cache view result when doing select', async function () {
            // expected result
            var expected = {
                pre: true,
                bam: { bar: '0.000000000', foo: 'bam' },
                bar: { bar: '1.000000000', foo: 'bar' },
                foo: { bar: '2.000000000', foo: 'foo' },
                post: true,
            }
            // first query should not be cached
            var res = await fooModel.select.all
            // check result
            assert.isUndefined(res._cached)
            assert.deepEqual(res, expected)
            // wait to allow async cache to complete
            await Promise.delay(50)
            // second query should be cached
            res = await fooModel.select.all
            // check result
            assert.isTrue(res._cachedView)
            delete  res._cachedView
            assert.deepEqual(res, expected)
        })
    })

    describe('with async collection view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'barAsync',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should cache view result when requesting multiple ids', async function () {
            // expected result
            var expected = {
                preAsync: true,
                bamAsync: { bar: '0.000000000', foo: 'bam' },
                barAsync: { bar: '1.000000000', foo: 'bar' },
                postAsync: true,
            }
            // first query should not be cached
            var res = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(res._cached)
            assert.deepEqual(res, expected)
            // second query should be cached
            res = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isTrue(res._cachedView)
            delete  res._cachedView
            assert.deepEqual(res, expected)
        })

        it('should cache raw record when caching view record', async function () {
            // first query should not be cached
            var res = await fooModel.select.by.id([origBam.id])
            // check result
            assert.isUndefined(res._cachedView)
            assert.deepEqual(res, { preAsync: true, bamAsync: { bar: '0.000000000', foo: 'bam' }, postAsync: true })
            // second query without view should be cached
            var foo = await fooModel.select.one.where.id.eq(origBam.id).view(false)
            // check result
            assert.isTrue(foo.raw._cached)
            assert.strictEqual(foo.data.foo, 'bam')
        })

        it('should cache view result when doing select', async function () {
            // expected result
            var expected = {
                preAsync: true,
                bamAsync: { bar: '0.000000000', foo: 'bam' },
                barAsync: { bar: '1.000000000', foo: 'bar' },
                fooAsync: { bar: '2.000000000', foo: 'foo' },
                postAsync: true,
            }
            // first query should not be cached
            var res = await fooModel.select.all
            // check result
            assert.isUndefined(res._cached)
            assert.deepEqual(res, expected)
            // wait to allow async cache to complete
            await Promise.delay(50)
            // second query should be cached
            res = await fooModel.select.all
            // check result
            assert.isTrue(res._cachedView)
            delete  res._cachedView
            assert.deepEqual(res, expected)
        })
    })

    describe('with cache:false view', function () {

        beforeEach(function () {
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
                views: {
                    default: 'fooNoCache',
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should not cache view result', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
        })
    })

    describe('with cache:false view instance', function () {

        beforeEach(function () {
            // get foo model view
            var FooModelView = ImmutableCoreModelView.modelView('foo')
            // create new view instance with cache disabled
            var fooModelView = FooModelView({cache: false})
            // create foo model
            fooModelGlobal = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
                views: {
                    default: fooModelView,
                }
            })
            // get local foo model
            fooModel = fooModelGlobal.session(session)
        })

        it('should not cache view result', async function () {
            // first query should not be cached
            var foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
            // second query should be cached
            foos = await fooModel.select.by.id([origBam.id, origBar.id])
            // check result
            assert.isUndefined(foos[0].raw._cachedView)
            assert.isUndefined(foos[1].raw._cachedView)
            assert.deepEqual(_.map(foos, 'data.foo'), ['bam food', 'bar food'])
        })
    })

})
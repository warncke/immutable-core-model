'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - opensearch', function () {

    var mysql, opensearch, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session, opensearch] = await initTestEnv({opensearch: true})
    })

    beforeEach(async function () {
        await reset()
    })

    after(async function () {
        await mysql.end()
    })

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    it('should create a new model with an opensearch client', function () {
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: opensearch,
            name: 'foo',
            redis: redis,
        })
        // get client
        assert.deepEqual(fooModel.opensearch(), opensearch)
    })

    it('should get/set client on model', function () {
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // set client - should return instance
        assert.deepEqual(fooModel.opensearch(opensearch), fooModel)
        // get client
        assert.deepEqual(fooModel.opensearch(), opensearch)
    })

    it('should get/set global client', function () {
         // set client - should return instance
        assert.deepEqual(ImmutableCoreModel.opensearchGlobal(opensearch), ImmutableCoreModel)
        // get client
        assert.deepEqual(ImmutableCoreModel.opensearchGlobal(), opensearch)
    })

    it('should use global client when opensearch true and setting after model creation', function () {
        // create model that requires opensearch client to be set
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: true,
            name: 'foo',
            redis: redis,
        })
        // set global opensearch client
        ImmutableCoreModel.opensearchGlobal(opensearch)
        // model should have client
        assert.deepEqual(fooModel.opensearch(), opensearch)
    })

    it('should use global client when opensearch true and setting before model creation', function () {
        // set global opensearch client
        ImmutableCoreModel.opensearchGlobal(opensearch)
        // create model that requires opensearch client to be set
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            opensearch: true,
            name: 'foo',
            redis: redis,
        })
        // model should have client
        assert.deepEqual(fooModel.opensearch(), opensearch)
    })

    it('should not use global client when opensearch not true', function () {
        // create model that requires opensearch client to be set
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // set global opensearch client
        ImmutableCoreModel.opensearchGlobal(opensearch)
        // model should not have client
        assert.strictEqual(fooModel.opensearch(), null)
    })

    it('should throw error on invalid opensearch on model creation', function () {
        assert.throws(function () {
            // create model with invalid client
            var fooModel = new ImmutableCoreModel({
                mysql: mysql,
                opensearch: {},
                name: 'foo',
                redis: redis,
            })
        })
    })

    it('should throw error seting invalid opensearch on model', function () {
        assert.throws(function () {
            var fooModel = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // set invalid client
            fooModel.opensearch({})
        })
    })

    it('should not throw error seting invalid opensearch globally', function () {
        assert.doesNotThrow(function () {
            // set invalid client
            ImmutableCoreModel.opensearchGlobal({})
        })
    })

})
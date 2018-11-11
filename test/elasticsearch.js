'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - elasticsearch', function () {

    var mysql, elasticsearch, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session, elasticsearch] = await initTestEnv({elasticsearch: true})
    })

    beforeEach(async function () {
        await reset()
    })

    after(async function () {
        await mysql.close()
    })

    // will be pouplated in before
    var foo1, foo2, foo3, globalFooModel, fooModel

    it('should create a new model with an elasticsearch client', function () {
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            elasticsearch: elasticsearch,
            name: 'foo',
            redis: redis,
        })
        // get client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearch)
    })

    it('should get/set client on model', function () {
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // set client - should return instance
        assert.deepEqual(fooModel.elasticsearch(elasticsearch), fooModel)
        // get client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearch)
    })

    it('should get/set global client', function () {
         // set client - should return instance
        assert.deepEqual(ImmutableCoreModel.elasticsearchGlobal(elasticsearch), ImmutableCoreModel)
        // get client
        assert.deepEqual(ImmutableCoreModel.elasticsearchGlobal(), elasticsearch)
    })

    it('should use global client when elasticsearch true and setting after model creation', function () {
        // create model that requires elasticsearch client to be set
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            elasticsearch: true,
            name: 'foo',
            redis: redis,
        })
        // set global elasticsearch client
        ImmutableCoreModel.elasticsearchGlobal(elasticsearch)
        // model should have client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearch)
    })

    it('should use global client when elasticsearch true and setting before model creation', function () {
        // set global elasticsearch client
        ImmutableCoreModel.elasticsearchGlobal(elasticsearch)
        // create model that requires elasticsearch client to be set
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            elasticsearch: true,
            name: 'foo',
            redis: redis,
        })
        // model should have client
        assert.deepEqual(fooModel.elasticsearch(), elasticsearch)
    })

    it('should not use global client when elasticsearch not true', function () {
        // create model that requires elasticsearch client to be set
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // set global elasticsearch client
        ImmutableCoreModel.elasticsearchGlobal(elasticsearch)
        // model should not have client
        assert.strictEqual(fooModel.elasticsearch(), null)
    })

    it('should throw error on invalid elasticsearch on model creation', function () {
        assert.throws(function () {
            // create model with invalid client
            var fooModel = new ImmutableCoreModel({
                mysql: mysql,
                elasticsearch: {},
                name: 'foo',
                redis: redis,
            })
        })
    })

    it('should throw error seting invalid elasticsearch on model', function () {
        assert.throws(function () {
            var fooModel = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // set invalid client
            fooModel.elasticsearch({})
        })
    })

    it('should not throw error seting invalid elasticsearch globally', function () {
        assert.doesNotThrow(function () {
            // set invalid client
            ImmutableCoreModel.elasticsearchGlobal({})
        })
    })

})
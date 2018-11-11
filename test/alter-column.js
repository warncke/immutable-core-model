'use strict'

/* npm modules */
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - alter column', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(mysql, redis)
    })

    after(async function () {
        await mysql.close()
    })

    it('should add non-unique index with no previous index', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    index: true,
                    type: 'string',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, {
            index: true,
            type: 'string',
        })
    })

    it('should add unique index with no previous index', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.deepEqual(schema.columns.foo, {
            type: 'string',
            unique: true,
        })
    })

    it('should throw error if attempting to change column type', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'number',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        var thrown
        // sync with mysql - should throw error
        try {
            await fooModel.sync()
        }
        catch (err) {
            thrown = err
        }
        // check error
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'column type cannot be changed')
    })

    it('should throw error if attempting to change from non-unique to unique index', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    index: true,
                    type: 'string',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        var thrown
        // sync with mysql - should throw error
        try {
            await fooModel.sync()
        }
        catch (err) {
            thrown = err
        }
        // check error
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'index type cannot be changed')
    })

    it('should throw error if attempting to change from unique to non-unique index', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: {
                    index: true,
                    type: 'string',
                },
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        var thrown
        // sync with mysql - should throw error
        try {
            await fooModel.sync()
        }
        catch (err) {
            thrown = err
        }
        // check error
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'index type cannot be changed')
    })

})
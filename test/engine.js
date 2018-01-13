'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - engine and charset', function () {

    var database, redis, reset, session

    before(async function () {
        [database, redis, reset, session] = await initTestEnv()
    })

    beforeEach(async function () {
        await reset(database, redis)
    })

    after(async function () {
        await database.close()
    })

    it('should use default engine and charset', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'InnoDB')
        assert.strictEqual(schema.charset, 'utf8')
    })

    it('should set engine and charset globally', async function () {
        // set global engine and charset
        ImmutableCoreModel
            .defaultCharset('latin1')
            .defaultEngine('MyISAM')
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'MyISAM')
        assert.strictEqual(schema.charset, 'latin1')
    })

    it('should set engine and charset in model args', async function () {
        // create model
        var fooModel = new ImmutableCoreModel({
            charset: 'latin1',
            database: database,
            engine: 'MyISAM',
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'MyISAM')
        assert.strictEqual(schema.charset, 'latin1')
    })

    it('should set engine and charset from env', async function () {
        // set global engine and charset
        process.env.DEFAULT_CHARSET = 'latin1'
        process.env.DEFAULT_ENGINE = 'MyISAM'
        // create model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.strictEqual(schema.engine, 'MyISAM')
        assert.strictEqual(schema.charset, 'latin1')
    })

})
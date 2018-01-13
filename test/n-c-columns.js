'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - n/c columns', function () {

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

    var fooModel

    beforeEach(async function () {
        // create foo model without n,c columns
        var fooModel = new ImmutableCoreModel({
            columns: {
                c: false,
                id: {
                    unique: false,
                    primary: true,
                },
                n: false,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync db
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
    })

    it('should convert id from primary to unique', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.isUndefined(schema.columns.fooId.primary)
        assert.isTrue(schema.columns.fooId.unique)
        assert.isTrue(schema.columns.n.primary)
    })

    it('should create c column if it does not exist', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.c.type, 'smallint')
        assert.strictEqual(schema.columns.c.unsigned, true)
    })

    it('c column should default to 1 with compression:true', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.c.default, '1')
    })

    it('c column should default to 0 with compression:false', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                n: false,
            },
            compression: false,
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.c.default, '0')
    })

    it('should create n column if it does not exist', async function () {
        // update foo model with n column
        var fooModel = new ImmutableCoreModel({
            columns: {
                c: false,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync db
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // check schema
        assert.strictEqual(schema.columns.n.type, 'int')
        assert.strictEqual(schema.columns.n.primary, true)
    })

})
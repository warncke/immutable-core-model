'use strict'

/* npm modules */
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - add column', function () {

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

    it('should add new columns', async function () {
        // full table schema including all default columns
        var expectedSchema = {
            charset: 'utf8',
            columns: {
                n: {
                    null: false,
                    primary: true,
                    type: 'int',
                    unsigned: true,
                },
                c: {
                    default: '1',
                    null: false,
                    type: 'smallint',
                    unsigned: true,
                },
                d: {
                    default: false,
                    null: false,
                    type: 'boolean',
                },
                fooAccountId: {
                    type: 'id',
                    null: false,
                    index: true
                },
                fooCreateTime: {
                    type: 'time',
                    null: false,
                    index: true
                },
                fooData: {
                    type: 'data',
                    null: false
                },
                fooId: {
                    type: 'id',
                    null: false,
                    unique: true
                },
                fooOriginalId: {
                    type: 'id',
                    null: false,
                    index: true
                },
                fooParentId: {
                    type: 'id',
                    unique: true
                },
                fooSessionId: {
                    type: 'id',
                    null: false,
                    index: true
                },
                bam: {
                    type: 'boolean',
                    index: true
                },
                bar: {
                    type: 'string',
                    index: true
                },
                foo: {
                    type: 'number',
                    index: true
                }
            },
            engine: 'InnoDB',
            indexes: [],
        };
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                bam: 'boolean',
                bar: 'string',
                foo: 'number',
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema, expectedSchema)
    })

    it('should add new string column with default value', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: 'TEST',
            type: 'string',
        };
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should add new number column with default value', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: '95.750000000',
            type: 'number',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should add new boolean column with default value', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            default: false,
            type: 'boolean',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should add new column with non-unique index', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            index: true,
            type: 'string',
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

    it('should add new column with unique index', async function () {
        // expected schema for extra column foo
        var fooSchema = {
            type: 'string',
            unique: true,
        }
        // create initial model
        var fooModel = new ImmutableCoreModel({
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // reset global data
        ImmutableCore.reset()
        ImmutableCoreModel.reset()
        // create updated model
        var fooModel = new ImmutableCoreModel({
            columns: {
                foo: fooSchema,
            },
            database: database,
            name: 'foo',
            redis: redis,
        })
        // sync with database
        await fooModel.sync()
        // get schema
        var schema = await fooModel.schema()
        // test that schema matches spec
        assert.deepEqual(schema.columns.foo, fooSchema)
    })

})
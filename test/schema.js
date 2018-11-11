'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - schema', function () {

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

    it('should create a model with a schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // get schema
        var schema = fooModel.global().validator.getSchema(fooModel.schemaId)
        var schemaData = fooModel.global().validator.getSchema(fooModel.schemaDataId)
        // schema should be a function
        assert.isFunction(schema)
        assert.isFunction(schemaData)
    })

    it('should throw error on invalid schema', function () {
        try {
            // create model with schema
            var fooModel = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                properties: {
                    foo: {
                        type: 'xxx'
                    },
                },
                redis: redis,
            })
        }
        catch (err) {
            var threw = err
        }

        assert.isDefined(threw)
    })

    it('should create model instance that matches schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // validate data
        assert.strictEqual(foo.data.foo, 'foo')
    })

    it('should validate data schema', async function () {
        // create model with schema
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // get schema validator
        var schemaData = fooModel.global().validator.getSchema(fooModel.schemaDataId)
        // schema should be a function
        assert.isFunction(schemaData)
        // schema should validate
        assert.isTrue(schemaData({foo: 'foo'}))
    })

    it('should coerce scalar values', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 0},
            session: session,
        })
        // validate data
        assert.strictEqual(foo.data.foo, '0')
    })

    it('should coerce arrays', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'array'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 0},
            session: session,
        })
        // validate data
        assert.deepEqual(foo.data.foo, [0])
    })

    it('should not remove extra properties', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'array'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bar: 'bar'},
            session: session,
        })
        // validate data
        assert.strictEqual(foo.data.bar, 'bar')
    })

    it('should remove extra properties when additionalProperties:false', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            additionalProperties: false,
            properties: {
                foo: {
                    type: 'array'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bar: 'bar'},
            session: session,
        })
        // validate data
        assert.isUndefined(foo.data.bar)
    })

    it('should update a model instance that matches schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // update
        foo = await foo.update({
            foo: 'bar'
        })
        // validate data
        assert.strictEqual(foo.data.foo, 'bar')
    })

    it('should throw error when creating instance that does not match schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
            required: 'foo'
        })
        try {
            // sync with mysql
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should not throw error when creating instance that does not match schema and validate:false on model', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
            validate: false,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: false},
            session: session,
        })
    })

    it('should not throw error when creating instance that does not match schema and validate:false on create', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: false},
            session: session,
            validate: false,
        })
    })

    it('should throw error when missing required (string) property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string',
                },
            },
            redis: redis,
            required: 'foo',
        })
        try {
            // sync with mysql
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should throw error when missing required (array) property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: ['string'],
                },
            },
            redis: redis,
            required: 'foo',
        })
        try {
            // sync with mysql
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {bar: 'bar'},
                session: session,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should not throw error when missing non-required property', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bar: 'bar'},
            session: session,
        })
    })

    it('should throw error when updating an instance that does not match schema', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                },
            },
            redis: redis,
            required: 'foo',
        })
        try {
            // sync with mysql
            await fooModel.sync()
            // create new foo instance
            var foo = await fooModel.createMeta({
                data: {foo: 'foo'},
                session: session,
            })
            // update
            foo = await foo.update({
                foo: undefined,
            })
        }
        catch (err) {
            var threw = err
        }
        // check that error thrown
        assert.isDefined(threw)
    })

    it('should not throw error when updating instance that does not match schema and validate:false', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string'
                }
            },
            redis: redis,
            required: ['foo'],
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {foo: 'foo'},
            session: session,
        })
        // update
        foo = await foo.updateMeta({
            data: {foo: false},
            validate: false,
        })
    })

    it('should not throw error when missing required property that has default', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            properties: {
                foo: {
                    type: 'string',
                    default: 'foo',
                },
            },
            redis: redis,
            required: 'foo',
        })
        // sync with mysql
        await fooModel.sync()
        // create new foo instance
        var foo = await fooModel.createMeta({
            data: {bar: 'bar'},
            session: session,
        })
    // check that default value set
        assert.strictEqual(foo.data.foo, 'foo')
    })

    it('should require not null default columns', async function () {
        // create initial model
        var fooModel = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            required: 'foo',
        })
        // get global validator
        var validator = fooModel.global().validator
        // validate data - should be false
        assert.isFalse(validator.validate(fooModel.schemaId, {}))
        // there should be 5 missing required coluns
        assert.strictEqual(validator.errors.length, 5)
    })

})
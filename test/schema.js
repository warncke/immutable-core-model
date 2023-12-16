'use strict'

const { assert } = require('chai')
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
        await mysql.end()
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

    it('should handle schema with errorMessage', async function () {
        const businessModel = new ImmutableCoreModel({
            errorMessage: {
                required: {
                    businessName: 'must provide business name',
                }
            },
            mysql: mysql,
            name: 'business',
            properties: {
                businessName: {
                    type: 'string',
                },
                hoursOfOperation: {
                    items: {
                        properties: {
                            fromDay: {
                                enum: [
                                    'Sunday',
                                    'Monday',
                                    'Tuesday',
                                    'Wednesday',
                                    'Thursday',
                                    'Friday',
                                    'Saturday',
                                ],
                                type: 'string',
                            },
                            toDay: {
                                enum: [
                                    'Sunday',
                                    'Monday',
                                    'Tuesday',
                                    'Wednesday',
                                    'Thursday',
                                    'Friday',
                                    'Saturday',
                                ],
                                type: 'string',
                            },
                            fromHourOne: {
                                errorMessage: {
                                    pattern: 'Enter time as HH:MM like 09:30',
                                },
                                pattern: '^\\d{2}:\\d{2}$',
                                type: 'string',
                            },
                            toHourOne: {
                                errorMessage: {
                                    pattern: 'Enter time as HH:MM like 09:30',
                                },
                                pattern: '^\\d{2}:\\d{2}$',
                                type: 'string',
                            },
                            fromHourTwo: {
                                errorMessage: {
                                    pattern: 'Enter time as HH:MM like 09:30',
                                },
                                pattern: '^(\\d{2}:\\d{2})?$',
                                type: 'string',
                            },
                            toHourTwo: {
                                errorMessage: {
                                    pattern: 'Enter time as HH:MM like 09:30',
                                },
                                pattern: '^(\\d{2}:\\d{2})?$',
                                type: 'string',
                            },
                        },
                        required: [
                            'fromDay',
                            'toDay',
                            'fromHourOne',
                            'toHourOne',
                        ],
                        type: 'object',
                    },
                    maxItems: 7,
                    minItems: 0,
                    type: 'array',
                },
            },
            required: [
                'businessName',
            ],
        })
        // create table
        await businessModel.sync()
        // test with valid data
        await businessModel.createMeta({
            data: {
                businessName: 'test',
                hoursOfOperation: [
                    {
                        fromDay: 'Sunday',
                        toDay: 'Thursday',
                        fromHourOne: '11:00',
                        toHourOne: '14:00',
                        fromHourTwo: '16:30',
                        toHourTwo: '21:00',
                    },
                    {
                        fromDay: 'Friday',
                        toDay: 'Saturday',
                        fromHourOne: '11:00',
                        toHourOne: '23:00',
                    },
                ],
            },
            session
        })
        // test with invalid data
        let error
        try {
            await businessModel.createMeta({
                data: {
                    hoursOfOperation: [
                        {
                            fromDay: 'Sunday',
                            toDay: 'Thursday',
                            fromHourOne: 'foo',
                            toHourOne: '14:00',
                            fromHourTwo: '16:30',
                            toHourTwo: '21:00',
                        },
                        {
                            fromDay: 'Friday',
                            toDay: 'Saturday',
                            fromHourOne: '11:00',
                            toHourOne: '23:00',
                        },
                    ],
                },
                session
            })
        } catch (err) {
            error = err
        }
        const businessNameError = error.data.find(e => e.instancePath === '/businessData')
        assert.strictEqual(businessNameError.message, 'must provide business name')
        const hourError = error.data.find(e => e.instancePath === '/businessData/hoursOfOperation/0/fromHourOne')
        assert.strictEqual(hourError.message, 'Enter time as HH:MM like 09:30')
    })

})
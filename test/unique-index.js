'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - unique index', function () {

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

    var fooModel, fooModelGlobal

    beforeEach(async function () {
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
            columns: {
                foo: {
                    type: 'string',
                    unique: true,
                }
            },
            mysql: mysql,
            name: 'foo',
            redis: redis,
        })
        // sync with mysql
        await fooModelGlobal.sync()
        // get local fooModel
        fooModel = fooModelGlobal.session(session)
    })

    it('should not create two objects with the same unique value', async function () {
        // insert first record
        await fooModel.create({foo: 'foo'})
        // inserting second record should throw error
        try {
            await fooModel.create({foo: 'foo'})
        }
        catch (err) {
            var threwError = true
        }
        assert.isTrue(threwError, 'second insert with unique index threw error')
    })

    it('should create revision with the same unique value', async function () {
        // insert first record
        var foo = await fooModel.create({foo: 'foo'})
        // create new revision with same foo value
        foo = await foo.update({bar: 'bar'})
        // verify that foo value still set in data
        assert.strictEqual(foo.data.foo, 'foo')
        // foo should not be set in raw data
        assert.strictEqual(foo.raw.foo, undefined)
    })

    it('should update unique value if data changes', async function () {
        // insert first record
        var foo = await fooModel.create({foo: 'foo'})
        // create new revision with same foo value
        foo = await foo.update({bar: 'bar'})
        // create new revision with new foo value
        foo = await foo.update({foo: 'foo2'})
        // verify that foo value still set in data
        assert.strictEqual(foo.data.foo, 'foo2')
        // foo should be set in raw data when updated
        assert.strictEqual(foo.raw.foo, 'foo2')
    })

})
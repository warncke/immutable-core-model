'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - select by unique', function () {

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

    // models
    var fooModel, fooModelGlobal
    // records
    var origFoo, newFoo

    beforeEach(async function () {
        // create initial model
        fooModelGlobal = new ImmutableCoreModel({
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
        await fooModelGlobal.sync()
        // get local model
        fooModel = fooModelGlobal.session(session)
        // create foo record
        origFoo = await fooModel.create({foo: 'foo', bar: 1})
        // revise foo record
        newFoo = await origFoo.update({bar: 2})
    })

    it('should select record by unique column', async function () {
        // do query by unique colum foo
        var foo = await fooModel.select.by.foo('foo')
        // record should be found
        assert.isDefined(foo)
        // second record should be returned
        assert.strictEqual(foo.id, newFoo.id)
    })

    it('should select record by unique column and id', async function () {
        // do query by unique colum foo
        var foo = await fooModel.query({
            one: true,
            where: {
                foo: 'foo',
                id: origFoo.id,
            }
        })
        // record should be found
        assert.isDefined(foo)
        // second record should be returned
        assert.strictEqual(foo.id, origFoo.id)
    })

    it('should select all revisions by unique column', async function () {
        // do query by unique colum foo
        var foo = await fooModel.query({
            all: true,
            allRevisions: true,
            where: {
                foo: 'foo',
            }
        })
        // record should be found
        assert.isDefined(foo)
        // should be two records
        assert.strictEqual(foo.length, 2)
    })

})
'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - query required', function () {

    var mysql, redis, reset, session

    before(async function () {
        [mysql, redis, reset, session] = await initTestEnv()
    })

    after(async function () {
        await mysql.close()
    })

    // models to create
    var foo, fooModel, fooModelGlobal


    before(async function () {
        await reset(mysql, redis)
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,

        })
        // sync with mysql
        await fooModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
    })

    it('should throw error with required:true and no results', async function () {
        // arguments for test query
        var queryArgs = {
            required: true,
            where: {id: 'foo'},
        }
        // capture thrown error
        var thrown
        // catch error
        try {
            // load foo with related records
            var res = await fooModel.query(queryArgs)
        }
        catch (err) {
            thrown = err
        }
        // check result
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'foo query error: no records found')
    })

    it('should throw error with required:true and no results with select by id', async function () {
        // arguments for test query
        var queryArgs = {
            required: true,
            where: {id: 'foo'},
        }
        // capture thrown error
        var thrown
        // catch error
        try {
            // load foo with related records
            var res = await fooModel.select.required.by.id('foo')
        }
        catch (err) {
            thrown = err
        }
        // check result
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'foo query error: no records found')
    })

    it('should throw error with required:true and no results with select where', async function () {
        // arguments for test query
        var queryArgs = {
            required: true,
            where: {id: 'foo'},
        }
        // capture thrown error
        var thrown
        // catch error
        try {
            // load foo with related records
            var res = await fooModel.select.required.where.id.eq('foo').query()
        }
        catch (err) {
            thrown = err
        }
        // check result
        assert.isDefined(thrown)
        assert.strictEqual(thrown.message, 'foo query error: no records found')
    })

})
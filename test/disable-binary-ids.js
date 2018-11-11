'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - disable binary ids', function () {

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

    describe('with binaryIds disabled globally', function () {

        beforeEach(async function () {
            // disable binary ids
            ImmutableCoreModel.defaultBinaryIds(false)
            // create foo model without n,c columns
            fooModelGlobal = new ImmutableCoreModel({
                columns: {
                    c: false,
                    id: {
                        unique: false,
                        primary: true,
                    },
                    n: false,
                },
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // sync db
            await fooModelGlobal.sync()
            // get local model
            fooModel = fooModelGlobal.session(session)
        })

        it('should should set ids as char hex strings', async function () {
            // create new record
            var foo = await fooModel.create({foo: 1})
            // get raw data by id
            var [ raw ] = await fooModelGlobal.mysql().query('SELECT * FROM foo WHERE fooId = :fooId', {fooId: foo.id});
            // if id is hex it will find result
            assert.strictEqual(raw.length, 1)
        })

    })

    describe('with binaryIds disabled on model', function () {

        beforeEach(async function () {
            // create foo model without n,c columns
            fooModelGlobal = new ImmutableCoreModel({
                binaryIds: false,
                columns: {
                    c: false,
                    id: {
                        unique: false,
                        primary: true,
                    },
                    n: false,
                },
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // sync db
            await fooModelGlobal.sync()
            // get local model
            fooModel = fooModelGlobal.session(session)
        })

        it('should should set ids as char hex strings', async function () {
            // create new record
            var foo = await fooModel.create({foo: 1})
            // get raw data by id
            var [ raw ] = await fooModelGlobal.mysql().query('SELECT * FROM foo WHERE fooId = :fooId', {fooId: foo.id});
            // if id is hex it will find result
            assert.strictEqual(raw.length, 1)
        })

    })

    describe('with binaryIds disabled in env', function () {

        beforeEach(async function () {
            // disable binary ids in env
            process.env.DEFAULT_BINARY_IDS = 'false'
            // create foo model without n,c columns
            fooModelGlobal = new ImmutableCoreModel({
                binaryIds: true,
                columns: {
                    c: false,
                    id: {
                        unique: false,
                        primary: true,
                    },
                    n: false,
                },
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // sync db
            await fooModelGlobal.sync()
            // get local model
            fooModel = fooModelGlobal.session(session)
        })

        afterEach(function () {
            process.env.DEFAULT_BINARY_IDS = undefined
        })

        it('should should set ids as char hex strings', async function () {
            // create new record
            var foo = await fooModel.create({foo: 1})
            // get raw data by id
            var [ raw ] = await fooModelGlobal.mysql().query('SELECT * FROM foo WHERE fooId = :fooId', {fooId: foo.id});
            // if id is hex it will find result
            assert.strictEqual(raw.length, 1)
        })

    })

})
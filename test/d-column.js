'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCore = require('immutable-core')

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - d column', function () {

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

    var fooModel, fooDeleteModel

    var bam, bar, baz, foo

    describe('with delete table', function () {

        beforeEach(async function () {
            // create foo model without d column
            var fooModel = new ImmutableCoreModel({
                columns: {
                    d: false,
                },
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // create foo delete model to simulate old action table
            var fooDeleteModel = new ImmutableCoreModel({
                columns: {
                    c: false,
                    d: false,
                    n: false,
                    accountId: false,
                    data: false,
                    originalId: false,
                    parentId: false,
                    fooId: 'id',
                },
                mysql: mysql,
                name: 'fooDelete',
                redis: redis,
            })
            // sync db
            await fooModel.sync()
            await fooDeleteModel.sync()
            // get local models
            fooModel = fooModel.session(session)
            fooDeleteModel = fooDeleteModel.session(session)
            // create three foo records
            bam = await fooModel.create({foo: 'bam'})
            bar = await fooModel.create({foo: 'bar'})
            baz = await fooModel.create({foo: 'baz'})
            foo = await fooModel.create({foo: 'foo'})
            // create delete record for two of them
            await fooDeleteModel.create({fooId: bam.id})
            await fooDeleteModel.create({fooId: bar.id})
            await fooDeleteModel.create({fooId: baz.id})
            // create new revision of baz
            baz = await baz.update({foo: 'baz2'})
            // reset global data
            ImmutableCore.reset()
            ImmutableCoreModel.reset()
            ImmutableAccessControl.reset()
        })

        it('should delete records when adding d column', async function () {
            // update foo model with n column
            var fooModel = new ImmutableCoreModel({
                mysql: mysql,
                name: 'foo',
                redis: redis,
            })
            // sync db
            await fooModel.sync()
            // get schema
            var schema = await fooModel.schema()
            // check schema
            assert.isDefined(schema.columns.d)
            // select all records which should exclude deleted
            var res = await fooModel.session(session).select.all.order.createTime
            // should only be one response
            assert.strictEqual(res.length, 2)
            assert.strictEqual(res[0].id, foo.id)
            assert.strictEqual(res[1].id, baz.id)
        })

    })

})
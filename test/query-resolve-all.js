'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - query resolve all', function () {

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

    // models to create
    var fooModelGlobal, bamModelGlobal, barModelGlobal
    // local models with session
    var fooModel, bamModel, barModel
    // instances
    var foo, bam1, bam2, bar1, bar2, origBam1, origBam2, origBar1, origBar2

    beforeEach(async function () {
        // create foo model
        fooModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'foo',
            redis: redis,
            relations: {
                bar: {via: 'bam'},
            },
        })
        // create bam model
        bamModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'bam',
            redis: redis,
        })
        // create bar model
        barModelGlobal = new ImmutableCoreModel({
            mysql: mysql,
            name: 'bar',
            redis: redis,
        })
        // sync with mysql
        await fooModelGlobal.sync()
        await bamModelGlobal.sync()
        await barModelGlobal.sync()
        // get local instances
        fooModel = fooModelGlobal.session(session)
        bamModel = bamModelGlobal.session(session)
        barModel = barModelGlobal.session(session)
        // create instances that will be linked to foo
        origBam1 = await bamModel.create({bam: 1})
        origBam2 = await bamModel.create({bam: 2})
        origBar1 = await barModel.create({bar: 1})
        origBar2 = await barModel.create({bar: 2})
        // create updates to each instance
        bam1 = await origBam1.update({bam: 10})
        bam2 = await origBam2.update({bam: 20})
        bar1 = await origBar1.update({bar: 10})
        bar2 = await origBar2.update({bar: 20})
    })

    describe('with array of ids identified by model name', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bam: [bam1.id, bam2.id],
                bars: [bar2.id, origBar1.id],
            })

        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })
            // check results
            assert.deepEqual(_.map(res.data.bam, 'id'), [bam1.id, bam2.id])
            assert.deepEqual(_.map(res.data.bars, 'id'), [bar2.id, origBar1.id])
        })

    })

    describe('with id object identified by model name', function () {

        beforeEach(async function () {
            // build data
            var bam = {}
            bam[bam1.id] = true
            bam[bam2.id] = true
            var bars = {}
            bars[bar2.id] = true
            bars[origBar1.id] = true
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bam: bam,
                bars: bars,
            })

        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })
            // check results
            assert.isDefined(res.data.bam[bam1.id])
            assert.isDefined(res.data.bam[bam2.id])
            assert.isDefined(res.data.bars[bar2.id])
            assert.isDefined(res.data.bars[origBar1.id])
        })

    })

    describe('with string ids identified by model name', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bam: bam2.id,
                bars: origBar1.id,
            })

        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })
            // check results
            assert.strictEqual(res.data.bam.id, bam2.id)
            assert.strictEqual(res.data.bars.id, origBar1.id)
        })

    })

    describe('with array of ids identified by id column', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bamId: [bam1.id, bam2.id],
                barOriginalIds: [bar2.originalId, origBar1.id],
            })

        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })
            // check results
            assert.deepEqual(res.data.bamId, [bam1.id, bam2.id])
            assert.deepEqual(_.map(res.data.bam, 'id'), [bam1.id, bam2.id])
            assert.deepEqual(res.data.barOriginalIds, [bar2.originalId, origBar1.id])
            assert.deepEqual(_.map(res.data.bars, 'id'), [bar2.id, bar1.id])
        })

    })

    describe('with id object identified by id column', function () {

        var bam, bar

        beforeEach(async function () {
            // build data
            bam = {}
            bam[bam1.id] = true
            bam[bam2.id] = true
            bar = {}
            bar[bar1.originalId] = true
            bar[bar2.originalId] = true
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bamIds: bam,
                barOriginalId: bar,
            })

        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })

            // check results
            assert.deepEqual(res.data.bamIds, bam)
            assert.isDefined(res.data.bams[bam1.id])
            assert.isDefined(res.data.bams[bam2.id])

            assert.deepEqual(res.data.barOriginalId, bar)
            assert.isDefined(res.data.bar[bar1.originalId])
            assert.isDefined(res.data.bar[bar2.originalId])
        })

    })

    describe('with array of objects that contain id column', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bams: [
                    {bamId: origBam1.id},
                    {bamId: origBam2.id},
                ],
                bars: [
                    {barOriginalId: bar1.originalId},
                    {barOriginalId: bar2.originalId},
                ],
            })
        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })
            // check results
            assert.isDefined(res.data.bams[0].data)
            assert.strictEqual(res.data.bams[0].data.bam, 1);
            assert.isDefined(res.data.bams[1].data)
            assert.strictEqual(res.data.bams[1].data.bam, 2);

            assert.isDefined(res.data.bars[0].data)
            assert.strictEqual(res.data.bars[0].data.bar, 10);
            assert.isDefined(res.data.bars[1].data)
            assert.strictEqual(res.data.bars[1].data.bar, 20);
        })

    })

    describe('with string ids identified by model name', function () {

        beforeEach(async function () {
            // create foo record pointing to bam, bar records
            foo = await fooModel.create({
                bamId: bam2.id,
                barOriginalId: bar1.originalId,
            })

        })

        it('should resolve all records with resolve:true', async function () {
            var res = await fooModel.query({
                limit: 1,
                resolve: true,
                where: {id: foo.id}
            })
            // check results
            assert.strictEqual(res.data.bamId, bam2.id)
            assert.strictEqual(res.data.bam.id, bam2.id)
            assert.strictEqual(res.data.barOriginalId, bar1.originalId)
            assert.strictEqual(res.data.bar.originalId, bar1.originalId)
        })

    })

})
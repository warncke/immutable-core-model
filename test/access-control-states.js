'use strict'

const ImmutableAccessControl = require('immutable-access-control')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const ImmutableCoreModel = require('../lib/immutable-core-model')
const Promise = require('bluebird')
const _ = require('lodash')
const chai = require('chai')
const immutable = require('immutable-core')

const assert = chai.assert

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

// use the same params for all connections
const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

describe.skip('immutable-core-model - access control states', function () {

    // create database connection to use for testing
    var database = new ImmutableDatabaseMariaSQL(connectionParams)

    // fake sessions to use for testing
    var session1 = {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated', 'foo'],
        sessionId: '22222222222222222222222222222222',
    }
    var session2 = {
        accountId: '33333333333333333333333333333333',
        roles: ['all', 'authenticated', 'bar'],
        sessionId: '44444444444444444444444444444444',
    }
    var session3 = {
        accountId: '55555555555555555555555555555555',
        roles: ['all', 'authenticated'],
        sessionId: '66666666666666666666666666666666',
    }

    // model instance
    var fooModel
    // record instances
    var bam, bar, baz

    beforeEach(async function () {
        // reset global data
        immutable.reset()
        ImmutableCoreModel.reset()
        ImmutableAccessControl.reset()
        // drop any test tables if they exist
        await database.query('DROP TABLE IF EXISTS foo')
        await database.query('DROP TABLE IF EXISTS fooDelete')
        await database.query('DROP TABLE IF EXISTS fooUnDelete')
        await database.query('DROP TABLE IF EXISTS fooPublish')
        await database.query('DROP TABLE IF EXISTS fooUnPublish')
        await database.query('DROP TABLE IF EXISTS fooFlag')
        // create model
        fooModel = new ImmutableCoreModel({
            accessControlRules: [
                '0',
                'create:1',
                'read:own:1',
                'delete:own:1',
                'publish:own:1',
                'flag:own:1',
                'list:published:any:1',
                'read:published:any:1',
                ['foo', 'read:deleted:own:1'],
                ['bar', 'read:deleted:any:1'],
                ['foo', 'unPublish:flaged:any:1']
            ],
            actions: {
                delete: true,
                flag: false,
                publish: true,
            },
            database: database,
            name: 'foo',
        })
        // sync model
        await fooModel.sync()
        // create one record with each session
        bam = await fooModel.createMeta({
            data: {foo: 'bam'},
            session: session1,
        })
        bar = await fooModel.createMeta({
            data: {foo: 'bar'},
            session: session2,
        })
        baz = await fooModel.createMeta({
            data: {foo: 'baz'},
            session: session3,
        })
    })

    it('should deny access to deleted records', async function () {
        // delete record
        try {
            await baz.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id, isDeleted: true},
                session: session3,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should deny access to mixed records', async function () {
        // delete record
        try {
            await baz.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id, isDeleted: null},
                session: session3,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow access to own deleted records', async function () {
        try {
            // delete record
            await bam.delete()
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: bam.id, isDeleted: true},
                session: session1,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // test error
        assert.isObject(res)
        assert.strictEqual(res.id, bam.id)
    })

    it('should allow access to any deleted records', async function () {
        try {
            // delete record
            await bam.delete()
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: bam.id, isDeleted: true},
                session: session2,
            })
        }
        catch (err) {
            assert.ifError(err)
        }
        // test error
        assert.isObject(res)
        assert.strictEqual(res.id, bam.id)
    })

    it('should allow access to any published record', async function () {
        var error
        try {
            // should deny access to list
            await fooModel.query({
                session: session3,
            })
        }
        catch (err) {
            error = err
        }
        // should have thrown error
        assert.isDefined(error)
        // should allow access to list published
        try {
            // publish record
            await bam.publish()
            // should allow list published
            var res = await fooModel.query({
                where: {isPublished: true},
                session: session3,
            })
            // fetch record
            var [record] = await res.fetch(1)
        }
        catch (err) {
            assert.ifError(err)
        }
        // test error
        assert.isObject(res)
        assert.deepEqual(res.ids, [bam.id])
        assert.strictEqual(record.id, bam.id)
    })

    it('should deny access to published and deleted record', async function () {
        try {
            // publish and delete record
            await baz.publish()
            await baz.delete()
        }
        catch (err) {
            assert.ifError(err)
        }
        // capture error
        var error
        try {
            // query all foo records
            var res = await fooModel.query({
                limit: 1,
                where: {id: baz.id, isDeleted: true, isPublished: true},
                session: session3,
            })
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should deny action when not in allowed state', async function () {
        // publish record
        try {
            await bam.publish()
        }
        catch (err) {
            assert.ifError(err)
        }
        // capture error
        var error
        try {
            // unpublish baz - should fail
            await bam.unPublish()
        }
        catch (err) {
            error = err
        }
        // test error
        assert.isDefined(error)
        assert.strictEqual(error.code, 403)
    })

    it('should allow action when in allowed state', async function () {
        // publish and flag record
        try {
            bam = await bam.publish()
            bam = await bam.flag()
        }
        catch (err) {
            assert.ifError(err)
        }
        // should allow unpublish on flagged record
        try {
            // publish record
            bam = await bam.unPublish()
        }
        catch (err) {
            assert.ifError(err)
        }
        // should be unpublished
        assert.isFalse(bam.isPublished)
        assert.isTrue(bam.wasPublished)
    })
})
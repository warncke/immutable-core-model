'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - session model', function () {

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

    // will be pouplated in before
    var foo1, globalSessionModel, sessionModel

    beforeEach(async function () {
        // create initial model
        globalSessionModel = new ImmutableCoreModel({
            columns: {
                accountId: false,
                d: false,
                data: false,
                originalId: false,
                parentId: false,
                sessionSessionId: false,
            },
            database: database,
            name: 'session',
            redis: redis,
        })
        // create local model with session
        sessionModel = globalSessionModel.session(session)
        // sync with database
        await globalSessionModel.sync()
        // insert first record
        foo1 = await globalSessionModel.createMeta({
            id: '01000000000000000000000000000000',
            session: session,
        })
    })

    it('should select session by id', async function () {
        var session = await sessionModel.select.by.id(foo1.id)
        // check data
        assert.isDefined(session)
        assert.strictEqual(session.id, foo1.id)
    })

})
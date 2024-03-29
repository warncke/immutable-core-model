'use strict'

/* application modules */
const ImmutableCoreModel = require('../lib/immutable-core-model')
const initTestEnv = require('./helpers/init-test-env')

describe('immutable-core-model - session model', function () {

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
            mysql: mysql,
            name: 'session',
            redis: redis,
        })
        // create local model with session
        sessionModel = globalSessionModel.session(session)
        // sync with mysql
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
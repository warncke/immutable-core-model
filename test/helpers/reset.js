'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCore = require('immutable-core')
const ImmutableCoreModelView = require('immutable-core-model-view')
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')
const _ = require('lodash')
const nullFunction = require('null-function')

/* application modules */
const ImmutableCoreModel = require('../../lib/immutable-core-model')

/* exports */
module.exports = reset

// capture initial state of env
const env = _.clone(process.env)
Object.freeze(env)

/**
 * @function reset
 *
 * reset database, reset, and internal state
 *
 * @param {object} database
 * @param {object} redis
 *
 */
async function reset (database, redis, elasticsearch) {
    ImmutableAccessControl.reset()
    ImmutableCore.reset()
    ImmutableCoreModel.reset()
    ImmutableCoreModelView.reset()

    process.env = _.clone(env)

    if (database) {
        await database.query('DROP DATABASE test')
        await database.query('CREATE DATABASE test')
        await database.query('USE test')
    }

    if (redis) {
        await redis.flushdb()
    }

    if (elasticsearch) {
        await elasticsearch.indices.delete({
            index: 'foo'
        }).catch(nullFunction)
        await elasticsearch.indices.delete({
            index: 'not-foo'
        }).catch(nullFunction)
    }
}
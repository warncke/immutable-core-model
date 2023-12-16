'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const ImmutableCore = require('immutable-core')
const ImmutableCoreModelView = require('immutable-core-model-view')
const _ = require('lodash')
const nullFunction = require('null-function')

/* application modules */
const ImmutableCoreModel = require('../../lib/immutable-core-model')

/* exports */
module.exports = reset

// capture initial state of env
const env = _.clone(process.env)
Object.freeze(env)

const dbName = process.env.DB_NAME || 'test'

/**
 * @function reset
 *
 * reset mysql, reset, and internal state
 *
 * @param {object} mysql
 * @param {object} redis
 *
 */
async function reset (mysql, redis, opensearch) {
    ImmutableAccessControl.reset()
    ImmutableCore.reset()
    ImmutableCoreModel.reset()
    ImmutableCoreModelView.reset()

    process.env = _.clone(env)

    if (mysql) {
        await mysql.query(`DROP DATABASE IF EXISTS ${dbName}`)
        await mysql.query(`CREATE DATABASE ${dbName}`)
        await mysql.query(`USE ${dbName}`)
    }

    if (redis) {
        await redis.flushDb()
    }

    if (opensearch) {
        await opensearch.indices.delete({
            index: 'foo'
        }).catch(nullFunction)
        await opensearch.indices.delete({
            index: 'not-foo'
        }).catch(nullFunction)
    }
}
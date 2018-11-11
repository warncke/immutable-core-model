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

/**
 * @function reset
 *
 * reset mysql, reset, and internal state
 *
 * @param {object} mysql
 * @param {object} redis
 *
 */
async function reset (mysql, redis, elasticsearch) {
    ImmutableAccessControl.reset()
    ImmutableCore.reset()
    ImmutableCoreModel.reset()
    ImmutableCoreModelView.reset()

    process.env = _.clone(env)

    if (mysql) {
        await mysql.query('DROP DATABASE test')
        await mysql.query('CREATE DATABASE test')
        await mysql.query('USE test')
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
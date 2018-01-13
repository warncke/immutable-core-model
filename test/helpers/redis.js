'use strict'

/* npm modules */
const Promise = require('bluebird')
const Redis = require('redis')

/* exports */
module.exports = redis

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'

const testCache = process.env.TEST_CACHE === '1' ? true : false

// promisify redis client
Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

/**
 * @function redis
 *
 * return new redis client if cache testing enabled
 */
function redis (force) {
    if (!testCache && !force) {
        return
    }
    return Redis.createClient({
        host: redisHost,
        port: redisPort,
    })
}
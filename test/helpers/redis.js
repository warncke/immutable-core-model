'use strict'

/* npm modules */
const Redis = require('redis')

/* exports */
module.exports = redis

const redisHost = process.env.REDIS_HOST || '127.0.0.1'
const redisPort = process.env.REDIS_PORT || '6379'

const testCache = process.env.TEST_CACHE === '1' ? true : false

/**
 * @function redis
 *
 * return new redis client if cache testing enabled
 */
async function redis (force) {
    if (!testCache && !force) {
        return
    }
    const client = await Redis.createClient({
        url: `redis://${redisHost}:${redisPort}`
    }).on('error', err => {
        console.error('Redis Client Error', err)
        process.exit()
    }).connect()
    return client
}
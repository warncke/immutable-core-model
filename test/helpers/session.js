'use strict'

/* npm modules */
const _ = require('lodash')

/* exports */
module.exports = session

/**
 * @function session
 *
 * return new session mock for testing
 */
function session () {
    return {
        accountId: '11111111111111111111111111111111',
        roles: ['all', 'authenticated', 'foo'],
        sessionId: '22222222222222222222222222222222',
    }
}
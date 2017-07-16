'use strict'

/* npm modules */
const defined = require('if-defined')

/* exports */
module.exports = initActions

/**
 * @function initActions
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initActions (args) {
    // throw error on actions
    if (defined(args.actions)) {
        throw new Error('actions are deprecated')
    }
}
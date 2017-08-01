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
    this.assert(!defined(args.actions), 'actions are deprecated')
}
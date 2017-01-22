'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

/* exports */
module.exports = initIndexes

/**
 * @function initIndexes
 *
 * called by new ImmutableCoreModel to initialize multi-column index spec
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initIndexes (args) {
    // if multi-column indexes are set then validate
    this.indexes = args.indexes
        ? requireValidIndexes(args.indexes)
        : []
}

/**
 * @function requireValidIndexes
 *
 * validate indexes argument
 *
 * @param {object} database
 *
 * @returns {object}
 *
 * @throws {Error}
 */

function requireValidIndexes (indexes) {
    // throw error on invalid indexes option
    assert.ok(Array.isArray(indexes), 'indexes must be array')
    // validate each index spec
    _.each(indexes, index => {
        // require columns to be array
        assert.ok(Array.isArray(index.columns), 'index columns must be array')
        // require multiple columns
        assert.ok(index.columns.length > 1, 'index must have at least 2 columns')
    })
    // return validated indexes
    return indexes
}
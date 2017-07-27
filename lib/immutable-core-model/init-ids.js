'use strict'

/* npm modules */
const stableId = require('stable-id')

/* exports */
module.exports = initIds

/**
 * @function initIds
 *
 * create moduleId and schemaId
 */
function initIds () {
    // columns id is first 8 chars of id of column definitions
    this.columnsId = stableId(this.columns)
}
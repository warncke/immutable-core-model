'use strict'

/* npm modules */
var Ajv = require('ajv');

/* exports */
module.exports = initGlobal

/**
 * @function initGlobal
 *
 * initialize global data
 */
function initGlobal (args) {
    // do nothing if global data already defined
    if (global.__immutable_core_model__) {
        return
    }
    // create new global object
    var GLOBAL = global.__immutable_core_model__ = {}
    // create validator as global object so that schemas will be shared
    // between all model classes
    GLOBAL.validator = new Ajv({
        coerceTypes: 'array',
        removeAdditional: true,
        useDefaults: true,
        v5: true,
    })
}
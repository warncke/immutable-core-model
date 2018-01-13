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
    var GLOBAL = global.__immutable_core_model__ = {
        // number of concurrent related queries to allow per query
        concurrency: 5,
        // default to use binary columns for ids
        defaultBinaryIds: true,
        // default character set
        defaultCharset: 'utf8',
        // default compression setting
        defaultCompression: true,
        // default elastic search client
        defaultElasticsearch: undefined,
        // default database engine
        defaultEngine: 'InnoDB',
        // default insert delayed option for myisam tables
        defaultInsertDelayed: false,
        // map of models indexed by name
        models: {},
    }
    // create validator as global object so that schemas will be shared
    // between all model classes
    GLOBAL.validator = new Ajv({
        allErrors: true,
        coerceTypes: 'array',
        removeAdditional: true,
        useDefaults: true,
        v5: true,
    })
}
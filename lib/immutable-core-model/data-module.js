'use strict'

/* npm modules */
const jsonStableStringify = require('json-stable-stringify')
const snappy = require('snappy')

/* exports */
module.exports = {
    decodeData: decodeData,
    encodeData: encodeData,
}

/**
 * @function decodeData
 *
 * decode data stored in database and return object
 *
 * @param {string|Buffer} data
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function decodeData (data) {
    // decompress if compresion in use
    if (this.compression) {
        data = snappy.uncompressSync(Buffer.from(data, 'base64'))
    }
    // return JSON parsed data
    return JSON.parse(data)
}

/**
 * @function encodeData
 *
 * encode object to Buffer for storage in database
 *
 * @param {object} data
 *
 * @returns {string|Buffer}
 *
 * @throws {Error}
 */
function encodeData (data) {
    // json encode data
    data = jsonStableStringify(data)
    // compress if compression in use
    if (this.compression) {
        data = snappy.compressSync(data).toString('base64')
    }
    // return encoded data
    return data
}
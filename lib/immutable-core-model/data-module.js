'use strict'

/* npm modules */
const Promise = require('bluebird')
const defined = require('if-defined')
const jsonStableStringify = require('json-stable-stringify')
const snappy = require('snappy')

/* exports */
module.exports = {
    decodeData: decodeData,
    encodeData: encodeData,
}

// promise versions of snappy methods
const snappyCompress = Promise.promisify(snappy.compress)
const snappyUncompress = Promise.promisify(snappy.uncompress)

/**
 * @function decodeData
 *
 * decode data stored in database and return object
 *
 * @param {object} record
 *
 * @returns {Promise}
 */
async function decodeData (record) {
    // get data column to decode data
    var dataColumn = this.columnName('data')
    // skip if no data column
    if (!defined(dataColumn) || !defined(record[dataColumn])) {
        return
    }
    // decompress if compresion in use
    if (this.compression) {
        // decompress data
        record[dataColumn] = await snappyUncompress(Buffer.from(record[dataColumn], 'base64'), {asBuffer: false})
    }
    // decode data
    record[dataColumn] = JSON.parse(record[dataColumn])
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
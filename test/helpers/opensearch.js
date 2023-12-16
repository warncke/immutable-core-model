'use strict'

/* npm modules */
const { Client } = require('@opensearch-project/opensearch')

/* exports */
module.exports = opensearch

const osHost = process.env.OS_HOST || 'localhost:9200'

/** 
 * @function opensearch
 *
 * return new opensearch client
 */
function opensearch () {
    return new Client({
        node: `https://admin:admin@${osHost}`,
        ssl: {
            rejectUnauthorized: false,
        }
    })    
}
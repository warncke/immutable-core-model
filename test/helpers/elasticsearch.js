'use strict'

/* npm modules */
const Elasticsearch = require('elasticsearch')

/* exports */
module.exports = elasticsearch

const esHost = process.env.ES_HOST || 'localhost:9200'

/** 
 * @function elasticsearch
 *
 * return new elasticsearch client
 */
function elasticsearch () {
    return new Elasticsearch.Client({
        host: esHost,
    })    
}
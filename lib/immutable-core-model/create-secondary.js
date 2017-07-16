'use strict'

/* native modules */
const assert = require('assert')
const nullFunction = require('null-function')

/* npm modules */
const _ = require('lodash')

/* exports */
module.exports = createSecondary

/**
 * @function createSecondary
 *
 * create record in secondary storage (elasticsearch, redis)
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function createSecondary (args) {
    // create elasticsearch
    if (this.elasticsearchClient) {
        createElasticsearch(args, this)
    }
}

/* private functions */

/**
 * @function createElasticsearch
 *
 * create record in elasticsearch
 *
 * @param {object} args
 * @param {object} model
 *
 * @returns {Promise}
 */
function createElasticsearch (args, model) {
    // get client - throw error if not set
    var elasticsearchClient = model.elasticsearch()
    // document to store in elastic search
    var body
    // use raw data to build body
    if (args.raw) {
        body = elasticSearchBodyFromRaw(model, args.raw)
    }
    // use record to build body
    else if (args.record) {
        body = elasticSearchBodyFromRecord(model, args.record)
    }
    else {
        // ignore errors
        return
    }
    // get id from originalId or id
    var id = body.originalId || body.id
    // if instance does not have id cannot store
    if (!id) {
        // ignore errors
        return
    }
    // get record type
    var type = model.esType
        ? _.get(body.data, model.esType) || model.name
        : model.name
    // if record is deleted then delete from elasticsearch
    if (body.isDeleted) {
        return elasticsearchClient.delete({
            id: id,
            index: model.esIndex,
            type: type,
        })
        // ignore error
        .catch(console.error)
    }
    // otherwise create/update record with elasticsearch
    else {
        return elasticsearchClient.index({
            body: body,
            id: id,
            index: model.esIndex,
            type: type,
        })
        // ignore error
        .catch(console.error)
    }
}

/**
 * @function elasticSearchBodyFromRaw
 *
 * use raw data to build body - used for record creation
 *
 * @param {ImmutableCoreModel} model
 * @param {object} raw
 *
 * @returns {object}
 */
function elasticSearchBodyFromRaw (model, raw) {
    // document to store in elastic search
    var body = {}
    // lookup data in raw and store by default column name
    _.each(model.defaultColumns, (defaultName, name) => {
        // skip c column because elasticsearch is never compressed
        if (name === 'c') {
            return
        }
        body[defaultName] = raw[name]
    })

    return body
}

/**
 * @function elasticSearchBodyFromRaw
 *
 * use raw data to build body - used for record action
 *
 * @param {ImmutableCoreModel} model
 * @param {object} raw
 *
 * @returns {object}
 */
function elasticSearchBodyFromRecord (model, record) {
    // document to store in elastic search
    var body = {}
    // store data by default column name
    _.each(model.defaultColumns, defaultName => {
        body[defaultName] = record[defaultName]
    })
    // store action properties
    _.each(model.actions, (action, name) => {
        // set isAction property
        if (action.isProperty) {
            body[action.isProperty] = record[action.isProperty]
        }
        // set wasAction property
        if (action.wasProperty) {
            body[action.wasProperty] = record[action.wasProperty]
        }
    })

    return body
}
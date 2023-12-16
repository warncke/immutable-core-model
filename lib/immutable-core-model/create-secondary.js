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
 * create record in secondary storage (opensearch, redis)
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function createSecondary (args) {
    // create opensearch
    if (this.opensearchClient) {
        createOpensearch(args, this)
    }
}

/* private functions */

/**
 * @function createOpensearch
 *
 * create record in opensearch
 *
 * @param {object} args
 * @param {object} model
 *
 * @returns {Promise}
 */
function createOpensearch (args, model) {
    // get client - throw error if not set
    var opensearchClient = model.opensearch()
    // document to store in elastic search
    var body
    // use raw data to build body
    if (args.raw) {
        body = opensearchBodyFromRaw(model, args.raw)
    }
    // use record to build body
    else if (args.record) {
        body = opensearchBodyFromRecord(model, args.record)
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
    // if record is deleted then delete from opensearch
    if (body.isDeleted) {
        return opensearchClient.delete({
            id: id,
            index: model.osIndex,
        })
        // ignore error
        .catch(console.error)
    }
    // otherwise create/update record with opensearch
    else {
        return opensearchClient.index({
            body: body,
            id: id,
            index: model.osIndex,
        })
        .then(ret => {
            return ret
        })
        // ignore error
        .catch(console.error)
    }
}

/**
 * @function opensearchBodyFromRaw
 *
 * use raw data to build body - used for record creation
 *
 * @param {ImmutableCoreModel} model
 * @param {object} raw
 *
 * @returns {object}
 */
function opensearchBodyFromRaw (model, raw) {
    // document to store in elastic search
    var body = {}
    // lookup data in raw and store by default column name
    _.each(model.defaultColumns, (defaultName, name) => {
        // skip c column because opensearch is never compressed
        if (name === 'c') {
            return
        }
        body[defaultName] = raw[name]
    })

    return body
}

/**
 * @function opensearchBodyFromRaw
 *
 * use raw data to build body - used for record action
 *
 * @param {ImmutableCoreModel} model
 * @param {object} raw
 *
 * @returns {object}
 */
function opensearchBodyFromRecord (model, record) {
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
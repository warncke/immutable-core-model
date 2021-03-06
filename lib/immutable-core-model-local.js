'use strict'

/* npm modules */
var _ = require('lodash')

/* app modules */
var ImmutableCoreModelSelect = require('./immutable-core-model-select')

/* exports */
module.exports = ImmutableCoreModelLocal

/**
 * @function ImmutableCoreModelLocal
 *
 * @param {object} args
 *
 * @returns {ImmutableCoreModelLocal}
 */
function ImmutableCoreModelLocal (args) {
    this.model = args.model
    this.session = args.session
    // add getter for select that will return a new select instance
    // whenever it is called
    Object.defineProperty(this, 'select', {
        get: () => {
            return new ImmutableCoreModelSelect({
                model: this.model,
                session: this.session,
            })
        }
    })
}

/* public functions */
ImmutableCoreModelLocal.prototype = {
    create: create,
    createMeta: createMeta,
    persist: persist,
    query: query,
    search: search,
    // class properties
    class: 'ImmutableCoreModelLocal',
    ImmutableCoreModelLocal: true,
}

/**
 * @function create
 *
 * proxy call to createMeta using args as data and adding session
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function create (args) {
    // return original method call
    return this.model.createMeta({
        data: args,
        session: this.session,
    })
}

/**
 * @function createMeta
 *
 * proxy call to createMeta adding session if needed
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function createMeta (args) {
    // add session if not set
    if (!args.session) {
        args.session = this.session
    }
    // return original method call
    return this.model.createMeta(args)
}

/**
 * @function persist
 *
 * proxy call to createMeta using args as data, adding session and setting
 * duplicate: true and response: false flags
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function persist (args) {
    // return original method call
    return this.model.createMeta({
        data: args,
        duplicate: true,
        responseIdOnly: true,
        session: this.session,
    })
}

/**
 * @function query
 *
 * proxy call to query, adding session if needed
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function query (args) {
    // add session if not set
    if (!args.session) {
        args.session = this.session
    }
    // return original method call
    return this.model.query(args)
}

/**
 * @function search
 *
 * proxy call to search, adding session if needed
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function search (args) {
    // add session if not set
    if (!args.session) {
        args.session = this.session
    }
    // return original method call
    return this.model.search(args)
}
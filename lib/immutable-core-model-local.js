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
    query: query,
}

/**
 * @function create
 *
 * proxy call to create using args as data and adding session
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
async function create (args) {
    // return original method call
    return this.model.createMeta({
        data: args,
        session: this.session,
    })
}

/**
 * @function createMeta
 *
 * proxy call to create, adding session if needed
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
async function createMeta (args) {
    // add session if not set
    if (!args.session) {
        args.session = this.session
    }
    // return original method call
    return this.model.createMeta(args)
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
async function query (args) {
    // add session if not set
    if (!args.session) {
        args.session = this.session
    }
    // return original method call
    return this.model.query(args)
}
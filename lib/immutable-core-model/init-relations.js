'use strict'

/* native modules */
const assert = require('assert')

/* application modules */
const _ = require('lodash')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* exports */
module.exports = initRelations

/**
 * @function initRelations
 *
 * add relations
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initRelations (args) {
    // create map of relations
    this.relations = {}
    // get relations from args
    var relations = requireValidOptionalObject(args.relations)
    // validate and add relations
    _.each(relations, (relation, relatedModelName) => {
        this.relations[relatedModelName] = relation
    })
}
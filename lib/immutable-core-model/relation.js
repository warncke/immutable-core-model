'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const immutable = require('immutable-core')

/* exports */
module.exports = relation

/**
 * @function relation
 *
 * resolve related model name to relation spec including model
 *
 * @param {string} relatedModelName
 *
 * @returns {object}
 *
 * @throws {Error}
 */
function relation (relatedModelName) {
    // if related model is not linked then lookup through immutable module
    if (!this.relations[relatedModelName] || !this.relations[relatedModelName].model) {
        // module name has Model appended
        var relatedModuleName = relatedModelName + 'Model'
        // check that module exists
        assert.ok(immutable.hasModule(relatedModuleName), 'module not found for relation '+relatedModelName)
        // get module
        var module = immutable.module(relatedModuleName)
        // get module meta data to get model
        var meta = module.meta()
        // module must be ImmutableCoreModel
        assert.ok(meta.class === 'ImmutableCoreModel', 'invalid model for relation '+relatedModelName)
        // get model
        var relatedModel = meta.instance
        // if entry does not exist in relations create one
        if (!this.relations[relatedModelName]) {
            // require related model to have a relation to this model
            assert.ok(relatedModel.relations[this.name], 'no relation for '+relatedModelName)
            // build local relation from other model
            var relation = this.relations[relatedModelName] = _.cloneDeep(relatedModel.relations[this.name])
        }
        else {
            var relation = this.relations[relatedModelName]
        }
        // set model for relation
        relation.model = relatedModel
        // if relation has via and via model is not loaded then load it
        if (relation.via && !relation.viaModel) {
            // get via model module name
            var viaModuleName = relation.via+'Model'
            // check that module exists
            assert.ok(immutable.hasModule(viaModuleName), 'module not found for relation via '+relation.via)
            // get module
            var module = immutable.module(viaModuleName)
            // get module meta data to get model
            var meta = module.meta()
            // module must be ImmutableCoreModel
            assert.ok(meta.class === 'ImmutableCoreModel', 'invalid model for relation via '+relation.via)
            // store model for relation via
            relation.viaModel = meta.instance
        }
    }
    // return relation
    return this.relations[relatedModelName]
}
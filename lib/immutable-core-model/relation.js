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
        // set column names for via relation
        if (relation.via) {
            // get id column for model
            var idColumn = this.columnName('id')
            var originalIdColumn = this.columnName('originalId')
            // original id is on via table directly
            if (relation.viaModel.columns[originalIdColumn]) {
                relation.modelIdColumn = originalIdColumn
                relation.viaModelIdColumn = originalIdColumn
            }
            // original id is linked to via table on default column
            else if (relation.viaModel.columnName(originalIdColumn)) {
                relation.modelIdColumn = originalIdColumn
                relation.viaModelIdColumn = relation.viaModel.columnName(originalIdColumn)
            }
            // id column is on via table directly
            else if (relation.viaModel.columns[idColumn]) {
                relation.modelIdColumn = idColumn
                relation.viaModelIdColumn = idColumn
            }
            // id column is linked to via table on default column
            else if (relation.viaModel.columnName(idColumn)) {
                relation.modelIdColumn = idColumn
                relation.viaModelIdColumn = relation.viaModel.columnName(idColumn)
            }
            // error
            else {
                throw new Error('invalid id column for model '+this.name+' relation '+relatedModelName)
            }
            // get id column for relation model that links it to via model
            var relationIdColumn = relation.model.columnName('id')
            var relationOriginalIdColumn = relation.model.columnName('originalId')
            // relation original id is on via table directly
            if (relation.viaModel.columns[relationOriginalIdColumn]) {
                relation.relationIdColumn = relationOriginalIdColumn
                relation.viaRelationIdColumn = relationOriginalIdColumn
            }
            // relation original id is linked to via table on default column
            else if (relation.viaModel.columnName(relationOriginalIdColumn)) {
                relation.relationIdColumn = relationOriginalIdColumn
                relation.viaRelationIdColumn = relation.viaModel.columnName(relationOriginalIdColumn)
            }
            // relation id is on via table directly
            else if (relation.viaModel.columns[relationIdColumn]) {
                relation.relationIdColumn = relationIdColumn
                relation.viaRelationIdColumn = relationIdColumn
            }
            // relation id is linked to via table on default column
            else if (relation.viaModel.columnName(relationIdColumn)) {
                relation.relationIdColumn = relationIdColumn
                relation.viaRelationIdColumn = relation.viaModel.columnName(relationIdColumn)
            }
            // error
            else {
                throw new Error('invalid id column for model '+this.name+' relation '+relatedModelName)
            }
        }
        // set column names for direct relation
        else {
            // get id column for related model - direct relation can go either
            // way so need to test all possibilities
            var modelIdColumn = this.columnName('id')
            var modelOriginalIdColumn = this.columnName('originalId')
            var relationIdColumn = relation.model.columnName('id')
            var relationOriginalIdColumn = relation.model.columnName('originalId')
            // original id links directly to relation
            if (relation.model.columns[modelOriginalIdColumn]) {
                relation.modelIdColumn = modelOriginalIdColumn
                relation.relationIdColumn = modelOriginalIdColumn
            }
            // original id links to relation on default column
            else if (relation.model.columnName(modelOriginalIdColumn)) {
                relation.modelIdColumn = modelOriginalIdColumn
                relation.relationIdColumn = relation.model.columnName(modelOriginalIdColumn)
            }
            // id links directly to relation
            else if (relation.model.columns[modelIdColumn]) {
                relation.modelIdColumn = modelIdColumn
                relation.relationIdColumn = modelIdColumn
            }
            // id links to relation on default column
            else if (relation.model.columnName(modelIdColumn)) {
                relation.modelIdColumn = modelIdColumn
                relation.relationIdColumn = relation.model.columnName(modelIdColumn)
            }
            // relation original id links directly to model
            else if (this.columns[relationOriginalIdColumn]) {
                relation.modelIdColumn = relationOriginalIdColumn
                relation.relationIdColumn = relationOriginalIdColumn
            }
            // relation original id links to model on default column
            else if (this.columnName(relationOriginalIdColumn)) {
                relation.modelIdColumn = this.columnName(relationOriginalIdColumn)
                relation.relationIdColumn = relationOriginalIdColumn
            }
            // relation id links directly to model
            else if (this.columns[relationIdColumn]) {
                relation.modelIdColumn = relationIdColumn
                relation.relationIdColumn = relationIdColumn
            }
            // relation id links to model on default column
            else if (this.columnName(relationIdColumn)) {
                relation.modelIdColumn = this.columnName(relationIdColumn)
                relation.relationIdColumn = relationIdColumn
            }
            // error
            else {
                throw new Error('invalid id column for model '+this.name+' relation '+relatedModelName)
            }
        }
    }
    // return relation
    return this.relations[relatedModelName]
}
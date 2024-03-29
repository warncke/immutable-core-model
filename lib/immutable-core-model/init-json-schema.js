'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

/* module exports */
module.exports = initJsonSchema

/* constants */
const defaultSchemas = {
    'id': {
        pattern: '^[a-f0-9]{32}$',
        type: 'string',
    },
    'time': {
        pattern: '^\\d{4}-\\d{2}-\\d{2}( \\d\\d:\\d\\d:\\d\\d(\\.\\d+)?)?$',
        type: 'string',
    },
}

/**
 * @function initJsonSchema
 *
 * create JSON schema for model
 *
 * @throws {Error}
 */
function initJsonSchema (args) {
    // get global validator instance
    var validator = this.global().validator
    // get schema id based on model name - must be globally unique
    this.schemaId = '/model/'+this.name
    // set option to perform schema validation on created/update
    this.validateSchema = args.validate === false ? false : true
    // create schema for model
    var schema = this.schemaMeta = {
        $id: this.schemaId,
        properties: {},
        required: [],
        type: 'object',
    }
    // get data column
    var dataColumn = this.columnName('data')
    // create entry in schema for data if model has data
    if (dataColumn) {
        // schema id for data only
        this.schemaDataId = '/model/'+this.name+'/data'
        // create data schema - meta and data schemas are compiled without
        // ref so that the complete schemas can be easily sent to clients
        var schemaData = this.schemaData = schema.properties[dataColumn] = {
            additionalProperties: args.additionalProperties,
            $id: this.schemaDataId,
            properties: {},
            type: 'object',
        }
        // merge schema from args over data schema
        _.merge(schemaData.properties, args.properties)
        // if required properties are set then add
        if (args.required) {
            // required must be array
            if (typeof args.required === 'string') {
                args.required = [args.required]
            }
            // throw error if not array
            assert.ok(Array.isArray(args.required), 'required must be array or string')
            // add list of required properties
            schemaData.required = args.required
        }
        // add error messages if any
        if (args.errorMessage) {
            schemaData.errorMessage = args.errorMessage
        }
        // add data schema
        validator.addSchema(schemaData, this.schemaDataId)
    }
    // create schema for each default column
    _.each(this.defaultColumns, (defaultName, columnName) => {
        // skip data column which is already specified
        if (defaultName === 'data') {
            return
        }
        // get column spec
        var column = this.columns[columnName]
        // if there is not schema for type then skip
        if (!defaultSchemas[column.type]) {
            return
        }
        // get column schema
        var columnSchema = _.cloneDeep(defaultSchemas[column.type])
        // set default schema based on type
        schema.properties[columnName] = columnSchema
        // make property required unless nullable
        if (column.null === false) {
            schema.required.push(columnName)
        }
    })
    // add schema
    validator.addSchema(schema, this.schemaId)
}
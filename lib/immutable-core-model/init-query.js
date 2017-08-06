'use strict'

/* npm modules */
const immutable = require('immutable-core')

/* application modules */
const ImmutableCoreModelQuery = require('../immutable-core-model-query')

/* exports */
module.exports = initQuery

/**
 * @function initQuery
 *
 * called by new ImmutableCoreModel to add query method to module
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initQuery (args) {
    // method name is moduleNameQuery
    var methodName = `${this.name}Query`
    // method signature is moduleName.methodName
    var methodSignature = `${this.moduleName}.${methodName}`
    // create immutable method for doing query
    this.query = immutable.method(methodSignature, args => {
        // get session from args
        var session = args.session
        // delete session so that query args are isolated
        delete args.session
        // create new query object
        var query = new ImmutableCoreModelQuery({
            args: args,
            model: this,
            session: session,
        })
        // execute query and return result
        try {
            return query.execute()
        }
        catch (err) {
            return Promise.reject(err)
        }
    })
}
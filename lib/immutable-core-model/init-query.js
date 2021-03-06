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
    // capture model to pass to function
    var model = this
    // create immutable method for doing query
    this.query = immutable.method(methodSignature, function (args) {
        // get session from args
        var session = args.session
        // remove session from args
        delete args.session
        // create new query object
        var query = new ImmutableCoreModelQuery({
            args: args,
            model: model,
            session: session,
        })
        // execute query and return result
        try {
            return query.execute()
        }
        catch (err) {
            return Promise.reject(err)
        }
    }, {
        // disable freezing args
        freeze: false,
    })
}
'use strict'

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')

/* exports */
module.exports = ImmutableCoreModelSelect

// Proxy handlery functions
const ProxyHandler = {
    get: getProxy,    
}

/**
 * @function ImmutableCoreModelSelect
 *
 * @param {object} args
 *
 * @returns {ImmutableCoreModelSelect}
 */
function ImmutableCoreModelSelect (args) {
    // model query will be performed on
    this.model = args.model
    // query to be performed
    this.query = {
        session: args.session,
    }
    // current context of query
    this.context
    // data associated with context
    this.contextData = {}
    // true if next property access should be column name
    this.expectColumn = false
    // because model.select needs to work as a function to select a list
    // of columns e.g. model.select(['foo', 'bar'])... and as a property
    // e.g. model.select.by... that property on the model is a getter
    // that always returns a new ImmutableCoreModelSelect() which in turn
    // returns with proxy function which can be called as a function with
    // a list of columns or accessed as an object which hits the proxy
    var proxyFunction = (columns) => {
        // set columns if array passed
        if (Array.isArray(columns)) {
            this.query.select = columns
        }
        // return class instance
        return this.proxy
    }
    // because hits on the proxy get this function as the target the
    // class instance has to be a property on the function so that it can
    // be accessed by the proxy handler
    proxyFunction.select = this
    // create proxy to map property accesses to query builder commands
    // proxy is actually a function that returns the class instance
    // because it needs to be able to be called as function so that
    // select can be used as both a function and property
    this.proxy = new Proxy(proxyFunction, ProxyHandler)
    // return proxy
    return this.proxy
}

/* private functions */

/**
 * @function getProxy
 *
 * @param {object} target
 * @param {string} property
 *
 * @returns {function|object|undefined}
 * 
 * @throws {Error}
 */
function getProxy (target, property) {
    // get ImmutableCoreModelSelect from target
    var select = target.select
    // next property should be column name
    if (select.expectColumn) {
        // get column name - throw error
        var columnName = select.model.columnName(property, true)
        // if in by context then return function which will be
        // called with the value to to be selected by
        if (select.context === 'by') {
            // if this is select by id then only a single result
            if (property === 'id') {
                select.query.limit = 1
            }
            // return function that will take select value and do query
            return function (val) {
                // set where clause for query
                select.query.where = {}
                select.query.where[columnName] = val
                // return query
                return select.model.query(select.query)
            }
        }
        else {
            throw new Error('invalid context for '+property)
        }
    }
    // next property should be keyword
    else {
        // by: select.by
        if (property === 'by') {
            // by can only be used without prior context so throw error
            if (select.context) {
                throw new Error('invalid use of by after '+select.context)
            }
            // set context
            select.context = 'by'
            // next property should be column name to select
            select.expectColumn = true
        }
        // one: select.one.by
        else if (property === 'one') {
            select.query.limit = 1
        }
        // and: where...and
        else if (property === 'and') {

        }
        else if (property === 'current') {
            // set current flag for query
            select.query.current = true
        }
        else {
            
        }
    }

    // return proxy again for most cases
    return select.proxy
}
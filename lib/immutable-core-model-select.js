'use strict'

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model-select')

/* application libraries */
const SqlSelect = require('./sql/select')
// get allowed match operators from sql select class
const matchOperators = SqlSelect.matchOperators

/* exports */
module.exports = ImmutableCoreModelSelect

/**
 * @function ImmutableCoreModelSelect
 *
 * @param {object} args
 *
 * @returns {ImmutableCoreModelSelect}
 */
function ImmutableCoreModelSelect (args) {
    // create select object to store state of select
    var select = {}
    // model query will be performed on
    select.model = args.model
    // current context of query
    select.context
    // data associated with context
    select.contextData = {}
    // true if next property access should be column name
    select.expectColumn = false
    // all properties
    select.history = []
    // query to be performed
    select.query = {
        session: args.session,
    }
    // because model.select needs to work as a function to select a list
    // of columns e.g. model.select(['foo', 'bar'])... and as a property
    // e.g. model.select.by... that property on the model is a getter
    // that always returns a new ImmutableCoreModelSelect() which in turn
    // returns with proxy function which can be called as a function with
    // a list of columns or accessed as an object which hits the proxy
    var proxyFunction = (columns) => {
        // set columns if array passed
        if (Array.isArray(columns)) {
            select.query.select = columns
        }
        // return class instance
        return select.proxy
    }
    // create proxy to map property accesses to query builder commands
    // proxy is actually a function that returns the class instance
    // because it needs to be able to be called as function so that
    // select can be used as both a function and property
    select.proxy = new Proxy(proxyFunction, {
        // proxy handler with get function that passes select object
        // along with the requested property to the actual handler
        get: function (target, property) {
            return getProxy(select, property)
        }
    })
    // return proxy
    return select.proxy
}

/* private functions */

/**
 * @function closeOrderContext
 *
 * create order condition from order context
 *
 * @param {object} select
 *
 * @throws {Error}
 */
function closeOrderContext (select) {
    // only operate if in order context
    if (select.context !== 'order') {
        return
    }
    // debug
    debug('closeOrderContext', select.contextData)
    // get columns to order by
    var columns = select.contextData.columns
    // must have columns in order to create order statement
    if (!Array.isArray(columns) || !columns.length) {
        // there is a direction with no column or there
        // are no order clauses in query then throw error
        if (!select.query.order || select.query.order.length === 0 || select.contextData.direction) {
            throwError('order must have columns', select)
        }
        // there is nothing in context that needs to be added to query
        else {
            return
        }
    }
    // if there is a direction then add to columns
    if (select.contextData.direction) {
        columns.push(select.contextData.direction)
    }
    // make sure query has order
    if (!select.query.order) {
        select.query.order = []
    }
    // add order caluse to query
    select.query.order.push(columns)
    // reset contextData
    select.contextData = {}
}

/**
 * @function closeWhereContext
 *
 * create where condition from where context
 *
 * @param {object} select
 *
 * @throws {Error}
 */
function closeWhereContext (select) {
    // only operate if in where context
    if (select.context !== 'where') {
        return
    }
    // debug
    debug('closeWhereContext', select.contextData)
    // get where options
    var column = select.contextData.column
    var not = select.contextData.not
    var operator = select.contextData.operator
    var value = select.contextData.value
    // require column
    if (!column) {
        // if query already has where then nothing in context to add
        if (select.query.where) {
            return
        }
        // otherwise where was created without any columns
        else {
            throwError('column required', select)
        }
    }
    // require value if operator is not null/boolean
    if (operator !== null && operator !== true && operator !== false && value === undefined) {
        throwError('value required', select)
    }
    // make sure query has where property
    if (!select.query.where) {
        select.query.where = {}
    }
    // clause is negated
    if (not) {
        // null/boolean operator
        if (operator === null || operator === true || operator === false) {
            select.query.where[column] = {not: operator}
        }
        // match operator
        else {
            select.query.where[column] = { not: {} }
            select.query.where[column]['not'][operator] = value
        }
    }
    // regular clause
    else {
        // null/boolean operator
        if (operator === null || operator === true || operator === false) {
            select.query.where[column] = operator
        }
        // match operator
        else {
            select.query.where[column] = {}
            select.query.where[column][operator] = value
        }
    }
    // reset contextData
    select.contextData = {}
}

/**
 * @function getColumn
 *
 * Get column name from property, throw error on invalid colum name, unset
 * expectColumn flag
 *
 * @param {string} property
 * @param {object} select
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function getColumn (property, select) {
    // column is only allowed property after by
    var columnName = select.model.columnName(property)
    // throw error on invalid column name
    if (!columnName) {
        throwInvalidColumnName(columnName, select)
    }
    // unset expectColumn flag now that column captured
    select.expectColumn = false
    // return full column name
    return columnName
}

/**
 * @function getProxy
 *
 * @param {object} select
 * @param {string} property
 *
 * @returns {function|object|undefined}
 * 
 * @throws {Error}
 */
function getProxy (select, property) {

    debug('property', property)

    // if property is query then return function that executes query
    if (property === 'query') {
        // close where context
        closeWhereContext(select)
        // close order context
        closeOrderContext(select)
        // return function that will execute and return query
        return function (args) {
            // if args is set then merge args into query
            if (args) {
                _.merge(select.query, args)
            }
            // debug query
            debug('query', select.query)
            // execute query
            return select.model.query(select.query)
        }
    }

    // add property to history
    select.history.push(property)

    /*
     * there are two primary selection contexts: where and by
     *
     * select by is more limited and only allows specifying a single column
     * to do a select where equals query on
     *
     * where context allows specifying multiple columns to match separated
     * by and with the full range of matching operators available.
     *
     * query modifiers can only be specified before any cotext is set - e.g.
     * one, all, current, allRevisions must be specified before by or where.
     *
     */

    // handle context specific logic
    if (!select.context) {
        // switch to by context
        if (property === 'by') {
            // set context
            select.context = 'by'
            // column name must follow by
            select.expectColumn = true
        }
        // switch to where context
        else if (property === 'where') {
            // set context
            select.context = 'where'
            // column name must follow where
            select.expectColumn = true
        }
        // switch to order context
        else if (property === 'order') {
            // order can only appear without where context after select.all
            if (!select.query.all) {
                throwInvalidProperty(property, select)
            }
            // set context
            select.context = 'order'
        }
        // set all flag on query
        else if (property === 'all') {
            select.query.all = true
        }
        // set allRevisions flag on query
        else if (property === 'allRevisions') {
            select.query.allRevisions = true
        }
        // set current flag on query
        else if (property === 'current') {
            select.query.current = true
        }
        // set limit: 1 on query
        else if (property === 'one') {
            select.query.limit = 1
        }
        // invalid property
        else {
            throwInvalidProperty(property, select)
        }
    }
    else if (select.context === 'by') {
        // column is only allowed property after by
        var column = getColumn(property, select)
        // if doing select by id then force limit to 1
        if (column === select.model.columnName('id')) {
            // throw error on select.all before by.id
            if (select.query.all) {
                throwError('select.all not allowed with by.id', select)
            }
            select.query.limit = 1
        }
        // return function that will take select value and do query
        return function (val) {
            // set where clause for query
            select.query.where = {}
            select.query.where[column] = val
            // debug query
            debug('query', select.query)
            // execute query
            return select.model.query(select.query)
        }
    }
    else if (select.context === 'where') {
        // column must be first property in where clause
        if (select.expectColumn) {
            // property is an action isProperty
            if (select.model.actionIsProperties[property]) {
                // isProperty takes place of column
                select.expectColumn = false
                // return function that captures value
                return function (value) {
                    // set isProperty as column for where query
                    select.contextData.column = property
                    select.contextData.operator = value
                    // add where clause to query
                    closeWhereContext(select)
                    // return proxy
                    return select.proxy
                }
            }
            else {
                // set column in context data
                select.contextData.column = getColumn(property, select)
            }
        }
        // otherwise look for operator
        else {
            // is is a noop
            if (property === 'is') {

            }
            // apply negation to where clause
            else if (property === 'not') {
                select.contextData.not = true
            }
            // property is valid match operator
            else if (matchOperators[property]) {
                select.contextData.operator = property
                // return function that captures value and then closes where
                return function (val) {
                    // capture value
                    select.contextData.value = val
                    // add where clause to query
                    closeWhereContext(select)
                    // return proxy
                    return select.proxy
                }
            }
            // property is null
            else if (property === 'null') {
                // set IS NULL operator
                select.contextData.operator = null
                // add where clause to query
                closeWhereContext(select)
            }
            // if doing and close current clause and start another
            else if (property === 'and') {
                // add where clause to query
                closeWhereContext(select)
                // next property should be column for new where clause
                select.expectColumn = true
            }
            // switch to order context
            else if (property === 'order') {
                // add where clause to query
                closeWhereContext(select)
                // set context
                select.context = 'order'
            }
            // switch to limit context - capture limit
            else if (property === 'limit') {
                // add where clause to query
                closeWhereContext(select)
                // set context
                select.context = 'limit'
                // return function that sets limit
                return function (val) {
                    // do not allow limit 1 after select.all
                    if (val === 1 && select.query.all) {
                        throwError('limit(1) not allowed with select.all', select)
                    }
                    // set limit
                    select.query.limit = val
                    // return proxy
                    return select.proxy
                }
            }
            else {
                throwInvalidProperty(property, select)
            }
        }
    }
    else if (select.context === 'order') {
        // by is a noop
        if (property === 'by') {
        }
        // switch to limit context - capture limit
        else if (property === 'limit') {
            // add context to query
            closeOrderContext(select)
            // set context
            select.context = 'limit'
            // return function that sets limit
            return function (val) {
                // do not allow limit 1 after select.all
                if (val === 1 && select.query.all) {
                    throwError('limit(1) not allowed with select.all', select)
                }
                // set limit
                select.query.limit = val
                // return proxy
                return select.proxy
            }
        }
        // direction asc|desc
        else if (property === 'asc' || property === 'desc') {
            // add direction to order context
            select.contextData.direction = property
            // add context to query
            closeOrderContext(select)
        }
        // if not keyword then expect column name
        else {
            // get column name
            var columnName = select.model.columnName(property)
            // throw error on invalid column name
            if (!columnName) {
                throwInvalidColumnName(columnName, select)
            }
            // if list of columns does not exist in context data create
            if (!select.contextData.columns) {
                select.contextData.columns = []
            }
            // add column to list of columns for order
            select.contextData.columns.push(columnName)
        }
    }
    else if (select.context === 'limit') {
        // capture offset
        if (property === 'offset') {
            // return function that sets offset
            return function (val) {
                // set offset
                select.query.offset = val
                // return proxy
                return select.proxy
            }
        }
        else {
            throwInvalidProperty(property, select)
        }
    }
    else {
        throwInvalidProperty(property, select)
    }

    // return proxy again for most cases
    return select.proxy
}

/**
 * @function throwError
 *
 * throw any msg as error
 *
 * @param {string} msg
 * @param {object} select
 *
 * @throws {Error}
 */
function throwError (msg, select) {
    // create error message
    var msg = msg+' at select.'+select.history.join('.')+' in context '+select.context
    // create error
    var err = new Error(msg)
    // add select data to error
    err.data = _.pick(select, ['context', 'contextData', 'expectColumn', 'history', 'query'])
    // throw error
    throw new Error(err)
}

/**
 * @function throwInvalidColumnName
 *
 * throw invalid option error
 *
 * @param {string} columnName
 * @param {object} select
 *
 * @throws {Error}
 */
function throwInvalidColumnName (columnName, select) {
    // create error message
    var msg = 'invalid column name for select `'+columnName
        +'` at select.'+select.history.join('.')+' in context '+select.context
    // create error
    var err = new Error(msg)
    // add select data to error
    err.data = _.pick(select, ['context', 'contextData', 'expectColumn', 'history', 'query'])
    // throw error
    throw new Error(err)
}

/**
 * @function throwInvalidProperty
 *
 * throw invalid option error
 *
 * @param {string} property
 * @param {object} select
 *
 * @throws {Error}
 */
function throwInvalidProperty (property, select) {
    // create error message
    var msg = 'invalid option for select `'+property
        +'` at select.'+select.history.join('.')+' in context '+select.context
    // create error
    var err = new Error(msg)
    // add select data to error
    err.data = _.pick(select, ['context', 'contextData', 'expectColumn', 'history', 'query'])
    // throw error
    throw new Error(err)
}
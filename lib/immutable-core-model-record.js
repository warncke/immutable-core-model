'use strict'

/* native modules */
const util = require('util')

/* npm modules */
const _ = require('lodash')
const debug = require('debug')('immutable-core-model')
const deepExtend = require('deep-extend')
const defined = require('if-defined')
const httpError = require('immutable-app-http-error')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* application modules */
const sql = require('./sql')

/* exports */
module.exports = ImmutableCoreModelRecord

/* constats */
const MAX_RETRY = 3

/**
 * @function ImmutableCoreModelRecord
 *
 * create a new ImmutableCoreModelRecord instance from raw data object
 *
 * @param {object} args
 *
 * @returns {ImmutableCoreModelRecord}
 *
 * @throws {Error}
 */
function ImmutableCoreModelRecord (args) {
    // initialize new instance
    this.init(args)
}

/* public functions */
ImmutableCoreModelRecord.prototype = {
    assert: assert,
    create: create,
    createMeta: createMeta,
    current: current,
    delete: _delete,
    empty: empty,
    error: error,
    init: init,
    inspect: inspect,
    isConflictError: isConflictError,
    toJSON: toJSON,
    query: query,
    select: select,
    undelete: undelete,
    update: update,
    updateMeta: updateMeta,
    // class properties
    class: 'ImmutableCoreModelRecord',
    ImmutableCoreModelRecord: true,
}

/**
 * @function assert
 *
 * throw error if value is not true
 *
 * @param {boolean} assertValue
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @throws {Error}
 */
function assert (assertValue, message, err) {
    if (!assertValue) {
        throw this.error(message, err)
    }
}

/**
 * @function create
 *
 * create related object
 *
 * @param {string} relation
 * @param {object} data
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
function create (relation, data) {
    return this.createMeta({
        data: data,
        relation: relation,
    })
}

/**
 * @function createMeta
 *
 * create related object
 *
 * @param {object} args
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
function createMeta (args) {
    // resolve relation name to spec - will throw error if cant be resolved
    var relation = this.model.relation(args.relation)
    // args for creating related model
    var relatedArgs = {
        catch: false,
        data: args.data,
        session: args.session || this.session,
        wait: false,
    }
    // add ids
    relatedArgs[this.model.columnName('id')] = this.id
    relatedArgs[this.model.columnName('originalId')] = this.originalId
    // create related model
    return relation.model.createMeta(relatedArgs)
    // create via model if any
    .then(related => {
        // if via model not specified then do not create
        if (!relation.viaModel) {
            return related
        }
        // args for via model
        var viaArgs = {
            session: args.session || this.session,
        }
        // add id and original id for both instance and related models
        viaArgs[this.model.columnName('id')] = this.id
        viaArgs[this.model.columnName('originalId')] = this.originalId
        viaArgs[relation.model.columnName('id')] = related.id
        viaArgs[relation.model.columnName('originalId')] = related.originalId
        // create via model
        return relation.viaModel.createMeta(viaArgs)
        // wait for initial create to finish
        .then(() => {
            return related.promise.then(() => {
                // delete promise now that it is resolved
                delete related.promise
                // resolve with related record
                return related
            })
        })
    })
}

/**
 * @function current
 *
 * do query for current instance of object
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function current (args) {
    // build args
    var queryArgs = {
        current: true,
        limit: 1,
        where: {
            id: this.id,
        },
        session: this.session,
    }
    // override with args if passed
    if (defined(args)) {
        _.merge(queryArgs, args)
    }
    // do query for current record
    return this.model.query(queryArgs)
}

/**
 * @function _delete
 *
 * set deleted property to true
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function _delete (args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // model must allow delete
    if (!defined(this.model.columns.d)) {
        throw this.error('delete not supported')
    }
    // instance must not already be deleted
    if (this.isDeleted) {
        throw this.error('record already deleted')
    }
    // check access to delete unless allow set
    if (!args.allow) {
        var allow = this.model.accessControl.allowModel({
            action: 'delete',
            model: this.model.name,
            scope: this.scope,
            session: this.session,
        })
        // throw access denied error if not allowed
        if (!allow) {
            httpError(403, null, _.clone(this.model.accessControl.audit))
        }
    }
    // set d(eleted) flag true
    args.delete = true
    // use update method to empty
    return this.updateMeta(args)
}

/**
 * @function empty
 *
 * empty object data
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function empty (args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // to empty object data must be set to null
    args.data = null
    // use update method to empty
    return this.updateMeta(args)
}

/**
 * @function error
 *
 * create/update error object with query data
 *
 * @param {string} message
 * @param {Error|undefined} error
 *
 * @returns {Error}
 */
function error (message, error) {
    // build custom error message
    message = `${this.model.name}#${this.id} record error` + (
        typeof message === 'string'
            ? `: ${message}`
            : ''
    )
    // use error object passed in
    if (defined(error)) {
        // create data object with original message
        error.data = {
            message: error.message,
        }
    }
    // create new error message
    else {
        error = new Error(message)
        error.data = {}
    }
    // set record data for error
    error.data.record = this

    return error
}

/**
 * @function init
 *
 * called by instantiator to initialize new instance
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function init (args) {
    // get values from args
    this.model = args.model
    this.promise = args.promise
    this.raw = args.raw
    this.session = args.session
    // list of instance properties
    this.properties = []
    // add default properties to instance
    _.each(this.model.defaultColumns, (defaultName, columnName) => {
        // skip row (n)um column
        if (columnName === 'c' || columnName === 'n') {
            return
        }
        // use d column to set deleted flag
        if (columnName === 'd') {
            this.isDeleted = this.raw[columnName] === '1' ? true : false
        }
        // and column to instance
        else {
            // add property using default name (e.g. id, createTime) to object
            this[defaultName] = this.raw[columnName]
            // add to properties
            this.properties.push(defaultName)
        }
    })
    // if model has data then make sure extra columns are set in data
    if (defined(this.model.columnName('data'))) {
        // check that extra properties defined in data
        _.each(this.model.extraColumns, (spec, columnName) => {
            if (defined(this.raw[columnName]) && !defined(_.get(this.data, spec.path))) {
                _.set(this.data, spec.path, this.raw[columnName])
            }
        })
    }
    // if model does not have data then any extra columns go on instnace
    else {
        // add extra properties to instance
        _.each(this.model.extraColumns, (spec, columnName) => {
            this[columnName] = this.raw[columnName]
            // add to properties
            this.properties.push(columnName)
        })
    }
    // list of states record is in for checking access
    var states = []
    // add deleted to states if set
    if (this.isDeleted) {
        states.push('deleted')
    }
    // if there are reladed records loaded copy them to instance
    if (this.raw._related) {
        this.related = this.raw._related
        delete this.raw._related
    }
    // if child id was selected use to determin if record is current
    if (this.raw.hasOwnProperty('childId')) {
        // if record has child it is not current
        this.isCurrent = defined(this.raw.childId) ? false : true
        // add isCurrent to properties
        this.properties.push('isCurrent')
    }
    // default scope for access control
    this.scope = 'any'
    // id that grants ownership access to record
    this.accessId = undefined
    // set access id for raw if defined
    if (defined(this.raw[this.model.accessIdName])) {
        this.accessId = this.raw[this.model.accessIdName]
    }
    // otherwise set from data - may be undefined
    else if (defined(this.data) && defined(this.data[this.model.accessIdName])) {
        this.accessId = this.data[this.model.accessIdName]
    }
    // if session has accessId set and it is used for model then use it
    if (defined(this.session.accessId) && this.session.accessIdName === this.model.accessIdName) {
        // if access id is in data and matches session then change scope to own
        if (this.session.accessId = this.accessId) {
            this.scope = 'own'
        }
    }
    // otherwise try account id
    else if (defined(this.session.accountId) && this.model.defaultColumnsInverse.accountId) {
        // if account id matches session then change scope to own
        if (this.session.accountId === this.accountId) {
            this.scope = 'own'
        }
    }
    // check access unless allow override set - only check access on primary model
    // records and not on action records
    if (!args.allow && !this.model.isAction) {
        // build args for access check - default to any scope
        var allowArgs = {
            action: 'read',
            model: this.model.name,
            scope: this.scope,
            session: this.session,
            states: states,
        }

        // check access
        var allow = this.model.accessControl.allowModel(allowArgs)
        // throw access denied error if not allowed
        if (!allow) {
            httpError(403, null, _.clone(this.model.accessControl.audit))
        }
    }
}

/**
 * @function inspect
 *
 * generate output for util.inspect used by node.js console.log
 *
 * @returns {string}
 */
function inspect () {
    var out = '[immutable.model.'+this.model.name+'] '
    return out + util.inspect(this.toJSON())
}

/**
 * @function isConflictError
 *
 * return true if argument is error from conflicting revision - i.e. a unique
 * key constraint violation on the parentId column for the instance model
 *
 * @param {Error} err
 *
 * @returns {boolean}
 */
function isConflictError (err) {
    // return false if err is not an object
    if (typeof err !== 'object') {
        return false
    }
    // return false if error does not have mysql duplicate key code
    if (err.code !== 1062) {
        return false
    }
    // return false if duplicate key error is not on parent id column
    if (err.message.indexOf(this.model.columnName('parentId')) === -1) {
        return false
    }
    // if all negative tests pass return true
    return true
}

/**
 * @function toJSON
 *
 * return data that will be serialized by JSON.encode
 *
 * @returns {object}
 */
function toJSON () {
    return _.pick(this, this.properties)
}

/**
 * @function query
 *
 * query related records
 *
 * @param {object} args
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
function query (args) {
    // get relation
    var relation = this.model.relation(args.relation)
    // delete relation name from args so it wont pass to query
    delete args.relation
    // build query args
    var queryArgs = {
        session: args.session || this.session,
        where: { relation: { name: this.model.name } },
    }
    // relation is via a linking table
    if (relation.via) {
        queryArgs.where.relation[relation.viaModelIdColumn] = this[relation.modelIdColumn] || this[this.model.defaultColumns[relation.modelIdColumn]]
    }
    // relation is direct
    else {
        queryArgs.where.relation[relation.relationIdColumn] = this[relation.modelIdColumn] || this[this.model.defaultColumns[relation.modelIdColumn]]
    }
    // merge args
    _.merge(queryArgs, args)
    // do query on related model
    return relation.model.query(queryArgs)
}

/**
 * @function select
 *
 * select related records
 *
 * @param {string} relation
 *
 * @returns {Promise}
 *
 * @throws {Error}
 */
function select (relation) {
    return this.query({
        relation: relation,
    })
}


/**
 * @function undelete
 *
 * set deleted property to false
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function undelete (args) {
    // make sure args is object
    args = requireValidOptionalObject(args)
    // model must allow delete
    if (!defined(this.model.columns.d)) {
        throw this.error('undelete not supported')
    }
    // instance must not already be deleted
    if (!this.isDeleted) {
        throw this.error('record is not deleted')
    }
    // check access for undelete unless allow set
    if (!args.allow) {
        var allow = this.model.accessControl.allowModel({
            action: 'undelete',
            model: this.model.name,
            scope: this.scope,
            session: this.session,
        })
        // throw access denied error if not allowed
        if (!allow) {
            httpError(403, null, _.clone(this.model.accessControl.audit))
        }
    }
    // set d(eleted) flag false
    args.delete = false
    // use update method to empty
    return this.updateMeta(args)
}

/**
 * @function update
 *
 * create and return new revision of object - args will be used as data along
 * with original session
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function update (data) {
    return this.updateMeta({data: data})
}

/**
 * @function updateMeta
 *
 * create and return new revision of object - args data will be merged into
 * existing data.
 *
 * @param {object} args
 *
 * @returns {Promise}
 */
function updateMeta (args) {
    // data for new revision
    var data
    // check whether access is allowed
    if (!args.allow) {
        var allow
        // bulid args for access check
        var allowArgs = {
            action: 'update',
            model: this.model.name,
            scope: this.scope,
            session: args.session || this.session,
        }
        // get name of access id column for model
        var accessIdName = this.model.accessIdName
        // check access for update
        allow = this.model.accessControl.allowModel(allowArgs)
        // access id value being set in update if any
        var updateAccessId
        // access id set in args
        if (defined(args[accessIdName])) {
            updateAccessId = args[accessIdName]
        }
        // access id is set in data
        else if (defined(args.data) && args.data !== null && defined(args.data[accessIdName])) {
            updateAccessId = args.data[accessIdName]
        }
        // if access id is being set and does not match current access id then
        // change ownership permission is required as well
        if (defined(updateAccessId) && updateAccessId !== this.accessId) {
            allowArgs.action = 'chown'
            // checked allowed
            allow = this.model.accessControl.allowModel(allowArgs)
        }
        // throw access denied error if not allowed
        if (!allow) {
            httpError(403, null, _.clone(this.model.accessControl.audit))
        }
    }
    // if data was passed in args then merge into existing data - if data
    // is set to null then object will be emptied
    if (defined(this.data) && args.data !== null) {
        // if data is being set check
        if (defined(args.data)) {
            // map of updated firstOnly conlumns
            var updateColumns = {}
            // check firstOnly and immutable for extra columns
            _.each(this.model.extraColumns, (spec, name) => {
                // if property is immutable do not allow value to change
                if (spec.immutable && defined(this.data[name])) {
                    this.assert(args.data[name] === this.data[name], `cannot modify immutable property ${name}`)
                }
                // if property is set on first insert only and it has changed
                // then add to list to update
                if (spec.firstOnly && args.data[name] !== undefined && args.data[name] !== this.data[name]) {
                    // and to map of firstOnly columns to update
                    updateColumns[name] = true
                }
            })
        }
        // if merge is disabled then overwrite existing data
        if (args.merge === false) {
            data = args.data
        }
        // merge update args to existing data by default
        else {
            // create clone of existing object data to merge update into
            data = _.cloneDeep(this.data)
            // merge update data into existing data
            deepExtend(data, args.data)
        }
    }
    // args for create
    var createArgs = {
        // use accountId from original object unless accountId in args
        accountId: args.accountId || this.accountId,
        // skip create access check since update is allowed
        allow: true,
        // object data
        data: data,
        // set original id from current instance
        originalId: this.originalId,
        // id of this instance is parentId for revision
        parentId: this.id,
        // use session from this instance unless set in args
        session: args.session || this.session,
        // map of firstOnly columns to update
        updateColumns: updateColumns,
        // perform validation
        validate: args.validate,
    }
    // if object does not have data then add any extra columns directly to args
    if (!defined(this.data)) {
        // check firstOnly and immutable for extra columns
        _.each(this.model.extraColumns, (spec, name) => {
            // if property is immutable do not allow value to change
            if (spec.immutable && defined(this[name] && defined(args[name]))) {
                this.assert(args[name] === this.data[name], `cannot modify immutable property ${name}`)
            }
            // if property is set on first insert only and it has changed
            // then add to list to update
            if (spec.firstOnly && defined(args[name]) && args[name] !== this[name]) {
                // and to map of firstOnly columns to update
                updateColumns[name] = true
            }
            // set value from args
            if (defined(args[name])) {
                createArgs[name] = args[name]
            }
            // set value from current instance unless column is firstOnly
            else if (!spec.firstOnly) {
                createArgs[name] = this[name]
            }
        })
    }
    // if delete arg is set use
    if (typeof args.delete === 'boolean') {
        createArgs.d = args.delete
    }
    // otherwise use current value
    else {
        createArgs.d = this.isDeleted ? true : false
    }
    // attempt to create new instance
    return this.model.createMeta(createArgs)
    // catch errors
    .catch(err => {
        // if force is not set then throw error
        if (!args.force) {
            throw err
        }
        // only force retry on revision conflicts not other errors
        if (!this.isConflictError(err)) {
            throw err
        }
        // should retry now so make sure that retry counter is set
        if (!args.retry) {
            args.retry = 0
        }
        // increment retry counter
        args.retry++
        // do not retry if limit exceeded
        if (args.retry > MAX_RETRY) {
            throw err
        }
        // get current instance
        return this.model.query({
            current: 1,
            limit: 1,
            session: createArgs.session,
            where: {originalId: createArgs.originalId},
        })
        .then(current => {
            // call updateMeta on the current instance with the same args
            // and retry incremented
            return current.updateMeta(args)
        })
    })
}
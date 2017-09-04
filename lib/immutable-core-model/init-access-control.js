'use strict'

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const _ = require('lodash')
const defined = require('if-defined')

/* exports */
module.exports = initAccessControl

/**
 * @function initAccessControl
 *
 * get access control instance for model if not set in args. set access id and
 * access rules if specified in args.
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initAccessControl (args) {
    // get global access control instance
    var accessControl = ImmutableAccessControl.getGlobal()
    // check for deprecated access control
    if (defined(args.accessControl)) {
        throw new Error('model local accessControl is deprecated')
    }
    // check for deprecated access model if passed
    if (defined(args.accessModel)) {
        throw new Error('accessModel is deprecated')
    }
    // set access id column if passed
    if (args.accessIdName) {
        // set access id name
        this.accessIdName = args.accessIdName
        // get column spec
        var spec = this.columns[this.accessIdName]
        // column for access id name must exist
        this.assert(defined(spec), `column not defined for accessIdName ${args.accessIdName}`)
        // column must be id
        this.assert(spec.type === 'id', `accessIdName column ${args.accessIdName} must have type id`)
        // set access id name with access control provider
        accessControl.setAccessIdName(this.name, this.accessIdName)
    }
    // set default access id name o model
    else {
        // default is accountId if model has an account id
        this.accessIdName = this.defaultColumnsInverse.accountId ? 'accountId' : undefined
    }
    // if rules not passed skip adding
    if (!defined(args.accessControlRules)) {
        return
    }
    // require access control rules to be array
    this.assert(Array.isArray(args.accessControlRules), 'accessControlRules must be array')
    // add each access control rule
    _.each(args.accessControlRules, accessControlRule => {
        // if rule is a string then it is for `all` role
        if (typeof accessControlRule === 'string') {
            // prepend model:<modelName>: to rule
            accessControlRule = `model:${this.name}:${accessControlRule}`
            // add rule with all role
            accessControl.setRule(['all', accessControlRule], true)
        }
        // otherwise must be array with role(s) and rule as last element
        else if (Array.isArray(accessControlRule)) {
            // get index of last element
            var lastIdx = accessControlRule.length - 1
            // prepend model:<modelName>: to rule
            accessControlRule[lastIdx] = `model:${this.name}:${accessControlRule[lastIdx]}`
            // add rule
            accessControl.setRule(accessControlRule, true)
        }
        // error
        else {
            throw this.error('string or array required for accessControlRules element')
        }
    })
}
'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const ImmutableAccessControl = require('immutable-access-control')
const _ = require('lodash')

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
    // if access control instance is passed validate
    if (args.accessControl) {
        assert.ok(args.accessControl.ImmutableAccessControl, 'ImmutableAccessControl instance required for accessControl')
        // use passed in access control
        this.accessControl = args.accessControl
    }
    // create new access control instance - which returns global singleton
    else {
        this.accessControl = new ImmutableAccessControl()
    }
    // set access model if passed
    if (args.accessModel) {
        throw new Error('accessModel is deprecated')
    }
    // set access id column if passed
    if (args.accessIdName) {
        // set access id name
        this.accessIdName = args.accessIdName
        // get column spec
        var spec = this.columns[this.accessIdName]
        // column for access id name must exist
        assert.ok(spec, `column does not exist for accessIdName ${this.name} ${args.accessIdName}`)
        // column must be id
        assert.ok(spec.type === 'id', `accessIdName column must have type id ${this.name} ${args.accessIdName}`)
        // set access id name with access control provider
        this.accessControl.setAccessIdName(this.name, this.accessIdName)
    }
    // set default access id name o model
    else {
        // default is accountId if model has an account id
        this.accessIdName = this.defaultColumnsInverse.accountId ? 'accountId' : undefined
    }
    // if rules not passed skip adding
    if (!args.accessControlRules) {
        return
    }
    // require access control rules to be array
    assert.ok(Array.isArray(args.accessControlRules), 'accessControlRules must be array')
    // add each access control rule
    _.each(args.accessControlRules, accessControlRule => {
        // if rule is a string then it is for `all` role
        if (typeof accessControlRule === 'string') {
            // prepend model:<modelName>: to rule
            accessControlRule = 'model:'+this.name+':'+accessControlRule
            // add rule with all role
            this.accessControl.setRule(['all', accessControlRule], true)
        }
        // otherwise must be array with role(s) and rule as last element
        else if (Array.isArray(accessControlRule)) {
            // get index of last element
            var lastIdx = accessControlRule.length - 1
            // prepend model:<modelName>: to rule
            accessControlRule[lastIdx] = 'model:'+this.name+':'+accessControlRule[lastIdx]
            // add rule
            this.accessControl.setRule(accessControlRule, true)
        }
        // error
        else {
            throw new Error('string or array required for access control rule')
        }
    })
}
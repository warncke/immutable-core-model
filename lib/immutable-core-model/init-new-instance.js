'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')

/* application modules */
const ImmutableCoreModelInstance = require('../immutable-core-model-instance')

/* exports */
module.exports = initNewInstance

/**
 * @function initNewInstance
 *
 * called by new ImmutableCoreModel to add create newInstance method
 *
 * @param {object} args
 *
 * @throws {Error}
 */
function initNewInstance (args) {
    // create prototype for Instance based on ImmutableCoreModuleInstance
    var prototype = _.clone(ImmutableCoreModelInstance.prototype)
    // add action methods to prototype
    _.each(this.actions, (spec, name) => {
        // create method for action
        prototype[name] = function (args) {
            return this.action(name, args)
        }
        // if action has an inverse create a method for it
        if (spec.inverseName) {
            prototype[spec.inverseName] = async function (args) {
                return this.action(spec.inverseName, args)
            }
        }
    })
    // create instance initializer 
    function Instance (args) {
        this.init(args)
    }
    // set prototype for Instance
    Instance.prototype = prototype
    // create newInstance method
    this.newInstance = function (args) {
        return new Instance(args)
    }
}
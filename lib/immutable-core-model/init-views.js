'use strict'

/* npm modules */
const _ = require('lodash')

/* application modules */
const requireValidModelView = require('./require-valid-model-view')

/* exports */
module.exports = initViews

/**
 * @function initViews
 *
 * initialize any model views
 *
 * @throws {Error}
 */
function initViews (args) {
    // create views register for model indexed by view name - these names
    // are not required to be the same as global view names
    this.views = {}
    // validate each defined view, get view model if needed
    _.each(args.views, (spec, name) => {
        // get list of model views
        var views = Array.isArray(spec) ? spec : [spec]
        // validate that all model views can be loaded
        _.each(views, view => requireValidModelView(view, args.views, true))
        // add to views
        this.views[name] = views
    })
}
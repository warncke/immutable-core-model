'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const ImmutableCoreModelView = require('immutable-core-model-view')

/* exports */
module.exports = requireValidModelView

/**
 * @function requireValidModelView
 *
 * validate argument which can be either model view name or object. throws
 * error on invalid argument.
 *
 * when the resolve argument is true then string model view names will be
 * resolved into model view object(s) and constructors will be resolved into
 * instances.
 *
 * if name is an alias for a list of model view objects then an array will be
 * returned. otherwise model view object will be returned.
 *
 * @param {string|object} view
 * @param {object} views
 * @param {boolean} resolve
 * @param {object} resolved
 *
 * @returns {array|object|string}
 *
 * @throws {Error}
 */
function requireValidModelView (view, views, resolve, resolved) {
    // validate model view name
    if (typeof view === 'string') {
        // view name is defined on model
        if (views[view]) {
            // resolve to object if option set
            if (resolve) {
                view = resolveModelViewName(views, view, resolved)
            }
        }
        // name is not defined locally for model
        else {
            // require name to be defined globally
            assert.ok(ImmutableCoreModelView.hasModelView(view), 'model view not found '+view)
            // get model view instance object
            if (resolve) {
                // get model view constructor
                var ModelView = ImmutableCoreModelView.getModelView(view)
                // get instance from constructor
                view = ModelView()
            }
        }
    }
    // validate model view instance object
    else if (typeof view === 'object') {
        // require object with acceptable interface
        assert.ok(ImmutableCoreModelView.looksLikeInstance(view), 'invalid model view instance')
    }
    // validate model view constructor function
    else if (typeof view === 'function') {
        // require object with acceptable interface
        assert.ok(ImmutableCoreModelView.looksLikeConstructor(view), 'invalid model view instance')
        // get instance from constructor
        if (resolve) {
            view = view()
        }
    }
    // invalid type
    else {
        throw new Error('name or object required for view')
    }

    // return validated model view
    return view
}

/* private functions */

/**
 * @function resolveModelViewName
 *
 * take a model view name and return model view object or list of objects
 *
 * @param {object} modelViews
 * @param {string} modelViewName
 * @param {object} resolved
 *
 * @returns {array|object}
 *
 * @throws {Error}
 */
function resolveModelViewName (modelViews, modelViewName, resolved) {
    // map of names resolved - this is needed to detect infinite loops
    if (!resolved) {
        resolved = {}
    }
    // throw error if name has already been resolved - infinite loop
    assert.ok(!resolved[modelViewName], 'views error: '+modelViewName+' cannot be resolved to model view object')
    // set flag that current name has been seen
    resolved[modelViewName] = true
    // get specified model view - this has already been tested to exist
    var modelView = modelViews[modelViewName]
    // return resolved value(s)
    return Array.isArray(modelView)
        ? _.map(modelView, modelView => requireValidModelView(modelView, modelViews, true, resolved))
        : requireValidModelView(modelView, modelViews, true, resolved)
}
'use strict'

const ImmutableCoreModel = require('../lib/immutable-core-model')
const chai = require('chai')
const immutable = require('immutable-core')

const assert = chai.assert

describe('immutable-core-model - looksLike', function () {

    before(function () {
        // reset globals
        immutable.reset()
        ImmutableCoreModel.reset()
    })

    it('should expose looksLike method', function () {
        assert.isFunction(ImmutableCoreModel)
    })


    it('should return false if object does not look like', function () {
        assert.isFalse(ImmutableCoreModel.looksLike({}))
    })

    it('should return true if object does look like', function () {
        // create new model
        var fooModel = new ImmutableCoreModel({name: 'foo'})
        // model should look like an ImmutableCoreModel
        assert.isTrue(ImmutableCoreModel.looksLike(fooModel))
    })

}) 
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Shared helpers for mocking things out in the tests.
 */

var sinon = require('sinon')
var extend = require('util')._extend
var P = require('../lib/promise')
var crypto = require('crypto')

var DB_METHOD_NAMES = ['account', 'createAccount', 'createDevice', 'createKeyFetchToken',
                       'createSessionToken', 'deleteAccount', 'deleteDevice',
                       'deletePasswordChangeToken', 'emailRecord', 'resetAccount', 'sessions',
                       'updateDevice']

var LOG_METHOD_NAMES = ['trace', 'increment', 'info', 'error', 'begin', 'warn',
                        'activityEvent', 'event']

var MAILER_METHOD_NAMES = ['sendVerifyCode', 'sendVerifyLoginEmail',
                           'sendNewDeviceLoginNotification', 'sendPasswordChangedNotification']

var METRICS_CONTEXT_METHOD_NAMES = ['add', 'validate']

var PUSH_METHOD_NAMES = ['notifyDeviceConnected', 'notifyDeviceDisconnected', 'notifyUpdate']

module.exports = {
  mockDB: mockDB,
  mockLog: mockLog,
  spyLog: spyLog,
  mockMailer: mockObject(MAILER_METHOD_NAMES),
  mockMetricsContext: mockObject(METRICS_CONTEXT_METHOD_NAMES),
  mockPush: mockObject(PUSH_METHOD_NAMES),
  mockRequest: mockRequest
}

function mockDB (data, errors) {
  data = data || {}
  errors = errors || {}

  return mockObject(DB_METHOD_NAMES)({
    account: sinon.spy(function () {
      return P.resolve({
        email: data.email,
        uid: data.uid,
        verifierSetAt: Date.now()
      })
    }),
    createAccount: sinon.spy(function () {
      return P.resolve({
        uid: data.uid,
        email: data.email,
        emailVerified: data.emailVerified
      })
    }),
    createDevice: sinon.spy(function () {
      return P.resolve(Object.keys(data.device).reduce(function (result, key) {
        result[key] = data.device[key]
        return result
      }, {
        id: data.deviceId,
        createdAt: data.deviceCreatedAt
      }))
    }),
    createKeyFetchToken: sinon.spy(function () {
      return P.resolve({
        data: crypto.randomBytes(32)
      })
    }),
    createSessionToken: sinon.spy(function () {
      return P.resolve({
        data: crypto.randomBytes(32),
        email: data.email,
        emailVerified: data.emailVerified,
        lastAuthAt: function () {
          return Date.now()
        },
        tokenVerificationId: data.tokenVerificationId,
        tokenVerified: ! data.tokenVerificationId,
        uid: data.uid
      })
    }),
    emailRecord: sinon.spy(function () {
      if (errors.emailRecord) {
        return P.reject(errors.emailRecord)
      }
      return P.resolve({
        authSalt: crypto.randomBytes(32),
        data: crypto.randomBytes(32),
        email: data.email,
        emailVerified: data.emailVerified,
        kA: crypto.randomBytes(32),
        lastAuthAt: function () {
          return Date.now()
        },
        uid: data.uid,
        wrapWrapKb: crypto.randomBytes(32)
      })
    }),
    sessions: sinon.spy(function () {
      return P.resolve([])
    }),
    updateDevice: sinon.spy(function (uid, sessionTokenId, device) {
      return P.resolve(device)
    })
  })
}

function mockObject (methodNames) {
  return function (methods) {
    return methodNames.reduce(function (object, name) {
      object[name] = methods && methods[name] || sinon.spy(function () {
        return P.resolve()
      })

      return object
    }, {})
  }
}

// A logging mock that doesn't capture anything.
// You can pass in an object of custom logging methods
// if you need to e.g. make assertions about logged values.
function mockLog (methods) {
  var log = extend({}, methods)
  LOG_METHOD_NAMES.forEach(function(name) {
    if (!log[name]) {
      log[name] = function() {}
    }
  })
  return log
}

// A logging mock where all logging methods are sinon spys,
// and we capture a log of all their calls in order.
function spyLog (methods) {
  methods = extend({}, methods)
  methods.messages = methods.messages || []
  LOG_METHOD_NAMES.forEach(function(name) {
    if (!methods[name]) {
      methods[name] = function() {
        this.messages.push({
          level: name,
          args: Array.prototype.slice.call(arguments)
        })
      }
    }
    methods[name] = sinon.spy(methods[name])
  })
  return mockLog(methods)
}

function mockRequest (data) {
  return {
    app: {
      acceptLangage: 'en-US'
    },
    auth: {
      credentials: data.credentials
    },
    headers: {
      'user-agent': 'test user-agent'
    },
    query: data.query,
    payload: data.payload
  }
}


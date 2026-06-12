"use strict";

var assert = require("assert");
var CloudState = require("../js/cloud-state");

var calls = [];
var loginCalled = false;
var initCalled = false;
var remoteState = {
  levelIndex: 1,
  score: 120,
  movesLeft: 6,
  board: [],
  goals: [],
  phase: "playing",
  message: "remote"
};

var mockWx = {
  login: function (options) {
    loginCalled = true;
    options.success({ code: "login-code" });
  },
  cloud: {
    init: function (options) {
      initCalled = options && options.traceUser === true;
    },
    callFunction: function (options) {
      calls.push(options);
      if (options.data.action === "load") {
        options.success({ result: { ok: true, openid: "openid-1", state: remoteState } });
      } else {
        options.success({ result: { ok: true, openid: "openid-1", saved: true } });
      }
    }
  }
};

var sanitized = 0;
var service = CloudState.create({
  wx: mockWx,
  gameId: "wechat-mini-arcade",
  storageKey: "garden-state",
  sanitize: function (state) {
    sanitized += 1;
    return state;
  }
});

var loaded = null;
assert.strictEqual(service.start(function (state) {
  loaded = state;
}), true, "cloud service should start when wx.cloud is available");

assert.strictEqual(loginCalled, true, "wx.login should be called");
assert.strictEqual(initCalled, true, "wx.cloud.init should enable traceUser");
assert.deepStrictEqual(loaded, remoteState, "remote state should be returned to the runtime");
assert.strictEqual(calls[0].name, "playerState");
assert.strictEqual(calls[0].data.action, "load");
assert.strictEqual(calls[0].data.gameId, "wechat-mini-arcade");

assert.strictEqual(service.save(remoteState), true, "save should call the cloud function");
assert.strictEqual(calls[1].data.action, "save");
assert.deepStrictEqual(calls[1].data.payload.state, remoteState);

var status = service.getStatus();
assert.strictEqual(status.mode, "cloud");
assert.strictEqual(status.loggedIn, true);
assert.strictEqual(status.loginCode, "login-code");
assert.strictEqual(status.openid, "openid-1");
assert.ok(status.lastSyncAt >= 0);
assert.ok(sanitized >= 2, "load and save should sanitize state");

var localOnly = CloudState.create({ wx: {}, gameId: "offline" });
assert.strictEqual(localOnly.start(function () {}), false, "missing cloud API should keep local mode");
assert.strictEqual(localOnly.getStatus().mode, "local");

console.log("cloud state tests passed");

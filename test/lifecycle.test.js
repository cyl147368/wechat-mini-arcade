"use strict";

var assert = require("assert");
var callbacks = {};
var storage = {};
var frameHandlers = [];
var systemInfo = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };

function noop() {}
function makeContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "middle",
    font: "",
    lineCap: "butt",
    lineJoin: "miter",
    createLinearGradient: function () {
      return { addColorStop: noop };
    },
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arcTo: noop,
    arc: noop,
    setTransform: noop,
    fill: noop,
    stroke: noop,
    fillText: noop
  };
}

delete global.requestAnimationFrame;
global.wx = {
  createCanvas: function () {
    return {
      width: systemInfo.windowWidth,
      height: systemInfo.windowHeight,
      getContext: function () {
        return makeContext();
      }
    };
  },
  requestAnimationFrame: function (handler) {
    frameHandlers.push(handler);
    return frameHandlers.length;
  },
  getSystemInfoSync: function () {
    return systemInfo;
  },
  getStorageSync: function (key) {
    return storage[key] || 0;
  },
  setStorageSync: function (key, value) {
    storage[key] = value;
  },
  onTouchStart: function (handler) {
    callbacks.start = handler;
  },
  onTouchMove: function (handler) {
    callbacks.move = handler;
  },
  onTouchEnd: function (handler) {
    callbacks.end = handler;
  },
  onTouchCancel: function (handler) {
    callbacks.cancel = handler;
  },
  onWindowResize: function (handler) {
    callbacks.resize = handler;
  },
  onHide: function (handler) {
    callbacks.hide = handler;
  },
  onShow: function (handler) {
    callbacks.show = handler;
  }
};

var gameModule = require("../game.js");
var app = gameModule.app;
assert.ok(app);
assert.strictEqual(frameHandlers.length, 1, "wx.requestAnimationFrame should be used when available");

app.runAction("play:merge");
app.merge.score = 128;
callbacks.hide();
assert.strictEqual(app.paused, true);
assert.strictEqual(storage.arcade_best_merge, 128);

app.runAction("play:dodge");
app.dodge.score = 10;
var scoreBefore = app.dodge.score;
app.loop(10000);
assert.strictEqual(app.dodge.score, scoreBefore, "paused app should not update gameplay timers");

systemInfo = { windowWidth: 430, windowHeight: 932, pixelRatio: 3 };
callbacks.show();
assert.strictEqual(app.paused, false);
assert.strictEqual(app.lastTime, 0);
assert.strictEqual(app.width, 430);
assert.strictEqual(app.height, 932);
assert.strictEqual(app.canvas.width, 1290);
assert.strictEqual(app.canvas.height, 2796);

console.log("lifecycle tests passed");

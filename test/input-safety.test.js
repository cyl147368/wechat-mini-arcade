"use strict";

var assert = require("assert");
var callbacks = {};
var storage = {
  arcade_best_merge: "-20",
  arcade_best_snake: "12.9",
  arcade_best_dodge: "not-a-score"
};
var drawCalls = 0;
var systemInfo = { windowWidth: "wide", windowHeight: {}, pixelRatio: "sharp" };

function noop() {}
function drawCall() {
  drawCalls += 1;
}

function makeContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    font: "",
    lineCap: "butt",
    lineJoin: "miter",
    createLinearGradient: function () {
      return { addColorStop: noop };
    },
    measureText: function (value) {
      return { width: String(value).length * 8 };
    },
    fillRect: drawCall,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arcTo: noop,
    arc: noop,
    setTransform: noop,
    fill: drawCall,
    stroke: drawCall,
    fillText: drawCall
  };
}

global.requestAnimationFrame = function () {
  return 1;
};

global.wx = {
  createCanvas: function () {
    return {
      width: 375,
      height: 667,
      getContext: function () {
        return makeContext();
      }
    };
  },
  getSystemInfoSync: function () {
    return systemInfo;
  },
  getStorageSync: function (key) {
    return storage[key];
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
assert.strictEqual(app.width, 375);
assert.strictEqual(app.height, 667);
assert.strictEqual(app.pixelRatio, 1);
assert.deepStrictEqual(app.best, { merge: 0, snake: 12, dodge: 0 });

callbacks.start({ touches: [{ clientX: Infinity, clientY: 100 }] });
assert.strictEqual(app.touchStart, null);
callbacks.start({ touches: [null] });
assert.strictEqual(app.touchStart, null);
callbacks.start({ touches: [{ clientX: "150", clientY: "200" }] });
assert.deepStrictEqual(app.touchStart.x, 150);
assert.deepStrictEqual(app.touchStart.y, 200);
callbacks.end({ changedTouches: [{ clientX: "bad", clientY: 220 }] });
assert.strictEqual(app.touchStart, null);

app.writeBest("unknown", 999);
assert.strictEqual(app.best.unknown, undefined);
app.writeBest("merge", -1);
assert.strictEqual(app.best.merge, 0);
app.writeBest("merge", 10.8);
assert.strictEqual(app.best.merge, 10);
assert.strictEqual(storage.arcade_best_merge, 10);

systemInfo = { windowWidth: "320.9", windowHeight: "519.1", pixelRatio: "9" };
callbacks.resize();
assert.strictEqual(app.width, 320);
assert.strictEqual(app.height, 520);
assert.strictEqual(app.pixelRatio, 3);
app.draw();

app.runAction("play:dodge");
app.lastTime = 1000;
var scoreBeforeBadFrame = app.dodge.score;
app.loop("bad-frame-time");
assert.strictEqual(app.lastTime, 1000);
assert.strictEqual(app.dodge.score, scoreBeforeBadFrame);

var minimal = new gameModule.ArcadeApp({
  createCanvas: global.wx.createCanvas,
  getSystemInfoSync: function () {
    return { windowWidth: 360, windowHeight: 640, pixelRatio: 2 };
  },
  getStorageSync: function () {
    return 0;
  },
  setStorageSync: noop
});
minimal.draw();
assert.strictEqual(minimal.width, 360);
assert.strictEqual(minimal.height, 640);

assert.ok(drawCalls > 20, "expected drawing after input safety checks");
console.log("input safety tests passed");

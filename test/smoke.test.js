"use strict";

var assert = require("assert");
var callbacks = {};
var storage = {};
var drawCalls = 0;
var transformCalls = 0;

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
    createLinearGradient: function () {
      return { addColorStop: noop };
    },
    fillRect: drawCall,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arcTo: noop,
    arc: noop,
    setTransform: function () {
      transformCalls += 1;
    },
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
    return { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };
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
  }
};

var gameModule = require("../game.js");
assert.ok(gameModule.app);
assert.strictEqual(typeof gameModule.ArcadeApp, "function");

var app = gameModule.app;
assert.strictEqual(app.pixelRatio, 2);
assert.strictEqual(app.canvas.width, 750);
assert.strictEqual(app.canvas.height, 1334);
assert.ok(transformCalls >= 1);
app.draw();
callbacks.start({ touches: [{ clientX: 180, clientY: 176 }] });
callbacks.end({ changedTouches: [{ clientX: 180, clientY: 176 }] });
assert.strictEqual(app.current, "merge");
assert.strictEqual(app.scene, "game");

app.runAction("play:merge");
app.draw();
app.handleSwipe("left");
app.draw();

app.runAction("play:snake");
app.handleSwipe("up");
app.snake.update(0.2);
app.draw();

app.runAction("play:dodge");
app.onTouchStart({ touches: [{ clientX: 100, clientY: 500 }] });
app.onTouchMove({ touches: [{ clientX: 230, clientY: 500 }] });
app.dodge.update(0.2);
app.draw();

app.runAction("menu");
app.draw();

assert.ok(callbacks.start);
assert.ok(callbacks.end);
assert.ok(drawCalls > 200, "expected non-trivial canvas drawing");
console.log("wechat smoke test passed");

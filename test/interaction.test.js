"use strict";

var assert = require("assert");
var callbacks = {};
var storage = {};
var frames = [];
var drawCalls = 0;
var scaleCalls = [];
var systemInfo = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };

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
    scale: function (x, y) {
      scaleCalls.push({ x: x, y: y });
    },
    fill: drawCall,
    stroke: drawCall,
    fillText: drawCall
  };
}

global.requestAnimationFrame = function (handler) {
  frames.push(handler);
  return frames.length;
};

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
  }
};

function tap(x, y) {
  callbacks.start({ touches: [{ clientX: x, clientY: y }] });
  callbacks.end({ changedTouches: [{ clientX: x, clientY: y }] });
}

function swipe(x1, y1, x2, y2) {
  callbacks.start({ touches: [{ clientX: x1, clientY: y1 }] });
  callbacks.end({ changedTouches: [{ clientX: x2, clientY: y2 }] });
}

var gameModule = require("../game.js");
var app = gameModule.app;
assert.ok(app);
assert.strictEqual(app.scene, "menu");
assert.strictEqual(app.pixelRatio, 2);
assert.strictEqual(app.canvas.width, 750);
assert.strictEqual(app.canvas.height, 1334);
app.draw();
assert.ok(app.buttons.length >= 3);

tap(187, 176);
assert.strictEqual(app.current, "merge");
assert.strictEqual(app.scene, "game");
swipe(260, 360, 100, 360);
app.draw();
tap(37, 36);
assert.strictEqual(app.scene, "menu");
app.draw();

tap(187, 306);
assert.strictEqual(app.current, "snake");
swipe(200, 400, 200, 260);
app.snake.update(0.2);
app.draw();
tap(317, 36);
assert.strictEqual(app.snake.score, 0);
tap(37, 36);
assert.strictEqual(app.scene, "menu");
app.draw();

tap(187, 436);
assert.strictEqual(app.current, "dodge");
callbacks.move({ touches: [{ clientX: 300, clientY: 500 }] });
app.dodge.update(0.3);
app.draw();
tap(37, 36);
assert.strictEqual(app.scene, "menu");

app.runAction("play:unknown");
assert.strictEqual(app.scene, "menu");
assert.strictEqual(app.current, "");
app.handleSwipe("diagonal");
var bestBeforeNaN = app.best.merge;
app.writeBest("merge", NaN);
assert.strictEqual(app.best.merge, bestBeforeNaN);

systemInfo = { windowWidth: 320, windowHeight: 520, pixelRatio: 3 };
callbacks.resize();
assert.strictEqual(app.width, 320);
assert.strictEqual(app.height, 520);
assert.strictEqual(app.pixelRatio, 3);
assert.strictEqual(app.canvas.width, 960);
assert.strictEqual(app.canvas.height, 1560);
app.draw();
assert.ok(drawCalls > 300, "expected real drawing across interaction flow");
assert.ok(scaleCalls.length >= 2, "expected canvas scale adjustment");
assert.deepStrictEqual(scaleCalls[0], { x: 2, y: 2 });
assert.deepStrictEqual(scaleCalls[scaleCalls.length - 1], { x: 3, y: 3 });
assert.ok(frames.length >= 1, "expected animation frame scheduling");
console.log("interaction tests passed");

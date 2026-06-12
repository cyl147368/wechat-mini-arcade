"use strict";

var assert = require("assert");
var callbacks = {};
var drawCalls = 0;
var systemInfo = { windowWidth: 360, windowHeight: 640, pixelRatio: 2 };

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
    textBaseline: "middle",
    font: "",
    lineCap: "butt",
    lineJoin: "miter",
    fillRect: drawCall,
    strokeRect: drawCall,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
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
  getStorageSync: function () {
    return 0;
  },
  setStorageSync: noop,
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

app.draw();
app.runAction("play:merge");
app.merge.board = [
  [2, 4, 8, 16],
  [32, 64, 128, 256],
  [512, 1024, 2048, 0],
  [0, 0, 0, 0]
];
app.draw();

app.runAction("play:snake");
app.snake.food = { x: 6, y: 6 };
app.draw();

app.runAction("play:dodge");
app.dodge.objects = [
  { x: 80, y: 120, w: 24, h: 24, vy: 120, type: "star", hit: false },
  { x: 160, y: 180, w: 42, h: 42, vy: 160, type: "block", hit: false }
];
app.draw();

assert.strictEqual(app.width, 360);
assert.strictEqual(app.height, 640);
assert.ok(drawCalls > 120, "fallback canvas should still draw non-empty screens");
console.log("canvas compatibility tests passed");

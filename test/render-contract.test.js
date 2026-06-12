"use strict";

var assert = require("assert");
var callbacks = {};
var textCalls = [];
var fillCalls = [];
var strokeCalls = 0;
var arcCalls = 0;
var pathFills = 0;
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
    measureText: function (value) {
      return { width: String(value).length * 8 };
    },
    fillRect: function (x, y, w, h) {
      fillCalls.push({ type: "rect", color: this.fillStyle, x: x, y: y, w: w, h: h });
    },
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arcTo: noop,
    arc: function () {
      arcCalls += 1;
    },
    setTransform: noop,
    fill: function () {
      pathFills += 1;
      fillCalls.push({ type: "path", color: this.fillStyle });
    },
    stroke: function () {
      strokeCalls += 1;
    },
    fillText: function (value, x, y, maxWidth) {
      textCalls.push({ value: String(value), x: x, y: y, maxWidth: maxWidth, color: this.fillStyle });
    }
  };
}

function resetCapture() {
  textCalls = [];
  fillCalls = [];
  strokeCalls = 0;
  arcCalls = 0;
  pathFills = 0;
}

function hasText(value) {
  return textCalls.some(function (call) {
    return call.value === value;
  });
}

function hasTextPrefix(prefix) {
  return textCalls.some(function (call) {
    return call.value.indexOf(prefix) === 0;
  });
}

function hasColor(color) {
  return fillCalls.some(function (call) {
    return call.color === color;
  });
}

function assertCommonDrawing(label) {
  assert.ok(fillCalls.length > 0, label + " should draw filled shapes");
  assert.ok(strokeCalls > 0, label + " should draw strokes");
  assert.ok(textCalls.length > 0, label + " should draw text");
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

resetCapture();
app.draw();
assertCommonDrawing("menu");
assert.ok(hasText("小游戏精选"));
assert.ok(hasText("3 款热门轻休闲"));
assert.ok(hasText("合成 2048"));
assert.ok(hasText("霓虹贪吃蛇"));
assert.ok(hasText("极速躲避"));
assert.ok(app.buttons.some(function (button) { return button.action === "play:merge"; }));
assert.ok(app.buttons.some(function (button) { return button.action === "play:snake"; }));
assert.ok(app.buttons.some(function (button) { return button.action === "play:dodge"; }));

app.runAction("play:merge");
app.merge.board = [
  [2, 4, 8, 16],
  [32, 64, 128, 256],
  [512, 1024, 2048, 0],
  [0, 0, 0, 0]
];
app.merge.score = 4096;
app.merge.moves = 12;
app.merge.won = true;
resetCapture();
app.draw();
assertCommonDrawing("merge");
assert.ok(hasText("合成 2048"));
assert.ok(hasTextPrefix("分数 4096"));
assert.ok(hasText("2048"));
assert.ok(hasColor("#334155"));
assert.ok(hasColor("#8b5cf6"));
assert.ok(app.buttons.some(function (button) { return button.action === "menu"; }));
assert.ok(app.buttons.some(function (button) { return button.action === "restart"; }));

app.merge.over = true;
resetCapture();
app.draw();
assertCommonDrawing("merge overlay");
assert.ok(hasText("本局结束"));
assert.ok(hasTextPrefix("分数 4096"));
assert.ok(hasText("再来"));
assert.ok(hasText("菜单"));

app.runAction("play:snake");
app.snake.snake = [
  { x: 4, y: 4 },
  { x: 3, y: 4 },
  { x: 2, y: 4 },
  { x: 1, y: 4 }
];
app.snake.food = { x: 7, y: 6 };
app.snake.score = 30;
resetCapture();
app.draw();
assertCommonDrawing("snake");
assert.ok(hasText("霓虹贪吃蛇"));
assert.ok(hasTextPrefix("分数 30"));
assert.ok(hasText("长度 4"));
assert.ok(arcCalls >= 1, "snake should draw food as an arc");
assert.ok(hasColor("#22d3ee"));
assert.ok(hasColor("#facc15"));

app.runAction("play:dodge");
app.dodge.objects = [
  { x: 80, y: 120, w: 24, h: 24, vy: 120, type: "star", hit: false },
  { x: 160, y: 180, w: 42, h: 42, vy: 160, type: "block", hit: false }
];
app.dodge.score = 55;
app.dodge.lives = 2;
resetCapture();
app.draw();
assertCommonDrawing("dodge");
assert.ok(hasText("极速躲避"));
assert.ok(hasTextPrefix("分数 55"));
assert.ok(hasText("+"));
assert.ok(hasColor("#fb7185"));
assert.ok(hasColor("#38bdf8"));
assert.ok(pathFills >= 3, "dodge should draw path-based obstacle, player and UI shapes");

console.log("render contract tests passed");

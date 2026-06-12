"use strict";

var assert = require("assert");
var callbacks = {};
var textCalls = [];
var drawCalls = 0;
var systemInfo = { windowWidth: 320, windowHeight: 520, pixelRatio: 3 };

function noop() {}

function parseSize(font) {
  var match = / ([0-9]+)px /.exec(font || "");
  return match ? Number(match[1]) : 12;
}

function estimateWidth(value, size) {
  var text = String(value);
  var width = 0;
  for (var i = 0; i < text.length; i += 1) {
    var code = text.charCodeAt(i);
    if (text.charAt(i) === " ") width += size * 0.34;
    else if (code > 255) width += size;
    else width += size * 0.58;
  }
  return width;
}

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
    createLinearGradient: function () {
      return { addColorStop: noop };
    },
    measureText: function (value) {
      return { width: estimateWidth(value, parseSize(this.font)) };
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
    fillText: function (value, x, y, maxWidth) {
      textCalls.push({
        value: String(value),
        x: x,
        y: y,
        maxWidth: maxWidth,
        align: this.textAlign,
        font: this.font
      });
      drawCall();
    }
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

function assertTextFits(app, label) {
  textCalls.forEach(function (call) {
    var size = parseSize(call.font);
    var width = call.maxWidth || estimateWidth(call.value, size);
    assert.ok(call.y - size / 2 >= -1, label + " text above screen: " + call.value);
    assert.ok(call.y + size / 2 <= app.height + 1, label + " text below screen: " + call.value);
    if (call.align === "center") {
      assert.ok(call.x - width / 2 >= -1, label + " text outside left: " + call.value);
      assert.ok(call.x + width / 2 <= app.width + 1, label + " text outside right: " + call.value);
    } else if (call.align === "left") {
      assert.ok(call.x >= -1, label + " text starts outside left: " + call.value);
      assert.ok(call.x + width <= app.width + 1, label + " text ends outside right: " + call.value);
    }
  });
}

function drawAndAssert(app, label) {
  textCalls = [];
  app.draw();
  assert.ok(textCalls.length > 0, label + " should draw text");
  assertTextFits(app, label);
}

var gameModule = require("../game.js");
var app = gameModule.app;
var screens = [
  { windowWidth: 320, windowHeight: 520, pixelRatio: 3 },
  { windowWidth: 375, windowHeight: 667, pixelRatio: 2 },
  { windowWidth: 430, windowHeight: 932, pixelRatio: 3 }
];

screens.forEach(function (screen) {
  systemInfo = screen;
  callbacks.resize();
  app.runAction("menu");
  drawAndAssert(app, "menu " + screen.windowWidth);
  app.runAction("play:merge");
  drawAndAssert(app, "merge " + screen.windowWidth);
  app.runAction("play:snake");
  drawAndAssert(app, "snake " + screen.windowWidth);
  app.runAction("play:dodge");
  app.dodge.score = 123456;
  app.best.dodge = 999999;
  drawAndAssert(app, "dodge " + screen.windowWidth);
});

assert.ok(drawCalls > 700, "expected substantial drawing during text fit checks");
console.log("text fit tests passed");

"use strict";

var assert = require("assert");
var callbacks = {};
var drawCalls = 0;
var frameCount = 0;
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
    lineCap: "butt",
    lineJoin: "miter",
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
    setTransform: noop,
    fill: drawCall,
    stroke: drawCall,
    fillText: drawCall
  };
}

global.requestAnimationFrame = function () {
  frameCount += 1;
  return frameCount;
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
  }
};

function assertButtonsInside(app, label) {
  assert.ok(app.buttons.length > 0, label + " should expose touch targets");
  app.buttons.forEach(function (button) {
    assert.ok(button.w >= 40, label + " button too narrow");
    assert.ok(button.h >= 36, label + " button too short");
    assert.ok(button.x >= 0, label + " button outside left");
    assert.ok(button.y >= 0, label + " button outside top");
    assert.ok(button.x + button.w <= app.width, label + " button outside right");
    assert.ok(button.y + button.h <= app.height, label + " button outside bottom");
  });
}

function tapAtButton(app, action) {
  var found = null;
  app.buttons.forEach(function (button) {
    if (!found && button.action === action) found = button;
  });
  assert.ok(found, "missing action " + action);
  callbacks.start({ touches: [{ clientX: found.x + found.w / 2, clientY: found.y + found.h / 2 }] });
  callbacks.end({ changedTouches: [{ clientX: found.x + found.w / 2, clientY: found.y + found.h / 2 }] });
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
  assert.strictEqual(app.width, screen.windowWidth);
  assert.strictEqual(app.height, screen.windowHeight);
  assert.strictEqual(app.canvas.width, screen.windowWidth * screen.pixelRatio);
  assert.strictEqual(app.canvas.height, screen.windowHeight * screen.pixelRatio);

  app.runAction("menu");
  app.draw();
  assertButtonsInside(app, "menu " + screen.windowWidth);
  tapAtButton(app, "play:merge");
  app.draw();
  assert.strictEqual(app.current, "merge");
  assertButtonsInside(app, "merge " + screen.windowWidth);

  app.runAction("menu");
  app.draw();
  tapAtButton(app, "play:snake");
  app.draw();
  assert.strictEqual(app.current, "snake");
  assertButtonsInside(app, "snake " + screen.windowWidth);

  app.runAction("menu");
  app.draw();
  tapAtButton(app, "play:dodge");
  app.draw();
  assert.strictEqual(app.current, "dodge");
  assertButtonsInside(app, "dodge " + screen.windowWidth);
});

assert.ok(drawCalls > 500, "expected substantial drawing across screen sizes");
console.log("layout tests passed");

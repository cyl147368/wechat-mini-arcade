"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var releaseDir = path.resolve(root, "..", "wechat-mini-arcade-release");
var callbacks = {};
var storage = {};
var frames = [];
var drawCalls = 0;
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
    textBaseline: "middle",
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

function tap(x, y) {
  callbacks.start({ touches: [{ clientX: x, clientY: y }] });
  callbacks.end({ changedTouches: [{ clientX: x, clientY: y }] });
}

function swipe(x1, y1, x2, y2) {
  callbacks.start({ touches: [{ clientX: x1, clientY: y1 }] });
  callbacks.end({ changedTouches: [{ clientX: x2, clientY: y2 }] });
}

function runFrame(timestamp) {
  var handler = frames.shift();
  assert.strictEqual(typeof handler, "function", "missing animation frame handler");
  handler(timestamp);
  assert.ok(frames.length <= 1, "runtime should schedule one steady animation frame");
}

function assertOnlyInternalRequires(source) {
  var requirePattern = /require\((["'])(.*?)\1\)/g;
  var match = null;
  var count = 0;
  var allowed = {
    "./js/logic.js": true,
    "./js/cloud-state.js": true
  };
  while ((match = requirePattern.exec(source))) {
    count += 1;
    assert.ok(allowed[match[2]], "unexpected release require: " + match[2]);
    assert.ok(fs.existsSync(path.join(releaseDir, match[2])), "required file missing from release");
  }
  assert.strictEqual(count, 2, "release should have exactly two local runtime requires");
}

function assertButtonsInside(app) {
  app.buttons.forEach(function (button) {
    assert.ok(button.x >= 0, "button outside left edge");
    assert.ok(button.y >= 0, "button outside top edge");
    assert.ok(button.x + button.w <= app.width, "button outside right edge");
    assert.ok(button.y + button.h <= app.height, "button outside bottom edge");
  });
}

function tapAction(app, action) {
  var found = null;
  app.buttons.forEach(function (button) {
    if (!found && button.action === action) found = button;
  });
  assert.ok(found, "missing touch action " + action);
  tap(found.x + found.w / 2, found.y + found.h / 2);
}

var gameSource = fs.readFileSync(path.join(releaseDir, "game.js"), "utf8");
var logicSource = fs.readFileSync(path.join(releaseDir, "js", "logic.js"), "utf8");
var projectConfig = JSON.parse(fs.readFileSync(path.join(releaseDir, "project.config.json"), "utf8"));
var gameConfig = JSON.parse(fs.readFileSync(path.join(releaseDir, "game.json"), "utf8"));
var runtimeSource = gameSource + "\n" + logicSource;

assert.strictEqual(projectConfig.compileType, "game");
assert.strictEqual(projectConfig.appid, "touristappid");
assert.strictEqual(projectConfig.cloudfunctionRoot, "cloudfunctions/");
assert.strictEqual(gameConfig.deviceOrientation, "portrait");
assert.ok(!/https?:\/\//.test(runtimeSource), "release runtime should not depend on remote assets");
assert.ok(!/\b(document|window|localStorage|fetch|XMLHttpRequest)\b/.test(runtimeSource), "release runtime should avoid browser-only APIs");
assertOnlyInternalRequires(gameSource);

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
    frames.push(handler);
    return frames.length;
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

var releaseGame = require(path.join(releaseDir, "game.js"));
var app = releaseGame.app;
assert.ok(app, "release should create an app in a wx game runtime");
assert.strictEqual(frames.length, 1, "release should use wx.requestAnimationFrame");

app.draw();
assertButtonsInside(app);
tapAction(app, "play:merge");
assert.strictEqual(app.current, "merge");
swipe(260, 360, 100, 360);
runFrame(16);
assertButtonsInside(app);
tapAction(app, "menu");
assert.strictEqual(app.scene, "menu");

app.draw();
tapAction(app, "play:snake");
assert.strictEqual(app.current, "snake");
swipe(200, 400, 200, 260);
for (var i = 0; i < 10; i += 1) runFrame(32 + i * 16);
assertButtonsInside(app);
tapAction(app, "menu");
assert.strictEqual(app.scene, "menu");

app.draw();
tapAction(app, "play:dodge");
assert.strictEqual(app.current, "dodge");
for (var j = 0; j < 60; j += 1) {
  callbacks.move({ touches: [{ clientX: 80 + (j % 240), clientY: 500 }] });
  runFrame(240 + j * 16);
}
assert.ok(isFinite(app.dodge.score), "dodge score should remain finite");
assertButtonsInside(app);

app.dodge.score = 42;
callbacks.hide();
assert.strictEqual(app.paused, true);
assert.strictEqual(storage.arcade_best_dodge, 42);
systemInfo = { windowWidth: 430, windowHeight: 932, pixelRatio: 3 };
callbacks.show();
assert.strictEqual(app.paused, false);
assert.strictEqual(app.canvas.width, 1290);
assert.strictEqual(app.canvas.height, 2796);
app.draw();
assertButtonsInside(app);

systemInfo = { windowWidth: 320, windowHeight: 520, pixelRatio: 3 };
callbacks.resize();
app.runAction("menu");
app.draw();
assertButtonsInside(app);
assert.ok(drawCalls > 700, "release should draw non-empty screens through DevTools flow");

console.log("release devtools compatibility tests passed");

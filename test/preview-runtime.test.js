"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.resolve(__dirname, "..");
var previewDir = path.join(root, "preview");
var html = fs.readFileSync(path.join(previewDir, "index.html"), "utf8");
var canvasHandlers = {};
var windowHandlers = {};
var toolbarHandlers = {};
var drawCalls = 0;
var textCalls = [];
var frameHandlers = [];

function noop() {}

function makeContext2d() {
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
    fillRect: function () {
      drawCalls += 1;
    },
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arcTo: noop,
    arc: noop,
    setTransform: noop,
    fill: function () {
      drawCalls += 1;
    },
    stroke: function () {
      drawCalls += 1;
    },
    fillText: function (value) {
      textCalls.push(String(value));
      drawCalls += 1;
    }
  };
}

var canvas = {
  width: 0,
  height: 0,
  getContext: function (type) {
    assert.strictEqual(type, "2d");
    return makeContext2d();
  },
  getBoundingClientRect: function () {
    return { left: 0, top: 0 };
  },
  addEventListener: function (type, handler) {
    canvasHandlers[type] = handler;
  },
  setPointerCapture: noop
};

var toolbar = {
  addEventListener: function (type, handler) {
    toolbarHandlers[type] = handler;
  }
};

var document = {
  getElementById: function (id) {
    if (id === "stage") return canvas;
    if (id === "toolbar") return toolbar;
    return null;
  }
};

var sandbox = {
  console: console,
  document: document,
  innerWidth: 375,
  innerHeight: 667,
  devicePixelRatio: 2,
  requestAnimationFrame: function (handler) {
    frameHandlers.push(handler);
    return frameHandlers.length;
  },
  setTimeout: function (handler) {
    frameHandlers.push(handler);
    return frameHandlers.length;
  },
  addEventListener: function (type, handler) {
    windowHandlers[type] = handler;
  },
  Error: Error,
  Math: Math,
  Date: Date,
  Number: Number,
  String: String,
  isFinite: isFinite
};
sandbox.window = sandbox;

function runScript(code, filename) {
  vm.runInNewContext(code, sandbox, { filename: filename });
}

var scriptPattern = /<script(?:\s+src="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g;
var match = null;
var scripts = 0;
while ((match = scriptPattern.exec(html))) {
  scripts += 1;
  if (match[1]) {
    var scriptPath = path.resolve(previewDir, match[1]);
    runScript(fs.readFileSync(scriptPath, "utf8"), scriptPath);
  } else {
    runScript(match[2], "preview-inline-" + scripts + ".js");
  }
}

assert.ok(sandbox.__arcadeApp, "preview should expose a running app");
assert.strictEqual(sandbox.__arcadeApp.scene, "menu");
assert.strictEqual(typeof toolbarHandlers.click, "function");
assert.strictEqual(typeof canvasHandlers.pointerdown, "function");
assert.strictEqual(typeof canvasHandlers.pointermove, "function");
assert.strictEqual(typeof canvasHandlers.pointerup, "function");
assert.strictEqual(typeof canvasHandlers.pointercancel, "function");
assert.strictEqual(typeof windowHandlers.resize, "function");
assert.strictEqual(typeof windowHandlers.blur, "function");
assert.strictEqual(typeof windowHandlers.focus, "function");

sandbox.__arcadeApp.draw();
assert.ok(textCalls.indexOf("小游戏精选") >= 0);
assert.ok(drawCalls > 20, "preview should draw a non-empty menu");

function clickToolbar(action) {
  toolbarHandlers.click({
    target: {
      getAttribute: function (name) {
        return name === "data-action" ? action : null;
      }
    }
  });
}

clickToolbar("play:merge");
assert.strictEqual(sandbox.__arcadeApp.current, "merge");
clickToolbar("play:snake");
assert.strictEqual(sandbox.__arcadeApp.current, "snake");
clickToolbar("play:dodge");
assert.strictEqual(sandbox.__arcadeApp.current, "dodge");

canvasHandlers.pointerdown({ pointerId: 1, clientX: 120, clientY: 500 });
canvasHandlers.pointermove({ pointerId: 1, clientX: 240, clientY: 500 });
assert.ok(sandbox.__arcadeApp.dodge.player.x > 120);
canvasHandlers.pointercancel({ pointerId: 1 });
assert.strictEqual(sandbox.__arcadeApp.touchStart, null);
canvasHandlers.pointerdown({ pointerId: 1, clientX: 120, clientY: 500 });
canvasHandlers.pointerup({ pointerId: 1, clientX: 240, clientY: 500 });

sandbox.innerWidth = 430;
sandbox.innerHeight = 932;
windowHandlers.resize();
assert.strictEqual(sandbox.__arcadeApp.width, 430);
assert.strictEqual(sandbox.__arcadeApp.height, 932);

sandbox.__arcadeApp.dodge.score = 33;
windowHandlers.blur();
assert.strictEqual(sandbox.__arcadeApp.paused, true);
assert.strictEqual(sandbox.wx.getStorageSync("arcade_best_dodge"), 33);
windowHandlers.focus();
assert.strictEqual(sandbox.__arcadeApp.paused, false);
assert.strictEqual(sandbox.__arcadeApp.width, 430);

assert.ok(frameHandlers.length >= 1, "preview should schedule animation frames");
console.log("preview runtime tests passed");

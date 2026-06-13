"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var releaseDir = path.resolve(root, "..", "wechat-mini-arcade-release");
var releaseZip = path.resolve(root, "..", "wechat-mini-arcade-release.zip");
var expectedFiles = [
  "app.json",
  "cloudfunctions/playerState/index.js",
  "cloudfunctions/playerState/package.json",
  "game.js",
  "game.json",
  "js/cloud-config.js",
  "js/cloud-state.js",
  "js/logic.js",
  "js/session-ui.js",
  "pages/index/index.js",
  "pages/index/index.json",
  "pages/index/index.wxml",
  "pages/index/index.wxss",
  "project.config.json"
];
var drawCalls = 0;

function noop() {}
function drawCall() {
  drawCalls += 1;
}

function walk(dir, files) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else files.push(path.relative(releaseDir, full).replace(/\\/g, "/"));
  });
}

assert.ok(fs.existsSync(releaseDir), "release directory missing");
assert.ok(fs.existsSync(releaseZip), "release zip missing");

var found = [];
walk(releaseDir, found);
assert.deepStrictEqual(found.sort(), expectedFiles.slice().sort());

var projectConfig = JSON.parse(fs.readFileSync(path.join(releaseDir, "project.config.json"), "utf8"));
var appConfig = JSON.parse(fs.readFileSync(path.join(releaseDir, "app.json"), "utf8"));
var gameConfig = JSON.parse(fs.readFileSync(path.join(releaseDir, "game.json"), "utf8"));
assert.strictEqual(projectConfig.compileType, "game");
assert.strictEqual(projectConfig.cloudfunctionRoot, "cloudfunctions/");
assert.deepStrictEqual(appConfig.pages, ["pages/index/index"]);
assert.strictEqual(appConfig.deviceOrientation, "portrait");
assert.strictEqual(appConfig.showStatusBar, false);
assert.strictEqual(gameConfig.deviceOrientation, "portrait");
assert.ok(fs.readFileSync(path.join(releaseDir, "game.js"), "utf8").indexOf("CloudState") !== -1);
assert.ok(fs.readFileSync(path.join(releaseDir, "js", "cloud-state.js"), "utf8").indexOf("wxApi.login") !== -1);
assert.ok(fs.readFileSync(path.join(releaseDir, "cloudfunctions", "playerState", "index.js"), "utf8").indexOf("OPENID") !== -1);

global.requestAnimationFrame = function () {
  return 1;
};
global.wx = {
  createCanvas: function () {
    return {
      width: 375,
      height: 667,
      getContext: function () {
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
    };
  },
  getSystemInfoSync: function () {
    return { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };
  },
  getStorageSync: function () {
    return 0;
  },
  setStorageSync: noop,
  onTouchStart: noop,
  onTouchMove: noop,
  onTouchEnd: noop,
  onTouchCancel: noop,
  onWindowResize: noop,
  onHide: noop
};

var releaseGame = require(path.join(releaseDir, "game.js"));
assert.ok(releaseGame.app);
releaseGame.app.draw();
assert.ok(drawCalls > 20, "release package should draw a non-empty menu");
console.log("release tests passed");

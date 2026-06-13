"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var requiredFiles = [
  "app.json",
  "cloudfunctions/playerState/index.js",
  "cloudfunctions/playerState/package.json",
  "game.js",
  "game.json",
  "project.config.json",
  "js/cloud-state.js",
  "js/logic.js",
  "pages/index/index.js",
  "pages/index/index.json",
  "pages/index/index.wxml",
  "pages/index/index.wxss"
];

requiredFiles.forEach(function (file) {
  assert.ok(fs.existsSync(path.join(root, file)), "missing " + file);
});

var projectConfig = JSON.parse(fs.readFileSync(path.join(root, "project.config.json"), "utf8"));
var appConfig = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
var gameConfig = JSON.parse(fs.readFileSync(path.join(root, "game.json"), "utf8"));

assert.strictEqual(projectConfig.compileType, "game");
assert.strictEqual(projectConfig.appid, "touristappid");
assert.strictEqual(projectConfig.cloudfunctionRoot, "cloudfunctions/");
assert.strictEqual(projectConfig.setting.es6, true);
assert.strictEqual(projectConfig.setting.packNpmManually, false);
assert.deepStrictEqual(appConfig.pages, ["pages/index/index"]);
assert.strictEqual(appConfig.deviceOrientation, "portrait");
assert.strictEqual(appConfig.showStatusBar, false);
assert.strictEqual(gameConfig.deviceOrientation, "portrait");
assert.strictEqual(gameConfig.showStatusBar, false);

var gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");
var logicSource = fs.readFileSync(path.join(root, "js/logic.js"), "utf8");
var runtimeSource = gameSource + "\n" + logicSource;

assert.ok(/wx\.createCanvas/.test(gameSource), "game.js must use wx.createCanvas");
assert.ok(/drawIconButton/.test(gameSource), "top bar controls should be icon-drawn buttons");
assert.ok(/pixelRatio/.test(gameSource), "game.js should account for device pixel ratio");
assert.ok(/setTransform|scale/.test(gameSource), "game.js should scale canvas drawing for high DPI screens");
assert.ok(/wx\.requestAnimationFrame/.test(gameSource), "game.js should prefer wx.requestAnimationFrame when present");
assert.ok(/onHide/.test(gameSource) && /onShow/.test(gameSource), "game.js should handle app lifecycle hooks");
assert.ok(/module\.exports/.test(gameSource), "game.js should expose a module for smoke tests");
assert.ok(/CloudState/.test(gameSource), "game.js should wire cloud state sync");
assert.ok(/module\.exports/.test(logicSource), "logic.js should expose gameplay logic");
assert.ok(!/WeChat Mini Game Canvas/.test(runtimeSource), "runtime should not show technical placeholder text");
assert.ok(!/https?:\/\//.test(runtimeSource), "runtime should not depend on remote assets");
assert.ok(!/\b(document|window|localStorage)\b/.test(runtimeSource), "runtime should avoid browser-only globals");
assert.ok(!/\b(const|let|class|async|await|Promise|Number\.isFinite)\b/.test(runtimeSource), "runtime should avoid newer syntax/APIs");

var requireMatches = runtimeSource.match(/require\((["'])(.*?)\1\)/g) || [];
requireMatches.forEach(function (call) {
  assert.ok(/require\((["'])\.\/js\/(?:logic|cloud-state|cloud-config|session-ui)(?:\.js)?\1\)/.test(call), "unexpected runtime require: " + call);
});

console.log("project tests passed");

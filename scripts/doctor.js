"use strict";

var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");

var root = path.resolve(__dirname, "..");
var releaseDir = path.resolve(root, "..", "wechat-mini-arcade-release");
var releaseZip = path.resolve(root, "..", "wechat-mini-arcade-release.zip");
var cliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
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
var warnings = [];

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(dir, base, files) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, base, files);
    else files.push(path.relative(base, full).replace(/\\/g, "/"));
  });
}

function assertEqualList(actual, expected) {
  var a = actual.slice().sort();
  var e = expected.slice().sort();
  if (a.length !== e.length) fail("release file count mismatch: " + a.join(", "));
  for (var i = 0; i < e.length; i += 1) {
    if (a[i] !== e[i]) fail("release file mismatch: expected " + e[i] + " got " + a[i]);
  }
}

function assertOnlyKnownRequires(source) {
  var requirePattern = /require\((["'])(.*?)\1\)/g;
  var match = null;
  var count = 0;
  var allowed = {
    "./js/logic.js": true,
    "./js/cloud-state.js": true,
    "./js/cloud-config": true,
    "./js/session-ui": true
  };
  while ((match = requirePattern.exec(source))) {
    count += 1;
    if (!allowed[match[2]]) fail("unexpected runtime require: " + match[2]);
    var requiredPath = path.join(releaseDir, match[2]);
    if (!fs.existsSync(requiredPath) && !/\.js$/.test(requiredPath)) requiredPath += ".js";
    if (!fs.existsSync(requiredPath)) fail("missing required release file: " + match[2]);
  }
  if (count !== 4) fail("expected exactly four runtime requires, found " + count);
}

function checkCli() {
  if (!fs.existsSync(cliPath)) {
    warnings.push("WeChat DevTools CLI was not found at " + cliPath);
    return;
  }
  try {
    fs.accessSync(cliPath, fs.constants.X_OK);
  } catch (error) {
    warnings.push("WeChat DevTools CLI exists but is not executable: " + cliPath);
  }
}

if (!fs.existsSync(releaseDir)) fail("release directory is missing: " + releaseDir);
if (!fs.existsSync(releaseZip)) fail("release zip is missing: " + releaseZip);

var files = [];
walk(releaseDir, releaseDir, files);
assertEqualList(files, expectedFiles);

expectedFiles.forEach(function (file) {
  var full = path.join(releaseDir, file);
  if (!fs.existsSync(full)) fail("missing release file: " + file);
});

childProcess.execFileSync(process.execPath, ["-c", path.join(releaseDir, "game.js")], { stdio: "ignore" });
childProcess.execFileSync(process.execPath, ["-c", path.join(releaseDir, "js", "logic.js")], { stdio: "ignore" });
childProcess.execFileSync("unzip", ["-t", releaseZip], { stdio: "ignore" });

var projectConfig = readJson(path.join(releaseDir, "project.config.json"));
var appConfig = readJson(path.join(releaseDir, "app.json"));
var gameConfig = readJson(path.join(releaseDir, "game.json"));
if (projectConfig.compileType !== "game") fail("project.config.json compileType must be game");
if (projectConfig.appid !== "touristappid") fail("project.config.json appid should be touristappid for direct import");
if (projectConfig.cloudfunctionRoot !== "cloudfunctions/") fail("project.config.json cloudfunctionRoot must point at cloudfunctions/");
if (!projectConfig.setting || projectConfig.setting.packNpmManually !== false) fail("release should not require npm packing");
if (!Array.isArray(appConfig.pages) || appConfig.pages[0] !== "pages/index/index") fail("app.json pages must include pages/index/index");
if (appConfig.deviceOrientation !== "portrait") fail("app.json deviceOrientation must be portrait");
if (appConfig.showStatusBar !== false) fail("app.json showStatusBar must be false");
if (gameConfig.deviceOrientation !== "portrait") fail("game.json deviceOrientation must be portrait");

var gameSource = fs.readFileSync(path.join(releaseDir, "game.js"), "utf8");
var cloudSource = fs.readFileSync(path.join(releaseDir, "js", "cloud-state.js"), "utf8");
var functionSource = fs.readFileSync(path.join(releaseDir, "cloudfunctions", "playerState", "index.js"), "utf8");
var logicSource = fs.readFileSync(path.join(releaseDir, "js", "logic.js"), "utf8");
var runtimeSource = gameSource + "\n" + logicSource;
assertOnlyKnownRequires(gameSource);
if (gameSource.indexOf("CloudState") === -1) fail("game.js should wire cloud state sync");
if (cloudSource.indexOf("wxApi.login") === -1) fail("cloud state should call wx.login");
if (cloudSource.indexOf("callFunction") === -1) fail("cloud state should call a cloud function");
if (functionSource.indexOf("OPENID") === -1) fail("cloud function should persist state by WeChat OPENID");
if (/https?:\/\//.test(runtimeSource)) fail("release runtime should not use remote assets");
if (/\b(document|window|localStorage|fetch|XMLHttpRequest)\b/.test(runtimeSource)) fail("release runtime should not use browser-only APIs");
if (/\b(const|let|class|async|await|Promise|Number\.isFinite)\b/.test(runtimeSource)) fail("release runtime should avoid newer syntax/APIs");
if (!/wx\.createCanvas/.test(gameSource)) fail("game.js should create the mini game canvas through wx.createCanvas");
if (!/wx\.requestAnimationFrame/.test(gameSource)) fail("game.js should prefer wx.requestAnimationFrame");
if (!/onHide/.test(gameSource) || !/onShow/.test(gameSource)) fail("game.js should handle lifecycle hooks");

checkCli();

console.log("doctor checks passed");
console.log("release project:", releaseDir);
console.log("release zip:", releaseZip);
console.log("open command:");
console.log(cliPath + " open --project " + releaseDir + " --port 9420 --lang zh");
warnings.forEach(function (warning) {
  console.log("warning:", warning);
});

"use strict";

var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseDir = path.join(outputRoot, "wechat-mini-arcade-release");
var releaseZip = path.join(outputRoot, "wechat-mini-arcade-release.zip");
var fullZip = path.join(outputRoot, "wechat-mini-arcade.zip");
var requiredReleaseFiles = [
  "app.json",
  "cloudfunctions/playerState/index.js",
  "cloudfunctions/playerState/package.json",
  "game.js",
  "game.json",
  "js/cloud-state.js",
  "js/logic.js",
  "pages/index/index.js",
  "pages/index/index.json",
  "pages/index/index.wxml",
  "pages/index/index.wxss",
  "project.config.json"
];
var requiredTests = [
  "project.test.js",
  "logic.test.js",
  "smoke.test.js",
  "interaction.test.js",
  "input-safety.test.js",
  "canvas-compat.test.js",
  "layout.test.js",
  "text-fit.test.js",
  "lifecycle.test.js",
  "replay.test.js",
  "render-contract.test.js",
  "preview.test.js",
  "preview-runtime.test.js",
  "stress.test.js",
  "cloud-state.test.js",
  "release.test.js",
  "release-devtools.test.js"
];
var checks = [];

function pass(name, detail) {
  checks.push({ name: name, status: "pass", detail: detail || "" });
}

function fail(name, detail) {
  checks.push({ name: name, status: "fail", detail: detail || "" });
  throw new Error(name + (detail ? ": " + detail : ""));
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function walk(dir, base, found) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, found);
    else found.push(path.relative(base, full).replace(/\\/g, "/"));
  });
}

function assertContains(source, value, name) {
  if (source.indexOf(value) === -1) fail(name, "missing " + value);
}

function assertReleaseFileList() {
  var found = [];
  walk(releaseDir, releaseDir, found);
  found.sort();
  var expected = requiredReleaseFiles.slice().sort();
  if (found.length !== expected.length) fail("release file list", "expected " + expected.join(", ") + " got " + found.join(", "));
  for (var i = 0; i < expected.length; i += 1) {
    if (found[i] !== expected[i]) fail("release file list", "expected " + expected[i] + " got " + found[i]);
  }
  pass("release file list", found.join(", "));
}

function assertZip(zipPath, name) {
  if (!fs.existsSync(zipPath)) fail(name, "missing " + zipPath);
  childProcess.execFileSync("unzip", ["-t", zipPath], { stdio: "ignore" });
  pass(name, zipPath);
}

function assertRuntimeSource() {
  var game = read(path.join(releaseDir, "game.js"));
  var cloudState = read(path.join(releaseDir, "js", "cloud-state.js"));
  var cloudFunction = read(path.join(releaseDir, "cloudfunctions", "playerState", "index.js"));
  var logic = read(path.join(releaseDir, "js", "logic.js"));
  var runtime = game + "\n" + logic;
  assertContains(game, "CloudState", "runtime cloud state");
  assertContains(cloudState, "wxApi.login", "cloud login");
  assertContains(cloudState, "callFunction", "cloud function call");
  assertContains(cloudFunction, "OPENID", "cloud function identity");
  assertContains(game, "wx.createCanvas", "runtime canvas");
  assertContains(game, "wx.requestAnimationFrame", "runtime animation frame");
  assertContains(game, "onHide", "runtime lifecycle hide");
  assertContains(game, "onShow", "runtime lifecycle show");
  assertContains(game, "合成 2048", "runtime merge title");
  assertContains(game, "霓虹贪吃蛇", "runtime snake title");
  assertContains(game, "极速躲避", "runtime dodge title");
  if (/https?:\/\//.test(runtime)) fail("runtime assets", "remote URL found");
  if (/\b(document|window|localStorage|fetch|XMLHttpRequest)\b/.test(runtime)) fail("runtime APIs", "browser-only API found");
  if (/\b(const|let|class|async|await|Promise|Number\.isFinite)\b/.test(runtime)) fail("runtime syntax", "newer syntax/API found");
  pass("runtime source", "canvas, lifecycle, titles, offline runtime checks passed");
}

function assertConfigs() {
  var project = readJson(path.join(releaseDir, "project.config.json"));
  var app = readJson(path.join(releaseDir, "app.json"));
  var game = readJson(path.join(releaseDir, "game.json"));
  if (project.compileType !== "game") fail("project compile type", String(project.compileType));
  if (project.appid !== "touristappid") fail("project appid", String(project.appid));
  if (project.cloudfunctionRoot !== "cloudfunctions/") fail("cloud function root", String(project.cloudfunctionRoot));
  if (!project.setting || project.setting.packNpmManually !== false) fail("npm packing", "release should not need npm packing");
  if (!Array.isArray(app.pages) || app.pages[0] !== "pages/index/index") fail("app pages", JSON.stringify(app.pages));
  if (app.deviceOrientation !== "portrait") fail("app orientation", String(app.deviceOrientation));
  if (app.showStatusBar !== false) fail("app status bar", String(app.showStatusBar));
  if (game.deviceOrientation !== "portrait") fail("device orientation", String(game.deviceOrientation));
  pass("wechat config", "compileType game, touristappid, portrait, no npm packing");
}

function assertReadmeAndScripts() {
  var readme = read(path.join(root, "README.md"));
  var pkg = readJson(path.join(root, "package.json"));
  ["合成 2048", "霓虹贪吃蛇", "极速躲避", "玩法选择", "wechat-mini-arcade-release", "npm run open:devtools", "npm run verify:devtools-engine"].forEach(function (text) {
    assertContains(readme, text, "README coverage");
  });
  ["test", "doctor", "audit", "hygiene", "qa:report", "verify:release", "verify:devtools-engine", "open:devtools"].forEach(function (script) {
    if (!pkg.scripts || !pkg.scripts[script]) fail("npm scripts", "missing " + script);
  });
  if (pkg.dependencies || pkg.devDependencies) fail("npm dependencies", "runtime should not rely on npm packages");
  pass("README and scripts", "usage, verification, DevTools commands and dependency-free package checked");
}

function assertTestSuite() {
  var pkg = readJson(path.join(root, "package.json"));
  var testScript = pkg.scripts && pkg.scripts.test || "";
  requiredTests.forEach(function (name) {
    if (!fs.existsSync(path.join(root, "test", name))) fail("test files", "missing " + name);
    assertContains(testScript, "node test/" + name, "test script coverage");
  });
  assertContains(testScript, "node scripts/doctor.js", "test script coverage");
  pass("test suite", String(requiredTests.length) + " test files plus doctor are part of npm test");
}

try {
  if (!fs.existsSync(releaseDir)) fail("release directory", "missing " + releaseDir);
  assertReleaseFileList();
  assertConfigs();
  assertRuntimeSource();
  assertZip(releaseZip, "release zip integrity");
  assertZip(fullZip, "full zip integrity");
  assertReadmeAndScripts();
  assertTestSuite();
  console.log("completion audit passed");
  checks.forEach(function (check) {
    console.log("- " + check.status + " " + check.name + (check.detail ? ": " + check.detail : ""));
  });
} catch (error) {
  console.error("completion audit failed");
  checks.forEach(function (check) {
    console.error("- " + check.status + " " + check.name + (check.detail ? ": " + check.detail : ""));
  });
  throw error;
}

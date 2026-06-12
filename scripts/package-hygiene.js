"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseZip = path.join(outputRoot, "wechat-mini-arcade-release.zip");
var fullZip = path.join(outputRoot, "wechat-mini-arcade.zip");
var expectedReleaseEntries = [
  "game.js",
  "game.json",
  "js/",
  "js/logic.js",
  "project.config.json"
];

function zipEntries(zipPath) {
  if (!fs.existsSync(zipPath)) throw new Error("missing zip: " + zipPath);
  return childProcess.execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

function assertNoBadEntries(entries, label) {
  entries.forEach(function (entry) {
    if (entry.charAt(0) === "/") throw new Error(label + " contains absolute path: " + entry);
    if (entry.indexOf("../") !== -1 || entry.indexOf("..\\") !== -1) throw new Error(label + " contains parent path: " + entry);
    if (entry.indexOf("__MACOSX") !== -1) throw new Error(label + " contains macOS metadata: " + entry);
    if (entry.indexOf(".DS_Store") !== -1) throw new Error(label + " contains .DS_Store: " + entry);
    if (entry.indexOf("node_modules") !== -1) throw new Error(label + " contains node_modules: " + entry);
    if (entry.indexOf(".wechat-mini-arcade-release") !== -1) throw new Error(label + " contains temporary release artifact: " + entry);
    if (/\.lock\/?/.test(entry)) throw new Error(label + " contains lock directory: " + entry);
  });
}

function assertContains(entries, value, label) {
  if (entries.indexOf(value) === -1) throw new Error(label + " missing " + value);
}

function assertReleaseEntries(entries) {
  var sorted = entries.slice().sort();
  var expected = expectedReleaseEntries.slice().sort();
  if (sorted.length !== expected.length) {
    throw new Error("release zip entry count mismatch: " + sorted.join(", "));
  }
  expected.forEach(function (entry, index) {
    if (sorted[index] !== entry) {
      throw new Error("release zip entry mismatch: expected " + entry + " got " + sorted[index]);
    }
  });
}

var releaseEntries = zipEntries(releaseZip);
var fullEntries = zipEntries(fullZip);

assertNoBadEntries(releaseEntries, "release zip");
assertNoBadEntries(fullEntries, "full zip");
assertReleaseEntries(releaseEntries);

[
  "game.js",
  "game.json",
  "project.config.json",
  "js/logic.js",
  "README.md",
  "package.json",
  "scripts/build-release.js",
  "scripts/completion-audit.js",
  "scripts/write-qa-report.js",
  "test/replay.test.js",
  "test/render-contract.test.js",
  "test/preview-runtime.test.js"
].forEach(function (entry) {
  assertContains(fullEntries, entry, "full zip");
});

console.log("package hygiene checks passed");

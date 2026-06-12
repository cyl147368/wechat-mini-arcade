"use strict";

var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");
var releaseLock = require("./release-lock.js");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseDir = path.join(outputRoot, "wechat-mini-arcade-release");
var releaseZip = path.join(outputRoot, "wechat-mini-arcade-release.zip");
var buildId = String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000000));
var tempReleaseDir = path.join(outputRoot, ".wechat-mini-arcade-release-" + buildId);
var tempReleaseZip = path.join(outputRoot, ".wechat-mini-arcade-release-" + buildId + ".zip");
var files = [
  "game.js",
  "game.json",
  "project.config.json",
  "js/logic.js"
];

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(relativePath) {
  var source = path.join(root, relativePath);
  var target = path.join(tempReleaseDir, relativePath);
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function assertReleaseFileList() {
  var found = [];
  function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      var full = path.join(dir, name);
      var stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else found.push(path.relative(tempReleaseDir, full).replace(/\\/g, "/"));
    });
  }
  walk(tempReleaseDir);
  found.sort();
  files.slice().sort().forEach(function (file, index) {
    if (found[index] !== file) {
      throw new Error("release file mismatch: expected " + file + " got " + found[index]);
    }
  });
  if (found.length !== files.length) {
    throw new Error("release contains extra files: " + found.join(", "));
  }
}

var release = function () {};

try {
  release = releaseLock.acquire();
  rmDir(tempReleaseDir);
  ensureDir(tempReleaseDir);
  files.forEach(copyFile);
  assertReleaseFileList();
  if (fs.existsSync(tempReleaseZip)) fs.unlinkSync(tempReleaseZip);
  childProcess.execFileSync("zip", ["-qr", tempReleaseZip, "."], { cwd: tempReleaseDir });
  childProcess.execFileSync("unzip", ["-t", tempReleaseZip], { stdio: "ignore" });

  rmDir(releaseDir);
  if (fs.existsSync(releaseZip)) fs.unlinkSync(releaseZip);
  fs.renameSync(tempReleaseDir, releaseDir);
  fs.renameSync(tempReleaseZip, releaseZip);
  console.log("release package built:", releaseZip);
} catch (error) {
  rmDir(tempReleaseDir);
  if (fs.existsSync(tempReleaseZip)) fs.unlinkSync(tempReleaseZip);
  throw error;
} finally {
  release();
}

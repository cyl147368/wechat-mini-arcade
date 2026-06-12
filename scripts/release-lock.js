"use strict";

var fs = require("fs");
var path = require("path");

var outputRoot = path.resolve(__dirname, "..", "..");
var lockDir = path.join(outputRoot, ".wechat-mini-arcade-release.lock");

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function wait(ms) {
  var end = Date.now() + ms;
  while (Date.now() < end) {
    // The release package is tiny; a short synchronous wait keeps scripts dependency-free.
  }
}

function acquire() {
  if (process.env.WECHAT_ARCADE_RELEASE_LOCK_HELD === "1") {
    return function () {};
  }

  var started = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, "owner"), String(process.pid));
      return function () {
        rmDir(lockDir);
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        var stat = fs.statSync(lockDir);
        if (Date.now() - stat.mtimeMs > 120000) rmDir(lockDir);
      } catch (statError) {
        if (statError.code !== "ENOENT") throw statError;
      }
      if (Date.now() - started > 120000) throw new Error("timed out waiting for release build lock");
      wait(80);
    }
  }
}

module.exports = {
  acquire: acquire,
  lockDir: lockDir
};

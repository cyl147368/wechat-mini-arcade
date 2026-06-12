"use strict";

var childProcess = require("child_process");
var releaseLock = require("./release-lock.js");

var command = process.argv.slice(2).join(" ");
if (!command) throw new Error("missing command for with-release-lock");

var release = releaseLock.acquire();
try {
  var env = {};
  Object.keys(process.env).forEach(function (key) {
    env[key] = process.env[key];
  });
  env.WECHAT_ARCADE_RELEASE_LOCK_HELD = "1";
  childProcess.execSync(command, { stdio: "inherit", shell: true, env: env });
} finally {
  release();
}

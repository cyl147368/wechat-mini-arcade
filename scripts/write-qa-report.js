"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var outputRoot = path.resolve(root, "..");
var releaseDir = path.join(outputRoot, "wechat-mini-arcade-release");
var releaseZip = path.join(outputRoot, "wechat-mini-arcade-release.zip");
var fullZip = path.join(outputRoot, "wechat-mini-arcade.zip");
var reportPath = path.join(outputRoot, "wechat-mini-arcade-QA.md");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sizeKb(file) {
  return (fs.statSync(file).size / 1024).toFixed(1) + " KB";
}

function walk(dir, base, files) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, files);
    else files.push(path.relative(base, full).replace(/\\/g, "/"));
  });
}

function assertExists(file, label) {
  if (!fs.existsSync(file)) throw new Error(label + " missing: " + file);
}

assertExists(releaseDir, "release directory");
assertExists(releaseZip, "release zip");
assertExists(fullZip, "full zip");

var releaseFiles = [];
walk(releaseDir, releaseDir, releaseFiles);
releaseFiles.sort();

var lines = [
  "# WeChat Mini Arcade QA Report",
  "",
  "Generated: " + new Date().toISOString(),
  "",
  "## Deliverables",
  "",
  "- Release project: `" + releaseDir + "`",
  "- Release zip: `" + releaseZip + "` (" + sizeKb(releaseZip) + ")",
  "- Full project zip: `" + fullZip + "` (" + sizeKb(fullZip) + ")",
  "",
  "## Checksums",
  "",
  "- `wechat-mini-arcade-release.zip`: `" + sha256(releaseZip) + "`",
  "- `wechat-mini-arcade.zip`: `" + sha256(fullZip) + "`",
  "",
  "## Release File List",
  ""
];

releaseFiles.forEach(function (file) {
  lines.push("- `" + file + "`");
});

lines = lines.concat([
  "",
  "## Verification Commands",
  "",
  "Run these from the full project directory:",
  "",
  "```bash",
  "npm test",
  "npm run audit",
  "npm run doctor",
  "npm run verify:release",
  "unzip -t ../wechat-mini-arcade-release.zip",
  "unzip -t ../wechat-mini-arcade.zip",
  "```",
  "",
  "Optional WeChat DevTools engine verification, when the installed DevTools version exposes the engine build endpoint:",
  "",
  "```bash",
  "npm run verify:devtools-engine",
  "```",
  "",
  "Open in WeChat DevTools:",
  "",
  "```bash",
  "npm run open:devtools",
  "```",
  "",
  "## Scope",
  "",
  "- Native WeChat Mini Game Canvas runtime.",
  "- Three playable modes: 合成 2048, 霓虹贪吃蛇, 极速躲避.",
  "- No npm runtime dependency, no CDN, no remote assets.",
  "- Minimal release package contains only WeChat Mini Game runtime files.",
  "",
  "## WeChat DevTools Evidence",
  "",
  "- Service port was enabled through the WeChat DevTools CLI prompt.",
  "- WeChat DevTools launched with HTTP service `http://127.0.0.1:9420`.",
  "- The release project was opened by CLI and DevTools reported `打开项目成功`.",
  "- On the installed DevTools version, `engine build` reaches project open successfully but the IDE HTTP service returns `Cannot GET /engine/build`; this is a missing DevTools endpoint, not a project import failure."
]);

fs.writeFileSync(reportPath, lines.join("\n") + "\n");
console.log("QA report written:", reportPath);

"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var previewPath = path.join(root, "preview", "index.html");
var html = fs.readFileSync(previewPath, "utf8");

assert.ok(/<canvas id="stage"/.test(html), "preview should expose a canvas stage");
assert.ok(/<script src="\.\.\/js\/logic\.js"><\/script>/.test(html), "preview should load shared logic.js");
assert.ok(/<script src="\.\.\/js\/cloud-config\.js"><\/script>/.test(html), "preview should load cloud config");
assert.ok(/<script src="\.\.\/js\/session-ui\.js"><\/script>/.test(html), "preview should load session UI");
assert.ok(/<script src="\.\.\/game\.js"><\/script>/.test(html), "preview should load shared game.js");
assert.ok(/window\.wx/.test(html), "preview should provide a wx mock");
assert.ok(/onTouchCancel/.test(html), "preview should provide touch cancel events");
assert.ok(/onShow/.test(html), "preview should provide foreground lifecycle events");
assert.ok(/window\.require/.test(html), "preview should provide a CommonJS require shim");
assert.ok(/window\.__arcadeApp/.test(html), "preview should expose the running app for inspection");
assert.ok(/addEventListener\("focus"/.test(html), "preview should resume on window focus");
assert.ok(!/fetch\(/.test(html), "preview should not need a local HTTP server");
assert.ok(!/https?:\/\//.test(html), "preview should not use remote assets");

console.log("preview tests passed");

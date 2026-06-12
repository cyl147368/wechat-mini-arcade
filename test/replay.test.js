"use strict";

var assert = require("assert");
var callbacks = {};
var storage = {};
var frameHandlers = [];
var drawCalls = 0;
var systemInfo = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };

function noop() {}
function drawCall() {
  drawCalls += 1;
}

function makeContext() {
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
    measureText: function (value) {
      return { width: String(value).length * 8 };
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

global.wx = {
  createCanvas: function () {
    return {
      width: systemInfo.windowWidth,
      height: systemInfo.windowHeight,
      getContext: function () {
        return makeContext();
      }
    };
  },
  requestAnimationFrame: function (handler) {
    frameHandlers.push(handler);
    return frameHandlers.length;
  },
  getSystemInfoSync: function () {
    return systemInfo;
  },
  getStorageSync: function (key) {
    return storage[key] || 0;
  },
  setStorageSync: function (key, value) {
    storage[key] = value;
  },
  onTouchStart: function (handler) {
    callbacks.start = handler;
  },
  onTouchMove: function (handler) {
    callbacks.move = handler;
  },
  onTouchEnd: function (handler) {
    callbacks.end = handler;
  },
  onTouchCancel: function (handler) {
    callbacks.cancel = handler;
  },
  onWindowResize: function (handler) {
    callbacks.resize = handler;
  },
  onHide: function (handler) {
    callbacks.hide = handler;
  },
  onShow: function (handler) {
    callbacks.show = handler;
  }
};

function isPowerOfTwo(value) {
  return value === 0 || (value > 0 && (value & (value - 1)) === 0);
}

function runFrame(timestamp) {
  var handler = frameHandlers.shift();
  assert.strictEqual(typeof handler, "function", "missing animation frame handler");
  handler(timestamp);
  assert.ok(frameHandlers.length <= 1, "only one animation frame should be queued");
}

function tapAction(app, action) {
  app.draw();
  var found = null;
  app.buttons.forEach(function (button) {
    if (!found && button.action === action) found = button;
  });
  assert.ok(found, "missing action " + action);
  callbacks.start({ touches: [{ clientX: found.x + found.w / 2, clientY: found.y + found.h / 2 }] });
  callbacks.end({ changedTouches: [{ clientX: found.x + found.w / 2, clientY: found.y + found.h / 2 }] });
}

function swipe(direction) {
  var start = { x: 190, y: 340 };
  var end = {
    left: { x: 80, y: 340 },
    right: { x: 300, y: 340 },
    up: { x: 190, y: 220 },
    down: { x: 190, y: 460 }
  }[direction];
  callbacks.start({ touches: [{ clientX: start.x, clientY: start.y }] });
  callbacks.end({ changedTouches: [{ clientX: end.x, clientY: end.y }] });
}

function assertButtonsInside(app, label) {
  app.buttons.forEach(function (button) {
    assert.ok(button.x >= 0, label + " button outside left");
    assert.ok(button.y >= 0, label + " button outside top");
    assert.ok(button.x + button.w <= app.width, label + " button outside right");
    assert.ok(button.y + button.h <= app.height, label + " button outside bottom");
  });
}

function assertMergeHealthy(game) {
  assert.ok(isFinite(game.score));
  assert.ok(isFinite(game.moves));
  assert.strictEqual(game.board.length, 4);
  for (var y = 0; y < 4; y += 1) {
    assert.strictEqual(game.board[y].length, 4);
    for (var x = 0; x < 4; x += 1) assert.ok(isPowerOfTwo(game.board[y][x]));
  }
}

function assertSnakeHealthy(game) {
  var seen = {};
  assert.ok(isFinite(game.score));
  assert.ok(isFinite(game.steps));
  assert.ok(game.snake.length >= 1);
  game.snake.forEach(function (part) {
    assert.ok(part.x >= 0 && part.x < game.cols);
    assert.ok(part.y >= 0 && part.y < game.rows);
    var key = part.x + "," + part.y;
    assert.strictEqual(seen[key], undefined, "snake body should not overlap");
    seen[key] = true;
  });
  if (game.food) {
    assert.ok(game.food.x >= 0 && game.food.x < game.cols);
    assert.ok(game.food.y >= 0 && game.food.y < game.rows);
    assert.strictEqual(game.isSnakeCell(game.food.x, game.food.y, false), false);
  }
}

function assertDodgeHealthy(game) {
  assert.ok(isFinite(game.score));
  assert.ok(game.lives >= 0 && game.lives <= 3);
  assert.ok(game.player.x >= game.player.r + 8);
  assert.ok(game.player.x <= game.width - game.player.r - 8);
  assert.ok(game.objects.length < 100);
  game.objects.forEach(function (item) {
    assert.ok(isFinite(item.x));
    assert.ok(isFinite(item.y));
    assert.ok(item.w > 0 && item.h > 0);
    assert.ok(item.type === "star" || item.type === "block");
  });
}

var gameModule = require("../game.js");
var app = gameModule.app;
assert.ok(app);

tapAction(app, "play:merge");
var mergeDirections = ["left", "up", "right", "down"];
for (var i = 0; i < 120; i += 1) {
  swipe(mergeDirections[i % mergeDirections.length]);
  app.draw();
  assertMergeHealthy(app.merge);
  assertButtonsInside(app, "merge");
  if (app.merge.over) tapAction(app, "restart");
}

tapAction(app, "menu");
tapAction(app, "play:snake");
var snakeDirections = ["up", "right", "down", "left"];
for (var j = 0; j < 160; j += 1) {
  if (j % 9 === 0) swipe(snakeDirections[(j / 9) % snakeDirections.length]);
  runFrame(1000 + j * 16);
  assertSnakeHealthy(app.snake);
  assertButtonsInside(app, "snake");
  if (app.snake.over) tapAction(app, "restart");
}

tapAction(app, "menu");
tapAction(app, "play:dodge");
for (var k = 0; k < 240; k += 1) {
  callbacks.move({ touches: [{ clientX: 40 + (k * 17) % 300, clientY: 500 }] });
  runFrame(5000 + k * 16);
  assertDodgeHealthy(app.dodge);
  assertButtonsInside(app, "dodge");
  if (app.dodge.over) tapAction(app, "restart");
}

app.dodge.score = 88;
callbacks.hide();
assert.strictEqual(app.paused, true);
assert.strictEqual(storage.arcade_best_dodge, 88);
var pausedScore = app.dodge.score;
runFrame(9000);
assert.strictEqual(app.dodge.score, pausedScore);
systemInfo = { windowWidth: 430, windowHeight: 932, pixelRatio: 3 };
callbacks.show();
assert.strictEqual(app.paused, false);
assert.strictEqual(app.width, 430);
assert.strictEqual(app.height, 932);
app.draw();
assertButtonsInside(app, "resized dodge");

assert.ok(drawCalls > 4000, "expected substantial drawing during replay");
console.log("replay tests passed");

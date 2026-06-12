"use strict";

var assert = require("assert");
var Logic = require("../js/logic.js");

function testMerge2048() {
  var game = new Logic.Merge2048Game(4, new Logic.RNG(1));
  var merged = game.slideLine([2, 2, 4, 0]);
  assert.deepStrictEqual(merged.line, [4, 4, 0, 0]);
  assert.strictEqual(merged.gained, 4);
  assert.strictEqual(merged.changed, true);

  var still = game.slideLine([2, 4, 8, 16]);
  assert.deepStrictEqual(still.line, [2, 4, 8, 16]);
  assert.strictEqual(still.changed, false);

  game.board = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ];
  assert.strictEqual(game.canMove(), false);
  game.over = false;
  var blocked = game.move("left");
  assert.strictEqual(blocked.moved, false);
  assert.strictEqual(blocked.over, true);
  assert.strictEqual(game.over, true);

  game.board[3][3] = 4;
  game.over = false;
  assert.strictEqual(game.canMove(), true);
}

function testSnake() {
  var game = new Logic.SnakeGame(8, 8, new Logic.RNG(2));
  assert.ok(game.food);
  assert.strictEqual(game.isSnakeCell(game.food.x, game.food.y, false), false);

  game.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 0, y: 2 }
  ];
  game.direction = "right";
  game.pendingDirection = "right";
  game.food = { x: 3, y: 2 };
  game.step();
  assert.strictEqual(game.score, 10);
  assert.strictEqual(game.snake.length, 4);
  assert.deepStrictEqual(game.snake[0], { x: 3, y: 2 });

  game.setDirection("left");
  assert.strictEqual(game.pendingDirection, "right");
  game.setDirection("up");
  assert.strictEqual(game.pendingDirection, "up");
  game.setDirection("down");
  assert.strictEqual(game.pendingDirection, "up");

  var tiny = new Logic.SnakeGame(2, 2, new Logic.RNG(4));
  tiny.snake = [
    { x: 1, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 1 }
  ];
  tiny.direction = "right";
  tiny.pendingDirection = "down";
  tiny.food = { x: 1, y: 1 };
  tiny.step();
  assert.strictEqual(tiny.snake.length, 4);
  assert.strictEqual(tiny.food, null);
  assert.strictEqual(tiny.over, true);
}

function testDodge() {
  var game = new Logic.DodgeGame(320, 520, new Logic.RNG(3));
  game.setPlayerX(-999);
  assert.ok(game.player.x >= game.player.r + 8);
  game.setPlayerX(9999);
  assert.ok(game.player.x <= game.width - game.player.r - 8);

  game.reset();
  game.spawnTimer = 999;
  game.objects = [{
    x: game.player.x - 10,
    y: game.player.y - 10,
    w: 20,
    h: 20,
    vy: 0,
    type: "star",
    hit: false
  }];
  game.update(0.016);
  assert.ok(game.score >= 25);
  assert.strictEqual(game.objects.length, 0);

  game.objects = [{
    x: game.player.x - 10,
    y: game.player.y - 10,
    w: 20,
    h: 20,
    vy: 0,
    type: "block",
    hit: false
  }];
  game.update(0.016);
  assert.strictEqual(game.lives, 2);
  assert.strictEqual(game.over, false);
}

testMerge2048();
testSnake();
testDodge();
console.log("logic tests passed");

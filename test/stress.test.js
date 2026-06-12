"use strict";

var assert = require("assert");
var Logic = require("../js/logic.js");

function isPowerOfTwo(value) {
  return value === 0 || (value > 0 && (value & (value - 1)) === 0);
}

function stressMerge() {
  var rng = new Logic.RNG(42);
  var game = new Logic.Merge2048Game(4, rng);
  var directions = ["left", "right", "up", "down"];
  for (var step = 0; step < 300; step += 1) {
    game.move(directions[rng.int(0, directions.length - 1)]);
    assert.strictEqual(game.board.length, 4);
    var empty = 0;
    for (var y = 0; y < 4; y += 1) {
      assert.strictEqual(game.board[y].length, 4);
      for (var x = 0; x < 4; x += 1) {
        var value = game.board[y][x];
        if (value === 0) empty += 1;
        assert.ok(isPowerOfTwo(value), "invalid tile " + value);
      }
    }
    assert.ok(game.score >= 0);
    if (game.over) {
      assert.strictEqual(empty, 0);
      assert.strictEqual(game.canMove(), false);
      break;
    }
  }
}

function stressSnake() {
  var rng = new Logic.RNG(99);
  var game = new Logic.SnakeGame(18, 24, rng);
  var directions = ["left", "right", "up", "down"];
  for (var step = 0; step < 500 && !game.over; step += 1) {
    game.setDirection(directions[rng.int(0, directions.length - 1)]);
    game.update(0.16);
    for (var i = 0; i < game.snake.length; i += 1) {
      var part = game.snake[i];
      assert.ok(part.x >= 0 && part.x < game.cols);
      assert.ok(part.y >= 0 && part.y < game.rows);
    }
    if (game.food) {
      assert.ok(game.food.x >= 0 && game.food.x < game.cols);
      assert.ok(game.food.y >= 0 && game.food.y < game.rows);
      assert.strictEqual(game.isSnakeCell(game.food.x, game.food.y, false), false);
    }
  }
  assert.ok(game.score >= 0);
}

function stressDodge() {
  var rng = new Logic.RNG(123);
  var game = new Logic.DodgeGame(375, 667, rng);
  for (var frame = 0; frame < 900 && !game.over; frame += 1) {
    game.setPlayerX(rng.int(0, 375));
    game.update(1 / 60);
    assert.ok(isFinite(game.score));
    assert.ok(game.lives >= 0 && game.lives <= 3);
    assert.ok(game.player.x >= game.player.r + 8);
    assert.ok(game.player.x <= game.width - game.player.r - 8);
    assert.ok(game.objects.length < 80);
    for (var i = 0; i < game.objects.length; i += 1) {
      var item = game.objects[i];
      assert.ok(isFinite(item.x));
      assert.ok(isFinite(item.y));
      assert.ok(item.w > 0 && item.h > 0);
    }
  }
}

stressMerge();
stressSnake();
stressDodge();
console.log("stress tests passed");

"use strict";

function RNG(seed) {
  this.seed = typeof seed === "number" ? seed >>> 0 : Date.now() >>> 0;
}

RNG.prototype.next = function () {
  this.seed = (1664525 * this.seed + 1013904223) >>> 0;
  return this.seed / 4294967296;
};

RNG.prototype.int = function (min, max) {
  return Math.floor(this.next() * (max - min + 1)) + min;
};

RNG.prototype.pick = function (items) {
  return items[this.int(0, items.length - 1)];
};

function cloneBoard(board) {
  return board.map(function (row) {
    return row.slice();
  });
}

function Merge2048Game(size, rng) {
  this.size = size || 4;
  this.rng = rng || new RNG();
  this.reset();
}

Merge2048Game.prototype.reset = function () {
  this.board = [];
  for (var y = 0; y < this.size; y += 1) {
    var row = [];
    for (var x = 0; x < this.size; x += 1) row.push(0);
    this.board.push(row);
  }
  this.score = 0;
  this.moves = 0;
  this.over = false;
  this.won = false;
  this.addRandomTile();
  this.addRandomTile();
};

Merge2048Game.prototype.emptyCells = function () {
  var cells = [];
  for (var y = 0; y < this.size; y += 1) {
    for (var x = 0; x < this.size; x += 1) {
      if (this.board[y][x] === 0) cells.push({ x: x, y: y });
    }
  }
  return cells;
};

Merge2048Game.prototype.addRandomTile = function () {
  var cells = this.emptyCells();
  if (cells.length === 0) return false;
  var cell = this.rng.pick(cells);
  this.board[cell.y][cell.x] = this.rng.next() < 0.9 ? 2 : 4;
  return true;
};

Merge2048Game.prototype.slideLine = function (line) {
  var values = line.filter(function (value) {
    return value !== 0;
  });
  var merged = [];
  var gained = 0;
  for (var i = 0; i < values.length; i += 1) {
    if (i + 1 < values.length && values[i] === values[i + 1]) {
      var value = values[i] * 2;
      merged.push(value);
      gained += value;
      i += 1;
    } else {
      merged.push(values[i]);
    }
  }
  while (merged.length < this.size) merged.push(0);
  var changed = false;
  for (var j = 0; j < this.size; j += 1) {
    if (merged[j] !== line[j]) {
      changed = true;
      break;
    }
  }
  return { line: merged, gained: gained, changed: changed };
};

Merge2048Game.prototype.move = function (direction) {
  if (direction !== "left" && direction !== "right" && direction !== "up" && direction !== "down") {
    return { moved: false, gained: 0, over: this.over, won: this.won };
  }
  if (this.over) return { moved: false, gained: 0, over: true, won: this.won };

  var before = cloneBoard(this.board);
  var gained = 0;
  var moved = false;

  for (var i = 0; i < this.size; i += 1) {
    var line = [];
    var reverse = direction === "right" || direction === "down";
    for (var j = 0; j < this.size; j += 1) {
      var index = reverse ? this.size - 1 - j : j;
      if (direction === "left" || direction === "right") line.push(before[i][index]);
      else line.push(before[index][i]);
    }

    var result = this.slideLine(line);
    gained += result.gained;
    if (result.changed) moved = true;

    for (var k = 0; k < this.size; k += 1) {
      var writeIndex = reverse ? this.size - 1 - k : k;
      if (direction === "left" || direction === "right") this.board[i][writeIndex] = result.line[k];
      else this.board[writeIndex][i] = result.line[k];
    }
  }

  if (!moved) {
    this.over = !this.canMove();
    return { moved: false, gained: 0, over: this.over, won: this.won };
  }

  this.score += gained;
  this.moves += 1;
  this.addRandomTile();
  this.won = this.won || this.maxTile() >= 2048;
  this.over = !this.canMove();
  return { moved: true, gained: gained, over: this.over, won: this.won };
};

Merge2048Game.prototype.maxTile = function () {
  var max = 0;
  for (var y = 0; y < this.size; y += 1) {
    for (var x = 0; x < this.size; x += 1) {
      if (this.board[y][x] > max) max = this.board[y][x];
    }
  }
  return max;
};

Merge2048Game.prototype.canMove = function () {
  if (this.emptyCells().length > 0) return true;
  for (var y = 0; y < this.size; y += 1) {
    for (var x = 0; x < this.size; x += 1) {
      var value = this.board[y][x];
      if (x + 1 < this.size && this.board[y][x + 1] === value) return true;
      if (y + 1 < this.size && this.board[y + 1][x] === value) return true;
    }
  }
  return false;
};

function SnakeGame(cols, rows, rng) {
  this.cols = cols || 18;
  this.rows = rows || 24;
  this.rng = rng || new RNG();
  this.reset();
}

SnakeGame.prototype.reset = function () {
  var cx = Math.floor(this.cols / 2);
  var cy = Math.floor(this.rows / 2);
  this.snake = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy }
  ];
  this.direction = "right";
  this.pendingDirection = "right";
  this.food = null;
  this.score = 0;
  this.steps = 0;
  this.elapsed = 0;
  this.stepTime = 0.14;
  this.over = false;
  this.placeFood();
};

SnakeGame.prototype.isSnakeCell = function (x, y, ignoreTail) {
  var limit = ignoreTail ? this.snake.length - 1 : this.snake.length;
  for (var i = 0; i < limit; i += 1) {
    if (this.snake[i].x === x && this.snake[i].y === y) return true;
  }
  return false;
};

SnakeGame.prototype.placeFood = function () {
  var cells = [];
  for (var y = 0; y < this.rows; y += 1) {
    for (var x = 0; x < this.cols; x += 1) {
      if (!this.isSnakeCell(x, y, false)) cells.push({ x: x, y: y });
    }
  }
  this.food = cells.length ? this.rng.pick(cells) : null;
};

SnakeGame.prototype.setDirection = function (direction) {
  var opposite = { left: "right", right: "left", up: "down", down: "up" };
  if (!opposite[direction]) return;
  if (opposite[direction] === this.direction) return;
  if (opposite[direction] === this.pendingDirection) return;
  this.pendingDirection = direction;
};

SnakeGame.prototype.nextHead = function () {
  var head = this.snake[0];
  var delta = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
  }[this.pendingDirection];
  return { x: head.x + delta.x, y: head.y + delta.y };
};

SnakeGame.prototype.step = function () {
  if (this.over) return;
  this.direction = this.pendingDirection;
  var head = this.nextHead();
  var willEat = this.food && head.x === this.food.x && head.y === this.food.y;
  var hitWall = head.x < 0 || head.y < 0 || head.x >= this.cols || head.y >= this.rows;
  var hitBody = !hitWall && this.isSnakeCell(head.x, head.y, !willEat);

  if (hitWall || hitBody) {
    this.over = true;
    return;
  }

  this.snake.unshift(head);
  if (willEat) {
    this.score += 10;
    this.stepTime = Math.max(0.075, 0.14 - Math.floor(this.score / 50) * 0.008);
    this.placeFood();
    if (!this.food) this.over = true;
  } else {
    this.snake.pop();
  }
  this.steps += 1;
};

SnakeGame.prototype.update = function (dt) {
  if (this.over) return;
  if (!isFinite(dt) || dt <= 0) return;
  this.elapsed += Math.min(dt, 0.25);
  while (this.elapsed >= this.stepTime && !this.over) {
    this.elapsed -= this.stepTime;
    this.step();
  }
};

function DodgeGame(width, height, rng) {
  this.width = width || 360;
  this.height = height || 640;
  this.rng = rng || new RNG();
  this.reset();
}

DodgeGame.prototype.reset = function () {
  this.player = { x: this.width / 2, y: this.height - 88, r: 17 };
  this.objects = [];
  this.spawnTimer = 0;
  this.score = 0;
  this.lives = 3;
  this.time = 0;
  this.invulnerable = 0;
  this.over = false;
};

DodgeGame.prototype.resize = function (width, height) {
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return;
  this.width = width;
  this.height = height;
  this.player.y = height - 88;
  this.setPlayerX(this.player.x);
};

DodgeGame.prototype.setPlayerX = function (x) {
  if (!isFinite(x)) return;
  var r = this.player.r;
  this.player.x = Math.max(r + 8, Math.min(this.width - r - 8, x));
};

DodgeGame.prototype.spawn = function () {
  var isStar = this.rng.next() < 0.22;
  var size = isStar ? 22 : this.rng.int(34, 68);
  var speed = isStar ? this.rng.int(120, 175) : this.rng.int(145, 245) + Math.min(120, this.time * 4);
  this.objects.push({
    x: this.rng.int(16, Math.max(18, Math.floor(this.width - size - 16))),
    y: -size - 8,
    w: size,
    h: size,
    vy: speed,
    type: isStar ? "star" : "block",
    hit: false
  });
};

DodgeGame.prototype.circleRectHit = function (circle, rect) {
  var nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  var nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  var dx = circle.x - nearestX;
  var dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
};

DodgeGame.prototype.update = function (dt) {
  if (this.over) return;
  if (!isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  this.time += dt;
  this.invulnerable = Math.max(0, this.invulnerable - dt);
  this.spawnTimer -= dt;

  var spawnGap = Math.max(0.32, 0.78 - this.time * 0.012);
  while (this.spawnTimer <= 0) {
    this.spawn();
    this.spawnTimer += spawnGap;
  }

  for (var i = this.objects.length - 1; i >= 0; i -= 1) {
    var item = this.objects[i];
    item.y += item.vy * dt;
    if (!item.hit && this.circleRectHit(this.player, item)) {
      item.hit = true;
      if (item.type === "star") {
        this.score += 25;
      } else if (this.invulnerable <= 0) {
        this.lives -= 1;
        this.invulnerable = 0.9;
        if (this.lives <= 0) this.over = true;
      }
      this.objects.splice(i, 1);
      continue;
    }
    if (item.y > this.height + 80) this.objects.splice(i, 1);
  }

  this.score += dt * 4;
};

module.exports = {
  RNG: RNG,
  Merge2048Game: Merge2048Game,
  SnakeGame: SnakeGame,
  DodgeGame: DodgeGame
};

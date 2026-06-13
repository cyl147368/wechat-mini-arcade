"use strict";

var Logic = require("./js/logic.js");
var CloudState = require("./js/cloud-state.js");
var CloudConfig = require("./js/cloud-config");
var SessionUI = require("./js/session-ui");

var GAME_ID = "wechat-mini-arcade";
var CLOUD_STORAGE_KEY = "wechat-mini-arcade-state-v2";

function numberValue(value) {
  var number = Number(value);
  return isFinite(number) ? number : NaN;
}

function finiteNumber(value, fallback) {
  var number = numberValue(value);
  if (isFinite(number)) return number;
  number = numberValue(fallback);
  return isFinite(number) ? number : 0;
}

function sanitizeBestState(input) {
  input = input || {};
  return {
    merge: Math.max(0, Math.floor(finiteNumber(input.merge, 0))),
    snake: Math.max(0, Math.floor(finiteNumber(input.snake, 0))),
    dodge: Math.max(0, Math.floor(finiteNumber(input.dodge, 0)))
  };
}

function clonePlain(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
}

function sanitizeBoard(board, size) {
  var out = [];
  for (var y = 0; y < size; y += 1) {
    var row = [];
    for (var x = 0; x < size; x += 1) {
      row.push(Math.max(0, Math.floor(finiteNumber(board && board[y] && board[y][x], 0))));
    }
    out.push(row);
  }
  return out;
}

function sanitizePoint(point, fallback) {
  fallback = fallback || { x: 0, y: 0 };
  return {
    x: finiteNumber(point && point.x, fallback.x),
    y: finiteNumber(point && point.y, fallback.y)
  };
}

function sanitizeArcadeState(input) {
  input = input || {};
  var best = sanitizeBestState(input.best || input);
  var current = input.current === "merge" || input.current === "snake" || input.current === "dodge" ? input.current : "";
  return {
    version: 2,
    scene: input.scene === "game" && current ? "game" : "menu",
    current: current,
    best: best,
    merge: {
      size: 4,
      board: sanitizeBoard(input.merge && input.merge.board, 4),
      score: Math.max(0, Math.floor(finiteNumber(input.merge && input.merge.score, 0))),
      moves: Math.max(0, Math.floor(finiteNumber(input.merge && input.merge.moves, 0))),
      over: !!(input.merge && input.merge.over),
      won: !!(input.merge && input.merge.won),
      rngSeed: Math.max(1, Math.floor(finiteNumber(input.merge && input.merge.rngSeed, Date.now())) >>> 0)
    },
    snake: {
      cols: 18,
      rows: 24,
      snake: Array.isArray(input.snake && input.snake.snake) ? input.snake.snake.map(function (part) {
        return {
          x: Math.max(0, Math.min(17, Math.floor(finiteNumber(part && part.x, 0)))),
          y: Math.max(0, Math.min(23, Math.floor(finiteNumber(part && part.y, 0))))
        };
      }).slice(0, 432) : null,
      direction: input.snake && /^(left|right|up|down)$/.test(input.snake.direction) ? input.snake.direction : "right",
      pendingDirection: input.snake && /^(left|right|up|down)$/.test(input.snake.pendingDirection) ? input.snake.pendingDirection : "right",
      food: input.snake && input.snake.food ? {
        x: Math.max(0, Math.min(17, Math.floor(finiteNumber(input.snake.food.x, 0)))),
        y: Math.max(0, Math.min(23, Math.floor(finiteNumber(input.snake.food.y, 0))))
      } : null,
      score: Math.max(0, Math.floor(finiteNumber(input.snake && input.snake.score, 0))),
      steps: Math.max(0, Math.floor(finiteNumber(input.snake && input.snake.steps, 0))),
      elapsed: Math.max(0, finiteNumber(input.snake && input.snake.elapsed, 0)),
      stepTime: Math.max(0.05, finiteNumber(input.snake && input.snake.stepTime, 0.14)),
      over: !!(input.snake && input.snake.over),
      rngSeed: Math.max(1, Math.floor(finiteNumber(input.snake && input.snake.rngSeed, Date.now())) >>> 0)
    },
    dodge: {
      player: sanitizePoint(input.dodge && input.dodge.player, { x: 180, y: 552 }),
      objects: Array.isArray(input.dodge && input.dodge.objects) ? input.dodge.objects.map(function (item) {
        return {
          x: finiteNumber(item && item.x, 0),
          y: finiteNumber(item && item.y, 0),
          w: Math.max(4, finiteNumber(item && item.w, 22)),
          h: Math.max(4, finiteNumber(item && item.h, 22)),
          vy: finiteNumber(item && item.vy, 120),
          type: item && item.type === "star" ? "star" : "block",
          hit: !!(item && item.hit)
        };
      }).slice(0, 80) : [],
      spawnTimer: finiteNumber(input.dodge && input.dodge.spawnTimer, 0),
      score: Math.max(0, finiteNumber(input.dodge && input.dodge.score, 0)),
      lives: Math.max(0, Math.min(9, Math.floor(finiteNumber(input.dodge && input.dodge.lives, 3)))),
      time: Math.max(0, finiteNumber(input.dodge && input.dodge.time, 0)),
      invulnerable: Math.max(0, finiteNumber(input.dodge && input.dodge.invulnerable, 0)),
      over: !!(input.dodge && input.dodge.over),
      rngSeed: Math.max(1, Math.floor(finiteNumber(input.dodge && input.dodge.rngSeed, Date.now())) >>> 0)
    },
    _clientUpdatedAt: Math.max(0, Math.floor(finiteNumber(input._clientUpdatedAt || input.updatedAt, 0)))
  };
}

function ArcadeApp(wxApi) {
  this.wx = wxApi || wx;
  this.canvas = this.wx.createCanvas();
  this.ctx = this.canvas.getContext("2d");
  this.width = 375;
  this.height = 667;
  this.scene = "menu";
  this.current = "";
  this.buttons = [];
  this.touchStart = null;
  this.lastTime = 0;
  this.saveTimer = 0;
  this.localUpdatedAt = 0;
  this.paused = false;
  this.pixelRatio = 1;
  this.best = {
    merge: this.readBest("merge"),
    snake: this.readBest("snake"),
    dodge: this.readBest("dodge")
  };
  this.cloudSync = CloudState.create({
    wx: this.wx,
    gameId: GAME_ID,
    storageKey: CLOUD_STORAGE_KEY,
    env: CloudConfig.envId,
    sanitize: sanitizeArcadeState
  });
  this.merge = new Logic.Merge2048Game(4, new Logic.RNG());
  this.snake = new Logic.SnakeGame(18, 24, new Logic.RNG());
  this.dodge = new Logic.DodgeGame(this.width, this.height, new Logic.RNG());
  this.applyArcadeState(this.readLocalState(), true);
  this.resize();
  this.bindEvents();
  this.startCloudSync();
  this.loop = this.loop.bind(this);
  this.requestFrame(this.loop);
}

ArcadeApp.prototype.readBest = function (key) {
  try {
    var value = this.wx.getStorageSync ? finiteNumber(this.wx.getStorageSync("arcade_best_" + key), 0) : 0;
    value = Math.floor(value);
    return value > 0 ? value : 0;
  } catch (error) {
    return 0;
  }
};

ArcadeApp.prototype.writeBest = function (key, score) {
  if (!this.isKnownGame(key)) return;
  score = Math.floor(numberValue(score));
  if (!isFinite(score)) return;
  if (score < 0) return;
  if (score <= this.best[key]) return;
  this.best[key] = score;
  try {
    if (this.wx.setStorageSync) this.wx.setStorageSync("arcade_best_" + key, score);
  } catch (error) {
    // Storage is optional in dev tools guest mode; gameplay must continue without it.
  }
  this.saveState();
};

ArcadeApp.prototype.applyBestState = function (remoteBest) {
  var best = sanitizeBestState(remoteBest && remoteBest.best || remoteBest);
  var changed = false;
  var keys = ["merge", "snake", "dodge"];
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    if (best[key] > this.best[key]) {
      this.best[key] = best[key];
      changed = true;
      try {
        if (this.wx.setStorageSync) this.wx.setStorageSync("arcade_best_" + key, best[key]);
      } catch (error) {}
    }
  }
  if (changed) this.draw();
};

ArcadeApp.prototype.readLocalState = function () {
  try {
    if (!this.wx.getStorageSync) return null;
    var stored = this.wx.getStorageSync(CLOUD_STORAGE_KEY);
    return stored ? sanitizeArcadeState(stored) : null;
  } catch (error) {
    return null;
  }
};

ArcadeApp.prototype.snapshotState = function () {
  return sanitizeArcadeState({
    version: 2,
    scene: this.scene,
    current: this.current,
    best: this.best,
    merge: {
      board: this.merge.board,
      score: this.merge.score,
      moves: this.merge.moves,
      over: this.merge.over,
      won: this.merge.won,
      rngSeed: this.merge.rng && this.merge.rng.seed
    },
    snake: {
      snake: this.snake.snake,
      direction: this.snake.direction,
      pendingDirection: this.snake.pendingDirection,
      food: this.snake.food,
      score: this.snake.score,
      steps: this.snake.steps,
      elapsed: this.snake.elapsed,
      stepTime: this.snake.stepTime,
      over: this.snake.over,
      rngSeed: this.snake.rng && this.snake.rng.seed
    },
    dodge: {
      player: this.dodge.player,
      objects: this.dodge.objects,
      spawnTimer: this.dodge.spawnTimer,
      score: this.dodge.score,
      lives: this.dodge.lives,
      time: this.dodge.time,
      invulnerable: this.dodge.invulnerable,
      over: this.dodge.over,
      rngSeed: this.dodge.rng && this.dodge.rng.seed
    },
    _clientUpdatedAt: Date.now()
  });
};

ArcadeApp.prototype.writeLocalState = function (state) {
  try {
    state = state || this.snapshotState();
    this.localUpdatedAt = Number(state._clientUpdatedAt) || Date.now();
    if (this.wx.setStorageSync) this.wx.setStorageSync(CLOUD_STORAGE_KEY, state);
  } catch (error) {}
};

ArcadeApp.prototype.saveState = function () {
  var state = this.snapshotState();
  this.writeLocalState(state);
  if (this.cloudSync && typeof this.cloudSync.save === "function") this.cloudSync.save(state);
};

ArcadeApp.prototype.saveCloudBest = function () {
  this.saveState();
};

ArcadeApp.prototype.restoreMerge = function (state) {
  this.merge.rng = new Logic.RNG(state.rngSeed);
  this.merge.board = clonePlain(state.board, this.merge.board);
  this.merge.score = state.score;
  this.merge.moves = state.moves;
  this.merge.over = state.over;
  this.merge.won = state.won;
};

ArcadeApp.prototype.restoreSnake = function (state) {
  this.snake.rng = new Logic.RNG(state.rngSeed);
  if (state.snake && state.snake.length) this.snake.snake = clonePlain(state.snake, this.snake.snake);
  this.snake.direction = state.direction;
  this.snake.pendingDirection = state.pendingDirection;
  this.snake.food = state.food ? clonePlain(state.food, null) : null;
  this.snake.score = state.score;
  this.snake.steps = state.steps;
  this.snake.elapsed = state.elapsed;
  this.snake.stepTime = state.stepTime;
  this.snake.over = state.over;
};

ArcadeApp.prototype.restoreDodge = function (state) {
  this.dodge.rng = new Logic.RNG(state.rngSeed);
  this.dodge.player = Object.assign({ r: 17 }, clonePlain(state.player, this.dodge.player));
  this.dodge.objects = clonePlain(state.objects, []);
  this.dodge.spawnTimer = state.spawnTimer;
  this.dodge.score = state.score;
  this.dodge.lives = state.lives;
  this.dodge.time = state.time;
  this.dodge.invulnerable = state.invulnerable;
  this.dodge.over = state.over;
  this.dodge.resize(this.width, this.height);
};

ArcadeApp.prototype.applyArcadeState = function (remoteState, skipDraw) {
  if (!remoteState) return;
  var state = sanitizeArcadeState(remoteState);
  var localStamp = Number(this.localUpdatedAt) || 0;
  if (!skipDraw && state._clientUpdatedAt && localStamp && state._clientUpdatedAt < localStamp) return;
  this.applyBestState(state);
  this.best = {
    merge: Math.max(this.best.merge, state.best.merge),
    snake: Math.max(this.best.snake, state.best.snake),
    dodge: Math.max(this.best.dodge, state.best.dodge)
  };
  this.restoreMerge(state.merge);
  this.restoreSnake(state.snake);
  this.restoreDodge(state.dodge);
  this.scene = state.scene;
  this.current = state.current;
  this.writeLocalState(state);
  if (!skipDraw) this.draw();
};

ArcadeApp.prototype.startCloudSync = function () {
  var self = this;
  if (!this.cloudSync || typeof this.cloudSync.start !== "function") return;
  this.cloudSync.start(function (remoteState) {
    if (!remoteState) return;
    self.applyArcadeState(remoteState);
    self.saveState();
  });
};

ArcadeApp.prototype.requestFrame = function (handler) {
  if (typeof this.wx.requestAnimationFrame === "function") return this.wx.requestAnimationFrame(handler);
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(handler);
  return setTimeout(function () {
    handler(Date.now());
  }, 16);
};

ArcadeApp.prototype.resize = function () {
  var info = {};
  try {
    info = this.wx.getSystemInfoSync ? this.wx.getSystemInfoSync() : {};
  } catch (error) {
    info = {};
  }
  this.width = Math.max(320, Math.floor(finiteNumber(info.windowWidth, this.width || 375)));
  this.height = Math.max(520, Math.floor(finiteNumber(info.windowHeight, this.height || 667)));
  this.pixelRatio = Math.max(1, Math.min(3, finiteNumber(info.pixelRatio, 1)));
  this.canvas.width = Math.floor(this.width * this.pixelRatio);
  this.canvas.height = Math.floor(this.height * this.pixelRatio);
  if (this.ctx.setTransform) {
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  } else if (this.ctx.scale) {
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  }
  this.dodge.resize(this.width, this.height);
};

ArcadeApp.prototype.bindEvents = function () {
  var self = this;
  if (typeof this.wx.onTouchStart === "function") {
    this.wx.onTouchStart(function (event) {
      self.onTouchStart(event);
    });
  }
  if (typeof this.wx.onTouchMove === "function") {
    this.wx.onTouchMove(function (event) {
      self.onTouchMove(event);
    });
  }
  if (typeof this.wx.onTouchEnd === "function") {
    this.wx.onTouchEnd(function (event) {
      self.onTouchEnd(event);
    });
  }
  if (typeof this.wx.onTouchCancel === "function") {
    this.wx.onTouchCancel(function () {
      self.touchStart = null;
    });
  }
  if (typeof this.wx.onWindowResize === "function") {
    this.wx.onWindowResize(function () {
      self.resize();
    });
  }
  if (typeof this.wx.onHide === "function") {
    this.wx.onHide(function () {
      self.paused = true;
      self.lastTime = 0;
      self.recordCurrentScore();
      self.saveState();
    });
  }
  if (typeof this.wx.onShow === "function") {
    this.wx.onShow(function () {
      self.paused = false;
      self.lastTime = 0;
      self.resize();
      if (self.cloudSync && typeof self.cloudSync.load === "function") {
        self.cloudSync.load(function (remoteState) {
          if (remoteState) self.applyArcadeState(remoteState);
        });
      }
    });
  }
};

ArcadeApp.prototype.touchPoint = function (event) {
  var list = event && (event.touches || event.changedTouches);
  if (!list || !list.length) return null;
  var point = list[0];
  if (!point) return null;
  var x = numberValue(point.clientX);
  var y = numberValue(point.clientY);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x: x, y: y };
};

ArcadeApp.prototype.onTouchStart = function (event) {
  var point = this.touchPoint(event);
  if (!point) return;
  this.touchStart = { x: point.x, y: point.y, time: Date.now() };
  if (this.current === "dodge" && this.scene === "game") this.dodge.setPlayerX(point.x);
};

ArcadeApp.prototype.onTouchMove = function (event) {
  var point = this.touchPoint(event);
  if (!point) return;
  if (this.current === "dodge" && this.scene === "game") this.dodge.setPlayerX(point.x);
};

ArcadeApp.prototype.onTouchEnd = function (event) {
  var point = this.touchPoint(event) || this.touchStart;
  if (!point) return;

  if (SessionUI.hit({ width: this.width, height: this.height, pad: 16 }, point.x, point.y)) {
    if (this.cloudSync && typeof this.cloudSync.requestUserProfile === "function") {
      this.cloudSync.requestUserProfile(CloudConfig.profileDesc, this.draw.bind(this));
    }
    this.touchStart = null;
    return;
  }

  var button = this.findButton(point.x, point.y);
  if (button) {
    this.runAction(button.action);
    this.touchStart = null;
    return;
  }

  if (this.touchStart && this.scene === "game") {
    var dx = point.x - this.touchStart.x;
    var dy = point.y - this.touchStart.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 28) {
      var direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? "right" : "left")
        : (dy > 0 ? "down" : "up");
      this.handleSwipe(direction);
    }
  }
  this.touchStart = null;
};

ArcadeApp.prototype.findButton = function (x, y) {
  for (var i = this.buttons.length - 1; i >= 0; i -= 1) {
    var button = this.buttons[i];
    if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
      return button;
    }
  }
  return null;
};

ArcadeApp.prototype.runAction = function (action) {
  if (typeof action !== "string") return;
  if (action.indexOf("play:") === 0) {
    this.selectGame(action.split(":")[1]);
    return;
  }
  if (action === "menu") {
    this.recordCurrentScore();
    this.scene = "menu";
    this.current = "";
    this.saveState();
    return;
  }
  if (action === "restart") {
    this.resetCurrentGame();
  }
};

ArcadeApp.prototype.isKnownGame = function (key) {
  return key === "merge" || key === "snake" || key === "dodge";
};

ArcadeApp.prototype.selectGame = function (key) {
  if (!this.isKnownGame(key)) {
    this.scene = "menu";
    this.current = "";
    return;
  }
  this.current = key;
  this.scene = "game";
  this.resetCurrentGame();
};

ArcadeApp.prototype.resetCurrentGame = function () {
  if (this.current === "merge") this.merge.reset();
  if (this.current === "snake") this.snake.reset();
  if (this.current === "dodge") {
    this.dodge.resize(this.width, this.height);
    this.dodge.reset();
  }
  this.lastTime = 0;
  this.saveState();
};

ArcadeApp.prototype.recordCurrentScore = function () {
  if (this.current === "merge") this.writeBest("merge", this.merge.score);
  if (this.current === "snake") this.writeBest("snake", this.snake.score);
  if (this.current === "dodge") this.writeBest("dodge", this.dodge.score);
};

ArcadeApp.prototype.handleSwipe = function (direction) {
  if (direction !== "left" && direction !== "right" && direction !== "up" && direction !== "down") return;
  if (this.current === "merge") {
    var result = this.merge.move(direction);
    if (result && result.moved) this.saveState();
  }
  if (this.current === "snake") this.snake.setDirection(direction);
};

ArcadeApp.prototype.loop = function (timestamp) {
  var now = numberValue(timestamp);
  if (!isFinite(now)) now = this.lastTime || Date.now();
  var dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
  if (!isFinite(dt) || dt < 0) dt = 0;
  this.lastTime = now;
  if (!this.paused && this.scene === "game") {
    if (this.current === "snake") this.snake.update(dt);
    if (this.current === "dodge") this.dodge.update(dt);
    this.saveTimer += dt;
    var ended = this.current === "snake" && this.snake.over || this.current === "dodge" && this.dodge.over;
    if (this.saveTimer > 5 || ended && this.saveTimer >= 0) {
      this.saveTimer = ended ? -1 : 0;
      this.recordCurrentScore();
      this.saveState();
    }
    if (!ended && this.saveTimer < 0) this.saveTimer = 0;
  }
  this.draw();
  this.requestFrame(this.loop);
};

ArcadeApp.prototype.clear = function () {
  var ctx = this.ctx;
  if (typeof ctx.createLinearGradient === "function") {
    var gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#111827");
    gradient.addColorStop(0.45, "#16324f");
    gradient.addColorStop(1, "#231f3a");
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = "#111827";
  }
  ctx.fillRect(0, 0, this.width, this.height);
};

ArcadeApp.prototype.roundRect = function (x, y, w, h, r) {
  var ctx = this.ctx;
  if (!ctx.beginPath || !ctx.moveTo || !ctx.lineTo || !ctx.closePath) return false;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.arcTo === "function") {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  }
  ctx.closePath();
  return true;
};

ArcadeApp.prototype.fillRoundRect = function (x, y, w, h, r, color) {
  this.ctx.fillStyle = color;
  if (this.roundRect(x, y, w, h, r) && this.ctx.fill) this.ctx.fill();
  else this.ctx.fillRect(x, y, w, h);
};

ArcadeApp.prototype.strokeRoundRect = function (x, y, w, h, r, color, width) {
  this.ctx.strokeStyle = color;
  this.ctx.lineWidth = width || 1;
  if (this.roundRect(x, y, w, h, r) && this.ctx.stroke) this.ctx.stroke();
  else if (this.ctx.strokeRect) this.ctx.strokeRect(x, y, w, h);
};

ArcadeApp.prototype.textWidth = function (value, size, weight) {
  var ctx = this.ctx;
  var text = String(value);
  ctx.font = (weight || "400") + " " + size + "px sans-serif";
  if (ctx.measureText) {
    var measured = ctx.measureText(text).width;
    if (isFinite(measured) && measured > 0) return measured;
  }
  var width = 0;
  for (var i = 0; i < text.length; i += 1) {
    var code = text.charCodeAt(i);
    if (text.charAt(i) === " ") width += size * 0.34;
    else if (code > 255) width += size;
    else width += size * 0.58;
  }
  return width;
};

ArcadeApp.prototype.text = function (value, x, y, size, color, align, weight, maxWidth) {
  var ctx = this.ctx;
  var text = String(value);
  size = Math.max(9, Math.floor(size || 12));
  if (maxWidth) {
    maxWidth = Math.max(20, Math.floor(maxWidth));
    while (size > 9 && this.textWidth(text, size, weight) > maxWidth) size -= 1;
  }
  ctx.fillStyle = color || "#ffffff";
  ctx.textAlign = align || "left";
  ctx.textBaseline = "middle";
  ctx.font = (weight || "400") + " " + size + "px sans-serif";
  if (maxWidth) ctx.fillText(text, x, y, maxWidth);
  else ctx.fillText(text, x, y);
};

ArcadeApp.prototype.drawButton = function (x, y, w, h, label, action, color) {
  this.fillRoundRect(x, y, w, h, 8, color || "#f8fafc");
  this.strokeRoundRect(x, y, w, h, 8, "rgba(255,255,255,0.16)", 1);
  this.text(label, x + w / 2, y + h / 2 + 1, Math.min(18, Math.floor(h * 0.44)), "#111827", "center", "700", w - 10);
  this.buttons.push({ x: x, y: y, w: w, h: h, action: action });
};

ArcadeApp.prototype.drawIconButton = function (x, y, w, h, action, icon, color) {
  var ctx = this.ctx;
  this.fillRoundRect(x, y, w, h, 8, color || "#e2e8f0");
  this.strokeRoundRect(x, y, w, h, 8, "rgba(255,255,255,0.16)", 1);
  ctx.strokeStyle = "#111827";
  ctx.fillStyle = "#111827";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (icon === "back") {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.58, y + h * 0.28);
    ctx.lineTo(x + w * 0.38, y + h * 0.5);
    ctx.lineTo(x + w * 0.58, y + h * 0.72);
    ctx.stroke();
  } else if (icon === "restart") {
    if (typeof ctx.arc === "function") {
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.52, h * 0.22, Math.PI * 0.2, Math.PI * 1.68, false);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.34, y + h * 0.56);
      ctx.lineTo(x + w * 0.5, y + h * 0.34);
      ctx.lineTo(x + w * 0.67, y + h * 0.56);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x + w * 0.57, y + h * 0.25);
    ctx.lineTo(x + w * 0.71, y + h * 0.27);
    ctx.lineTo(x + w * 0.62, y + h * 0.38);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  this.buttons.push({ x: x, y: y, w: w, h: h, action: action });
};

ArcadeApp.prototype.draw = function () {
  this.buttons = [];
  this.clear();
  if (this.scene === "menu") this.drawMenu();
  else if (this.current === "merge") this.drawMerge();
  else if (this.current === "snake") this.drawSnake();
  else if (this.current === "dodge") this.drawDodge();
  SessionUI.draw(this.ctx, { width: this.width, height: this.height, pad: 16 }, this.cloudSync && this.cloudSync.getStatus());
};

ArcadeApp.prototype.drawMenu = function () {
  var ctx = this.ctx;
  var cx = this.width / 2;
  var top = Math.max(38, this.height * 0.075);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#ffffff";
  if (typeof ctx.arc === "function") {
    ctx.beginPath();
    ctx.arc(this.width * 0.82, this.height * 0.14, 62, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(this.width * 0.82 - 62, this.height * 0.14 - 62, 124, 124);
  }
  ctx.globalAlpha = 1;

  this.text("小游戏精选", cx, top, 34, "#f8fafc", "center", "800");
  this.text("3 款热门轻休闲", cx, top + 38, 16, "#bde9ff", "center", "600");

  var cardW = Math.min(336, this.width - 36);
  var cardH = 112;
  var gap = 18;
  var firstY = top + 76;
  var games = [
    { key: "merge", title: "合成 2048", sub: "最佳 " + this.best.merge, accent: "#f97316" },
    { key: "snake", title: "霓虹贪吃蛇", sub: "最佳 " + this.best.snake, accent: "#22c55e" },
    { key: "dodge", title: "极速躲避", sub: "最佳 " + this.best.dodge, accent: "#38bdf8" }
  ];

  for (var i = 0; i < games.length; i += 1) {
    var game = games[i];
    var x = cx - cardW / 2;
    var y = firstY + i * (cardH + gap);
    this.fillRoundRect(x, y, cardW, cardH, 8, "rgba(248,250,252,0.94)");
    this.strokeRoundRect(x, y, cardW, cardH, 8, "rgba(255,255,255,0.45)", 1);
    ctx.fillStyle = game.accent;
    ctx.fillRect(x, y, 7, cardH);
    this.drawMenuIcon(game.key, x + 26, y + 28, game.accent);
    this.text(game.title, x + 104, y + 42, 24, "#111827", "left", "800", cardW - 202);
    this.text(game.sub, x + 104, y + 74, 15, "#475569", "left", "600", cardW - 202);
    this.drawButton(x + cardW - 82, y + 36, 56, 40, "玩", "play:" + game.key, game.accent);
    this.buttons.push({ x: x, y: y, w: cardW, h: cardH, action: "play:" + game.key });
  }
};

ArcadeApp.prototype.drawMenuIcon = function (key, x, y, color) {
  var ctx = this.ctx;
  ctx.fillStyle = color;
  if (key === "merge") {
    for (var yy = 0; yy < 2; yy += 1) {
      for (var xx = 0; xx < 2; xx += 1) this.fillRoundRect(x + xx * 26, y + yy * 26, 22, 22, 5, color);
    }
    this.text("2", x + 11, y + 11, 12, "#fff", "center", "800");
    this.text("4", x + 37, y + 37, 12, "#fff", "center", "800");
  } else if (key === "snake") {
    for (var i = 0; i < 5; i += 1) this.fillRoundRect(x + i * 11, y + 22 + Math.sin(i) * 9, 14, 14, 4, color);
    ctx.fillStyle = "#facc15";
    if (typeof ctx.arc === "function") {
      ctx.beginPath();
      ctx.arc(x + 62, y + 15, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x + 55, y + 8, 14, 14);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x + 32, y);
    ctx.lineTo(x + 58, y + 52);
    ctx.lineTo(x + 6, y + 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#facc15";
    if (typeof ctx.arc === "function") {
      ctx.beginPath();
      ctx.arc(x + 52, y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x + 44, y, 16, 16);
    }
  }
};

ArcadeApp.prototype.drawTopBar = function (title, scoreText) {
  this.drawIconButton(16, 18, 42, 36, "menu", "back", "#e2e8f0");
  this.drawIconButton(this.width - 58, 18, 42, 36, "restart", "restart", "#e2e8f0");
  this.text(title, this.width / 2, 29, 20, "#f8fafc", "center", "800", this.width - 136);
  this.text(scoreText, this.width / 2, 54, 13, "#bae6fd", "center", "600", this.width - 86);
};

ArcadeApp.prototype.drawMerge = function () {
  var game = this.merge;
  this.drawTopBar("合成 2048", "分数 " + game.score + "  最高 " + this.best.merge);
  if (game.over) this.writeBest("merge", game.score);

  var size = Math.min(this.width - 32, this.height - 176);
  size = Math.min(size, 420);
  var x0 = (this.width - size) / 2;
  var y0 = Math.max(94, (this.height - size) / 2 + 22);
  var gap = 9;
  var cell = (size - gap * 5) / 4;
  this.fillRoundRect(x0, y0, size, size, 8, "#334155");

  for (var y = 0; y < 4; y += 1) {
    for (var x = 0; x < 4; x += 1) {
      var value = game.board[y][x];
      var tx = x0 + gap + x * (cell + gap);
      var ty = y0 + gap + y * (cell + gap);
      this.fillRoundRect(tx, ty, cell, cell, 7, this.tileColor(value));
      if (value) {
        var textSize = value < 100 ? 28 : value < 1000 ? 24 : 19;
        this.text(String(value), tx + cell / 2, ty + cell / 2 + 1, textSize, value <= 4 ? "#1f2937" : "#ffffff", "center", "800");
      }
    }
  }

  this.text("最大 " + game.maxTile() + "  步数 " + game.moves, this.width / 2, y0 + size + 34, 15, "#e0f2fe", "center", "700", this.width - 32);
  if (game.over) this.drawOverlay("本局结束", "分数 " + game.score);
  else if (game.won) this.text("2048", this.width / 2, y0 - 24, 16, "#facc15", "center", "800");
};

ArcadeApp.prototype.tileColor = function (value) {
  var colors = {
    0: "#475569",
    2: "#f8fafc",
    4: "#e0f2fe",
    8: "#fb923c",
    16: "#f97316",
    32: "#ef4444",
    64: "#dc2626",
    128: "#facc15",
    256: "#84cc16",
    512: "#22c55e",
    1024: "#06b6d4",
    2048: "#8b5cf6"
  };
  return colors[value] || "#ec4899";
};

ArcadeApp.prototype.drawSnake = function () {
  var game = this.snake;
  this.drawTopBar("霓虹贪吃蛇", "分数 " + game.score + "  最高 " + this.best.snake);
  if (game.over) this.writeBest("snake", game.score);

  var top = 82;
  var footerReserve = 60;
  var cell = Math.floor(Math.min((this.width - 32) / game.cols, (this.height - top - footerReserve) / game.rows));
  cell = Math.max(10, cell);
  var boardW = cell * game.cols;
  var boardH = cell * game.rows;
  var x0 = Math.floor((this.width - boardW) / 2);
  var y0 = top + Math.max(0, Math.floor((this.height - top - footerReserve - boardH) / 2));
  this.fillRoundRect(x0 - 6, y0 - 6, boardW + 12, boardH + 12, 8, "#0f172a");
  this.strokeRoundRect(x0 - 6, y0 - 6, boardW + 12, boardH + 12, 8, "rgba(125,211,252,0.34)", 1);

  for (var y = 0; y < game.rows; y += 1) {
    for (var x = 0; x < game.cols; x += 1) {
      this.ctx.fillStyle = (x + y) % 2 ? "#132033" : "#17243a";
      this.ctx.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
    }
  }

  if (game.food) {
    this.ctx.fillStyle = "#facc15";
    if (typeof this.ctx.arc === "function") {
      this.ctx.beginPath();
      this.ctx.arc(x0 + game.food.x * cell + cell / 2, y0 + game.food.y * cell + cell / 2, cell * 0.34, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.fillRoundRect(x0 + game.food.x * cell + cell * 0.2, y0 + game.food.y * cell + cell * 0.2, cell * 0.6, cell * 0.6, 3, "#facc15");
    }
  }

  for (var i = game.snake.length - 1; i >= 0; i -= 1) {
    var part = game.snake[i];
    var color = i === 0 ? "#22d3ee" : i % 2 ? "#22c55e" : "#4ade80";
    this.fillRoundRect(x0 + part.x * cell + 1, y0 + part.y * cell + 1, cell - 2, cell - 2, 4, color);
  }

  this.text("长度 " + game.snake.length, this.width / 2, y0 + boardH + 24, 14, "#e0f2fe", "center", "700", this.width - 32);
  if (game.over) this.drawOverlay("本局结束", "分数 " + game.score);
};

ArcadeApp.prototype.drawDodge = function () {
  var game = this.dodge;
  this.drawTopBar("极速躲避", "分数 " + Math.floor(game.score) + "  最高 " + this.best.dodge + "  生命 " + game.lives);
  if (game.over) this.writeBest("dodge", game.score);

  var ctx = this.ctx;
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#bae6fd";
  ctx.lineWidth = 1;
  for (var i = 0; i < 8; i += 1) {
    var x = (i + 0.5) * this.width / 8;
    ctx.beginPath();
    ctx.moveTo(x, 76);
    ctx.lineTo(x - this.width * 0.12, this.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (var j = 0; j < game.objects.length; j += 1) {
    var item = game.objects[j];
    if (item.type === "star") {
      ctx.fillStyle = "#facc15";
      if (typeof ctx.arc === "function") {
        ctx.beginPath();
        ctx.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.fillRoundRect(item.x, item.y, item.w, item.h, 5, "#facc15");
      }
      this.text("+", item.x + item.w / 2, item.y + item.h / 2 + 1, 17, "#7c2d12", "center", "800");
    } else {
      this.fillRoundRect(item.x, item.y, item.w, item.h, 7, "#fb7185");
      this.strokeRoundRect(item.x, item.y, item.w, item.h, 7, "rgba(255,255,255,0.42)", 1);
    }
  }

  var blink = game.invulnerable > 0 && Math.floor(game.invulnerable * 12) % 2 === 0;
  ctx.fillStyle = blink ? "#bae6fd" : "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(game.player.x, game.player.y - 22);
  ctx.lineTo(game.player.x + 22, game.player.y + 20);
  ctx.lineTo(game.player.x - 22, game.player.y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (game.over) this.drawOverlay("本局结束", "分数 " + Math.floor(game.score));
};

ArcadeApp.prototype.drawOverlay = function (title, sub) {
  var w = Math.min(286, this.width - 52);
  var h = 176;
  var x = (this.width - w) / 2;
  var y = (this.height - h) / 2;
  this.ctx.globalAlpha = 0.72;
  this.ctx.fillStyle = "#020617";
  this.ctx.fillRect(0, 0, this.width, this.height);
  this.ctx.globalAlpha = 1;
  this.fillRoundRect(x, y, w, h, 8, "#f8fafc");
  this.text(title, this.width / 2, y + 46, 25, "#111827", "center", "800", w - 32);
  this.text(sub, this.width / 2, y + 78, 16, "#475569", "center", "700", w - 32);
  this.drawButton(x + 28, y + 112, 96, 42, "再来", "restart", "#38bdf8");
  this.drawButton(x + w - 124, y + 112, 96, 42, "菜单", "menu", "#e2e8f0");
};

var app = null;
if (typeof wx !== "undefined" && wx && wx.createCanvas) {
  app = new ArcadeApp(wx);
}

module.exports = {
  ArcadeApp: ArcadeApp,
  app: app
};

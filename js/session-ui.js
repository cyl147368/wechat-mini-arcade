"use strict";

function number(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function buttonRect(layout) {
  var width = number(layout && layout.width, 375);
  var pad = number(layout && layout.pad, 16);
  var w = Math.max(86, Math.min(118, width * 0.28));
  return { x: width - pad - w, y: 16, w: w, h: 30 };
}

function inRect(x, y, rect) {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function rounded(ctx, rect, radius) {
  if (!ctx || !ctx.beginPath) return false;
  radius = Math.min(radius || 8, rect.w / 2, rect.h / 2);
  ctx.beginPath();
  if (typeof ctx.arcTo === "function") {
    ctx.moveTo(rect.x + radius, rect.y);
    ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, radius);
    ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, radius);
    ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, radius);
    ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, radius);
  } else if (typeof ctx.rect === "function") {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  } else {
    return false;
  }
  if (ctx.closePath) ctx.closePath();
  return true;
}

function text(ctx, value, x, y, maxWidth) {
  if (!ctx || typeof ctx.fillText !== "function") return;
  var label = String(value || "");
  var size = 12;
  ctx.font = "700 " + size + "px sans-serif";
  while (size > 9 && ctx.measureText && ctx.measureText(label).width > maxWidth) {
    size -= 1;
    ctx.font = "700 " + size + "px sans-serif";
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y, maxWidth);
}

function label(status) {
  status = status || {};
  if (status.profile && status.profile.nickName) return status.profile.nickName;
  if (status.openid) return "微信已登录";
  if (status.lastError) return "离线存档";
  return "微信登录";
}

function draw(ctx, layout, status) {
  var rect = buttonRect(layout);
  var offline = status && status.lastError;
  ctx.fillStyle = offline ? "rgba(248,113,113,0.92)" : "rgba(255,255,255,0.92)";
  if (rounded(ctx, rect, 8) && ctx.fill) ctx.fill();
  else if (ctx.fillRect) ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = offline ? "rgba(127,29,29,0.55)" : "rgba(15,23,42,0.16)";
  ctx.lineWidth = 1;
  if (rounded(ctx, rect, 8) && ctx.stroke) ctx.stroke();
  ctx.fillStyle = offline ? "#ffffff" : "#111827";
  text(ctx, label(status), rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, rect.w - 12);
}

function hit(layout, x, y) {
  return inRect(x, y, buttonRect(layout));
}

module.exports = {
  draw: draw,
  hit: hit,
  buttonRect: buttonRect
};

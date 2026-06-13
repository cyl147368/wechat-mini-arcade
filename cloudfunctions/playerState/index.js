"use strict";

var cloud = require("wx-server-sdk");
var crypto = require("crypto");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

var db = cloud.database();
var COLLECTION = "game_player_state";
var MAX_STATE_BYTES = 200000;

function response(data) {
  data = data || {};
  data.ok = data.ok !== false;
  return data;
}

function error(message, openid) {
  return {
    ok: false,
    error: message,
    openid: openid || ""
  };
}

function cleanText(value, max) {
  value = String(value || "").trim();
  return value.slice(0, max || 80);
}

function normalizeGameId(value) {
  value = String(value || "wechat-mini-game");
  value = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
  return value || "wechat-mini-game";
}

function digest(value) {
  value = cleanText(value, 512);
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sanitizeProfile(input) {
  input = input || {};
  var profile = {
    nickName: cleanText(input.nickName || input.nickname, 40),
    avatarUrl: cleanText(input.avatarUrl, 300),
    country: cleanText(input.country, 40),
    province: cleanText(input.province, 40),
    city: cleanText(input.city, 40),
    language: cleanText(input.language, 20)
  };
  if (!profile.nickName && !profile.avatarUrl) return null;
  return profile;
}

function assertState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("state must be an object");
  var text = JSON.stringify(state || {});
  if (text.length > MAX_STATE_BYTES) throw new Error("state payload too large");
}

function missingDocument(err) {
  var message = err && (err.errMsg || err.message || String(err));
  return /does not exist|not exist|document not found|collection.*not|coll.*not|db.*not/i.test(message);
}

async function readDoc(collection, docId) {
  try {
    var found = await collection.doc(docId).get();
    return found && found.data ? found.data : null;
  } catch (err) {
    if (missingDocument(err)) return null;
    throw err;
  }
}

async function writeDoc(collection, docId, data) {
  try {
    await collection.doc(docId).set({ data: data });
    return;
  } catch (err) {
    if (!missingDocument(err)) throw err;
  }
  var withId = Object.assign({ _id: docId }, data);
  try {
    await collection.add({ data: withId });
  } catch (err2) {
    if (!/duplicate|exist/i.test(err2 && (err2.errMsg || err2.message || ""))) throw err2;
    await collection.doc(docId).set({ data: data });
  }
}

exports.main = async function (event) {
  event = event || {};
  var wxContext = cloud.getWXContext();
  var openid = wxContext && wxContext.OPENID ? wxContext.OPENID : "";
  if (!openid) return error("missing OPENID", "");

  var action = event.action === "save" || event.action === "profile" ? event.action : "load";
  var gameId = normalizeGameId(event.gameId);
  var docId = openid + "_" + gameId;
  var collection = db.collection(COLLECTION);
  var profile = sanitizeProfile(event.profile || event.payload && event.payload.profile);
  var session = {
    openid: openid,
    appid: wxContext.APPID || "",
    unionid: wxContext.UNIONID || "",
    loginCodeDigest: digest(event.loginCode),
    lastLoginAt: db.serverDate()
  };

  if (action === "load") {
    try {
      var current = await readDoc(collection, docId);
      return response({
        openid: openid,
        appid: session.appid,
        unionid: session.unionid,
        gameId: gameId,
        profile: current && current.profile || null,
        state: current && current.state || null,
        updatedAt: current && current.updatedAt || null,
        schemaVersion: current && current.schemaVersion || 2
      });
    } catch (err) {
      return error(err.message || "load failed", openid);
    }
  }

  try {
    var currentDoc = await readDoc(collection, docId);
    var payload = event.payload || {};
    var nextState = action === "save" ? payload.state || {} : currentDoc && currentDoc.state || null;
    if (action === "save") assertState(nextState);
    var nextProfile = profile || currentDoc && currentDoc.profile || null;
    await writeDoc(collection, docId, {
      openid: openid,
      appid: session.appid,
      unionid: session.unionid,
      gameId: gameId,
      state: nextState,
      profile: nextProfile,
      login: session,
      updatedAt: db.serverDate(),
      schemaVersion: 2
    });
    return response({
      openid: openid,
      appid: session.appid,
      unionid: session.unionid,
      gameId: gameId,
      profile: nextProfile,
      saved: action === "save"
    });
  } catch (err2) {
    return error(err2.message || "save failed", openid);
  }
};

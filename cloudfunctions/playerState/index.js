"use strict";

var cloud = require("wx-server-sdk");

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

function normalizeGameId(value) {
  value = String(value || "wechat-mini-game");
  value = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
  return value || "wechat-mini-game";
}

function assertStateSize(state) {
  var text = JSON.stringify(state || {});
  if (text.length > MAX_STATE_BYTES) throw new Error("state payload too large");
}

function missingDocument(err) {
  var message = err && (err.errMsg || err.message || String(err));
  return /does not exist|not exist|document not found/i.test(message);
}

exports.main = async function (event) {
  event = event || {};
  var wxContext = cloud.getWXContext();
  var openid = wxContext && wxContext.OPENID ? wxContext.OPENID : "";
  if (!openid) return error("missing OPENID", "");

  var action = event.action === "save" ? "save" : "load";
  var gameId = normalizeGameId(event.gameId);
  var docId = openid + "_" + gameId;
  var collection = db.collection(COLLECTION);

  if (action === "load") {
    try {
      var found = await collection.doc(docId).get();
      return response({
        openid: openid,
        gameId: gameId,
        state: found && found.data ? found.data.state || null : null,
        updatedAt: found && found.data ? found.data.updatedAt || null : null
      });
    } catch (err) {
      if (missingDocument(err)) return response({ openid: openid, gameId: gameId, state: null });
      return error(err.message || "load failed", openid);
    }
  }

  try {
    var payload = event.payload || {};
    var state = payload.state || {};
    assertStateSize(state);
    await collection.doc(docId).set({
      data: {
        openid: openid,
        gameId: gameId,
        state: state,
        updatedAt: db.serverDate(),
        schemaVersion: 1
      }
    });
    return response({ openid: openid, gameId: gameId, saved: true });
  } catch (err2) {
    return error(err2.message || "save failed", openid);
  }
};

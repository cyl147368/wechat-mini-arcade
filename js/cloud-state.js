"use strict";

function safe(fn, fallback) {
  try {
    return fn();
  } catch (error) {
    return fallback;
  }
}

function now() {
  return typeof Date !== "undefined" && Date.now ? Date.now() : 0;
}

function cloneForWire(value) {
  return safe(function () {
    return JSON.parse(JSON.stringify(value));
  }, null);
}

function create(options) {
  options = options || {};
  var wxApi = options.wx || null;
  var cloud = wxApi && wxApi.cloud ? wxApi.cloud : null;
  var gameId = options.gameId || "wechat-mini-game";
  var storageKey = options.storageKey || "";
  var functionName = options.functionName || "playerState";
  var sanitize = typeof options.sanitize === "function" ? options.sanitize : function (value) { return value; };
  var status = {
    mode: "local",
    loggedIn: false,
    loginCode: "",
    openid: "",
    lastSyncAt: 0,
    lastError: ""
  };

  function setError(message) {
    status.lastError = message || "";
    if (message) status.mode = "local";
  }

  function canUseCloud() {
    return !!(cloud && typeof cloud.callFunction === "function");
  }

  function initCloud() {
    if (!canUseCloud()) return false;
    safe(function () {
      if (typeof cloud.init === "function") cloud.init({ traceUser: true });
    }, null);
    status.mode = "cloud";
    return true;
  }

  function login() {
    if (!wxApi || typeof wxApi.login !== "function") return;
    safe(function () {
      wxApi.login({
        success: function (res) {
          status.loggedIn = true;
          status.loginCode = res && res.code ? String(res.code) : "";
        },
        fail: function () {
          setError("wx.login failed");
        }
      });
    }, null);
  }

  function callCloud(action, payload, callback) {
    if (!canUseCloud()) {
      setError("wx.cloud.callFunction unavailable");
      return false;
    }
    status.mode = "cloud";
    status.lastError = "";
    cloud.callFunction({
      name: functionName,
      data: {
        action: action,
        gameId: gameId,
        storageKey: storageKey,
        payload: payload || {},
        clientTime: now()
      },
      success: function (res) {
        var result = res && res.result ? res.result : {};
        if (result.openid) status.openid = String(result.openid);
        if (result.ok === false) {
          setError(result.error || "cloud state request failed");
        } else {
          status.lastSyncAt = now();
          status.lastError = "";
          status.mode = "cloud";
        }
        if (typeof callback === "function") callback(result);
      },
      fail: function () {
        setError("cloud state request failed");
        if (typeof callback === "function") callback({ ok: false });
      }
    });
    return true;
  }

  function load(callback) {
    return callCloud("load", {}, function (result) {
      var remote = result && result.state ? sanitize(result.state) : null;
      if (typeof callback === "function") callback(remote, result || {});
    });
  }

  function save(value) {
    var state = cloneForWire(sanitize(value));
    if (!state) return false;
    return callCloud("save", { state: state }, null);
  }

  function start(callback) {
    if (!initCloud()) return false;
    login();
    return load(callback);
  }

  function getStatus() {
    return {
      mode: status.mode,
      loggedIn: status.loggedIn,
      loginCode: status.loginCode,
      openid: status.openid,
      lastSyncAt: status.lastSyncAt,
      lastError: status.lastError
    };
  }

  return {
    start: start,
    load: load,
    save: save,
    getStatus: getStatus
  };
}

module.exports = {
  create: create
};

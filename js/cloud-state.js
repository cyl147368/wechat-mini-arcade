"use strict";

var PLACEHOLDER_ENV = "replace-with-your-cloud-env-id";

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

function cleanText(value, max) {
  value = String(value || "").trim();
  return value.slice(0, max || 80);
}

function normalizeEnvId(value) {
  return cleanText(value, 128);
}

function isConfiguredEnv(envId) {
  return !!envId && envId !== PLACEHOLDER_ENV;
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

function create(options) {
  options = options || {};
  var wxApi = options.wx || null;
  var cloud = wxApi && wxApi.cloud ? wxApi.cloud : null;
  var gameId = options.gameId || "wechat-mini-game";
  var storageKey = options.storageKey || "";
  var functionName = options.functionName || "playerState";
  var envId = normalizeEnvId(options.env || options.envId || "");
  var profileStorageKey = storageKey ? storageKey + ":profile" : "";
  var sanitize = typeof options.sanitize === "function" ? options.sanitize : function (value) { return value; };
  var status = {
    mode: "local",
    cloudReady: false,
    loggedIn: false,
    loginCode: "",
    openid: "",
    appid: "",
    unionid: "",
    profile: null,
    lastSyncAt: 0,
    lastError: ""
  };

  status.profile = safe(function () {
    return profileStorageKey && wxApi && wxApi.getStorageSync ? sanitizeProfile(wxApi.getStorageSync(profileStorageKey)) : null;
  }, null);

  function setError(message) {
    status.lastError = message || "";
    if (message) status.mode = "local";
  }

  function canUseCloud() {
    return !!(cloud && typeof cloud.callFunction === "function");
  }

  function initCloud() {
    if (status.cloudReady) return true;
    if (!canUseCloud()) {
      setError("wx.cloud.callFunction unavailable");
      return false;
    }
    if (!isConfiguredEnv(envId)) {
      setError("cloud env not configured");
      return false;
    }
    var ok = safe(function () {
      if (typeof cloud.init === "function") cloud.init({ env: envId, traceUser: true });
      return true;
    }, false);
    if (!ok) {
      setError("wx.cloud.init failed");
      return false;
    }
    status.mode = "cloud";
    status.cloudReady = true;
    status.lastError = "";
    return true;
  }

  function login(callback) {
    if (!wxApi || typeof wxApi.login !== "function") {
      status.loggedIn = false;
      status.loginCode = "";
      if (typeof callback === "function") callback(false);
      return false;
    }
    safe(function () {
      wxApi.login({
        success: function (res) {
          status.loggedIn = true;
          status.loginCode = res && res.code ? String(res.code) : "";
          if (typeof callback === "function") callback(true);
        },
        fail: function () {
          setError("wx.login failed");
          if (typeof callback === "function") callback(false);
        }
      });
    }, null);
    return true;
  }

  function updateSession(result) {
    if (!result) return;
    if (result.openid) status.openid = String(result.openid);
    if (result.appid) status.appid = String(result.appid);
    if (result.unionid) status.unionid = String(result.unionid);
    if (result.profile) status.profile = sanitizeProfile(result.profile);
  }

  function callCloud(action, payload, callback) {
    if (!initCloud()) {
      if (typeof callback === "function") callback({ ok: false, error: status.lastError });
      return false;
    }
    login(function () {
      status.mode = "cloud";
      status.lastError = "";
      cloud.callFunction({
        name: functionName,
        data: {
          action: action,
          gameId: gameId,
          storageKey: storageKey,
          loginCode: status.loginCode,
          profile: status.profile || null,
          payload: payload || {},
          clientTime: now()
        },
        success: function (res) {
          var result = res && res.result ? res.result : {};
          updateSession(result);
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
          if (typeof callback === "function") callback({ ok: false, error: status.lastError });
        }
      });
    });
    return true;
  }

  function load(callback) {
    return callCloud("load", {}, function (result) {
      var raw = result && result.state ? result.state : null;
      var remote = raw ? sanitize(raw) : null;
      if (remote && typeof remote === "object" && raw && raw._clientUpdatedAt) {
        remote._clientUpdatedAt = Number(raw._clientUpdatedAt) || 0;
      }
      if (typeof callback === "function") callback(remote, result || {});
    });
  }

  function save(value) {
    var state = cloneForWire(sanitize(value));
    if (!state) return false;
    if (typeof state === "object" && !Array.isArray(state)) state._clientUpdatedAt = now();
    return callCloud("save", { state: state }, null);
  }

  function requestUserProfile(desc, callback) {
    if (!wxApi || typeof wxApi.getUserProfile !== "function") {
      setError("wx.getUserProfile unavailable");
      if (typeof callback === "function") callback(null, getStatus());
      return false;
    }
    safe(function () {
      wxApi.getUserProfile({
        desc: desc || "用于保存头像昵称和游戏进度",
        lang: "zh_CN",
        success: function (res) {
          var profile = sanitizeProfile(res && res.userInfo);
          if (profile) {
            status.profile = profile;
            safe(function () {
              if (profileStorageKey && wxApi.setStorageSync) wxApi.setStorageSync(profileStorageKey, profile);
            }, null);
            callCloud("profile", { profile: profile }, function (result) {
              if (typeof callback === "function") callback(profile, result || getStatus());
            });
          } else if (typeof callback === "function") {
            callback(null, getStatus());
          }
        },
        fail: function () {
          setError("wx.getUserProfile failed");
          if (typeof callback === "function") callback(null, getStatus());
        }
      });
    }, null);
    return true;
  }

  function start(callback) {
    return load(callback);
  }

  function getStatus() {
    return {
      mode: status.mode,
      cloudReady: status.cloudReady,
      loggedIn: status.loggedIn,
      loginCode: status.loginCode,
      openid: status.openid,
      appid: status.appid,
      unionid: status.unionid,
      profile: status.profile,
      envConfigured: isConfiguredEnv(envId),
      lastSyncAt: status.lastSyncAt,
      lastError: status.lastError
    };
  }

  return {
    start: start,
    load: load,
    save: save,
    login: login,
    requestUserProfile: requestUserProfile,
    getStatus: getStatus
  };
}

module.exports = {
  create: create,
  sanitizeProfile: sanitizeProfile,
  isConfiguredEnv: isConfiguredEnv
};

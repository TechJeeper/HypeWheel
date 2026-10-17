/**
 * Twitch IRC over WebSocket + Implicit OAuth (GitHub Pages friendly).
 * Exposed as window.TwitchChat
 *
 * Setup (one-time, site owner):
 * 1. Create an app at https://dev.twitch.tv/console/apps
 * 2. Set OAuth Redirect URLs exactly (include trailing slash if your site uses it):
 *    https://hypewheel.app/
 *    https://www.hypewheel.app/
 * 3. Paste the Client ID into TWITCH_CLIENT_ID below.
 */
(function (global) {
  "use strict";

  // --- Site owner: set your Twitch Application Client ID ---
  const TWITCH_CLIENT_ID = "zrz7jjtnzbrcjols4c4nr6ncqdp9l8";

  const WS_URL = "wss://irc-ws.chat.twitch.tv:443";
  const MIN_BACKOFF_MS = 1000;
  const MAX_BACKOFF_MS = 30000;
  const SEND_GAP_MS = 1600;
  const AUTH_STORAGE_KEY = "hypewheel_twitch_auth";
  const OAUTH_STATE_KEY = "hypewheel_twitch_oauth_state";
  // IRC scopes (not Helix user:write:chat) — chat:write is invalid
  const OAUTH_SCOPES = "chat:read chat:edit";

  const normalizeChannel = (raw) => {
    if (!raw) return "";
    let s = String(raw).trim();
    s = s.replace(/^https?:\/\//i, "");
    s = s.replace(/^(www\.)?twitch\.tv\//i, "");
    s = s.replace(/^@/, "");
    s = s.split(/[/?#]/)[0];
    s = s.replace(/^#/, "").toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(s)) return "";
    return s;
  };

  const messageHasKeyword = (message, keyword) => {
    const kw = String(keyword || "").trim();
    if (!kw) return false;
    const target = kw.toLowerCase();
    return String(message || "")
      .split(/\s+/)
      .some((token) => token.toLowerCase() === target);
  };

  const parseIrcTags = (tagStr) => {
    const tags = {};
    if (!tagStr) return tags;
    tagStr.split(";").forEach((part) => {
      const eq = part.indexOf("=");
      if (eq === -1) tags[part] = true;
      else tags[part.slice(0, eq)] = part.slice(eq + 1);
    });
    return tags;
  };

  const parsePrivmsg = (line) => {
    let rest = line;
    let tags = {};
    if (rest.startsWith("@")) {
      const space = rest.indexOf(" ");
      if (space === -1) return null;
      tags = parseIrcTags(rest.slice(1, space));
      rest = rest.slice(space + 1);
    }
    const match = rest.match(/^:([^!]+)![^\s]+ PRIVMSG #[^\s]+ :(.*)$/);
    if (!match) return null;
    const login = match[1];
    const display = String(tags["display-name"] || "").trim();
    return {
      login,
      displayName: display || login,
      message: match[2],
    };
  };

  const resolveKeyword = (keyword) =>
    typeof keyword === "function" ? keyword() : keyword;

  const getRedirectUri = () => {
    const path = window.location.pathname || "/";
    const normalized = path.endsWith("/") ? path : path.replace(/[^/]+$/, "");
    return window.location.origin + (normalized || "/");
  };

  const randomState = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const readAuth = () => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.token || !data.login) return null;
      return {
        token: String(data.token),
        login: String(data.login).toLowerCase(),
        displayName: data.displayName ? String(data.displayName) : String(data.login),
      };
    } catch {
      return null;
    }
  };

  const writeAuth = (auth) => {
    if (!auth || !auth.token || !auth.login) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: auth.token,
        login: String(auth.login).toLowerCase(),
        displayName: auth.displayName || auth.login,
      }),
    );
  };

  const clearAuth = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const getClientId = () => String(TWITCH_CLIENT_ID || "").trim();

  const isOAuthConfigured = () => !!getClientId();

  const buildAuthorizeUrl = () => {
    const clientId = getClientId();
    if (!clientId) return "";
    const state = randomState();
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      response_type: "token",
      scope: OAUTH_SCOPES,
      state,
      force_verify: "false",
    });
    return "https://id.twitch.tv/oauth2/authorize?" + params.toString();
  };

  const parseHashParams = () => {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    if (!params.has("access_token") && !params.has("error")) return null;
    return params;
  };

  const clearOAuthHash = () => {
    const url = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", url);
  };

  const validateToken = async (token) => {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: "OAuth " + token },
    });
    if (!res.ok) throw new Error("Token invalid");
    return res.json();
  };

  /**
   * If the URL hash contains an Implicit OAuth result, store the token and clean the URL.
   * Returns { ok, login } or { ok: false, error } or null if no callback present.
   */
  const consumeOAuthCallback = async () => {
    const params = parseHashParams();
    if (!params) return null;

    clearOAuthHash();

    if (params.get("error")) {
      return {
        ok: false,
        error: params.get("error_description") || params.get("error"),
      };
    }

    const token = params.get("access_token");
    const state = params.get("state") || "";
    const expected = sessionStorage.getItem(OAUTH_STATE_KEY) || "";
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    if (!token) return { ok: false, error: "No access token returned" };
    if (!expected || state !== expected) {
      return { ok: false, error: "OAuth state mismatch — try again" };
    }

    try {
      const info = await validateToken(token);
      const login = String(info.login || "").toLowerCase();
      if (!login) return { ok: false, error: "Could not read Twitch login" };
      writeAuth({ token, login, displayName: login });
      return { ok: true, login };
    } catch {
      return { ok: false, error: "Could not validate Twitch token" };
    }
  };

  const startOAuthLogin = () => {
    const url = buildAuthorizeUrl();
    if (!url) {
      return { ok: false, error: "Twitch Client ID is not configured" };
    }
    window.location.assign(url);
    return { ok: true };
  };

  const logout = () => {
    clearAuth();
  };

  const createClient = (options) => {
    const channel = normalizeChannel(options && options.channel);
    const onMessage = options && options.onMessage;
    const onStatus = options && options.onStatus;
    const keywordOpt = options && options.keyword;
    const leaveKeywordOpt = options && options.leaveKeyword;
    const auth = options && options.auth;

    let ws = null;
    let wanted = true;
    let reconnectTimer = null;
    let backoff = MIN_BACKOFF_MS;
    let sendQueue = Promise.resolve();
    let lastSendAt = 0;

    const setStatus = (state, detail) => {
      if (typeof onStatus === "function") onStatus(state, detail || {});
    };

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (!wanted) return;
      clearReconnect();
      setStatus("reconnecting", { delay: backoff, channel });
      reconnectTimer = setTimeout(open, backoff);
      backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
    };

    const handleLine = (line) => {
      if (!line) return;
      if (line.startsWith("PING")) {
        const payload = line.slice(5).trim() || ":tmi.twitch.tv";
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send("PONG " + payload);
        }
        return;
      }
      const priv = parsePrivmsg(line);
      if (!priv || typeof onMessage !== "function") return;
      // Ignore our own outbound confirmations if they somehow match keywords
      if (
        auth &&
        auth.login &&
        String(priv.login || "").toLowerCase() === String(auth.login).toLowerCase()
      ) {
        return;
      }
      const joinKw = String(resolveKeyword(keywordOpt) || "").trim();
      const leaveKw = String(resolveKeyword(leaveKeywordOpt) || "").trim();
      const hasLeave =
        leaveKw &&
        leaveKw.toLowerCase() !== joinKw.toLowerCase() &&
        messageHasKeyword(priv.message, leaveKw);
      const hasJoin = joinKw && messageHasKeyword(priv.message, joinKw);
      if (hasLeave) {
        onMessage({ ...priv, action: "leave" });
        return;
      }
      if (hasJoin) {
        onMessage({ ...priv, action: "join" });
      }
    };

    const open = () => {
      if (!wanted || !channel) return;
      clearReconnect();
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        scheduleReconnect();
        return;
      }
      setStatus("connecting", { channel });
      ws.onopen = () => {
        backoff = MIN_BACKOFF_MS;
        ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
        if (auth && auth.token && auth.login) {
          ws.send("PASS oauth:" + auth.token);
          ws.send("NICK " + String(auth.login).toLowerCase());
        } else {
          const nick = "justinfan" + Math.floor(Math.random() * 90000 + 10000);
          ws.send("PASS SCHMOOPIE");
          ws.send("NICK " + nick);
        }
        ws.send("JOIN #" + channel);
        setStatus("connected", { channel, canSend: !!(auth && auth.token) });
      };
      ws.onmessage = (ev) => {
        String(ev.data)
          .split(/\r?\n/)
          .forEach(handleLine);
      };
      ws.onclose = () => {
        ws = null;
        if (wanted) {
          setStatus("disconnected", { channel });
          scheduleReconnect();
        } else {
          setStatus("idle", { channel });
        }
      };
    };

    const send = (text) => {
      const body = String(text || "").trim();
      if (!body) return Promise.resolve(false);
      if (!auth || !auth.token) return Promise.resolve(false);

      sendQueue = sendQueue.then(async () => {
        const wait = Math.max(0, SEND_GAP_MS - (Date.now() - lastSendAt));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        try {
          ws.send("PRIVMSG #" + channel + " :" + body);
          lastSendAt = Date.now();
          return true;
        } catch {
          return false;
        }
      });
      return sendQueue;
    };

    const disconnect = () => {
      wanted = false;
      clearReconnect();
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        ws = null;
      }
      setStatus("idle", { channel });
    };

    if (!channel) {
      wanted = false;
      setStatus("error", { message: "Invalid channel" });
      return { disconnect, send: () => Promise.resolve(false), canSend: false };
    }

    open();
    return {
      disconnect,
      send,
      canSend: !!(auth && auth.token),
    };
  };

  global.TwitchChat = {
    normalizeChannel,
    messageHasKeyword,
    parsePrivmsg,
    createClient,
    getClientId,
    isOAuthConfigured,
    getRedirectUri,
    getAuth: readAuth,
    setAuth: writeAuth,
    clearAuth,
    startOAuthLogin,
    logout,
    consumeOAuthCallback,
    validateToken,
    OAUTH_SCOPES,
  };
})(typeof window !== "undefined" ? window : globalThis);

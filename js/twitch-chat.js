/**
 * Anonymous Twitch IRC over WebSocket (justinfan).
 * Exposed as window.TwitchChat
 */
(function (global) {
  "use strict";

  const WS_URL = "wss://irc-ws.chat.twitch.tv:443";
  const MIN_BACKOFF_MS = 1000;
  const MAX_BACKOFF_MS = 30000;

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

  const createClient = (options) => {
    const channel = normalizeChannel(options && options.channel);
    const onMessage = options && options.onMessage;
    const onStatus = options && options.onStatus;
    const keywordOpt = options && options.keyword;

    let ws = null;
    let wanted = true;
    let reconnectTimer = null;
    let backoff = MIN_BACKOFF_MS;

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
      if (!messageHasKeyword(priv.message, resolveKeyword(keywordOpt))) return;
      onMessage(priv);
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
        const nick = "justinfan" + Math.floor(Math.random() * 90000 + 10000);
        ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
        ws.send("PASS SCHMOOPIE");
        ws.send("NICK " + nick);
        ws.send("JOIN #" + channel);
        setStatus("connected", { channel });
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
      return { disconnect };
    }

    open();
    return { disconnect };
  };

  global.TwitchChat = {
    normalizeChannel,
    messageHasKeyword,
    parsePrivmsg,
    createClient,
  };
})(typeof window !== "undefined" ? window : globalThis);

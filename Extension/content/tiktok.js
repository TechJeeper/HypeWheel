(() => {
  const VERSION = 4;
  if (globalThis.__hypewheelTikTok === VERSION) return;
  globalThis.__hypewheelTikTok = VERSION;

  const {
    uniqueNames,
    textFrom,
    normalizeName,
    loadAllNamesWithDoubleCheck,
    doubleCheckHint,
    sleep,
    isScrollable,
  } = globalThis.HypewheelUtils;

  function isVideoPage() {
    return (
      /\/video\/\d+/i.test(location.pathname) ||
      /@[\w.-]+\/video\//i.test(location.pathname)
    );
  }

  function handleFromHref(href) {
    if (!href) return "";
    const match = String(href).match(/\/@([A-Za-z0-9._]+)/);
    return match ? match[1] : "";
  }

  function isCleanHandle(value) {
    const name = normalizeName(String(value || "").replace(/^@/, ""));
    if (!name || name.length < 2 || name.length > 30) return false;
    if (!/^[A-Za-z0-9._]+$/.test(name)) return false;
    // Reject blobs that clearly aren't handles
    if (/\bfriend\b/i.test(name)) return false;
    if (/\d{1,2}-\d{1,2}/.test(name)) return false;
    return true;
  }

  function cleanHandle(value) {
    let name = normalizeName(String(value || "").replace(/^@/, ""));
    if (!name) return "";

    // Strip junk TikTok appends into visible text: "pezliz · Friend", "techjeeper TechJeeper · 6-28"
    name = name.split("·")[0];
    name = name.split("|")[0];
    name = name.replace(/\bfriend\b/gi, "");
    name = name.replace(/\b\d{1,2}-\d{1,2}(-\d{2,4})?\b/g, "");
    name = normalizeName(name);

    // If multiple tokens, prefer the first that looks like a handle
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const handleToken = tokens.find((t) => isCleanHandle(t));
      if (handleToken) return handleToken;
      // Display names with spaces aren't usernames — bail
      return "";
    }

    return isCleanHandle(name) ? name : "";
  }

  function getVideoOwner() {
    const fromPath = location.pathname.match(/^\/@([A-Za-z0-9._]+)/);
    if (fromPath) return fromPath[1];

    const author =
      document.querySelector('[data-e2e="browse-username"]') ||
      document.querySelector('[data-e2e="video-author-uniqueid"]') ||
      document.querySelector('[data-e2e="video-author-avatar"]') ||
      document.querySelector('a[href^="/@"][data-e2e*="author" i]');

    if (author) {
      const href = author.getAttribute("href") || author.closest("a")?.getAttribute("href");
      const fromHref = handleFromHref(href || "");
      if (fromHref) return fromHref;
      return cleanHandle(textFrom(author));
    }
    return "";
  }

  function findCommentList() {
    return (
      document.querySelector('[data-e2e="comment-list"]') ||
      document.querySelector('[data-e2e="browse-comment-list"]') ||
      document.querySelector('[class*="CommentList"]') ||
      document.querySelector('[class*="comment-list" i]') ||
      null
    );
  }

  function findCommentScrollPane() {
    const list = findCommentList();
    if (!list) return null;
    if (isScrollable(list)) return list;

    let cur = list.parentElement;
    for (let i = 0; i < 8 && cur; i++) {
      if (isScrollable(cur)) return cur;
      cur = cur.parentElement;
    }
    return list;
  }

  function collectVisibleNames() {
    const owner = getVideoOwner();
    const list = findCommentList() || document.body;
    const names = [];
    const seen = new Set();

    const push = (raw) => {
      const name = cleanHandle(raw);
      if (!name) return;
      if (owner && name.toLowerCase() === owner.toLowerCase()) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(name);
    };

    // Strongest signal: profile links inside the comment list (/@handle)
    list.querySelectorAll('a[href*="/@"]').forEach((link) => {
      // Skip the sticky video author chrome if it somehow nests here
      if (link.closest('[data-e2e="video-author-avatar"], [data-e2e="browse-user-avatar"]')) {
        return;
      }
      const fromHref = handleFromHref(link.getAttribute("href") || "");
      if (fromHref) {
        push(fromHref);
        return;
      }
      push(textFrom(link));
    });

    // Dedicated username testids (prefer these; still clean them)
    const usernameSelectors = [
      '[data-e2e="comment-username-1"]',
      '[data-e2e="comment-username"]',
      '[data-e2e="comment-user-uniqueid"]',
      '[data-e2e="comment-user-name"]',
      '[data-e2e="comment-avatar-1"]',
    ];

    for (const selector of usernameSelectors) {
      list.querySelectorAll(selector).forEach((node) => {
        const href =
          node.getAttribute("href") ||
          node.closest("a")?.getAttribute("href") ||
          "";
        const fromHref = handleFromHref(href);
        if (fromHref) {
          push(fromHref);
          return;
        }
        push(textFrom(node));
      });
    }

    return names;
  }

  function clickTikTokExpanders(root) {
    if (!root) return 0;
    let clicked = 0;
    const patterns = [
      /view more/i,
      /load more/i,
      /see more/i,
      /more comments?/i,
      /view \d+ replies?/i,
      /\d+\s*replies?/i,
      /hide/i, // skip
    ];

    root
      .querySelectorAll('p, span, div[role="button"], button, [tabindex="0"]')
      .forEach((el) => {
        if (clicked >= 8) return;
        if (el.closest("a[href*='/@']")) return;
        const label = normalizeName(el.getAttribute("aria-label") || textFrom(el));
        if (!label || label.length > 40) return;
        if (/^hide\b/i.test(label)) return;
        if (!patterns.some((re) => re.test(label) && !/^hide/i.test(label))) {
          return;
        }
        // Only reply / more expanders
        if (
          !/more|replies?/i.test(label)
        ) {
          return;
        }
        try {
          el.click();
          clicked += 1;
        } catch {
          // ignore
        }
      });

    return clicked;
  }

  async function extractCommenters() {
    if (
      !isVideoPage() &&
      !document.querySelector(
        '[data-e2e="comment-list"], [class*="CommentList"]',
      )
    ) {
      return {
        ok: false,
        error: "Open a TikTok video page with comments visible.",
        names: [],
      };
    }

    const openBtn =
      document.querySelector('[data-e2e="comment-icon"]') ||
      document.querySelector('[data-e2e="browse-comment-icon"]');
    if (openBtn && !findCommentList()) {
      try {
        openBtn.click();
        await sleep(800);
      } catch {
        // ignore
      }
    }

    const { names, pass1Rounds, pass2Rounds, addedInCheck } =
      await loadAllNamesWithDoubleCheck({
      collectNames: collectVisibleNames,
      scrollCandidates: () =>
        [findCommentScrollPane(), findCommentList()].filter(Boolean),
      allowPageFallback: false,
      clickLoadMore: false,
      beforeScroll: async () => {
        clickTikTokExpanders(findCommentList() || document.body);
      },
      resetScroll: async () => {
        const pane = findCommentScrollPane() || findCommentList();
        if (pane) pane.scrollTop = 0;
        await sleep(350);
      },
      shouldAbort: () => {
        if (!isVideoPage() && !findCommentList()) {
          return "Stopped because you left the TikTok video.";
        }
        return false;
      },
      maxRounds: 60,
      idleStop: 5,
      delayMs: 550,
      maxMs: 60000,
    });

    const unique = uniqueNames(names);
    return {
      ok: true,
      platform: "TikTok",
      names: unique,
      count: unique.length,
      hint:
        unique.length === 0
          ? "No commenters found. Open the comments panel on the video."
          : doubleCheckHint(
              unique.length,
              pass1Rounds,
              pass2Rounds,
              addedInCheck,
              "username",
            ),
    };
  }

  if (globalThis.__hypewheelTikTokOnMessage) {
    chrome.runtime.onMessage.removeListener(
      globalThis.__hypewheelTikTokOnMessage,
    );
  }

  const onMessage = (message, _sender, sendResponse) => {
    if (message?.type === "HYPEWHEEL_PING") {
      sendResponse({ ok: true, platform: "TikTok", version: VERSION });
      return false;
    }
    if (message?.type === "HYPEWHEEL_EXTRACT") {
      extractCommenters().then(sendResponse);
      return true;
    }
    return false;
  };

  globalThis.__hypewheelTikTokOnMessage = onMessage;
  chrome.runtime.onMessage.addListener(onMessage);
})();

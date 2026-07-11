(() => {
  const VERSION = 7;
  if (globalThis.__hypewheelTwitter === VERSION) return;
  globalThis.__hypewheelTwitter = VERSION;

  const {
    uniqueNames,
    textFrom,
    loadAllNamesWithDoubleCheck,
    doubleCheckHint,
    normalizeName,
    sleep,
    isScrollable,
  } = globalThis.HypewheelUtils;

  function statusIdFromUrl(url = location.href) {
    const match = String(url).match(/\/(?:status|statuses)\/(\d+)/i);
    return match ? match[1] : null;
  }

  function isStatusPage() {
    return Boolean(statusIdFromUrl());
  }

  function primaryColumn() {
    return (
      document.querySelector('[data-testid="primaryColumn"]') ||
      document.querySelector('main[role="main"]') ||
      null
    );
  }

  function isAdTweet(article) {
    if (!article) return false;

    if (
      article.querySelector(
        '[data-testid="placementTracking"], [data-testid="promotedIndicator"]',
      )
    ) {
      return true;
    }

    const labelNodes = article.querySelectorAll(
      'span, div[dir="ltr"], div[dir="auto"]',
    );
    for (const node of labelNodes) {
      if (node.children.length > 2) continue;
      const label = normalizeName(node.textContent || "");
      if (!label || label.length > 16) continue;
      if (/^(ad|ads|promoted|promoted by)$/i.test(label)) return true;
    }

    const ariaBits = [
      article.getAttribute("aria-label") || "",
      ...Array.from(article.querySelectorAll("[aria-label]")).map(
        (el) => el.getAttribute("aria-label") || "",
      ),
    ].join(" ");
    if (/\b(promoted|sponsored)\b/i.test(ariaBits)) return true;
    if (/(?:^|[^a-z])ad(?:[^a-z]|$)/i.test(ariaBits)) return true;

    return false;
  }

  function handleFromHref(href) {
    if (!href) return "";
    const match = String(href).match(/^\/([A-Za-z0-9_]{1,15})\/?(?:\?|$)/);
    return match ? match[1] : "";
  }

  function getHandleFromUserName(userName) {
    if (!userName) return "";

    // aria-label is often "Display Name (@handle)" or includes @handle
    const aria = userName.getAttribute("aria-label") || "";
    const fromAria = aria.match(/@([A-Za-z0-9_]{1,15})\b/);
    if (fromAria) return fromAria[1];

    // Profile links: x.com/Handle
    const profileLinks = userName.querySelectorAll('a[href^="/"]');
    for (const link of profileLinks) {
      const handle = handleFromHref(link.getAttribute("href") || "");
      if (handle) return handle;
    }

    // Visible @handle line in the User-Name block (below display name)
    for (const line of textFrom(userName).split("\n")) {
      const trimmed = line.trim();
      const match = trimmed.match(/^@([A-Za-z0-9_]{1,15})$/);
      if (match) return match[1];
    }

    return "";
  }

  function getAuthorFromTweet(article) {
    if (isAdTweet(article)) return "";

    const userName = article.querySelector('[data-testid="User-Name"]');
    const handle = getHandleFromUserName(userName);
    return handle ? `@${handle}` : "";
  }

  function collectVisibleNames() {
    const root = primaryColumn() || document;
    const articles = Array.from(
      root.querySelectorAll('article[data-testid="tweet"]'),
    );

    // First top-level article is the original post
    const commentArticles = articles.length > 1 ? articles.slice(1) : [];

    const names = [];
    const seen = new Set();

    for (const article of commentArticles) {
      if (isAdTweet(article)) continue;
      const name = getAuthorFromTweet(article);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }

    return names;
  }

  function findReplyScrollPane() {
    const column = primaryColumn();
    if (!column) return null;

    const candidates = [
      column.querySelector('[aria-label*="Timeline" i]'),
      column.querySelector('section[role="region"]'),
      column.querySelector("section"),
      column,
    ].filter(Boolean);

    for (const el of candidates) {
      if (isScrollable(el)) return el;
    }

    let best = null;
    let bestScore = 0;
    column.querySelectorAll("div, section, main").forEach((el) => {
      if (!isScrollable(el)) return;
      const score = el.scrollHeight * el.clientHeight;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best || column;
  }

  function expandReplyThreads(column) {
    if (!column) return 0;
    let clicked = 0;
    const patterns = [
      /show (?:more )?replies?/i,
      /view (?:more )?replies?/i,
      /show additional replies?/i,
      /view additional replies?/i,
      /show \d+ more replies?/i,
      /view \d+ more replies?/i,
      /\d+ more repl/i,
      /^show replies$/i,
      /^more replies$/i,
    ];

    column
      .querySelectorAll(
        '[role="button"], div[role="button"], span[role="button"], button',
      )
      .forEach((btn) => {
        if (clicked >= 12) return;
        if (btn.closest("a[href]")) return;
        const label = normalizeName(
          btn.getAttribute("aria-label") || textFrom(btn),
        );
        if (!label || label.length > 80) return;
        if (!patterns.some((re) => re.test(label))) return;
        try {
          btn.click();
          clicked += 1;
        } catch {
          // ignore
        }
      });

    return clicked;
  }

  function scrollReplyPane(pane) {
    if (!pane) {
      window.scrollBy(0, Math.max(400, window.innerHeight * 0.75));
      return;
    }
    const delta = Math.max(320, Math.floor(pane.clientHeight * 0.85));
    pane.scrollTop = Math.min(pane.scrollTop + delta, pane.scrollHeight);
    pane.dispatchEvent(new Event("scroll", { bubbles: true }));
    // Some X layouts listen on window scroll too
    window.scrollBy(0, Math.floor(delta * 0.35));
  }

  async function extractCommenters() {
    if (!isStatusPage()) {
      return {
        ok: false,
        error:
          "Open a post page on X/Twitter (a URL with /status/...) so comments can be collected.",
        names: [],
      };
    }

    const startStatusId = statusIdFromUrl();
    const startHref = location.href;

    const { names, pass1Rounds, pass2Rounds, addedInCheck, aborted, abortReason } =
      await loadAllNamesWithDoubleCheck({
      collectNames: collectVisibleNames,
      scrollCandidates: () => [findReplyScrollPane()].filter(Boolean),
      allowPageFallback: false,
      clickLoadMore: false,
      beforeScroll: async () => {
        const column = primaryColumn();
        expandReplyThreads(column);
        await sleep(200);
        scrollReplyPane(findReplyScrollPane());
      },
      resetScroll: async () => {
        const pane = findReplyScrollPane();
        if (pane) pane.scrollTop = 0;
        window.scrollTo(0, 0);
        await sleep(350);
      },
      shouldAbort: () => {
        if (statusIdFromUrl() !== startStatusId) {
          return "Stopped because X navigated away from this post.";
        }
        if (!/\/(?:status|statuses)\/\d+/i.test(location.pathname)) {
          return "Stopped because X left the post page.";
        }
        if (
          !location.href.includes(startStatusId) &&
          location.href !== startHref
        ) {
          return "Stopped because the page URL changed.";
        }
        return false;
      },
      maxRounds: 80,
      idleStop: 8,
      delayMs: 600,
      maxMs: 75000,
    });

    const unique = uniqueNames(names);
    if (aborted && unique.length === 0) {
      return {
        ok: false,
        error:
          abortReason ||
          "X navigated away while loading replies. Stay on the post tab and try Extract again.",
        names: [],
      };
    }

    return {
      ok: true,
      platform: "X / Twitter",
      names: unique,
      count: unique.length,
      hint: aborted
        ? `${abortReason} Kept ${unique.length} unique commenter${
            unique.length === 1 ? "" : "s"
          } collected before that.`
        : unique.length === 0
          ? "No commenters found. Make sure replies are visible on this post."
          : doubleCheckHint(
              unique.length,
              pass1Rounds,
              pass2Rounds,
              addedInCheck,
              "handle",
            ),
    };
  }

  if (globalThis.__hypewheelTwitterOnMessage) {
    chrome.runtime.onMessage.removeListener(
      globalThis.__hypewheelTwitterOnMessage,
    );
  }

  const onMessage = (message, _sender, sendResponse) => {
    if (message?.type === "HYPEWHEEL_PING") {
      sendResponse({ ok: true, platform: "X / Twitter", version: VERSION });
      return false;
    }
    if (message?.type === "HYPEWHEEL_EXTRACT") {
      extractCommenters().then(sendResponse);
      return true;
    }
    return false;
  };

  globalThis.__hypewheelTwitterOnMessage = onMessage;
  chrome.runtime.onMessage.addListener(onMessage);
})();

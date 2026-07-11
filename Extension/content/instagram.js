(() => {
  const VERSION = 5;
  if (globalThis.__hypewheelInstagram === VERSION) return;
  globalThis.__hypewheelInstagram = VERSION;

  const {
    uniqueNames,
    textFrom,
    normalizeName,
    loadAllNamesWithDoubleCheck,
    doubleCheckHint,
    sleep,
    isScrollable,
  } = globalThis.HypewheelUtils;

  const BLOCKED_PATHS = new Set([
    "p",
    "reel",
    "reels",
    "tv",
    "stories",
    "explore",
    "accounts",
    "direct",
    "about",
    "legal",
    "privacy",
    "nametag",
    "inbox",
    "liked_by",
    "following",
    "followers",
    "tagged",
    "guide",
    "live",
  ]);

  function isRelativeTime(value) {
    const v = normalizeName(value);
    // Instagram comment ages: 4d, 17h, 1w, 3m, 2s
    return /^\d{1,3}[dhmswy]$/i.test(v);
  }

  function isValidUsername(value) {
    const name = normalizeName(String(value || "").replace(/^@/, ""));
    if (!name || name.length < 2 || name.length > 40) return false;
    if (!/^[A-Za-z0-9._]+$/.test(name)) return false;
    if (BLOCKED_PATHS.has(name.toLowerCase())) return false;
    if (isRelativeTime(name)) return false;
    if (/^\d+$/.test(name)) return false;
    // Real handles include a letter; filters "4d", "17h", etc.
    if (!/[A-Za-z]/.test(name)) return false;
    return true;
  }

  function isPostView() {
    return (
      /\/(p|reel|tv)\//i.test(location.pathname) ||
      !!document.querySelector("article") ||
      !!document.querySelector('[role="dialog"]')
    );
  }

  function usernameFromHref(href) {
    if (!href) return "";
    try {
      const path = href.startsWith("http")
        ? new URL(href, location.origin).pathname
        : href.split("?")[0].split("#")[0];
      // /username/ or /username
      const match = path.match(/^\/([A-Za-z0-9._]+)\/?$/);
      if (!match) return "";
      const user = match[1];
      if (BLOCKED_PATHS.has(user.toLowerCase())) return "";
      return user;
    } catch {
      return "";
    }
  }

  function findPostShell() {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) return dialog;
    return document.querySelector("article") || document.querySelector("main") || document.body;
  }

  function findCommentsRoot(shell) {
    if (!shell) return null;

    // Prefer an unordered list of comments (Instagram’s classic structure)
    const lists = Array.from(shell.querySelectorAll("ul"));
    let best = null;
    let bestScore = 0;
    for (const ul of lists) {
      const profileLinks = Array.from(ul.querySelectorAll('a[href^="/"]')).filter(
        (a) => usernameFromHref(a.getAttribute("href")),
      );
      const score = profileLinks.length * 10 + (isScrollable(ul) ? 5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = ul;
      }
    }
    if (best) return best;

    // Scrollable column that contains many profile links
    let bestPane = null;
    let paneScore = 0;
    shell.querySelectorAll("div, section").forEach((el) => {
      const links = Array.from(el.querySelectorAll(':scope > * a[href^="/"], a[href^="/"]'))
        .map((a) => usernameFromHref(a.getAttribute("href")))
        .filter(Boolean);
      if (links.length < 3) return;
      let score = new Set(links.map((n) => n.toLowerCase())).size;
      if (isScrollable(el)) score += 8;
      if (score > paneScore) {
        paneScore = score;
        bestPane = el;
      }
    });
    return bestPane || shell;
  }

  function findCommentsScrollPane(shell) {
    const root = findCommentsRoot(shell);
    if (!root) return null;
    if (isScrollable(root)) return root;

    let cur = root.parentElement;
    for (let i = 0; i < 10 && cur; i++) {
      if (isScrollable(cur)) return cur;
      cur = cur.parentElement;
    }

    let best = null;
    let bestScore = 0;
    (shell || document).querySelectorAll("div, ul, section").forEach((el) => {
      if (!isScrollable(el)) return;
      const users = Array.from(el.querySelectorAll('a[href^="/"]'))
        .map((a) => usernameFromHref(a.getAttribute("href")))
        .filter(Boolean);
      if (users.length < 1) return;
      const score = el.clientHeight * users.length;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best || root;
  }

  function getPostOwner(shell) {
    // Header of the post (not sidebar)
    const header =
      shell.querySelector("header") ||
      shell.querySelector('a[href^="/"][role="link"]');
    const headerLink =
      shell.querySelector("header a[href^='/']") ||
      Array.from(shell.querySelectorAll('a[href^="/"]')).find((a) =>
        usernameFromHref(a.getAttribute("href")),
      );
    return usernameFromHref(headerLink?.getAttribute("href") || "");
  }

  function collectVisibleNames() {
    const shell = findPostShell();
    const commentsRoot = findCommentsRoot(shell) || shell;
    const owner = getPostOwner(shell);
    const names = [];
    const seen = new Set();

    const push = (raw) => {
      if (!isValidUsername(raw)) return;
      const name = normalizeName(String(raw || "").replace(/^@/, ""));
      if (owner && name.toLowerCase() === owner.toLowerCase()) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(name);
    };

    // Comment author links — always use profile href, not visible text (timestamps like "4d")
    commentsRoot.querySelectorAll('a[href^="/"]').forEach((link) => {
      if (link.closest('nav, [role="navigation"]')) return;
      const href = link.getAttribute("href") || "";
      if (/\/(liked_by|following|followers)\b/i.test(href)) return;

      const user = usernameFromHref(href);
      if (user) push(user);
    });

    return names;
  }

  function isPlusLoadMoreButton(el) {
    if (!el || el.closest("a[href]")) return false;

    const aria = normalizeName(el.getAttribute("aria-label") || "");
    if (
      /load more comments|more comments|view more comments|load more replies|view replies/i.test(
        aria,
      )
    ) {
      return true;
    }

    // Circular + control: button/svg with little/no text
    const text = normalizeName(textFrom(el));
    if (text && text.length > 24) return false;
    if (text && !/^\+|view replies|\d+\s*replies?$/i.test(text) && text.length > 2) {
      // allow empty / "+" / "View replies (2)"
      if (!/view replies/i.test(text)) return false;
    }

    const hasPlusSvg = Boolean(
      el.querySelector(
        'svg[aria-label*="comment" i], svg[aria-label*="more" i], svg[aria-label*="load" i]',
      ) ||
        // Many IG builds use a path-only + icon without aria on the svg
        (el.matches("button, div[role='button'], span[role='button']") &&
          el.querySelector("svg") &&
          (text === "" || text === "+" || /^view replies/i.test(text))),
    );

    // Geometry: roughly circular control near comments
    const rect = el.getBoundingClientRect();
    const roundish =
      rect.width > 18 &&
      rect.width < 56 &&
      rect.height > 18 &&
      rect.height < 56 &&
      Math.abs(rect.width - rect.height) < 12;

    if (hasPlusSvg && roundish) return true;
    if (hasPlusSvg && /view replies|^$/i.test(text)) return true;
    return false;
  }

  function clickInstagramLoadMore(shell) {
    if (!shell) return 0;
    const root = findCommentsRoot(shell) || shell;
    let clicked = 0;

    // 1) Explicit text controls
    const textPatterns = [
      /view all \d+ comments?/i,
      /view more comments?/i,
      /load more comments?/i,
      /view replies/i,
      /^\d+\s*replies?/i,
    ];

    root.querySelectorAll('button, div[role="button"], span[role="button"]').forEach((el) => {
      if (clicked >= 10) return;
      if (el.closest("a[href]")) return;
      const label = normalizeName(el.getAttribute("aria-label") || textFrom(el));
      if (label && textPatterns.some((re) => re.test(label))) {
        try {
          el.click();
          clicked += 1;
        } catch {
          // ignore
        }
      }
    });

    // 2) Circular “+” load-more buttons in the comment thread
    const candidates = root.querySelectorAll(
      'button, div[role="button"], span[role="button"], [tabindex="0"]',
    );
    for (const el of candidates) {
      if (clicked >= 12) break;
      if (!isPlusLoadMoreButton(el)) continue;
      try {
        el.click();
        clicked += 1;
      } catch {
        // ignore
      }
    }

    // 3) “View replies (N)” text buttons / links styled as buttons
    root.querySelectorAll("button, span, div").forEach((el) => {
      if (clicked >= 14) return;
      const label = normalizeName(textFrom(el));
      if (!/^view replies\b/i.test(label) && !/^view \d+ replies?\b/i.test(label)) {
        return;
      }
      if (label.length > 40) return;
      try {
        (el.closest('button, [role="button"]') || el).click();
        clicked += 1;
      } catch {
        // ignore
      }
    });

    return clicked;
  }

  async function extractCommenters() {
    if (!isPostView()) {
      return {
        ok: false,
        error: "Open an Instagram post or reel so comments can be collected.",
        names: [],
      };
    }

    // Wait briefly for comments column to paint
    await sleep(300);

    const shell = () => findPostShell();

    const { names, pass1Rounds, pass2Rounds, addedInCheck } =
      await loadAllNamesWithDoubleCheck({
      collectNames: collectVisibleNames,
      scrollCandidates: () => {
        const s = shell();
        return [findCommentsScrollPane(s), findCommentsRoot(s), s].filter(Boolean);
      },
      allowPageFallback: false,
      clickLoadMore: false,
      beforeScroll: async () => {
        clickInstagramLoadMore(shell());
      },
      resetScroll: async () => {
        const s = shell();
        const pane = findCommentsScrollPane(s) || findCommentsRoot(s);
        if (pane) pane.scrollTop = 0;
        await sleep(350);
      },
      shouldAbort: () => {
        if (!isPostView()) return "Stopped because you left the Instagram post.";
        return false;
      },
      maxRounds: 70,
      idleStop: 6,
      delayMs: 650,
      maxMs: 75000,
    });

    const unique = uniqueNames(names);
    return {
      ok: true,
      platform: "Instagram",
      names: unique,
      count: unique.length,
      hint:
        unique.length === 0
          ? "No commenters found. Open the post with comments visible, then try again."
          : doubleCheckHint(
              unique.length,
              pass1Rounds,
              pass2Rounds,
              addedInCheck,
              "commenter",
            ),
    };
  }

  if (globalThis.__hypewheelInstagramOnMessage) {
    chrome.runtime.onMessage.removeListener(
      globalThis.__hypewheelInstagramOnMessage,
    );
  }

  const onMessage = (message, _sender, sendResponse) => {
    if (message?.type === "HYPEWHEEL_PING") {
      sendResponse({ ok: true, platform: "Instagram", version: VERSION });
      return false;
    }
    if (message?.type === "HYPEWHEEL_EXTRACT") {
      extractCommenters().then(sendResponse);
      return true;
    }
    return false;
  };

  globalThis.__hypewheelInstagramOnMessage = onMessage;
  chrome.runtime.onMessage.addListener(onMessage);
})();

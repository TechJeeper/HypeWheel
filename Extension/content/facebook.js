(() => {
  const VERSION = 7;
  if (globalThis.__hypewheelFacebook === VERSION) return;
  globalThis.__hypewheelFacebook = VERSION;

  const {
    uniqueNames,
    textFrom,
    normalizeName,
    loadAllNamesWithDoubleCheck,
    doubleCheckHint,
    sleep,
    isScrollable,
  } = globalThis.HypewheelUtils;

  const SKIP = new Set([
    "like",
    "reply",
    "share",
    "see more",
    "see translation",
    "hide",
    "top fan",
    "author",
    "most relevant",
    "all comments",
    "newest",
    "facebook",
    "follow",
    "following",
    "message",
    "write a comment",
    "write a comment…",
    "write a comment...",
    "edited",
    "sponsors",
    "sponsored",
  ]);

  function looksLikePersonName(value) {
    const name = normalizeName(value);
    if (!name || name.length < 2 || name.length > 60) return false;
    if (SKIP.has(name.toLowerCase())) return false;
    if (/^\d+$/.test(name)) return false;
    if (/^(http|www\.|youtube\.|youtu\.be)/i.test(name)) return false;
    if (/#/.test(name)) return false; // video titles / hashtags
    if (/[🗡️⚔️🔥💀⭐️✨🎬]/.test(name)) return false;
    if (/^(like|reply|share|view|hide|follow)\b/i.test(name)) return false;
    // Garbage FB tokens / random ids
    if (/^[a-z0-9_-]{20,}$/i.test(name) && !/\s/.test(name)) return false;
    if ((name.match(/[0-9]/g) || []).length >= 6 && !/\s/.test(name)) {
      return false;
    }
    // Link preview titles often have punctuation density
    if ((name.match(/[.!?]{2,}|[|]{1,}/g) || []).length > 0 && name.length > 25) {
      return false;
    }
    return true;
  }

  function isPostPermalink() {
    const path = location.pathname || "";
    const href = location.href || "";
    return (
      /\/groups\/[^/]+\/posts\/\d+/i.test(path) ||
      /\/posts\/\d+/i.test(path) ||
      /\/permalink\.php/i.test(path) ||
      /\/story\.php/i.test(path) ||
      /\/videos\/\d+/i.test(path) ||
      /\/reel\/\d+/i.test(path) ||
      /[?&]story_fbid=/i.test(href) ||
      /[?&]fbid=\d+/i.test(href)
    );
  }

  function postKeyFromUrl() {
    const path = location.pathname || "";
    const href = location.href || "";
    let match =
      path.match(/\/groups\/[^/]+\/posts\/(\d+)/i) ||
      path.match(/\/posts\/(\d+)/i) ||
      path.match(/\/videos\/(\d+)/i) ||
      path.match(/\/reel\/(\d+)/i);
    if (match) return match[1];
    try {
      const params = new URLSearchParams(location.search);
      return (
        params.get("story_fbid") ||
        params.get("fbid") ||
        params.get("v") ||
        href
      );
    } catch {
      return href;
    }
  }

  function findPostModal() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    if (!dialogs.length) return null;

    const scored = dialogs.map((dialog) => {
      const label = normalizeName(
        dialog.getAttribute("aria-label") ||
          textFrom(dialog.querySelector("h2, h1")) ||
          "",
      );
      let score = 0;
      if (/post/i.test(label)) score += 5;
      if (/comment/i.test(label)) score += 3;
      if (dialog.querySelector('[aria-label*="Comment" i]')) score += 4;
      if (dialog.querySelector('form, [contenteditable="true"]')) score += 2;
      const rect = dialog.getBoundingClientRect();
      if (rect.width > 300 && rect.height > 300) score += 2;
      score += Math.min(3, Math.floor((rect.width * rect.height) / 200000));
      return { dialog, score, label };
    });

    scored.sort((a, b) => b.score - a.score);
    // Only accept dialogs that look like a post — never fall back to chat/misc dialogs
    return scored[0]?.score > 0 ? scored[0].dialog : null;
  }

  function findSortControl(scope) {
    if (!scope) return null;
    return Array.from(
      scope.querySelectorAll(
        'div[role="button"], span[role="button"], [role="combobox"]',
      ),
    ).find((el) => {
      if (el.closest('a[href]')) return false;
      const t = normalizeName(textFrom(el));
      return /^(most relevant|newest|all comments)$/i.test(t);
    });
  }

  function findPermalinkPostRoot() {
    const main =
      document.querySelector('[role="main"]') ||
      document.querySelector("#content") ||
      document.body;

    const labeled =
      main.querySelector('[aria-label="Comments"]') ||
      main.querySelector('[aria-label*="Comments" i]');
    if (labeled) {
      let cur = labeled.parentElement;
      for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
        if (
          cur.querySelector(
            'form, [contenteditable="true"], [aria-label*="Write a comment" i]',
          ) ||
          findSortControl(cur) ||
          cur.getAttribute("role") === "article"
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return labeled.closest('[role="article"]') || labeled.parentElement || main;
    }

    const sortBtn = findSortControl(main);
    if (sortBtn) {
      let cur = sortBtn.parentElement;
      for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
        if (
          cur.querySelector('[aria-label*="Comment by" i]') ||
          cur.getAttribute("role") === "article" ||
          cur.querySelector('form, [contenteditable="true"]')
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return sortBtn.closest('[role="article"]') || main;
    }

    const firstComment = main.querySelector('[aria-label*="Comment by" i]');
    if (firstComment) {
      return (
        firstComment.closest('[role="article"]') ||
        firstComment.closest('[role="main"]') ||
        main
      );
    }

    const articles = Array.from(main.querySelectorAll('[role="article"]'));
    const withComments = articles.find(
      (el) =>
        el.querySelector('[aria-label*="Comment by" i]') ||
        findSortControl(el) ||
        el.querySelector('[aria-label*="Comments" i]'),
    );
    if (withComments) return withComments;

    return isPostPermalink() ? main : null;
  }

  /** Modal post dialog, or the inline permalink post root. */
  function findPostScope() {
    const modal = findPostModal();
    if (modal) return { root: modal, mode: "modal" };
    const permalink = findPermalinkPostRoot();
    if (permalink) return { root: permalink, mode: "permalink" };
    return null;
  }

  function getPostAuthor(scope) {
    if (!scope) return "";
    const aria = normalizeName(scope.getAttribute("aria-label") || "");
    // "Cody Dean's Post" / "Cody Dean’s Post"
    let match = aria.match(/^(.+?)[''`′’]s\s+Post$/i);
    if (match) return normalizeName(match[1]);

    const heading = normalizeName(
      textFrom(scope.querySelector('h2[id], [role="heading"]')),
    );
    match = heading.match(/^(.+?)[''`′’]s\s+Post$/i);
    if (match) return normalizeName(match[1]);

    // Author link near top of post (before comments)
    const headerLink = scope.querySelector(
      'h2 a[role="link"], [role="banner"] a[role="link"], a[role="link"]',
    );
    const headerName = textFrom(headerLink);
    if (looksLikePersonName(headerName)) return headerName;

    return "";
  }

  function findCommentsRoot(scope) {
    if (!scope) return null;

    const labeled =
      scope.querySelector('[aria-label="Comments"]') ||
      scope.querySelector('[aria-label*="Comments" i]');
    if (labeled) return labeled;

    // Section after the sort control ("Most relevant" / "All comments")
    const sortBtn = findSortControl(scope);
    if (sortBtn) {
      let cur = sortBtn.parentElement;
      for (let i = 0; i < 6 && cur && cur !== scope; i++) {
        if (
          cur.querySelector('[aria-label*="Comment by" i]') ||
          cur.querySelector("ul")
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
    }

    const firstComment = scope.querySelector('[aria-label*="Comment by" i]');
    if (firstComment) {
      let cur = firstComment.parentElement;
      for (let i = 0; i < 8 && cur && cur !== scope; i++) {
        if (cur.querySelectorAll('[aria-label*="Comment by" i]').length >= 2) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return firstComment.parentElement || firstComment;
    }

    return null;
  }

  function findCommentPane(scope) {
    const root = findCommentsRoot(scope) || scope;
    if (!root) return null;
    if (isScrollable(root)) return root;

    let cur = root.parentElement;
    for (let i = 0; i < 8 && cur; i++) {
      if (isScrollable(cur)) return cur;
      cur = cur.parentElement;
    }

    let best = null;
    let bestScore = 0;
    const searchRoot = scope || document;
    searchRoot.querySelectorAll("div, section, ul").forEach((el) => {
      if (scope && !scope.contains(el)) return;
      if (!isScrollable(el)) return;
      const score = el.scrollHeight * el.clientHeight;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best || root;
  }

  async function switchToAllComments(scope) {
    if (!scope) return { ok: false, reason: "no-scope" };

    const current = findSortControl(scope);
    const currentText = current ? normalizeName(textFrom(current)) : "";
    if (/^all comments$/i.test(currentText)) {
      return { ok: true, already: true };
    }

    // Only click the known sort label — never broad "sort"/"filter" matches
    // (those can hit nav and send Facebook back to facebook.com).
    const opener = current;
    if (!opener) return { ok: false, reason: "no-opener" };

    const startHref = location.href;
    try {
      opener.click();
    } catch {
      return { ok: false, reason: "opener-click-failed" };
    }
    await sleep(450);

    if (location.href !== startHref && !location.href.includes(postKeyFromUrl())) {
      return { ok: false, reason: "navigated-away" };
    }

    // Prefer menus/listboxes over unrelated dialogs (chat, etc.)
    const menuRoots = [
      ...document.querySelectorAll('[role="menu"], [role="listbox"]'),
      ...document.querySelectorAll('[role="dialog"]'),
    ];

    let picked = null;
    for (const root of menuRoots) {
      const options = root.querySelectorAll(
        '[role="menuitem"], [role="menuitemradio"], [role="option"], div[role="button"], span[role="button"]',
      );
      for (const opt of options) {
        // Never follow a real navigation link
        if (opt.closest('a[href^="http"], a[href^="/"]')) continue;
        const t = normalizeName(
          opt.getAttribute("aria-label") || textFrom(opt),
        );
        if (/^all comments\b/i.test(t) && t.length <= 80) {
          picked = opt;
          break;
        }
      }
      if (picked) break;
    }

    if (!picked) {
      // Close the sort menu by toggling the opener again — never send Escape,
      // Facebook closes the whole post modal on Escape.
      try {
        opener.click();
      } catch {
        // ignore
      }
      return { ok: false, reason: "all-comments-not-found" };
    }

    try {
      picked.click();
    } catch {
      return { ok: false, reason: "all-comments-click-failed" };
    }

    await sleep(700);
    if (location.href !== startHref && !location.href.includes(postKeyFromUrl())) {
      return { ok: false, reason: "navigated-away" };
    }
    return { ok: true, already: false };
  }

  function isProfileHref(href) {
    if (!href) return false;
    if (/^(https?:)?\/\/(?!(?:www\.)?facebook\.com|fb\.com|fb\.watch)/i.test(href)) {
      return false;
    }
    if (/youtube\.com|youtu\.be|instagram\.com|tiktok\.com/i.test(href)) {
      return false;
    }
    if (
      /\/(photo|photos|video|videos|reel|watch|permalink|story|stories|marketplace|ads|privacy|help|events|gaming|posts)\b/i.test(
        href,
      )
    ) {
      return false;
    }
    if (/\/groups\/[^/]+\/posts\b/i.test(href)) return false;
    if (/comment_id=|reply_comment_id=|__cft__/i.test(href)) return false;
    // Groups page link (not a person)
    if (/\/groups\/[^/]+\/?$/i.test(href) || /\/groups\/\d+/i.test(href)) {
      return false;
    }
    return (
      /\/profile\.php\?id=/i.test(href) ||
      /\/people\//i.test(href) ||
      /\/user\//i.test(href) ||
      /^https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.]+\/?(\?|$)/i.test(href) ||
      /^\/[A-Za-z0-9.]+\/?(\?|$)/.test(href)
    );
  }

  function nameFromAriaCommentLabel(node) {
    const aria = normalizeName(node.getAttribute("aria-label") || "");
    // "Comment by Scott Brennan" / "Reply by Name" / "Comment by Name 5d"
    const match = aria.match(/^(?:Comment|Reply) by (.+?)(?:\s+\d|\s*$)/i);
    if (!match) return "";
    // Trim trailing meta like "5d" already handled; also "Name · 1 Reply"
    let name = normalizeName(match[1].split("·")[0]);
    name = name.replace(/\s+\d+[smhdwy]\b.*$/i, "").trim();
    // Relative times without digits: "a week ago", "an hour ago", "yesterday", "just now"
    name = name
      .replace(
        /\s+(?:an?\s+)?(?:few\s+)?(?:second|minute|hour|day|week|month|year)s?\s+ago$/i,
        "",
      )
      .replace(/\s+(?:yesterday|just now)$/i, "")
      .trim();
    return looksLikePersonName(name) ? name : "";
  }

  function nameFromCommentAuthorLink(node, excluded) {
    // Prefer links that look like the comment header author, not embed cards
    const links = Array.from(
      node.querySelectorAll('a[role="link"][href], a[href]'),
    );

    for (const link of links) {
      // Skip links inside nested media / preview cards when possible
      if (
        link.closest(
          '[data-ad-preview], [data-testid*="story"], a[href*="youtube"], a[href*="youtu.be"]',
        )
      ) {
        continue;
      }

      const href = link.getAttribute("href") || "";
      if (!isProfileHref(href)) continue;

      const linkText = textFrom(link);
      if (!looksLikePersonName(linkText)) continue;
      if (linkText.includes("\n")) continue;
      if (excluded.has(linkText.toLowerCase())) continue;

      // Author name links are short and usually early in the comment block
      return linkText;
    }
    return "";
  }

  function isMainPostArticle(node, scope) {
    // The post itself is usually above the comments sort control
    const sortBtn = findSortControl(scope);
    if (!sortBtn) return false;
    const pos = node.compareDocumentPosition(sortBtn);
    // node is before sort button → likely the original post article
    return Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function collectVisibleNames(scope) {
    if (!scope) return [];

    const author = getPostAuthor(scope);
    const authorKey = author ? author.toLowerCase() : "";

    const commentsRoot = findCommentsRoot(scope);
    const collectScope = commentsRoot || scope;
    const names = [];
    const seen = new Set();

    const push = (raw) => {
      const name = normalizeName(raw);
      if (!looksLikePersonName(name)) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      // Skip the post author (exact full name), not other commenters who share a first name
      if (authorKey && key === authorKey) return;
      seen.add(key);
      names.push(name);
    };

    // Best signal: Facebook’s own “Comment by …” labels
    const labeled = collectScope.querySelectorAll(
      '[aria-label^="Comment by" i], [aria-label^="Reply by" i], [aria-label*="Comment by" i]',
    );
    labeled.forEach((node) => {
      // Only genuine comment/reply labels
      const aria = node.getAttribute("aria-label") || "";
      if (!/^(Comment|Reply) by /i.test(aria)) return;
      push(nameFromAriaCommentLabel(node));
    });

    if (names.length > 0) return names;

    // Fallback: comment list articles / list items under comments root only
    const commentNodes = [
      ...collectScope.querySelectorAll('div[role="article"]'),
      ...collectScope.querySelectorAll("ul li"),
    ];

    for (const node of commentNodes) {
      if (!commentsRoot && isMainPostArticle(node, scope)) continue;
      const fromAria = nameFromAriaCommentLabel(node);
      if (fromAria) {
        push(fromAria);
        continue;
      }
      push(nameFromCommentAuthorLink(node, new Set(authorKey ? [authorKey] : [])));
    }

    return names;
  }

  function clickExpanders(scope) {
    if (!scope) return 0;
    const expandScope = findCommentsRoot(scope) || scope;
    let clicked = 0;
    const patterns = [
      /view more comments?/i,
      /view previous comments?/i,
      /view \d+ more comments?/i,
      /view more replies?/i,
      /view \d+ more replies?/i,
      /\d+\s+replies?/i,
      /show \d+ more/i,
    ];

    const nodes = expandScope.querySelectorAll(
      'div[role="button"], span[role="button"], button',
    );
    for (const node of nodes) {
      if (node.closest("a[href]")) continue;
      const label = normalizeName(
        node.getAttribute("aria-label") || textFrom(node),
      );
      if (!label || label.length > 80) continue;
      if (/most relevant|all comments|newest|hidden by you/i.test(label)) {
        continue;
      }
      if (/^see more$/i.test(label)) continue;
      if (!patterns.some((re) => re.test(label))) continue;
      try {
        node.click();
        clicked += 1;
        if (clicked >= 8) break;
      } catch {
        // ignore
      }
    }
    return clicked;
  }

  async function extractCommenters() {
    const startKey = postKeyFromUrl();
    const startHref = location.href;
    const startPath = location.pathname;
    const startedOnPermalink = isPostPermalink();

    const found = findPostScope();
    if (!found) {
      return {
        ok: false,
        error: startedOnPermalink
          ? "Couldn’t find this post’s comments. Stay on the post URL, make sure comments are visible, then Extract."
          : "Open the post page (or click the post so its dialog is open), then Extract.",
        names: [],
      };
    }

    // "View more comments" in a feed modal can swap the modal for the inline
    // permalink view — track the mode live so we follow that transition.
    let mode = found.mode;
    const liveScope = () => {
      const current = findPostScope();
      if (current) {
        mode = current.mode;
        return current.root;
      }
      return found.root;
    };

    const sortResult = await switchToAllComments(liveScope());
    if (sortResult.reason === "navigated-away") {
      return {
        ok: false,
        error:
          "Facebook left the post while switching to All comments. Stay on the post URL and try Extract again.",
        names: [],
      };
    }
    if (sortResult.ok && !sortResult.already) {
      await sleep(900);
    }

    const stillOnPost = () => {
      if (mode === "modal") {
        if (findPostModal()) return false;
        // Modal gone — keep going if the same post is now rendered inline
        // (Facebook swaps modal → permalink page on "View more comments").
        const key = postKeyFromUrl();
        const samePost =
          !startKey || key === startKey || location.href.includes(startKey);
        if (samePost && isPostPermalink() && findPermalinkPostRoot()) {
          mode = "permalink";
          return false;
        }
        return "Stopped because the post modal closed.";
      }
      const key = postKeyFromUrl();
      if (startKey && key && key !== startKey) {
        return "Stopped because Facebook navigated away from this post.";
      }
      if (startedOnPermalink && !isPostPermalink()) {
        return "Stopped because Facebook left the post page.";
      }
      if (
        startKey &&
        !String(location.href).includes(String(startKey)) &&
        location.href !== startHref &&
        location.pathname !== startPath
      ) {
        return "Stopped because the page URL changed.";
      }
      // Plain facebook.com / home after a bad click
      const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
      if (path === "/" || /\/(home|feed)$/i.test(path)) {
        return "Stopped because Facebook navigated to the home feed.";
      }
      if (!findPostScope()) {
        return "Stopped because the post comments are no longer on the page.";
      }
      return false;
    };

    const { names, pass1Rounds, pass2Rounds, addedInCheck, aborted, abortReason } =
      await loadAllNamesWithDoubleCheck({
        collectNames: () => collectVisibleNames(liveScope()),
        scrollCandidates: () => {
          const current = liveScope();
          return [findCommentPane(current), findCommentsRoot(current)].filter(
            Boolean,
          );
        },
        // Permalink pages often scroll the document, not a nested pane.
        // Keep fallback on so a modal→permalink transition still scrolls.
        allowPageFallback: true,
        loadMoreRoot: () => findCommentsRoot(liveScope()) || liveScope(),
        loadMorePatterns: [
          /view more comments?/i,
          /view previous comments?/i,
          /view \d+ more comments?/i,
          /view more replies?/i,
          /view \d+ more replies?/i,
          /\d+\s+replies?/i,
          /show \d+ more/i,
        ],
        beforeScroll: async () => {
          clickExpanders(liveScope());
        },
        resetScroll: async () => {
          const current = liveScope();
          const pane = findCommentPane(current) || findCommentsRoot(current);
          if (pane) pane.scrollTop = 0;
          if (mode === "permalink") window.scrollTo(0, 0);
          await sleep(350);
        },
        shouldAbort: stillOnPost,
        maxRounds: 60,
        idleStop: 5,
        delayMs: 650,
        maxMs: 70000,
      });

    const unique = uniqueNames(names);
    if (aborted && unique.length === 0) {
      return {
        ok: false,
        error:
          abortReason ||
          "Facebook navigated away while loading comments. Stay on the post tab and try Extract again.",
        names: [],
      };
    }

    const sortNote = sortResult.ok
      ? sortResult.already
        ? "All comments already selected. "
        : "Switched to All comments. "
      : "Couldn’t confirm All comments — names may be incomplete. ";

    const modeNote =
      mode === "permalink" ? "Stayed on the post page. " : "";

    return {
      ok: true,
      platform: "Facebook",
      names: unique,
      count: unique.length,
      hint: aborted
        ? `${abortReason} Kept ${unique.length} unique commenter${
            unique.length === 1 ? "" : "s"
          } collected before that.`
        : unique.length === 0
          ? `${sortNote}${modeNote}No commenters found. Make sure comments are visible on this post.`
          : `${sortNote}${modeNote}${doubleCheckHint(
              unique.length,
              pass1Rounds,
              pass2Rounds,
              addedInCheck,
              "commenter",
            )}`,
    };
  }

  if (globalThis.__hypewheelFacebookOnMessage) {
    chrome.runtime.onMessage.removeListener(
      globalThis.__hypewheelFacebookOnMessage,
    );
  }

  const onMessage = (message, _sender, sendResponse) => {
    if (message?.type === "HYPEWHEEL_PING") {
      sendResponse({ ok: true, platform: "Facebook", version: VERSION });
      return false;
    }
    if (message?.type === "HYPEWHEEL_EXTRACT") {
      extractCommenters().then(sendResponse);
      return true;
    }
    return false;
  };

  globalThis.__hypewheelFacebookOnMessage = onMessage;
  chrome.runtime.onMessage.addListener(onMessage);
})();

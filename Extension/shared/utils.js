(() => {
  const HYPEWHEEL_BASE = "https://hypewheel.app/";

  function normalizeName(value) {
    if (value == null) return "";
    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueNames(names) {
    const seen = new Set();
    const result = [];

    for (const raw of names) {
      const name = normalizeName(raw);
      if (!name) continue;

      const key = name.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      result.push(name);
    }

    return result;
  }

  function buildHypewheelUrl(names, title = "") {
    const list = uniqueNames(names)
      .map((name) => encodeURIComponent(name))
      .join(",");
    const parts = [];
    if (title) parts.push(`title=${encodeURIComponent(title)}`);
    parts.push(`list=${list}`);
    return `${HYPEWHEEL_BASE}?${parts.join("&")}`;
  }

  function textFrom(el) {
    if (!el) return "";
    return normalizeName(el.innerText || el.textContent || "");
  }

  function collectFromSelectors(root, selectors, mapper) {
    const names = [];
    for (const selector of selectors) {
      (root || document).querySelectorAll(selector).forEach((node) => {
        const value = mapper ? mapper(node) : textFrom(node);
        if (value) names.push(value);
      });
    }
    return names;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isScrollable(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return false;
    }
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + 20;
    return canScroll;
  }

  function findScrollContainer(candidates = [], options = {}) {
    const { allowPageFallback = true } = options;

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (typeof candidate === "string") {
        const nodes = document.querySelectorAll(candidate);
        for (const node of nodes) {
          if (isScrollable(node)) return node;
          // Walk up/down nearby scrollable parents
          let cur = node;
          for (let i = 0; i < 8 && cur; i++) {
            if (isScrollable(cur)) return cur;
            cur = cur.parentElement;
          }
          const kids = node.querySelectorAll("div, section, ul, main");
          for (const kid of kids) {
            if (isScrollable(kid)) return kid;
          }
        }
        continue;
      }
      if (isScrollable(candidate)) return candidate;
      let cur = candidate.parentElement;
      for (let i = 0; i < 8 && cur; i++) {
        if (isScrollable(cur)) return cur;
        cur = cur.parentElement;
      }
    }

    if (!allowPageFallback) return null;

    // Largest scrollable region on the page as fallback
    let best = null;
    let bestScore = 0;
    document.querySelectorAll("div, section, main, ul, aside").forEach((el) => {
      if (!isScrollable(el)) return;
      const score = el.scrollHeight * el.clientHeight;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best;
  }

  function scrollStep(container, amount) {
    const delta = amount ?? Math.max(320, Math.floor((container?.clientHeight || window.innerHeight) * 0.85));
    if (container) {
      container.scrollTop = Math.min(
        container.scrollTop + delta,
        container.scrollHeight,
      );
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
      return;
    }
    window.scrollBy(0, delta);
  }

  function clickLoadMoreButtons(root = document, patterns = []) {
    // Empty patterns = intentionally do not click anything (scroll-only load).
    if (Array.isArray(patterns) && patterns.length === 0) return 0;

    const defaultPatterns = [
      /view more comments?/i,
      /view more replies?/i,
      /view \d+ (?:more )?replies?/i,
      /show more comments?/i,
      /show more replies?/i,
      /load more comments?/i,
      /load more replies?/i,
      /see more comments?/i,
      /show \d+ more replies?/i,
    ];
    const matchers = patterns.length ? patterns : defaultPatterns;
    let clicked = 0;

    const nodes = root.querySelectorAll(
      'div[role="button"], span[role="button"], button',
    );

    for (const node of nodes) {
      // Never click links — those navigate (profiles, suggested users, etc.)
      if (node.closest("a[href]")) continue;

      const label = normalizeName(
        node.getAttribute("aria-label") || textFrom(node),
      );
      if (!label || label.length > 80) continue;
      if (!matchers.some((re) => re.test(label))) continue;

      try {
        node.click();
        clicked += 1;
        if (clicked >= 4) break;
      } catch {
        // ignore
      }
    }

    return clicked;
  }

  /**
   * Auto-scroll + load-more until unique names stop growing.
   * Accumulates names each round (needed for virtualized feeds).
   */
  async function loadAllNames(options) {
    const {
      collectNames,
      scrollCandidates = [],
      loadMoreRoot = null,
      loadMorePatterns = undefined,
      clickLoadMore = true,
      allowPageFallback = true,
      maxRounds = 50,
      idleStop = 4,
      delayMs = 550,
      maxMs = 55000,
      beforeScroll = null,
      shouldAbort = null,
    } = options;

    const seen = new Set();
    const collected = [];
    const started = Date.now();
    let idle = 0;
    let rounds = 0;
    let aborted = false;
    let abortReason = "";

    const assimilate = () => {
      let added = 0;
      for (const raw of collectNames() || []) {
        const name = normalizeName(raw);
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(name);
        added += 1;
      }
      return added;
    };

    const checkAbort = () => {
      if (typeof shouldAbort !== "function") return false;
      const reason = shouldAbort();
      if (!reason) return false;
      aborted = true;
      abortReason = typeof reason === "string" ? reason : "Stopped early.";
      return true;
    };

    assimilate();

    while (rounds < maxRounds && Date.now() - started < maxMs) {
      if (checkAbort()) break;
      rounds += 1;

      if (typeof beforeScroll === "function") {
        await beforeScroll();
      }
      if (checkAbort()) break;

      if (clickLoadMore !== false) {
        const root =
          (typeof loadMoreRoot === "function" ? loadMoreRoot() : loadMoreRoot) ||
          document;
        // undefined → use defaults; [] → click nothing
        clickLoadMoreButtons(
          root,
          Array.isArray(loadMorePatterns) ? loadMorePatterns : undefined,
        );
      }

      const container = findScrollContainer(
        typeof scrollCandidates === "function"
          ? scrollCandidates()
          : scrollCandidates,
        { allowPageFallback },
      );
      scrollStep(container);

      await sleep(delayMs);
      if (checkAbort()) break;

      const added = assimilate();
      if (added === 0) {
        idle += 1;
        if (idle >= 2) {
          scrollStep(
            container,
            Math.max(600, (container?.clientHeight || 600) * 1.4),
          );
          await sleep(delayMs);
          if (checkAbort()) break;
          assimilate();
        }
        if (idle >= idleStop) break;
      } else {
        idle = 0;
      }
    }

    return {
      names: collected,
      rounds,
      elapsedMs: Date.now() - started,
      aborted,
      abortReason,
    };
  }

  /**
   * Run loadAllNames twice: full pass, reset scroll, verification pass.
   * Merges unique names from both passes.
   */
  async function loadAllNamesWithDoubleCheck(options) {
    const {
      resetScroll = null,
      betweenPassDelayMs = 500,
      checkMaxRounds = null,
      checkMaxMs = null,
      checkIdleStop = null,
      ...loadOptions
    } = options;

    const pass1 = await loadAllNames(loadOptions);

    if (typeof resetScroll === "function") {
      await resetScroll();
    }

    await sleep(betweenPassDelayMs);

    const pass2 = await loadAllNames({
      ...loadOptions,
      maxRounds:
        checkMaxRounds ??
        Math.max(20, Math.floor((loadOptions.maxRounds || 50) * 0.65)),
      maxMs:
        checkMaxMs ??
        Math.max(25000, Math.floor((loadOptions.maxMs || 55000) * 0.55)),
      idleStop: checkIdleStop ?? loadOptions.idleStop ?? 4,
    });

    const merged = uniqueNames([...pass1.names, ...pass2.names]);
    const pass1Keys = new Set(pass1.names.map((n) => n.toLowerCase()));
    const addedInCheck = pass2.names.filter(
      (n) => !pass1Keys.has(n.toLowerCase()),
    ).length;

    return {
      names: merged,
      rounds: pass1.rounds + pass2.rounds,
      pass1Rounds: pass1.rounds,
      pass2Rounds: pass2.rounds,
      addedInCheck,
      aborted: pass1.aborted || pass2.aborted,
      abortReason:
        pass2.aborted && pass2.abortReason
          ? pass2.abortReason
          : pass1.abortReason,
    };
  }

  function doubleCheckHint(count, pass1Rounds, pass2Rounds, addedInCheck, noun) {
    const extra =
      addedInCheck > 0
        ? ` Double-check found ${addedInCheck} more.`
        : " Double-check complete.";
    return `Auto-loaded (${pass1Rounds} + ${pass2Rounds} verify passes).${extra} Found ${count} unique ${noun}${
      count === 1 ? "" : "s"
    }.`;
  }

  globalThis.HypewheelUtils = {
    HYPEWHEEL_BASE,
    normalizeName,
    uniqueNames,
    buildHypewheelUrl,
    textFrom,
    collectFromSelectors,
    sleep,
    isScrollable,
    findScrollContainer,
    scrollStep,
    clickLoadMoreButtons,
    loadAllNames,
    loadAllNamesWithDoubleCheck,
    doubleCheckHint,
  };
})();

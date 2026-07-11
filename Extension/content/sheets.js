(() => {
  const VERSION = 6;
  if (globalThis.__hypewheelSheets === VERSION) return;
  globalThis.__hypewheelSheets = VERSION;

  const { uniqueNames, normalizeName, sleep } = globalThis.HypewheelUtils;

  const HEADERISH_EXACT =
    /^(name|names|participant|participants|entry|entries|username|user|handle|commenter|commenters|timestamp|time|date|#|no\.?|id)$/i;

  function isHeaderish(value) {
    const name = normalizeName(value);
    if (!name) return true;
    if (HEADERISH_EXACT.test(name)) return true;

    // "Username (Twitch/Discord)", "Name / Handle", "User Name:"
    if (
      /^(username|user\s*name|name|names|handle|participant|entrant|entry|entries|commenter|commenters|discord|twitch)\b/i.test(
        name,
      )
    ) {
      return true;
    }

    if (
      /^(username|name|handle|user|participant|entry|entrant)\s*[\(\[\/\-_:]/i.test(
        name,
      )
    ) {
      return true;
    }

    // Label-style headers with parentheses or slashes
    if (
      /\b(username|user\s*name|display\s*name|handle)\b/i.test(name) &&
      /[()\/\-_]/.test(name)
    ) {
      return true;
    }

    return false;
  }

  function normalizeColumnInput(value) {
    const letters = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (!letters || letters.length > 3) return null;
    return letters;
  }

  function getNameBoxEl() {
    return (
      document.querySelector(".waffle-name-box") ||
      document.querySelector("#t-name-box-input") ||
      document.querySelector("input.waffle-name-box") ||
      document.querySelector('#t-name-box input[type="text"]') ||
      document.querySelector('input[aria-label*="Name box" i]')
    );
  }

  function getNameBoxValue() {
    const el = getNameBoxEl();
    if (!el) return "";
    return normalizeName(el.value || el.getAttribute("value") || "");
  }

  function parseColumnFromRef(ref) {
    if (!ref) return null;
    let cleaned = String(ref).trim();
    cleaned = cleaned.replace(/^'[^']+'\s*!/, "").replace(/^[^!]+!/, "");
    cleaned = cleaned.replace(/\$/g, "");

    // Full column selection: C:C
    let match = cleaned.match(/^([A-Za-z]{1,3})\s*:\s*\1(?:\d+)?$/i);
    if (match) return match[1].toUpperCase();

    // Range starting in one column: C1:C99 or C:C100
    match = cleaned.match(/^([A-Za-z]{1,3})\d*\s*:\s*\1\d*$/i);
    if (match) return match[1].toUpperCase();

    // Multi-col range — use first column
    match = cleaned.match(/^([A-Za-z]{1,3})\d*\s*:/);
    if (match) return match[1].toUpperCase();

    // Single cell: C12
    match = cleaned.match(/^([A-Za-z]{1,3})\d+$/);
    if (match) return match[1].toUpperCase();

    // Bare letter
    match = cleaned.match(/^([A-Za-z]{1,3})$/);
    if (match) return match[1].toUpperCase();

    return null;
  }

  function detectSelectedColumn() {
    return parseColumnFromRef(getNameBoxValue());
  }

  function getSheetIds() {
    const idMatch = location.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!idMatch) return null;
    const id = idMatch[1];
    const hash = (location.hash || "").replace(/^#/, "");
    const search = location.search || "";
    const gidMatch =
      hash.match(/(?:^|&)gid=([0-9]+)/) ||
      search.match(/[?&]gid=([0-9]+)/);
    return { id, gid: gidMatch ? gidMatch[1] : "0" };
  }

  function parseCsvNames(text) {
    if (!text || !String(text).trim()) return [];
    const raw = String(text).replace(/^\uFEFF/, "");

    // Reject HTML error pages
    if (/^\s*</.test(raw) || /<!DOCTYPE|google-sheet-html/i.test(raw)) {
      return [];
    }

    const names = [];
    let rowIndex = 0;
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      let cell = line;
      if (cell.includes("\t")) cell = cell.split("\t")[0];
      if (cell.includes(",") && cell.startsWith('"')) {
        const m = cell.match(/^"(?:[^"]|"")*"/);
        cell = m ? m[0] : cell.split(",")[0];
      } else if (cell.includes(",") && !cell.startsWith('"')) {
        cell = cell.split(",")[0];
      }
      cell = cell.replace(/^"(.*)"$/, "$1").replace(/""/g, '"');
      const name = normalizeName(cell);
      rowIndex += 1;
      if (!name) continue;
      // Row 1 is almost always the column header when exporting B:B
      if (rowIndex === 1 && isHeaderish(name)) continue;
      if (HEADERISH_EXACT.test(name)) continue;
      if (/^[A-Za-z]{1,3}\d+$/.test(name)) continue;
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(name)) continue;
      names.push(name);
    }
    return names;
  }

  async function fetchColumnCsv(colLetters) {
    const ids = getSheetIds();
    if (!ids) return null;

    const range = encodeURIComponent(`${colLetters}:${colLetters}`);
    const urls = [
      `https://docs.google.com/spreadsheets/d/${ids.id}/export?format=csv&gid=${ids.gid}&range=${range}`,
      `https://docs.google.com/spreadsheets/d/${ids.id}/gviz/tq?tqx=out:csv&gid=${ids.gid}&range=${range}`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          credentials: "include",
          redirect: "follow",
        });
        if (!res.ok) continue;
        const text = await res.text();
        const names = parseCsvNames(text);
        if (names.length > 0) return names;
      } catch {
        // try next
      }
    }
    return null;
  }

  async function selectColumnViaNameBox(colLetters) {
    const el = getNameBoxEl();
    if (!el) return false;

    try {
      el.focus();
      el.select?.();
      el.value = `${colLetters}:${colLetters}`;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      const enter = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      };
      el.dispatchEvent(new KeyboardEvent("keydown", enter));
      el.dispatchEvent(new KeyboardEvent("keyup", enter));
      await sleep(250);
      return true;
    } catch {
      return false;
    }
  }

  function triggerCopy() {
    try {
      if (document.execCommand("copy")) return true;
    } catch {
      // continue
    }
    const target = document.activeElement || document.body;
    const opts = {
      key: "c",
      code: "KeyC",
      keyCode: 67,
      which: 67,
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
      cancelable: true,
    };
    target.dispatchEvent(new KeyboardEvent("keydown", opts));
    document.dispatchEvent(new KeyboardEvent("keydown", opts));
    return true;
  }

  async function extractNames(options = {}) {
    if (!/docs\.google\.com\/spreadsheets/i.test(location.href)) {
      return {
        ok: false,
        error: "Open a Google Sheet with your list of names.",
        names: [],
      };
    }

    const colLetters =
      normalizeColumnInput(options.column) || detectSelectedColumn();

    if (!colLetters) {
      return {
        ok: false,
        error:
          "Type the names column letter (e.g. C) in the extension, then Extract.",
        names: [],
      };
    }

    // Fetch twice and merge — double-check for completeness
    const csvPass1 = await fetchColumnCsv(colLetters);
    await sleep(400);
    const csvPass2 = await fetchColumnCsv(colLetters);
    const csvNames = uniqueNames([...(csvPass1 || []), ...(csvPass2 || [])]);
    const addedInCheck =
      (csvPass2 || []).filter(
        (n) =>
          !(csvPass1 || []).some(
            (p) => p.toLowerCase() === String(n).toLowerCase(),
          ),
      ).length || 0;

    if (csvNames.length > 0) {
      const checkNote =
        addedInCheck > 0
          ? ` Double-check found ${addedInCheck} more.`
          : " Double-check complete.";
      return {
        ok: true,
        platform: "Google Sheets",
        names: csvNames,
        count: csvNames.length,
        column: colLetters,
        hint: `Column ${colLetters}: found ${csvNames.length} unique name${
          csvNames.length === 1 ? "" : "s"
        }.${checkNote}`,
      };
    }

    // 2) Select the column via the name box, copy, let popup read clipboard
    await selectColumnViaNameBox(colLetters);
    triggerCopy();
    await sleep(150);

    return {
      ok: true,
      platform: "Google Sheets",
      names: [],
      count: 0,
      column: colLetters,
      needsClipboard: true,
      hint: `Column ${colLetters} selected — reading clipboard…`,
    };
  }

  if (globalThis.__hypewheelSheetsOnMessage) {
    chrome.runtime.onMessage.removeListener(
      globalThis.__hypewheelSheetsOnMessage,
    );
  }

  const onMessage = (message, _sender, sendResponse) => {
    if (message?.type === "HYPEWHEEL_PING") {
      sendResponse({
        ok: true,
        platform: "Google Sheets",
        version: VERSION,
        column: detectSelectedColumn(),
        nameBox: getNameBoxValue(),
      });
      return false;
    }
    if (message?.type === "HYPEWHEEL_DETECT_COLUMN") {
      const nameBox = getNameBoxValue();
      const column = detectSelectedColumn();
      sendResponse({
        ok: Boolean(column),
        column,
        nameBox,
        error: column
          ? null
          : nameBox
            ? `Name box shows “${nameBox}” — type the column letter (e.g. C) instead.`
            : "Could not detect the column. Type C (or whichever letter has the names), then Extract.",
      });
      return false;
    }
    if (message?.type === "HYPEWHEEL_EXTRACT") {
      extractNames(message.options || {}).then(sendResponse);
      return true;
    }
    return false;
  };

  globalThis.__hypewheelSheetsOnMessage = onMessage;
  chrome.runtime.onMessage.addListener(onMessage);
})();

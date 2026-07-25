const HYPEWHEEL_BASE = "https://hypewheel.app/";

const PLATFORM_MATCHERS = [
  {
    id: "twitter",
    label: "X / Twitter",
    test: (url) => /https?:\/\/(www\.)?(x|twitter)\.com\//i.test(url),
    files: ["shared/utils.js", "content/twitter.js"],
    help: "Open a post page (/status/…). Extract auto-scrolls replies in the post column — stay on that tab.",
  },
  {
    id: "facebook",
    label: "Facebook",
    test: (url) => /https?:\/\/(www\.)?facebook\.com\//i.test(url),
    files: ["shared/utils.js", "content/facebook.js"],
    help: "Open a post URL or post modal. Extract switches to All comments, expands threads, and stays on that post.",
  },
  {
    id: "instagram",
    label: "Instagram",
    test: (url) => /https?:\/\/(www\.)?instagram\.com\//i.test(url),
    files: ["shared/utils.js", "content/instagram.js"],
    help: "Open a post with comments visible. Extract clicks + / View replies and scrolls the comments panel.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    test: (url) => /https?:\/\/(www\.)?tiktok\.com\//i.test(url),
    files: ["shared/utils.js", "content/tiktok.js"],
    help: "Open a video with the comments panel visible. Extract scrolls comments and collects usernames.",
  },
  {
    id: "sheets",
    label: "Google Sheets",
    test: (url) => /https?:\/\/docs\.google\.com\/spreadsheets\//i.test(url),
    files: ["shared/utils.js", "content/sheets.js"],
    help: "Type the names column letter (e.g. C), then Extract. One name per cell works best.",
  },
];

const REQUIRED_VERSION = {
  twitter: 7,
  facebook: 7,
  instagram: 5,
  tiktok: 4,
  sheets: 6,
};

const els = {
  platform: document.getElementById("platform"),
  message: document.getElementById("message"),
  preview: document.getElementById("preview"),
  countLabel: document.getElementById("count-label"),
  nameList: document.getElementById("name-list"),
  extractBtn: document.getElementById("extract-btn"),
  openBtn: document.getElementById("open-btn"),
  copyBtn: document.getElementById("copy-btn"),
  sheetsPicker: document.getElementById("sheets-picker"),
  columnInput: document.getElementById("column-input"),
  detectColBtn: document.getElementById("detect-col-btn"),
  help: document.querySelector(".help"),
};

let currentTab = null;
let currentPlatform = null;
let extractedNames = [];

function uniqueNames(names) {
  const seen = new Set();
  const result = [];
  for (const raw of names || []) {
    const name = String(raw || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
    .map((n) => encodeURIComponent(n))
    .join(",");
  const parts = [];
  if (title) parts.push(`title=${encodeURIComponent(title)}`);
  parts.push(`list=${list}`);
  return `${HYPEWHEEL_BASE}?${parts.join("&")}`;
}

function setHelp(text) {
  if (els.help) els.help.textContent = text;
}

function setMessage(text, kind = "") {
  els.message.textContent = text;
  els.message.className = `message${kind ? ` ${kind}` : ""}`;
}

function normalizeColumnInput(value) {
  const letters = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!letters || letters.length > 3) return null;
  return letters;
}

function getChosenColumn() {
  return normalizeColumnInput(els.columnInput?.value);
}

function renderNames(names) {
  extractedNames = uniqueNames(names);
  els.nameList.innerHTML = "";

  if (extractedNames.length === 0) {
    els.preview.hidden = true;
    els.openBtn.disabled = true;
    els.copyBtn.hidden = true;
    return;
  }

  els.preview.hidden = false;
  els.openBtn.disabled = false;
  els.copyBtn.hidden = false;
  els.countLabel.textContent = `${extractedNames.length} unique name${
    extractedNames.length === 1 ? "" : "s"
  }`;

  const frag = document.createDocumentFragment();
  extractedNames.slice(0, 100).forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    frag.appendChild(li);
  });
  if (extractedNames.length > 100) {
    const li = document.createElement("li");
    li.textContent = `…and ${extractedNames.length - 100} more`;
    frag.appendChild(li);
  }
  els.nameList.appendChild(frag);
}

function detectPlatform(url) {
  return PLATFORM_MATCHERS.find((p) => p.test(url || "")) || null;
}

async function pingTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "HYPEWHEEL_PING" });
  } catch {
    return null;
  }
}

async function requestExtract(tabId, options = {}) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "HYPEWHEEL_EXTRACT",
      options,
    });
  } catch {
    return null;
  }
}

async function ensureInjected(tabId, platform) {
  const ping = await pingTab(tabId);
  const required = REQUIRED_VERSION[platform.id] || 1;
  if (ping?.ok && Number(ping.version) >= required) return ping;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: platform.files,
  });
  await new Promise((r) => setTimeout(r, 100));
  return pingTab(tabId);
}

function isSheetHeaderish(value) {
  const name = String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return true;
  if (
    /^(name|names|participant|participants|entry|entries|username|user|handle|commenter|commenters|#|no\.?|id)$/i.test(
      name,
    )
  ) {
    return true;
  }
  if (
    /^(username|user\s*name|name|names|handle|participant|entrant|entry|entries)\b/i.test(
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
  if (
    /\b(username|user\s*name|display\s*name|handle)\b/i.test(name) &&
    /[()\/\-_]/.test(name)
  ) {
    return true;
  }
  return false;
}

function parseClipboardNames(text) {
  if (!text || !String(text).trim()) return [];
  let rowIndex = 0;
  return String(text)
    .split(/\r?\n/)
    .map((line) =>
      String(line || "")
        .split("\t")[0]
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((name) => {
      rowIndex += 1;
      if (!name) return false;
      if (rowIndex === 1 && isSheetHeaderish(name)) return false;
      return !/^[A-Za-z]{1,3}\d+$/.test(name);
    });
}

async function readClipboardText() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

async function extractFromSheets(tabId) {
  const column = getChosenColumn();
  if (!column) {
    return {
      ok: false,
      error:
        "Type the names column letter first (in your screenshot that’s C), then Extract.",
      names: [],
    };
  }

  const result = await requestExtract(tabId, { column });
  if (!result) return null;
  if (!result.ok) return result;

  // CSV fetch succeeded and returned names
  if ((result.names || []).length > 0) return result;

  // Fallback: content script selected the column and copied — read clipboard here
  if (result.needsClipboard) {
    await new Promise((r) => setTimeout(r, 200));
    const clip = await readClipboardText();
    const fromClip = uniqueNames(parseClipboardNames(clip));
    if (fromClip.length > 0) {
      return {
        ok: true,
        platform: "Google Sheets",
        names: fromClip,
        count: fromClip.length,
        column,
        hint: `Column ${column}: found ${fromClip.length} unique name${
          fromClip.length === 1 ? "" : "s"
        }.`,
      };
    }
    return {
      ok: false,
      error: `Could not read column ${column}. Type C, click Extract again, and allow clipboard access if Chrome asks.`,
      names: [],
    };
  }

  return result;
}

async function detectColumnIntoInput() {
  if (!currentTab?.id || currentPlatform?.id !== "sheets") return;

  els.detectColBtn.disabled = true;
  try {
    const ready = await ensureInjected(currentTab.id, currentPlatform);
    if (!ready?.ok) {
      setMessage("Could not reach the sheet. Refresh the tab.", "error");
      return;
    }

    let column = ready.column || null;
    try {
      const detected = await chrome.tabs.sendMessage(currentTab.id, {
        type: "HYPEWHEEL_DETECT_COLUMN",
      });
      if (detected?.column) column = detected.column;
      if (!column && detected?.error) {
        setMessage(detected.error, "error");
        return;
      }
    } catch {
      // ping may already have column
    }

    if (column) {
      els.columnInput.value = column;
      setMessage(
        `Using column ${column}. Click Extract names when ready.`,
        "ok",
      );
    } else {
      setMessage(
        "No column detected. Click a column letter in the sheet, then Detect — or type A/B/C here.",
        "error",
      );
    }
  } finally {
    els.detectColBtn.disabled = false;
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentPlatform = detectPlatform(tab?.url);

  if (!currentPlatform) {
    els.platform.textContent = "Unsupported page";
    setMessage(
      "Open an X, Facebook, Instagram, or TikTok post — or a Google Sheet — then click the extension again.",
      "error",
    );
    setHelp(
      "Supported: X/Twitter posts, Facebook posts, Instagram posts, TikTok videos, and Google Sheets.",
    );
    return;
  }

  els.platform.textContent = currentPlatform.label;
  setHelp(currentPlatform.help || "Click Extract names, then Open in HypeWheel.app.");

  if (currentPlatform.id === "sheets") {
    els.sheetsPicker.hidden = false;
    els.columnInput.value = "";
    setMessage(
      "Type the names column letter (e.g. C), then click Extract names.",
    );

    const ready = await ensureInjected(currentTab.id, currentPlatform);
    if (ready?.column) {
      els.columnInput.value = ready.column;
      setMessage(
        `Detected column ${ready.column}. Click Extract names when ready.`,
        "ok",
      );
    } else if (ready?.nameBox) {
      setMessage(
        `Sheet selection: ${ready.nameBox}. Type the column letter (e.g. C) if Detect fails, then Extract.`,
      );
    }
  } else {
    els.sheetsPicker.hidden = true;
    setMessage(
      "Ready. Extract will auto-scroll and load more comments for you.",
    );
  }

  els.extractBtn.disabled = false;
}

els.columnInput?.addEventListener("input", () => {
  const cleaned = normalizeColumnInput(els.columnInput.value);
  if (cleaned) els.columnInput.value = cleaned;
});

els.detectColBtn?.addEventListener("click", () => {
  detectColumnIntoInput();
});

els.extractBtn.addEventListener("click", async () => {
  if (!currentTab?.id || !currentPlatform) return;

  els.extractBtn.disabled = true;
  els.openBtn.disabled = true;
  setMessage(
    currentPlatform.id === "sheets"
      ? `Reading column ${getChosenColumn() || "?"}… keep this popup open.`
      : "Auto-loading comments (with double-check)… keep this popup open (can take up to ~2 min).",
  );

  try {
    const ready = await ensureInjected(currentTab.id, currentPlatform);
    if (!ready?.ok) {
      setMessage(
        "Could not reach this page. Refresh the tab, then try again.",
        "error",
      );
      renderNames([]);
      return;
    }

    const result =
      currentPlatform.id === "sheets"
        ? await extractFromSheets(currentTab.id)
        : await requestExtract(currentTab.id);

    if (!result) {
      setMessage(
        "Extraction timed out or was blocked. Refresh and try again.",
        "error",
      );
      renderNames([]);
      return;
    }

    if (!result.ok) {
      setMessage(result.error || "Extraction failed.", "error");
      renderNames([]);
      return;
    }

    renderNames(result.names || []);
    setMessage(
      result.hint ||
        `Found ${extractedNames.length} unique name${
          extractedNames.length === 1 ? "" : "s"
        }.`,
      extractedNames.length ? "ok" : "error",
    );
  } catch (err) {
    setMessage(err?.message || "Unexpected error while extracting.", "error");
    renderNames([]);
  } finally {
    els.extractBtn.disabled = false;
  }
});

els.openBtn.addEventListener("click", async () => {
  if (!extractedNames.length) return;
  const url = buildHypewheelUrl(
    extractedNames,
    currentPlatform?.label || "",
  );
  await chrome.tabs.create({ url });
});

els.copyBtn.addEventListener("click", async () => {
  if (!extractedNames.length) return;
  await navigator.clipboard.writeText(extractedNames.join("\n"));
  els.copyBtn.textContent = "Copied!";
  setTimeout(() => {
    els.copyBtn.textContent = "Copy list";
  }, 1200);
});

init().catch((err) => {
  els.platform.textContent = "Error";
  setMessage(err?.message || "Could not read the active tab.", "error");
});

# HypeWheel Chrome Extension

Pull unique commenter names from social posts (or names from a Google Sheet) and open them on [HypeWheel](https://hypewheel.app/?list=name1,name2,name3).

**Install:** [Chrome Web Store listing](https://chromewebstore.google.com/detail/afpnpiehbfpnolbmfpekfibonikdiaeo?utm_source=item-share-cb)

## Supported platforms

| Platform | Page to open |
|----------|----------------|
| **X / Twitter** | Post URL (`…/status/…`) with replies visible |
| **Facebook** | Post with the comment dialog open |
| **Instagram** | Post or reel with comments visible |
| **TikTok** | Video with the comments panel open |
| **Google Sheets** | Spreadsheet with names in a column |

## How to use

1. Open a supported page (see table above).
2. Click the **HypeWheel.app** extension icon → **Extract names**.
3. Keep the popup open while it auto-scrolls and clicks “load more” (up to ~1 minute).
4. Review the unique list → **Open in HypeWheel.app**.

That opens `https://hypewheel.app/?title=…&list=…` with every unique name. The wheel title is set from the source platform (e.g. Facebook, TikTok).

## Install from source (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `Extension` folder.
4. After code changes, click **Reload** on the extension card.

## Build for Chrome Web Store

From this folder:

```powershell
.\build.ps1
```

Output: `dist/HypeWheel.app-chrome-store-v{version}.zip` with `manifest.json` at the zip root.

## Auto-load behavior

Extract will:

- Find the comments (or sheet) scroll area
- Scroll repeatedly and click “View more / Load more / See more” style controls
- Keep accumulating unique names each pass (virtualized feeds don’t lose earlier entries)
- Stop when names stop growing for several passes, or after a time limit

## Tips

- Leave the post’s comment panel open (especially Facebook / TikTok) before extracting.
- **Google Sheets:** type the names column letter in the popup (e.g. **C**), then Extract. Opening the popup can clear the sheet’s selection, so typing the letter is the reliable path.
- Use **Copy list** for plain-text names without opening HypeWheel.
- Platform-specific hints appear in the popup footer when you’re on a supported page.

## Project structure

```
Extension/
├── manifest.json       # MV3 manifest
├── build.ps1           # Store upload zip builder
├── popup/              # Extension popup UI
├── content/            # Per-platform extractors (twitter, facebook, …)
├── shared/utils.js     # Shared scroll/load/URL helpers
└── icons/              # Extension icons (16, 48, 128 px)
```

## Related

- [HypeWheel web app](../README.md) — spinning wheel at [hypewheel.app](https://hypewheel.app)
- [Privacy policy](https://hypewheel.app/privacy.html)

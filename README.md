# HypeWheel

Free, customizable spinning wheel for giveaways, classroom picks, and random name selection.

**Live app:** [hypewheel.app](https://hypewheel.app)

## Features

- **Spin the wheel** — Enter names (one per line) and spin to pick a random winner
- **Multiple wheels** — Run several wheels at once from the header
- **Customize each wheel** — Colors, images, spin speed/duration, sound, and confetti
- **Brand packs** — Save and reuse appearance presets across wheels
- **Theater & OBS overlay** — Full-screen theater mode, or `?overlay=1` for a transparent Browser Source (Space = spin, R = remove, K = keep)
- **Share links** — Copy a compressed `?w=` link for one or all wheels (Import/Export)
- **Winners history** — Track past winners; copy as a formatted table or export CSV
- **Import / export** — Back up or restore wheels, winners, brand packs, and settings as JSON
- **Dark mode** — Toggle theme from the navbar
- **URL import** — Open with `?list=name1,name2,name3&title=My+Giveaway` to preload names

## Quick start

1. Open [hypewheel.app](https://hypewheel.app)
2. Click a wheel’s text area and paste names, one per line
3. Click **SPIN** (or click the wheel)
4. Open **Winners** in the header to review, copy, or export results

### Import names from a URL

```
https://hypewheel.app/?title=Instagram+Giveaway&list=Alice,Bob,Charlie
```

The wheel title and entries are added automatically. This is how the [Chrome extension](./Extension/) sends commenters into HypeWheel.

### Share links and OBS overlay

From **Import / Export**, copy a share link (`?w=…`) for large lists, or an OBS overlay link (`?w=…&overlay=1`). Overlay mode hides chrome and uses a transparent background for Browser Source.

## Chrome extension

Pull unique commenter names from social posts or Google Sheets and open them in HypeWheel:

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/afpnpiehbfpnolbmfpekfibonikdiaeo?utm_source=item-share-cb)
- [Extension source & docs](./Extension/README.md)

Supported sources: X (Twitter), Facebook, Instagram, TikTok, Google Sheets.

## Repository layout

| Path | Description |
|------|-------------|
| `index.html` | Main HypeWheel web app (single-page, static) |
| `js/share.js` | Compress/encode share-link payloads |
| `logo.png` | Site logo |
| `privacy.html` | Privacy policy |
| `404.html` | GitHub Pages 404 page |
| `CNAME` | Custom domain (`hypewheel.app`) |
| `Extension/` | Chrome extension source |

## Development

HypeWheel is a static site hosted on **GitHub Pages**. No build step is required for the web app—edit `index.html` (and `js/`) and push to `main`.

```bash
git clone https://github.com/TechJeeper/HypeWheel.git
cd HypeWheel
# Open index.html locally, or serve with any static file server
```

To work on the extension, see [Extension/README.md](./Extension/README.md).

## Links

- **Website:** [hypewheel.app](https://hypewheel.app)
- **Issues:** [github.com/TechJeeper/HypeWheel/issues](https://github.com/TechJeeper/HypeWheel/issues)
- **Privacy:** [hypewheel.app/privacy.html](https://hypewheel.app/privacy.html)

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
- **Twitch chat** — Click the Twitch icon on a wheel to show controls. Enter a channel plus join/leave keywords (default `!join` / `!leave`); unique chatters who type them are added or removed. The tab must stay open (GitHub Pages has no server).

## Quick start

1. Open [hypewheel.app](https://hypewheel.app)
2. Click a wheel’s text area and paste names, one per line
3. Click **SPIN** (or click the wheel)
4. Open **Winners** in the header to review, copy, or export results
5. For a live Twitch giveaway, click the Twitch icon on a wheel, enter the channel and join/leave keywords, click **Connect**, and keep the tab open

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
| `js/twitch-chat.js` | Twitch IRC + Implicit OAuth for keyword joins / chat confirms |
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

### Twitch chat confirmations (optional)

To enable **Login with Twitch** (so join/leave replies can post in chat), register a Twitch application and set its Client ID in `js/twitch-chat.js`:

1. Create an app at [dev.twitch.tv/console](https://dev.twitch.tv/console/apps)
2. Add OAuth Redirect URLs (exact match, including trailing slash):
   - `https://hypewheel.app/`
   - `https://www.hypewheel.app/`
   - plus any local URL you use while testing
3. Paste the Client ID into `TWITCH_CLIENT_ID` in `js/twitch-chat.js`

Streamers then click **Login with Twitch** in the wheel panel (scopes: `chat:read`, `chat:write`). The token stays in their browser only.

To work on the extension, see [Extension/README.md](./Extension/README.md).

## Links

- **Website:** [hypewheel.app](https://hypewheel.app)
- **Issues:** [github.com/TechJeeper/HypeWheel/issues](https://github.com/TechJeeper/HypeWheel/issues)
- **Privacy:** [hypewheel.app/privacy.html](https://hypewheel.app/privacy.html)

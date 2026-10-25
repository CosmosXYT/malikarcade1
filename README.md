# Malik Arcade 💙 — just for Malik

A complete, personalized 5-game arcade **starring Malik's actual uploaded face**, designed to run as a static site on GitHub Pages, or as static assets on Cloudflare Workers. No libraries, installation, sign-in, database or server needed.

## Included

- **Flappy Malik** — mobile tap/desktop Space controls, progressively faster and moving pipes, hearts, shields, high score.
- **Malik Dash** — 3 lanes, three lives, swipe/tap/keyboard steering, obstacles and hearts.
- **Malik Love Rush** — 45-second heart-catching game, stars, hazards, combos, drag controls.
- **Malik Match** — 8 matching pairs with Malik's face on every card; fastest completed time tracked.
- **Pop the Malik** — 30-second reaction game, 9 targets, combos, bomb traps.
- **Malik's trophy shelf** — 6 unlockable achievements saved in your browser.
- Sounds (Web Audio), settings (mute, choose Real Malik / Angel Malik, reduced motion), heart counter, runs, best scores, pause/resume, auto-pause on tab change. Local progress is stored in your browser via `localStorage` (so it won't automatically sync across devices).

## Exact project files

```text
malik-arcade/
├── index.html              ← entry point, upload at repository root
├── styles.css              ← responsive layouts / iPhone safe areas
├── app.js                  ← all games & persistence
├── sw.js                   ← optional offline service worker
├── manifest.webmanifest    ← iPhone Home Screen app metadata
├── wrangler.jsonc          ← optional Cloudflare Worker static assets config
└── assets/
    ├── face.png            ← original uploaded photo of Malik
    ├── face-winged.png     ← optional cartoon-style second look
    ├── sky.webp            ← blue cloud game background
    ├── icon-192.png        ← Home Screen favicon
    └── icon-512.png        ← larger Home Screen icon
```

**No other uploads needed:** the ZIP includes every asset already, including the **original** `face.png`. If you ever replace his photo, save it with the exact name `face.png`, keep the transparent background, and overwrite `assets/face.png`. Do **not** change the image name without updating the code. If you replace assets for an existing deployment, increment the cache name in `sw.js` (`malik-arcade-v2`, etc.) so installed/offline clients pick up the change.

## Deploy to GitHub Pages

1. Create a new repository (e.g., `malik-arcade`).
2. Unzip `malik-arcade-github-pages.zip` and upload **the contents** of the `malik-arcade` folder directly to the repository **root**. GitHub must see `index.html` at the top level, not nested inside another folder.
3. Open repository **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. Visit `https://YOUR-USERNAME.github.io/malik-arcade/` (your actual repository name may differ).
5. On iPhone 13 or later, open that HTTPS address in Safari → Share → **Add to Home Screen** to play it as a full-screen web app.

GitHub Pages serves HTML/CSS/JS files; **it doesn't execute Cloudflare Workers**. This project needs no server worker, but `sw.js` is a *browser service worker* used for offline caching.

## If you actually mean Cloudflare Workers

Cloudflare Workers can serve this exact folder as static assets, using `wrangler.jsonc`:

```bash
cd malik-arcade
npx wrangler login
npx wrangler deploy
```

You can instead connect a GitHub repository through Cloudflare's dashboard. No custom server-side code required.

## Controls

| Game | iPhone | Computer |
| --- | --- | --- |
| Flappy Malik | Tap screen to flap | Space / Arrow Up |
| Malik Dash | Swipe, or tap left/right side | Left/Right arrows |
| Malik Love Rush | Drag Malik left/right | Mouse drag, or Left/Right arrows |
| Malik Match | Tap pairs | Click cards |
| Pop the Malik | Tap his face; avoid bombs | Click face; avoid bombs |

Pause with the button (or **P** / **Esc** on desktop); progress is saved locally, not uploaded anywhere.

## Local test

For realistic HTTP behavior, run:

```bash
cd malik-arcade
python3 -m http.server 8000
```

Visit `http://localhost:8000` on your computer. Browsers can run most of the project from `index.html` directly, but offline caching requires HTTPS or localhost.

**Privacy:** If this GitHub repository / GitHub Pages site is public, Malik's photo is accessible to anyone with the public address. Publish with his permission.

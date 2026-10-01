# Finlings

A cozy pixel-art pocket aquarium for your phone. Keep fish, shrimp and jellyfish, feed them, keep the water clean, breed new colors and hybrids, and fill your collection book.

Everything is plain HTML, CSS and JavaScript (canvas pixel art, synthesized sound, no images, no libraries). The build step just glues the source files into **one self-contained HTML file**.

## Build

It is one plain bash script, nothing to install (on Windows use Git Bash or WSL).

```
bash build.sh
```

It writes two files to `dist/`:

| File | What it is |
| --- | --- |
| `dist/index.html` | A normal standalone page. Open it in a browser or host it anywhere (GitHub Pages, Netlify, your own server). |
| `dist/finlings.html` | The bare fragment (no `<html>` wrapper), which is the format Claude artifacts use. |

If Node happens to be installed, the script also syntax-checks the combined code first. Without Node it just skips that step.

## Publishing on GitHub Pages

GitHub Pages only serves files, it never runs a build, so the build always happens before the files get there. Two easy ways:

1. **Automatic (recommended):** `.github/workflows/pages.yml` runs `bash build.sh` on GitHub whenever you push to `main` and publishes `dist/`. One-time setup: repo Settings > Pages > Source: **GitHub Actions**.
2. **Manual:** run `bash build.sh` yourself and publish `dist/index.html` (for example copy it to the repo root or to `/docs` and point Pages at that).

## Where things are

Everything lives in `src/`. The files are joined **in this order** into a single `<script>`, so later files can use anything defined earlier (the order is listed at the top of `build.sh`).

| File | What is inside |
| --- | --- |
| `00-head.html` | `<title>`, font links and all CSS (design tokens, layout, animations) |
| `10-body.html` | The page markup: header, tank canvas, tabs, bottom sheet, toast |
| `21-data.js` | Species list, genetics (colors, patterns, alleles), pixel icons, small helpers |
| `22-sim.js` | Game state, the time simulation (also used for offline catch-up), breeding, hybrids, jelly life cycle, save format and migrations, the "juice" event queue |
| `22b-audio.js` | Sound effects, all synthesized with the Web Audio API |
| `23-scene.js` | The tank canvas: fish and shrimp sprites, swimming, food, drawing, tap handling |
| `23a-jelly.js` | The six jellyfish sprite builders |
| `23b-juice.js` | Particles, ripples, confetti, scrub and water-change effects, marine snow |
| `24-ui.js` | Tabs, sheets, shop, breeding screen, collection book, flying coins, toasts |
| `25-boot.js` | Loading and saving, offline catch-up, startup |

## Good to know

- **Saving:** the game saves to `localStorage` under the key `finlings.save.v1`. When it runs as a Claude artifact it also saves to the artifact's database (`window.claude`); outside of Claude that part is skipped automatically.
- **Offline time:** when you come back, the sim catches up on up to 72 hours of away time. Creatures never die, they only get sick or unhappy.
- **Fonts:** Pixelify Sans and Silkscreen load from Google Fonts. Without a connection the game falls back to the system monospace font and still works.
- **Reduced motion:** if the device has "Reduce Motion" on, the particles and bouncy animations switch off.
- **Developer tools:** open Settings and tap the title 7 times to reveal the skip-ahead buttons.
- **Adding a species:** add an entry to `SPECIES` in `21-data.js`. Fish and shrimp use the shared sprite builder in `23-scene.js`; jellyfish need a builder in `23a-jelly.js`.

## Testing

`tests/smoke.py` loads the built page in a phone-sized headless browser and checks the main loop (collect coins, feed, scrub, water change, buy a fish, save and reload) with no script errors.

```
pip install playwright
playwright install chromium
bash build.sh
python tests/smoke.py
```

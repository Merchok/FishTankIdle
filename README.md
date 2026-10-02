# future plans

this app was originaly made just for me but feel free to use it if you want. i plan on adding more features to the project and more species.

# Finlings

A cozy pixel-art pocket aquarium for your phone. Keep fish, shrimp and jellyfish, feed them, keep the water clean, breed new colors and hybrids, and fill your collection book.

Everything is plain HTML, CSS and JavaScript (canvas pixel art, synthesized sound, no libraries). The build step just glues the source files into **one self-contained HTML file**.

## Play it on your phone

**Play here:** https://merchok.github.io/FishTankIdle/

You can add Finlings to your home screen so it looks and works like a normal app: full screen, with its own icon, and it even works **without internet**.

### iPhone (Safari)

You have to use **Safari** (not Chrome) for this.

1. Open the link above in **Safari** and wait for the game to load.
2. Tap the **Share** button (the square with an arrow pointing up, at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** (top right).
5. Open Finlings from the new fish icon on your home screen. Done!

### Android (Chrome)

1. Open the link above in **Chrome** and wait for the game to load.
2. Tap the **three dots** menu (top right).
3. Tap **Install app** (or **Add to Home screen** if you don't see that).
4. Tap **Install**.
5. Open Finlings from the new fish icon. Done!

### Good to know

- **Open it with internet the first time.** That is when the game saves itself to your phone. After that it works offline.
- **Always open it from the home screen icon** once you have installed it.
- **Updates happen by themselves.** When a new version comes out, you get it the next time you open the game with internet (sometimes it takes one extra open).
- **Your tank is saved on your phone only.** Nothing is uploaded anywhere. Playing in the browser and playing from the home screen icon can have *separate* tanks.
- **Want to keep or move your tank?** Open **Settings** in the game, find **Backup**, and copy the code. Paste it into the **Restore** box on another device (or in the other app) to bring your tank over. Keep the code somewhere safe, it is your whole tank.

## Little habits

- Fish remember a favorite spot near a plant or decoration and wander back for a quiet pause. Shy fish prefer plants. With no decor, they pick a calm patch of water instead.
- Favorite spots survive saves and backups. Move a favorite decoration and the fish follows it; remove it and the fish finds another spot.
- Tap **empty glass** to say hello. Bold, social and playful fish come over; shy fish hang back, then cautiously approach; greedy fish check briefly; lazy fish watch from where they are. Tap a fish itself for its details and favorite spot.
- Greetings are brief and limited to three fish at a time. Food, sleep and health take priority. There is no affection meter, bonus, penalty or daily task; these are simply little ways to get to know your crew.
- Reduced motion keeps the greetings gentle and skips their hearts, ripples and tap wiggles.

## Build

It is one plain bash script, nothing to install (on Windows use Git Bash or WSL).

```
bash build.sh
```

It writes these files to `dist/`:

| File | What it is |
| --- | --- |
| `dist/index.html` | A normal standalone page with the fonts built in. Open it in a browser or host it anywhere (GitHub Pages, Netlify, your own server). |
| `dist/finlings.html` | The bare fragment (no `<html>` wrapper), which is the format Claude artifacts use. |
| `dist/sw.js` | The service worker that makes the game work offline. |
| `dist/manifest.webmanifest` | The web app manifest (name, colors, icons) that makes it installable. |
| `dist/icons/` | App icons (192, 512 and the iPhone home-screen icon). |

If Node happens to be installed, the script also syntax-checks the combined code first. Without Node it just skips that step.

## Publishing on GitHub Pages

GitHub Pages only serves files, it never runs a build, so the build always happens before the files get there. Two easy ways:

1. **Automatic (recommended):** `.github/workflows/pages.yml` runs `bash build.sh` on GitHub whenever you push to `main` and publishes `dist/`. One-time setup: repo Settings > Pages > Source: **GitHub Actions**.
2. **Manual:** run `bash build.sh` yourself and publish `dist/index.html` (for example copy it to the repo root or to `/docs` and point Pages at that).

## Where things are

Everything lives in `src/`. The files are joined **in this order** into a single `<script>`, so later files can use anything defined earlier (the order is listed at the top of `build.sh`).

| File | What is inside |
| --- | --- |
| `00-head.html` | `<title>`, the font placeholder and all CSS (design tokens, layout, animations) |
| `10-body.html` | The page markup: header, tank canvas, tabs, bottom sheet, toast |
| `21-data.js` | Species list, genetics (colors, patterns, alleles), pixel icons, small helpers |
| `22-sim.js` | Game state, the time simulation (also used for offline catch-up), breeding, hybrids, jelly life cycle, save format and migrations, the "juice" event queue |
| `22b-audio.js` | Sound effects, all synthesized with the Web Audio API |
| `23-scene.js` | The tank canvas: fish and shrimp sprites, swimming, food, drawing, tap handling |
| `23a-jelly.js` | The six jellyfish sprite builders |
| `23b-juice.js` | Particles, ripples, confetti, scrub and water-change effects, marine snow |
| `24-ui.js` | Tabs, sheets, shop, breeding screen, collection book, flying coins, toasts |
| `25-boot.js` | Loading and saving, offline catch-up, startup, service worker registration |
| `sw.js` | Service worker: serves the game from cache when offline (network first, cache fallback) |
| `manifest.webmanifest` | Install info for the home screen |
| `icons/` | App icons, generated by `tools/make-icons.py` (needs Pillow) |
| `fonts/` | Pixelify Sans and Silkscreen as woff2, inlined into the page by the build (SIL Open Font License, see the license files next to them) |

## Good to know

- **Saving:** the game saves to `localStorage` under the key `finlings.save.v1`. When it runs as a Claude artifact it also saves to the artifact's database (`window.claude`); outside of Claude that part is skipped automatically.
- **Offline time:** when you come back, the sim catches up on up to 72 hours of away time. Creatures never die, they only get sick or unhappy.
- **Fonts:** Pixelify Sans and Silkscreen are bundled in the page as base64, so nothing is fetched from the internet and they work offline. Both are under the SIL Open Font License (licenses are in `src/fonts/`).
- **Backup code:** Settings has a copy-code box and a restore box. The code starts with `FIN1z:` (gzip + base64 of the save). Restoring asks for a second tap before it replaces the current tank.
- **Reduced motion:** if the device has "Reduce Motion" on, the particles and bouncy animations switch off.
- **Developer tools:** open Settings and tap the title 7 times to reveal the skip-ahead buttons.
- **Adding a species:** add an entry to `SPECIES` in `21-data.js`. Fish and shrimp use the shared sprite builder in `23-scene.js`; jellyfish need a builder in `23a-jelly.js`.

## Testing

- `tests/smoke.py` loads the built page in a phone-sized headless browser and checks the main loop (collect coins, feed, scrub, water change, buy a fish, save and reload) with no script errors.
- `tests/fish_personality_unit.js` checks favorite persistence, movement and priorities directly in Node, in normal and reduced-motion modes (rendering is stubbed).
- `tests/fish_personality.py` checks saved favorite spots, decor changes, personality greetings, priorities, repeated taps and mobile/reduced-motion behavior.
- `tests/offline.py` serves `dist/` locally, loads it once, cuts the network and checks that the game still starts from the service worker cache, plus the manifest, icons, fonts and the backup code round trip.

```
pip install playwright
playwright install chromium
bash build.sh
python tests/smoke.py
python tests/offline.py
python tests/fish_personality.py
node tests/fish_personality_unit.js
```

#!/usr/bin/env bash
# Builds Finlings. Plain bash, nothing to install.
#   bash build.sh   ->  dist/   (the whole installable web app; GitHub Pages serves this folder)
#
# dist/index.html     the game as ONE self-contained page (fonts are baked in)
# dist/sw.js          lets it work offline
# dist/manifest.webmanifest + dist/icons/   what makes "Add to Home Screen" feel like an app
# dist/finlings.html  the bare fragment, the format Claude artifacts use
set -euo pipefail
cd "$(dirname "$0")"

# Order matters: these all end up in ONE <script>, so later files can use earlier ones.
JS=(
  src/21-data.js     # species, genetics, icons, helpers
  src/22-sim.js      # game state, simulation, breeding, saves, juice event queue
  src/22b-audio.js   # synthesized sound effects
  src/23-scene.js    # tank canvas: fish/shrimp sprites, movement, drawing, taps
  src/23a-jelly.js   # jellyfish sprite builders
  src/23b-juice.js   # particles, ripples, cleaning effects, celebrations
  src/24-ui.js       # tabs, sheets, shop, breeding screen, coin fly, toasts, backup code
  src/25-boot.js     # loading, saving, offline catch-up, startup
)

# Quick syntax check if Node happens to be installed (optional, skipped otherwise).
if command -v node >/dev/null 2>&1; then
  cat "${JS[@]}" | node --check - || { echo "Syntax error in the combined script, nothing written." >&2; exit 1; }
else
  echo "(node not found, skipping the syntax check)"
fi

# The three fonts, baked into the page as base64 so there is nothing to download.
font_css() {
  face() { printf "@font-face{font-family:'%s';font-weight:%s;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}\n" \
             "$1" "$2" "$(base64 < "src/fonts/$3" | tr -d '\n\r')"; }
  printf '<style>\n'
  face 'Pixelify Sans' 400 PixelifySans-400.woff2
  face 'Pixelify Sans' 600 PixelifySans-600.woff2
  face 'Silkscreen'    400 Silkscreen-400.woff2
  printf '</style>\n'
}
# src/00-head.html with the <!--FONTS--> marker swapped for the font CSS
head_html() {
  local h; h=$(cat src/00-head.html; printf x); h=${h%x}
  printf '%s' "${h%%<!--FONTS-->*}"
  font_css
  printf '%s' "${h#*<!--FONTS-->}"
}

rm -rf dist
mkdir -p dist/icons

# 1) Standalone page
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n'
  printf '<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#0d1b2b">\n'
  printf '<meta name="mobile-web-app-capable" content="yes">\n'
  printf '<meta name="apple-mobile-web-app-capable" content="yes">\n'
  printf '<meta name="apple-mobile-web-app-title" content="Finlings">\n'
  printf '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
  printf '<link rel="manifest" href="manifest.webmanifest">\n'
  printf '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
  printf '<link rel="icon" type="image/png" href="icons/icon-192.png">\n'
  head_html
  printf '</head>\n<body>\n'
  cat src/10-body.html
  printf '<script>\n'
  cat "${JS[@]}"
  printf '</script>\n</body>\n</html>\n'
} > dist/index.html

# 2) Bare fragment for Claude artifacts
{
  head_html
  cat src/10-body.html
  printf '<script>\n'
  cat "${JS[@]}"
  printf '</script>\n'
} > dist/finlings.html

# 3) App files. The service worker gets a version stamp so a new build refreshes the offline copy.
cp src/manifest.webmanifest dist/
cp src/icons/*.png dist/icons/
BUILD=$(cksum < dist/index.html | cut -d' ' -f1)
sed "s/__BUILD__/${BUILD}/g" src/sw.js > dist/sw.js

echo "dist/index.html     $(( $(wc -c < dist/index.html) / 1024 )) KB  (standalone page, fonts included)"
echo "dist/finlings.html  $(( $(wc -c < dist/finlings.html) / 1024 )) KB  (artifact fragment)"
echo "dist/sw.js          offline cache version ${BUILD}"

#!/usr/bin/env bash
# Builds Finlings into single self-contained HTML files. Plain bash, nothing to install.
#   bash build.sh   ->  dist/index.html    (standalone page: this is what GitHub Pages serves)
#                       dist/finlings.html (bare fragment, the format Claude artifacts use)
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
  src/24-ui.js       # tabs, sheets, shop, breeding screen, coin fly, toasts
  src/25-boot.js     # loading, saving, offline catch-up, startup
)

# Quick syntax check if Node happens to be installed (optional, skipped otherwise).
if command -v node >/dev/null 2>&1; then
  cat "${JS[@]}" | node --check - || { echo "Syntax error in the combined script, nothing written." >&2; exit 1; }
else
  echo "(node not found, skipping the syntax check)"
fi

mkdir -p dist

# 1) Standalone page
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n'
  printf '<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#0d1b2b">\n'
  cat src/00-head.html
  printf '</head>\n<body>\n'
  cat src/10-body.html
  printf '<script>\n'
  cat "${JS[@]}"
  printf '</script>\n</body>\n</html>\n'
} > dist/index.html

# 2) Bare fragment for Claude artifacts
{
  cat src/00-head.html src/10-body.html
  printf '<script>\n'
  cat "${JS[@]}"
  printf '</script>\n'
} > dist/finlings.html

echo "dist/index.html     $(( $(wc -c < dist/index.html) / 1024 )) KB  (standalone page)"
echo "dist/finlings.html  $(( $(wc -c < dist/finlings.html) / 1024 )) KB  (artifact fragment)"

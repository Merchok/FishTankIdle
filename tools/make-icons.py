"""Draws the Finlings app icon (a 32x32 pixel-art fish) and scales it up with crisp pixels.
Needs Pillow:  pip install pillow   then:  python tools/make-icons.py
Writes src/icons/*.png (these are committed, so you only re-run this if you change the art)."""
import os, math
from PIL import Image

W = 32
img = Image.new('RGB', (W, W))
px = img.load()
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# water: soft vertical bands
top, bot = hexrgb('#3a8fc0'), hexrgb('#15476d')
for y in range(W):
    t = (y // 2 * 2) / (W - 1)
    c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(W): px[x, y] = c
# light rays
for y in range(0, 22):
    for x in range(W):
        if (x + y // 2) % 11 in (0, 1) and y < 22:
            r, g, b = px[x, y]; px[x, y] = (min(255, r + 10), min(255, g + 12), min(255, b + 12))
# sand
sand, sand2 = hexrgb('#e8c98a'), hexrgb('#c9a86a')
for y in range(28, W):
    for x in range(W): px[x, y] = sand if (x * 7 + y * 3) % 5 else sand2

# fish body (head faces right)
cx, cy, rx, ry = 16.0, 15.0, 9.5, 6.5
body = set()
for y in range(W):
    for x in range(W):
        if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1: body.add((x, y))
# tail: triangle fan on the left
tail = set()
for x in range(2, 8):
    half = (x - 1.5) * 0.95
    for y in range(round(cy - half), round(cy + half) + 1):
        tail.add((x, y))
# fins
fin = {(15, 8), (16, 8), (17, 8), (16, 7), (17, 7), (14, 9), (15, 9), (13, 22), (14, 22), (15, 22), (12, 21), (13, 21)}
shape = body | tail | fin
outline = set()
for (x, y) in shape:
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if n not in shape and 0 <= n[0] < W and 0 <= n[1] < W: outline.add(n)

coral, coral_d, belly, sun, ink = hexrgb('#ff7a45'), hexrgb('#d9532b'), hexrgb('#ffb48a'), hexrgb('#ffd23f'), hexrgb('#3b1a14')
for (x, y) in outline: px[x, y] = ink
for (x, y) in body:
    c = coral
    if y >= cy + 3: c = belly
    elif y <= cy - 4: c = coral_d
    if x in (12, 13, 17, 18) and cy - 4 < y < cy + 3: c = sun      # stripes
    px[x, y] = c
for (x, y) in tail: px[x, y] = coral_d if (x + y) % 2 == 0 else coral
for (x, y) in fin: px[x, y] = coral_d
# eye + cheek shine
for (x, y) in ((21, 12), (22, 12), (23, 12), (21, 13), (22, 13), (23, 13), (21, 14), (22, 14), (23, 14)): px[x, y] = (255, 255, 255)
for (x, y) in ((22, 13), (23, 13), (22, 14), (23, 14)): px[x, y] = ink
px[20, 11] = hexrgb('#ffe0cc'); px[21, 11] = hexrgb('#ffe0cc'); px[19, 12] = hexrgb('#ffe0cc')
# smile
px[25, 17] = ink; px[26, 16] = ink
# bubbles (small pixel rings with a shine)
RING4 = ['.##.', '#..#', '#..#', '.##.']
RING3 = ['.#.', '#.#', '.#.']
for (bx, by, pat) in ((25, 5, RING4), (29, 2, RING3), (22, 2, RING3)):
    for j, row in enumerate(pat):
        for i, ch in enumerate(row):
            x, y = bx + i, by + j
            if ch == '#' and 0 <= x < W and 0 <= y < W: px[x, y] = hexrgb('#d6f1ff')
px[26, 6] = (255, 255, 255)

os.makedirs('src/icons', exist_ok=True)
for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
    img.resize((size, size), Image.NEAREST).save(os.path.join('src/icons', name), optimize=True)
    print('wrote src/icons/' + name)

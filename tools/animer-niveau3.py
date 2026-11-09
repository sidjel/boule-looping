"""
Prépare l'animation de la bande du niveau 3 (images/niveau3/bande.webp, faite par decouper-niveau3.py) :
- les drapeaux du château : découpés dans le dessin (le ciel derrière est transparent), rangés dans
  images/niveau3/drapeaux.webp ; le dessin sans drapeaux : images/niveau3/fond.webp. Le jeu les
  redessine en train de flotter au vent, accrochés à leur mât.
- l'eau du lac : son masque (images/niveau3/eau.png, en alpha), sans les roseaux ni les rives, effacé
  doucement vers la droite là où la bande suivante (le lac et les champs de foin) prend le relais.
  Le jeu fait onduler l'eau du dessin dans ce masque, avec quelques reflets de lumière.
- images/niveau3/anim.json : où sont les drapeaux et l'eau (en pixels de la bande), et des points
  dans l'eau pour les reflets.

Lancer après decouper-niveau3.py :  python3 tools/animer-niveau3.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'images', 'niveau3')
src = np.array(Image.open(os.path.join(ROOT, 'bande.webp')).convert('RGBA'))
a = src.astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
H, W = al.shape

# ---------- les drapeaux : taches rouges posées sur le ciel transparent, en haut du château ----------
red = ((r > 140) & (r - g > 45) & (r - b > 45) & (al > 60)).astype(np.uint8)
red[300:] = 0
red[:, :850] = 0
red[:, 1200:] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats(red, connectivity=8)
flags = []
for k in range(1, n):
    x, y, w, h, area = st[k]
    if area < 12 or w < 5:
        continue
    # un drapeau flotte dans le ciel : autour de lui (hors mât, à gauche), presque tout est transparent
    ring = al[max(0, y - 3):y + h + 3, x + 2:x + w + 4]
    if (ring < 40).mean() < 0.28:
        continue
    flags.append((int(x), int(y), int(w), int(h)))
flags.sort()
print('drapeaux :', flags)

fond = src.copy()
atlas_parts, out = [], []
ax = 0
for (x, y, w, h) in flags:
    # le drapeau : de juste après le mât à sa pointe, un peu au-dessus et en dessous (contour au crayon)
    x0, x1, y0, y1 = x, min(W, x + w + 8), max(0, y - 3), min(H, y + h + 3)
    part = src[y0:y1, x0:x1].copy()
    keep = part[..., 3] > 0
    # ne garder que la tache du drapeau et son contour (pas un morceau de toit en dessous)
    m = (lab[y0:y1, x0:x1] > 0).astype(np.uint8)
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 5)))
    keep &= m > 0
    part[~keep] = 0
    fond[y0:y1, x0:x1][keep] = 0
    atlas_parts.append(part)
    out.append({'sx': ax, 'w': x1 - x0, 'h': y1 - y0, 'x': x0, 'y': y0})
    ax += (x1 - x0) + 2
AH = max(p.shape[0] for p in atlas_parts)
atlas = np.zeros((AH, ax, 4), np.uint8)
for p, o in zip(atlas_parts, out):
    atlas[:p.shape[0], o['sx']:o['sx'] + p.shape[1]] = p
Image.fromarray(atlas).save(os.path.join(ROOT, 'drapeaux.webp'), lossless=True)
Image.fromarray(fond).save(os.path.join(ROOT, 'fond.webp'), quality=86, method=6)

# ---------- l'eau du lac ----------
blue = ((b > r + 30) & (b > g + 5) & (al > 200)).astype(np.uint8)
blue[:430] = 0
blue[720:] = 0
c = cv2.morphologyEx(blue, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
n, lab2, st2, _ = cv2.connectedComponentsWithStats(c)
big = 1 + int(np.argmax(st2[1:, 4]))
m = (lab2 == big).astype(np.uint8)
ff = m.copy()
cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 1)
m |= 1 - ff
# le haut du lac, sous la rive du fond (presque droite) : les reflets verts des arbres en font partie
top = np.array([np.argmax(m[:, x]) if m[:, x].any() else 9999 for x in range(W)])
good = top < 470
for x in range(900, W):
    if not good[x] and m[:, x].any():
        left = [t for t in top[max(0, x - 400):x] if t < 470]
        shore = int(np.median(left[-40:])) if left else 456
        m[shore:top[x], x] = 1
m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
ys, xs = np.nonzero(m)
bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
mask = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.6)
# vers la droite, la bande suivante recouvre le lac : l'ondulation s'y efface peu à peu
FADE0, FADE1 = 1180, 1300
fade = np.clip((FADE1 - np.arange(W)) / (FADE1 - FADE0), 0, 1)
mask *= fade[None, :]
crop = (mask[by0:by1, bx0:bx1] * 255).round().astype(np.uint8)
rgba = np.zeros(crop.shape + (4,), np.uint8)
rgba[..., :3] = 255
rgba[..., 3] = crop
Image.fromarray(rgba).save(os.path.join(ROOT, 'eau.png'), optimize=True)

# des points au milieu de l'eau pour les reflets de lumière (loin des rives)
deep = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
deep[:, FADE0 - 40:] = 0
py, px = np.nonzero(deep)
rng = np.random.default_rng(3)
pick = rng.choice(len(px), 24, replace=False)
glints = sorted([[int(px[i]), int(py[i])] for i in pick])

json.dump({
    'W': W, 'H': H,
    'drapeaux': out,
    'eau': {'x': bx0, 'y': by0, 'w': bx1 - bx0, 'h': by1 - by0},
    'reflets': glints,
}, open(os.path.join(ROOT, 'anim.json'), 'w'))
print('eau :', bx0, by0, bx1 - bx0, by1 - by0)

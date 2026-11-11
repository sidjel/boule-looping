"""
Prépare la boule dessinée (js/ballArt.js : bille d'acier au crayon) à partir du dessin fourni (fond noir) :
le disque de la boule est repéré (tout ce qui n'est pas noir), découpé en rond avec un bord adouci
(fond transparent), puis réduit à 192 × 192 : la boule fait 60 px du monde, soit 50 à 150 pixels à
l'écran selon la vue et la résolution. Écrit images/boule-metal.webp.
Usage : python3 tools/preparer-boule.py boule.png
"""
import os
import sys

import numpy as np
from PIL import Image

src = Image.open(sys.argv[1]).convert('RGB')
a = np.asarray(src).astype(np.int16)
ink = a.max(axis=2) > 28                      # tout ce qui n'est pas le fond noir
ys, xs = np.nonzero(ink)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
r = min(xs.max() - xs.min(), ys.max() - ys.min()) / 2 - 2   # un peu à l'intérieur : pas de liseré noir
SIZE, SS = 192, 4                              # taille finale, sur-échantillonnage du bord
box = (cx - r, cy - r, cx + r, cy + r)
disc = src.crop(tuple(round(v) for v in box)).resize((SIZE, SIZE), Image.LANCZOS)
yy, xx = np.mgrid[0:SIZE * SS, 0:SIZE * SS]
c = SIZE * SS / 2
mask = (((xx + 0.5 - c) ** 2 + (yy + 0.5 - c) ** 2) <= (c - SS * 0.5) ** 2).astype(np.uint8) * 255
mask = Image.fromarray(mask).resize((SIZE, SIZE), Image.LANCZOS)
disc.putalpha(mask)
out = os.path.join(os.path.dirname(__file__), '..', 'images', 'boule-metal.webp')
disc.save(out, quality=90, method=6)
print('centre', round(cx), round(cy), 'rayon', round(r), '→', out, os.path.getsize(out), 'octets')

"""
Prépare l'avion de l'automne (js/avion.js) à partir du dessin fourni (avion.png, fond transparent) :
- les deux pales de l'hélice qui dépassent du nez sont effacées : en vol, une hélice qui tourne ne se
  voit pas comme deux pales figées ; le jeu dessine à la place un disque flou qui scintille ;
- l'image est recadrée sur l'avion et réduite à 320 px de large (l'avion fait 130 à 210 pixels d'écran :
  assez fin sans être trop réduit à l'affichage, ce qui le ferait scintiller) ;
- images/avion/avion.webp et images/avion/avion.json (taille, centre et rayon de l'hélice).
Usage : python3 tools/preparer-avion.py avion.png
"""
import json
import os
import sys

import numpy as np
from PIL import Image

src = np.array(Image.open(sys.argv[1]).convert('RGBA'))
H, W = src.shape[:2]
# les pales, au-dessus et au-dessous du moyeu (colonnes de l'hélice, hors du nez)
X0, X1, HUB_Y0, HUB_Y1, LOW = 1626, 1700, 418, 512, 572
src[:HUB_Y0, X0:X1] = 0
src[LOW:, X0:X1] = 0
al = src[..., 3]
ys, xs = np.nonzero(al > 8)
x0, y0, x1, y1 = xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5
crop = Image.fromarray(src[y0:y1, x0:x1])
OUT_W = 320
k = OUT_W / crop.width
small = crop.resize((OUT_W, round(crop.height * k)), Image.LANCZOS)
out = os.path.join(os.path.dirname(__file__), '..', 'images', 'avion')
os.makedirs(out, exist_ok=True)
small.save(os.path.join(out, 'avion.webp'), quality=88, method=6)
hub = [round((1660 - x0) * k, 1), round((465 - y0) * k, 1)]
json.dump({'w': small.width, 'h': small.height, 'helice': {'x': hub[0], 'y': hub[1], 'r': round(228 * k, 1)}}, open(os.path.join(out, 'avion.json'), 'w'))
print(small.size, 'hélice', hub)

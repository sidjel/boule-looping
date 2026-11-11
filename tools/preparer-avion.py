"""
Prépare l'avion de l'automne (js/avion.js) à partir du dessin fourni (avion.png, fond transparent) :
- l'image est recadrée sur l'avion et réduite à 320 px de large (l'avion fait 130 à 210 pixels d'écran :
  assez fin sans être trop réduit à l'affichage, ce qui le ferait scintiller) ;
- images/avion/avion.webp et images/avion/avion.json (taille).
Usage : python3 tools/preparer-avion.py avion.png
"""
import json
import os
import sys

import numpy as np
from PIL import Image

src = np.array(Image.open(sys.argv[1]).convert('RGBA'))
H, W = src.shape[:2]
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
json.dump({'w': small.width, 'h': small.height}, open(os.path.join(out, 'avion.json'), 'w'))
print(small.size)

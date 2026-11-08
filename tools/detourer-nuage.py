"""Détoure le nuage modèle : le fond blanc autour du contour noir devient transparent,
l'intérieur (blanc et bleu) reste plein. Usage : python3 detourer-nuage.py source.jpg sortie.webp"""
import sys, cv2, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src).astype(np.float32)
g = im.mean(2)
# fond : pixels clairs reliés au bord de l'image
light = (g > 200).astype(np.uint8)
n, lab = cv2.connectedComponents(light)
border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
outside = np.isin(lab, [b for b in border if light[lab == b].any()])
# bord adouci : sur une bande autour de la forme, l'opacité suit la noirceur du trait
inside = ~outside
ring = cv2.dilate(inside.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & outside
a = inside.astype(np.float32)
a[ring] = np.clip((235 - g[ring]) / 200, 0, 1)
rgb = im[..., ::-1].copy()
rgb[ring] = 20  # le contour est noir
ys, xs = np.nonzero(a > 0.02)
y0, y1, x0, x1 = ys.min() - 2, ys.max() + 3, xs.min() - 2, xs.max() + 3
rgba = np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
Image.fromarray(rgba).save(out, quality=90, method=6)
print('taille', rgba.shape[1], 'x', rgba.shape[0])

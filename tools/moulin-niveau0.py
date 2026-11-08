"""Niveau 0 : le nouveau moulin, dessiné en deux parties (tour, ailes), détouré.
Usage : python3 moulin-niveau0.py tour.png ailes.png dossier/
Écrit tour.webp, ailes.webp (la croix entière, centrée sur le moyeu) et complète geo.json."""
import sys, json, cv2, numpy as np
from PIL import Image
tour, ailes, out = sys.argv[1:4]
geo = json.load(open(out + 'geo.json'))

def cut(path, solid):
    im = cv2.imread(path).astype(np.float32)
    paper = np.median(im[20:300, 20:1200].reshape(-1, 3), 0)
    d = np.clip(1 - im / paper[None, None, :], 0, 1).max(2)
    a = np.clip((d - 0.06) / 0.16, 0, 1)
    m = (cv2.GaussianBlur(a, (0, 0), 1) > 0.25).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 400]).astype(np.uint8)
    if solid:  # l'intérieur est plein (pierres claires, toiles des ailes)
        cs, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        fill = np.zeros_like(keep); cv2.drawContours(fill, cs, -1, 1, -1)
        a = np.maximum(a * keep, cv2.GaussianBlur(cv2.erode(fill, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 0.8))
    else:
        a = a * keep
    aa = np.maximum(a, 1e-3)[..., None]
    col = np.clip((im - (1 - aa) * paper) / aa, 0, 255)
    col = np.where(a[..., None] > 0.02, col, paper)
    ys, xs = np.nonzero(a > 0.05)
    x0, y0, x1, y1 = xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5
    rgba = np.dstack([col[..., ::-1], a * 255])[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)
    return rgba, (int(x0), int(y0))

t, (tx, ty) = cut(tour, True)
Image.fromarray(t).save(out + 'tour.webp', quality=85, method=6)
# les ailes : le moyeu (petit cercle au centre de la croix)
im = cv2.imread(ailes)
a, (ax, ay) = cut(ailes, True)
# moyeu : centre de la croix = intersection des diagonales ; on le prend au milieu de la boîte des ailes
# puis on l'affine sur le petit rond foncé
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
cx, cy = ax + a.shape[1] / 2, ay + a.shape[0] / 2
win = g[int(cy) - 40:int(cy) + 40, int(cx) - 40:int(cx) + 40]
circ = cv2.HoughCircles(win.astype(np.uint8), cv2.HOUGH_GRADIENT, 1, 20, param1=60, param2=12, minRadius=6, maxRadius=22)
if circ is not None:
    c = circ[0][0]; cx, cy = int(cx) - 40 + c[0], int(cy) - 40 + c[1]
# image des ailes centrée sur le moyeu
half = int(max(cx - ax, ax + a.shape[1] - cx, cy - ay, ay + a.shape[0] - cy)) + 4
sq = np.zeros((2 * half, 2 * half, 4), np.uint8)
ox, oy = int(round(half - (cx - ax))), int(round(half - (cy - ay)))
sq[oy:oy + a.shape[0], ox:ox + a.shape[1]] = a
Image.fromarray(sq).save(out + 'ailes.webp', quality=85, method=6)
# la tour et les ailes partagent le même repère (même feuille) : position du moyeu sur la tour
geo['moulin2'] = {'tour': [tx, ty, t.shape[1], t.shape[0]], 'moyeu': [float(cx), float(cy)], 'ailes': 2 * half}
json.dump(geo, open(out + 'geo.json', 'w'))
print('tour', tx, ty, t.shape[1], t.shape[0], 'moyeu', round(cx), round(cy), 'ailes', 2 * half)

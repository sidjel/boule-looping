"""L'herbe fleurie du premier plan, pour tous les niveaux, en quatre saisons.
Usage : python3 decouper-herbe.py herbe.jpg dossier/
- fond noir → transparent ;
- bande qui se raccorde sur elle-même en largeur (sans miroir) : le début est fondu avec la suite ;
- ete.webp (telle quelle), automne.webp (fanée : herbe paille et rousse, fleurs ternes),
  hiver.webp (givrée, neige sur les brins et au pied), pluie.webp (mouillée, plus sombre)."""
import sys, json, cv2, numpy as np
from PIL import Image
src, out = sys.argv[1:3]
im = cv2.imread(src).astype(np.float32)[..., ::-1]           # RGB
v = im.max(2)
a = np.clip((v - 6) / 18, 0, 1)
ys, xs = np.nonzero(a > 0.3)
y0, y1, x0, x1 = ys.min() - 4, ys.max() + 1, xs.min() + 30, xs.max() - 30
im, a = im[y0:y1, x0:x1], a[y0:y1, x0:x1]
# raccord : on garde la largeur w ; les B premières colonnes sont fondues avec les B suivantes
B = 260
w = im.shape[1] - B
t = (np.arange(B) / B)[None, :]
pa = im * a[..., None]                                          # couleurs prémultipliées
P = pa[:, :w].copy(); A = a[:, :w].copy()
P[:, :B] = pa[:, :B] * t[..., None] + pa[:, w:w + B] * (1 - t[..., None])
A[:, :B] = a[:, :B] * t + a[:, w:w + B] * (1 - t)
col = P / np.maximum(A, 1e-4)[..., None]
H = col.shape[0]
scale = 0.8
def save(name, rgb, al):
    rgba = np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8)
    rgba = cv2.resize(rgba, (round(rgba.shape[1] * scale), round(rgba.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    Image.fromarray(rgba).save(out + name, quality=84, method=6)
    print(name, rgba.shape[1], 'x', rgba.shape[0])
    return [rgba.shape[1], rgba.shape[0]]
meta = {'ete': save('ete.webp', col, A)}
# ----- automne : fanée
hsv = cv2.cvtColor(np.clip(col, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
h, s, val = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255   # h en degrés
green = np.clip(1 - np.abs(h - 95) / 60, 0, 1) * np.clip(s * 3, 0, 1)
L = (0.3 * col[..., 0] + 0.59 * col[..., 1] + 0.11 * col[..., 2])[..., None]
rnd = cv2.GaussianBlur(np.random.default_rng(4).random((H, col.shape[1])).astype(np.float32), (0, 0), 25)
rnd = (rnd - rnd.min()) / (rnd.max() - rnd.min())
straw = np.dstack([L[..., 0] * 1.05 + 55, L[..., 0] * 0.85 + 25, L[..., 0] * 0.35 + 5])   # paille
rust = np.dstack([L[..., 0] * 0.95 + 70, L[..., 0] * 0.55 + 15, L[..., 0] * 0.25])         # roux
dry = straw * (1 - rnd[..., None]) + rust * rnd[..., None]
faded = col * 0.5 + L * 0.5                                    # fleurs ternes
aut = faded * (1 - green[..., None]) + dry * green[..., None]
aut = aut * 0.82 + np.array([150, 105, 50]) * 0.18 * (1 - green[..., None])
meta['automne'] = save('automne.webp', aut, A)
# ----- hiver : givrée, neige sur le haut des brins et au pied
frost = col * 0.3 + (L * 0.55 + np.array([60, 75, 95])) * 0.7
cap = np.clip(A - np.roll(A, 7, axis=0), 0, 1)               # bords supérieurs des brins
cap[:7] = 0
cap = cv2.GaussianBlur(cap, (0, 0), 1.2)
cap = np.clip(cap * 1.6, 0, 1)
yy = np.arange(H)[:, None] / H
X = np.arange(col.shape[1])
# la congère : ondulations douces qui se raccordent sur la largeur de la bande
W_ = col.shape[1]
wave = 0.72 + 0.04 * np.sin(2 * np.pi * 7 * X / W_)[None, :] + 0.025 * np.sin(2 * np.pi * 19 * X / W_ + 1)[None, :]
drift = np.clip((yy - wave) / 0.025, 0, 1)                   # congère au pied
cap[yy[:, 0] > 0.6] = 0  # pas de « crêtes » de neige dans le bas, sous la congère
snow = np.maximum(cap, drift)
white = np.array([246, 249, 255], np.float32)
win = frost * (1 - snow[..., None]) + white * snow[..., None]
Aw = np.maximum(A, drift * (A.max(0, keepdims=True) > 0.3))
meta['hiver'] = save('hiver.webp', win, Aw)
# ----- pluie : mouillée, plus sombre et plus bleue
rain = col * np.array([0.72, 0.8, 0.85]) + np.array([0, 4, 14])
meta['pluie'] = save('pluie.webp', rain, A)
json.dump(meta, open(out + 'herbe.json', 'w'))

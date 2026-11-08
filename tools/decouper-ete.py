"""Été (niveaux 2 et 3) : prépare les éléments dessinés pour les plans de parallaxe.
Usage : python3 decouper-ete.py ferme.jpg cochon.png foret.png montagnes.png nuages.png herbe.jpg \
        ciel-niveau0.jpg butte-niveau0.jpg geo-niveau0.json dossier/"""
import sys, json, cv2, numpy as np
from PIL import Image
(ferme, cochon, foret, montagnes, nuages, herbe, ciel, butte, geo0, out) = sys.argv[1:11]
meta = {}

def save(name, rgba, scale=1.0, q=82):
    if scale != 1:
        rgba = cv2.resize(rgba, (round(rgba.shape[1] * scale), round(rgba.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    a = rgba.clip(0, 255).astype(np.uint8)
    Image.fromarray(a).save(out + name, quality=q, method=6)
    print(name, a.shape[1], 'x', a.shape[0])
    return a.shape[1], a.shape[0]

def crop_alpha(rgba, pad=4):
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    y0, y1, x0, x1 = max(0, ys.min() - pad), ys.max() + pad + 1, max(0, xs.min() - pad), xs.max() + pad + 1
    return rgba[y0:y1, x0:x1], (int(x0), int(y0))

def rgba_png(path):
    return np.array(Image.open(path).convert('RGBA')).astype(np.float32)

# ---------- éléments déjà détourés (PNG transparents)
pig, _ = crop_alpha(rgba_png(cochon))
meta['cochon'] = save('cochon.webp', pig, 0.25)
fo = rgba_png(foret)
fo, (fx, fy) = crop_alpha(fo, 0)
fo = fo[:-45, 45:-20]  # bords du papier déchiré
meta['foret'] = {'size': save('foret.webp', fo, 0.8), 'src': [fx, fy]}
mo, _ = crop_alpha(rgba_png(montagnes), 0)
meta['montagnes'] = save('montagnes.webp', mo, 0.75)
cl = rgba_png(nuages)
m = (cl[..., 3] > 20).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((9, 9), np.uint8)))
clouds = []
for i in sorted(range(1, n), key=lambda i: -st[i, cv2.CC_STAT_AREA]):
    x, y, w, h, area = st[i]
    if area < 3000: continue
    part = cl[y:y + h, x:x + w].copy()
    part[..., 3] *= (lab[y:y + h, x:x + w] == i)
    clouds.append(save(f'nuage-{len(clouds)}.webp', part, 0.6))
meta['nuages'] = clouds

# ---------- herbe : fond noir pur → transparent (les traits sombres restent)
g = cv2.imread(herbe).astype(np.float32)
v = g.max(2)
a = np.clip((v - 6) / 18, 0, 1)
rgba = np.dstack([g[..., ::-1], a * 255])
rgba, _ = crop_alpha(rgba, 0)
meta['herbe'] = save('herbe.webp', rgba, 0.8)

# ---------- ferme : papier blanc → transparent au-dessus des collines ; dessous, plein
im = cv2.imread(ferme).astype(np.float32)
H, W = im.shape[:2]
p = cv2.GaussianBlur(cv2.dilate(im, np.ones((31, 31), np.uint8)), (0, 0), 30)
d = np.clip(1 - im / np.maximum(p, 1), 0, 1).max(2)
db = cv2.GaussianBlur(d, (0, 0), 2)
on = db > 0.07
top = np.full(W, H)
for x in range(W):
    for y in np.nonzero(on[:, x])[0]:
        if y > H * 0.3 and on[y:y + 80, x].mean() > 0.9: top[x] = y; break
top = np.array([np.median(top[max(0, x - 6):x + 7]) for x in range(W)])
yy = np.arange(H)[:, None]
a = np.clip((d - 0.05) / 0.16, 0, 1)
a[yy < top[None, :] - 2] = np.where(d > 0.12, a, 0)[yy < top[None, :] - 2]  # au-dessus : seulement le dessin (la ferme, les arbres)
a[(yy < H * 0.45) & (np.arange(W)[None, :] < W * 0.6)] = 0  # la montagne pâle esquissée au loin
solid = yy >= top[None, :] + 3
a = np.maximum(a, cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 1.2))
aa = np.maximum(a, 1e-3)[..., None]
c = np.where(solid[..., None], im, np.clip((im - (1 - aa) * p) / aa, 0, 255))
# bords gauche et droit du dessin (papier) : coupés
xs = np.nonzero(solid[int(H * 0.8)])[0]
x0, x1 = xs.min() + 30, xs.max() - 30
spk = (a > 0.1).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(spk)
a[np.isin(lab, [k for k in range(1, n) if st[k, cv2.CC_STAT_AREA] < 300])] = 0
rgba = np.dstack([c[..., ::-1], a * 255])[int(H * 0.3):H - 30, x0:x1]
meta['ferme'] = {'size': save('ferme.webp', rgba, 0.8)}

# ---------- ciel : le ciel du niveau 0 (crayon bleu et petits nuages lointains), sans le soleil
s = cv2.imread(ciel).astype(np.float32)
b, r = s[..., 0], s[..., 2]
yy2, xx2 = np.mgrid[0:s.shape[0], 0:s.shape[1]]
# tout le disque du soleil et son halo, y compris le petit nuage qu'il chevauche
sun = (np.hypot(xx2 - 1330, yy2 - 255) < 330) | ((np.abs(xx2 - 1330) < 330) & (yy2 < 600) & (yy2 > 380) & (s.min(2) > 175))
tile = s.copy(); todo = sun.copy()
for dx in (760, -760, 1000, -1000):
    src = np.roll(s, dx, axis=1); sb = np.roll(sun, dx, axis=1)
    ok = todo & ~sb; tile[ok] = src[ok]; todo &= ~ok
w = cv2.GaussianBlur(sun.astype(np.float32), (0, 0), 10)[..., None]
tile = (s * (1 - w) + tile * w)[0:900]
meta['ciel'] = save('ciel.webp', np.dstack([tile[..., ::-1], np.full(tile.shape[:2], 255)]), 0.5, q=78)

# ---------- terre : la butte du niveau 0 (fond, et bande qui suit la route)
bt_ = cv2.imread(butte).astype(np.float32)
gs = np.array(json.load(open(geo0))['ground'])
K = 2000 / 2932
fond = bt_[1180:1430, 1300:2932]
meta['terre_fond'] = save('terre-fond.webp', np.dstack([fond[..., ::-1], np.full(fond.shape[:2], 255)]), K)
cols = [x for x in range(1300, 2900)]
D = 220
band = np.zeros((D, len(cols), 3), np.float32)
for i, x in enumerate(cols):
    y0 = int(gs[x]) + 2
    seg = bt_[y0:y0 + D, x]
    band[:len(seg), i] = seg
fade = np.clip((D - np.arange(D)) / 80, 0, 1)[:, None] * np.ones((1, len(cols)))
meta['terre_bande'] = save('terre-bande.webp', np.dstack([band[..., ::-1], fade * 255]), K)
json.dump(meta, open(out + 'ete.json', 'w'))

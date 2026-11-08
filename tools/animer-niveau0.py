"""Niveau 0 : prépare ce qui bouge, à lancer après decouper-niveau0.py.
- moulin : les ailes sont retirées de plan3-moulin.webp (ciel transparent, tour réparée)
  et une aile seule est écrite dans aile.webp (le jeu en fait tourner quatre) ;
- soleil : retiré du ciel (plan5-ciel.webp) et écrit seul dans soleil.webp (il pulse et brille).
Usage : python3 animer-niveau0.py ciel.jpg moulin.jpg dossier/"""
import sys, json, math, cv2, numpy as np
from PIL import Image
ciel, moulin, out = sys.argv[1:4]
geo = json.load(open(out + 'geo.json'))

def load_rgba(p):
    a = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
    return a
def save(name, arr, q=82):
    Image.fromarray(arr.clip(0, 255).astype(np.uint8)).save(out + name, quality=q, method=6)
    print(name, arr.shape[1], 'x', arr.shape[0])

# ---------- moulin (repère de l'image d'origine 2752 × 1536 ; plan3 est à 0,75)
S3 = 0.75
HUB = (2230, 565)
TIPS = [(2000, 270), (2520, 270), (2480, 840), (1980, 840)]
src = cv2.imread(moulin).astype(np.float32)
H0, W0 = src.shape[:2]
mask = np.zeros((H0, W0), np.uint8)
for tx, ty in TIPS:
    v = np.array([tx - HUB[0], ty - HUB[1]], float); L = np.linalg.norm(v); u = v / L; n = np.array([-u[1], u[0]])
    hw = 68
    p = [np.array(HUB) + n * 14 - u * 10, np.array(HUB) + u * 60 + n * 14, np.array(HUB) + u * 70 + n * hw,
         np.array(HUB) + u * (L + 30) + n * hw, np.array(HUB) + u * (L + 30) - n * hw, np.array(HUB) + u * 70 - n * hw,
         np.array(HUB) + u * 60 - n * 14, np.array(HUB) - n * 14 - u * 10]
    cv2.fillPoly(mask, [np.int32(p)], 1)
cv2.circle(mask, HUB, 34, 1, -1)
# aile seule : celle du haut à gauche (devant le ciel), tournée à l'horizontale
tx, ty = TIPS[0]
ang = math.degrees(math.atan2(ty - HUB[1], tx - HUB[0]))
M = cv2.getRotationMatrix2D(HUB, ang, 1.0)
rot = cv2.warpAffine(src, M, (W0, H0), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
L = int(math.hypot(tx - HUB[0], ty - HUB[1])) + 34
crop = rot[HUB[1] - 70:HUB[1] + 70, HUB[0]:HUB[0] + L]
pap = cv2.GaussianBlur(cv2.dilate(crop, np.ones((25, 25), np.uint8)), (0, 0), 20)
pap[:] = np.median(src[40:200, 1700:2700].reshape(-1, 3), 0)  # papier du ciel, uni
d = np.clip(1 - crop / np.maximum(pap, 1), 0, 1).max(2)
a = np.clip((d - 0.05) / 0.16, 0, 1)
a[:, :34] = 0  # le moyeu est dessiné à part
aa = np.maximum(a, 1e-3)[..., None]
col = np.clip((crop - (1 - aa) * pap) / aa, 0, 255)
blade = np.dstack([col[..., ::-1], a * 255])
blade = cv2.resize(blade, (round(blade.shape[1] * S3), round(blade.shape[0] * S3)), interpolation=cv2.INTER_AREA)
pass  # (ancienne aile découpée : remplacée par ailes.webp, moulin-niveau0.py)
# plan 3 sans l'ancien moulin (le nouveau, dessiné à part, se pose par-dessus : tour.webp).
# Le trou est rebouché par un morceau de paysage pris plus à gauche, fondu sans couture
# (clonage de Poisson), choisi pour que la crête des montagnes se raccorde des deux côtés.
OLD = np.int32([(2165, 600), (2290, 405), (2335, 430), (2425, 555), (2465, 620), (2475, 855), (2590, 875), (2590, 1020), (2125, 1020)])
cv2.fillPoly(mask, [OLD], 1)
mask = cv2.dilate(mask, np.ones((15, 15), np.uint8))
mask[1060:] = 0
yy, xx = np.mgrid[0:H0, 0:W0]

def paper_d(img):
    p = cv2.GaussianBlur(cv2.dilate(img, np.ones((31, 31), np.uint8)), (0, 0), 30)
    return np.clip(1 - img / np.maximum(p, 1), 0, 1).max(2), p

def ridge_of(img, skip=None):
    """Haut du paysage (montagnes comprises), colonne par colonne."""
    d, _ = paper_d(img)
    db = cv2.GaussianBlur(d, (0, 0), 3)
    on = db > 0.06
    if skip is not None: on &= ~skip
    r = np.full(W0, H0, np.float32)
    for x in range(W0):
        ys = np.nonzero(on[:, x])[0]
        for y in ys:
            if on[y:y + 60, x].mean() > 0.8: r[x] = y; break
    return np.array([np.median(r[max(0, x - 12):x + 13]) for x in range(W0)])

r0 = ridge_of(src, mask > 0)
cols = np.nonzero(mask.any(0))[0]
xl, xr = int(cols.min()), int(cols.max())
best = None
for dx in range(xr - xl + 40, 1500, 4):
    if xl - dx < 0: break
    e = abs(r0[xl - 2] - r0[xl - 2 - dx]) + abs(r0[min(W0 - 1, xr + 2)] - r0[xr + 2 - dx])
    if best is None or e < best[0]: best = (e, dx)
dx = best[1]
shifted = np.roll(src, dx, axis=1)
ys_, xs_ = np.nonzero(mask)
center = (int((xs_.min() + xs_.max()) / 2), int((ys_.min() + ys_.max()) / 2))
img2 = cv2.seamlessClone(shifted.astype(np.uint8), src.astype(np.uint8), (mask * 255).astype(np.uint8), center, cv2.NORMAL_CLONE).astype(np.float32)
print('moulin retiré : morceau pris', dx, 'px plus à gauche, écart de crête', best[0])
# bord droit du dessin, pâle : il est retiré (le jeu étire un peu le reste)
CUT = 70
cv2.imwrite('/tmp/moulin-sans-ailes.png', img2)
# détourage : au-dessus de la crête, le papier devient transparent ; dessous, tout est plein et
# garde les couleurs du dessin (pas de « dé-mélange », qui faisait des piqûres claires et sombres)
d, p = paper_d(img2)
a = np.clip((d - 0.05) / 0.18, 0, 1)
aa = np.maximum(a, 1e-3)[..., None]
c = np.where(a[..., None] > 0.02, np.clip((img2 - (1 - aa) * p) / aa, 0, 255), img2)
r2 = ridge_of(img2)

solid = (yy >= r2[None, :] + 5)
a = np.maximum(a, cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 1.2))
c = np.where(solid[..., None], img2, c)
# papier blanc collé au ciel (au-dessus du trait de crête) : transparent
pale = ((img2.min(2) > 195) & ((img2.max(2) - img2.min(2)) < 40)).astype(np.uint8)
pale = cv2.morphologyEx(pale, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
skyz = (a < 0.15).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(pale | skyz)
skyids = np.unique(lab[skyz > 0])
touch = np.isin(lab, skyids[skyids > 0]) & (pale > 0)
touch &= (yy < 900)  # seulement le long des montagnes
a[cv2.dilate(touch.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = 0
solid &= ~touch
# au-dessus de la crête : pas de poussières isolées
spk = ((a > 0.1) & ~solid).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(spk)
small = np.isin(lab, [k for k in range(1, n) if st[k, cv2.CC_STAT_AREA] < 400])
a[small] = 0
# taches blanches (papier) à l'intérieur : remplacées par la couleur voisine
white = solid & (img2.min(2) > 205) & ((img2.max(2) - img2.min(2)) < 30)
n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8))
white = np.isin(lab, [k for k in range(1, n) if st[k, cv2.CC_STAT_AREA] < 250])  # seulement les petites taches
white = cv2.dilate(white.astype(np.uint8), np.ones((3, 3), np.uint8))
c = cv2.inpaint(c.clip(0, 255).astype(np.uint8), white * 255, 4, cv2.INPAINT_TELEA).astype(np.float32)
top = geo['plan3']['top']
out3 = np.dstack([c[top:, :W0 - CUT, ::-1], a[top:, :W0 - CUT] * 255])
out3 = cv2.resize(out3, (round((W0 - CUT) * S3), round((H0 - top) * S3)), interpolation=cv2.INTER_AREA)
geo['plan3']['w'] = W0 - CUT
save('plan3-moulin.webp', out3, q=80)

# ---------- soleil (repère de l'image d'origine 2932 × 1440 ; plan5 est à 0,5)
S5 = 0.5
SUN, RS = (1330, 255), 250
sky = cv2.imread(ciel).astype(np.float32)
b, g, r = sky[..., 0], sky[..., 1], sky[..., 2]
sunm = ((r - b > 45) & (r > 160)).astype(np.uint8)
sunm = cv2.morphologyEx(sunm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
yy, xx = np.mgrid[0:sky.shape[0], 0:sky.shape[1]]
near = (np.hypot(xx - SUN[0], yy - SUN[1]) < RS + 20)
sunm = sunm.astype(bool) & near
# sprite : le soleil seul, sur fond transparent
x0, y0 = max(0, SUN[0] - RS - 20), max(0, SUN[1] - RS - 20)
crop = sky[y0:SUN[1] + RS + 20, x0:SUN[0] + RS + 20]
a = cv2.GaussianBlur(cv2.erode(sunm[y0:SUN[1] + RS + 20, x0:SUN[0] + RS + 20].astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.0)
spr = np.dstack([crop[..., ::-1], a * 255])
spr = cv2.resize(spr, (round(spr.shape[1] * S5), round(spr.shape[0] * S5)), interpolation=cv2.INTER_AREA)
save('soleil.webp', spr, q=85)
geo['soleil'] = {'x': SUN[0] - x0, 'y': SUN[1] - y0, 'cx': SUN[0], 'cy': SUN[1]}
# le ciel garde son soleil (le soleil animé se pose dessus) mais perd le papier blanc autour
ring = (np.hypot(xx - SUN[0], yy - SUN[1]) < RS + 40)
pale = ring & ~sunm & ((b - r) < 40) & (sky.min(2) > 175)
pale = cv2.dilate(pale.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~sunm
fill = sky.copy(); todo = pale.copy()
for dx in (620, -620, 820, -820, 1000):
    srcs = np.roll(sky, dx, axis=1); bad = np.roll(pale | sunm, dx, axis=1)
    okp = todo & ~bad; fill[okp] = srcs[okp]; todo &= ~okp
w = cv2.GaussianBlur(pale.astype(np.float32), (0, 0), 2)[..., None]
skyc = sky * (1 - w) + fill * w
p5 = cv2.resize(skyc, (round(sky.shape[1] * S5), round(sky.shape[0] * S5)), interpolation=cv2.INTER_AREA)
Image.fromarray(p5[..., ::-1].clip(0, 255).astype(np.uint8)).save(out + 'plan5-ciel.webp', quality=78, method=6)
print('plan5-ciel.webp : papier autour du soleil retiré', int(pale.sum()))
geo['moulin'] = {'hub': [HUB[0], HUB[1]], 'aile': [blade.shape[1], blade.shape[0]], 'echelle': S3,
                 'foin': [[372, 812], [743, 963]]}
json.dump(geo, open(out + 'geo.json', 'w'))

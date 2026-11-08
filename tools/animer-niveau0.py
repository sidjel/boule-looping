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
save('aile.webp', blade)
# plan 3 sans les ailes : retouche du dessin d'origine, puis même détourage que decouper-niveau0.py
TOWER = np.int32([(2180, 620), (2290, 420), (2320, 440), (2410, 550), (2450, 625), (2450, 1000), (2140, 1000)])
tower = np.zeros((H0, W0), np.uint8); cv2.fillPoly(tower, [TOWER], 1)
g0 = cv2.GaussianBlur(src, (0, 0), 2).mean(2) < 225
line = np.array([np.argmax(g0[:, x] & (mask[:, x] == 0)) if (g0[:, x] & (mask[:, x] == 0)).any() else H0 for x in range(W0)])
line = np.array([np.median(line[max(0, x - 25):x + 26]) for x in range(W0)])
# derrière les ailes du bas, la ligne des montagnes est cachée : on la tend entre ses bords visibles
for a0, a1 in ((1930, 2175), (2440, 2570)):
    line[a0:a1] = np.linspace(line[a0], line[a1], a1 - a0)
yy, xx = np.mgrid[0:H0, 0:W0]
blade = mask > 0
sky_hole = blade & (tower == 0) & (yy < line[None, :] + 4)
fix = blade & ~sky_hole
img2 = src.copy()
# la tour : reflet de l'autre côté de son axe quand il n'est pas caché
axis = 2300
mx = np.clip(2 * axis - xx, 0, W0 - 1)
mir = fix & (tower > 0) & ~blade[yy, mx]
img2[mir] = src[yy, mx][mir]
rest = fix & ~mir
# hors de la tour (montagnes, arbres, champs) : on recopie le paysage voisin, à la même hauteur
out_t = rest & (tower == 0)
for dx in (300, -300, 420, -420, 540, -540):
    srcx = np.clip(xx - dx, 0, W0 - 1)
    inside = (xx - dx >= 0) & (xx - dx < W0)
    okp = out_t & inside & ~blade[yy, srcx] & (tower[yy, srcx] == 0)
    img2[okp] = src[yy, srcx][okp]
    out_t &= ~okp
soft = cv2.GaussianBlur((rest & (tower == 0)).astype(np.float32), (0, 0), 2)[..., None]
img2 = img2 * 1.0
rest = (rest & (tower > 0)) | out_t
img2 = cv2.inpaint(img2.clip(0, 255).astype(np.uint8), rest.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA).astype(np.float32)
img2[sky_hole] = np.median(src[40:200, 1700:2700].reshape(-1, 3), 0)  # papier : deviendra transparent
cv2.imwrite('/tmp/moulin-sans-ailes.png', img2)
# détourage (comme decouper-niveau0.py, plan 3)
p = cv2.GaussianBlur(cv2.dilate(img2, np.ones((31, 31), np.uint8)), (0, 0), 30)
d = np.clip(1 - img2 / np.maximum(p, 1), 0, 1).max(2)
a = np.clip((d - 0.05) / 0.18, 0, 1)
aa = np.maximum(a, 1e-3)[..., None]
c = np.where(a[..., None] > 0.02, np.clip((img2 - (1 - aa) * p) / aa, 0, 255), img2)
g3 = cv2.GaussianBlur(img2, (0, 0), 2).mean(2) < 225
top3 = np.full(W0, H0)
for x in range(W0):
    for y in np.nonzero(g3[:, x])[0]:
        if g3[y:y + 120, x].mean() > 0.97: top3[x] = y; break
top3 = np.array([np.median(top3[max(0, x - 15):x + 16]) for x in range(W0)])
a = np.maximum(a, cv2.GaussianBlur((yy >= top3[None, :] + 6).astype(np.float32), (0, 0), 1.5))
a[sky_hole] = 0
a = np.maximum(a, np.maximum(tower, rest).astype(np.float32))
c = np.where(a[..., None] > 0.02, c, img2)
top = geo['plan3']['top']
out3 = np.dstack([c[top:, :, ::-1], a[top:] * 255])
out3 = cv2.resize(out3, (round(W0 * S3), round((H0 - top) * S3)), interpolation=cv2.INTER_AREA)
save('plan3-moulin.webp', out3, q=80)

# ---------- soleil (repère de l'image d'origine 2932 × 1440 ; plan5 est à 0,5)
S5 = 0.5
SUN, RS = (1330, 255), 250
sky = cv2.imread(ciel).astype(np.float32)
b, g, r = sky[..., 0], sky[..., 1], sky[..., 2]
sunm = ((r - b > 45) & (r > 160)).astype(np.uint8)
sunm = cv2.dilate(sunm, np.ones((9, 9), np.uint8))
yy, xx = np.mgrid[0:sky.shape[0], 0:sky.shape[1]]
near = (np.hypot(xx - SUN[0], yy - SUN[1]) < RS + 20)
sunm = sunm.astype(bool) & near
# sprite : le soleil seul, sur fond transparent
x0, y0 = max(0, SUN[0] - RS - 20), max(0, SUN[1] - RS - 20)
crop = sky[y0:SUN[1] + RS + 20, x0:SUN[0] + RS + 20]
a = cv2.GaussianBlur(sunm[y0:SUN[1] + RS + 20, x0:SUN[0] + RS + 20].astype(np.float32), (0, 0), 1.5)
spr = np.dstack([crop[..., ::-1], a * 255])
spr = cv2.resize(spr, (round(spr.shape[1] * S5), round(spr.shape[0] * S5)), interpolation=cv2.INTER_AREA)
save('soleil.webp', spr, q=85)
geo['soleil'] = {'x': SUN[0] - x0, 'y': SUN[1] - y0, 'cx': SUN[0], 'cy': SUN[1]}
# le ciel garde son soleil : le soleil animé se pose exactement dessus
geo['moulin'] = {'hub': [HUB[0], HUB[1]], 'aile': [blade.shape[1], blade.shape[0]], 'echelle': S3,
                 'foin': [[372, 812], [743, 963]]}
json.dump(geo, open(out + 'geo.json', 'w'))

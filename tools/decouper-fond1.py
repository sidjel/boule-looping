"""Découpe du second dessin : montagnes seules (raccordées, pour être répétées sur 4 niveaux),
ligne de sol, et objets détourés (charrette, foin, tronc, feuillage, moulin sans pales)."""
import cv2, numpy as np, json
from PIL import Image
SRC = '/root/.claude/uploads/458475f2-6a8a-5f63-8237-3bcc6d8a28fd/12d2549b-image.jpg'
OUT = 'boule-looping/images/fond1/'
SP = '/tmp/'  # aperçus
im = cv2.imread(SRC)
W = 2000; im = cv2.resize(im, (W, round(im.shape[0] * W / im.shape[1])), interpolation=cv2.INTER_AREA)
I = im.astype(np.float32)
H = I.shape[0]
rng = np.random.default_rng(3)

# ---------- moulin : pales retirées, silhouette réparée (comme fond1.py)
hub = (1637, 645)
ends = [(1510, 510), (1787, 510), (1487, 780), (1794, 787)]
Mb = np.zeros((H, W), np.uint8)
for e in ends:
    v = np.array(e, float) - hub; L = np.linalg.norm(v); u = v / L; n = np.array([-u[1], u[0]])
    hw = 30
    p = [np.array(hub) + n * hw - u * 10, np.array(e) + n * hw + u * 40, np.array(e) - n * hw + u * 40, np.array(hub) - n * hw - u * 10]
    cv2.fillPoly(Mb, [np.int32(p)], 1)
cv2.circle(Mb, hub, 20, 1, -1)
cap = np.int32([(1538, 708), (1566, 640), (1606, 590), (1630, 578), (1652, 585), (1690, 625), (1716, 668), (1732, 706)])
tower = np.int32([(1572, 706), (1712, 706), (1748, 1036), (1532, 1036)])
S = np.zeros_like(Mb); cv2.fillPoly(S, [cap], 1); cv2.fillPoly(S, [tower], 1)
fix = (Mb & S).astype(bool)
J = I.copy()
yy, xx = np.mgrid[0:H, 0:W]
for poly, ref in ((cap, 'cap'), (tower, 'tower')):
    R = np.zeros_like(Mb); cv2.fillPoly(R, [poly], 1)
    if ref == 'tower': R[:740] = 0
    good = (R == 1) & (Mb == 0); region = (R == 1) & fix
    mean = I[good].mean(0); std = I[good].std(0) * 0.6
    noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 1.2)
    hatch = np.sin((xx * 0.8 + yy * 1.0) * 0.9).astype(np.float32) * 0.5
    tex = mean[None, None, :] + (noise[..., None] * 1.6 + hatch[..., None]) * std[None, None, :]
    J[region] = tex[region]
edge = np.zeros_like(Mb)
for a, b in ((tower[0], tower[3]), (tower[1], tower[2]), (tower[0], tower[1])):
    cv2.line(edge, tuple(map(int, a)), tuple(map(int, b)), 1, 4, cv2.LINE_AA)
e = edge.astype(bool) & cv2.dilate(Mb, np.ones((5, 5), np.uint8)).astype(bool)
J[e] = np.array([88, 98, 128], np.float32) * 0.85 + J[e] * 0.15
bl = cv2.GaussianBlur(J, (0, 0), 0.9); J[fix] = bl[fix]

# ---------- papier local et transparence
def paper_of(img):
    p = cv2.dilate(img, np.ones((25, 25), np.uint8))
    return cv2.GaussianBlur(p, (0, 0), 25)
def to_rgba(img, paper, solid=None, thr=0.07):
    d = np.clip(1 - img / np.maximum(paper, 1), 0, 1)
    a = np.clip((d.max(2) - thr) / 0.30, 0, 1)
    if solid is not None: a = np.maximum(a, solid)
    aa = np.maximum(a, 1e-3)[..., None]
    C = np.clip((img - (1 - aa) * paper) / aa, 0, 255)
    C = np.where(a[..., None] > 0.02, C, paper)
    return np.dstack([C[..., 2], C[..., 1], C[..., 0], a * 255])

P = paper_of(J)
Sd = cv2.GaussianBlur(S.astype(np.float32), (0, 0), 1.5) * 0.92
full = to_rgba(J, P, Sd)
full[..., 3][(Mb == 1) & (S == 0)] = 0

# ---------- masques des objets (forme réelle, un peu élargie)
def poly_mask(pts, grow=8):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.int32(pts)], 1)
    return cv2.dilate(m, np.ones((grow * 2 + 1, grow * 2 + 1), np.uint8))
hay = poly_mask([(315, 937), (330, 905), (360, 885), (400, 875), (450, 864), (505, 856), (525, 850), (560, 870), (600, 884), (640, 902), (650, 937)])
cart = poly_mask([(305, 930), (660, 930), (650, 1000), (585, 1050), (500, 1050), (380, 1050), (300, 1030)])
fol = np.zeros((H, W), np.uint8); cv2.ellipse(fol, (1068, 765), (200, 150), 0, 0, 360, 1, -1)
trunk = poly_mask([(1000, 880), (1125, 880), (1085, 960), (1072, 1015), (1150, 1085), (925, 1075), (995, 1020), (1015, 960)])
mill = cv2.dilate(S, np.ones((13, 13), np.uint8))
objects = hay | cart | fol | trunk | mill | cv2.dilate(Mb, np.ones((19, 19), np.uint8))

# ---------- fond sans objets : papier lisse à leur place
small = cv2.resize(P, (W // 8, H // 8), interpolation=cv2.INTER_AREA)
msmall = cv2.resize(objects * 255, (W // 8, H // 8), interpolation=cv2.INTER_NEAREST)
msmall = cv2.dilate(msmall, np.ones((3, 3), np.uint8))
fill = cv2.inpaint(np.clip(small, 0, 255).astype(np.uint8), msmall, 3, cv2.INPAINT_TELEA)
fill = cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
grainy = fill + rng.normal(0, 2.0, (H, W, 1)).astype(np.float32)
soft = cv2.GaussianBlur(objects.astype(np.float32), (0, 0), 3)[..., None]
K = I * (1 - soft) + grainy * soft
# sous la crête, la colline hachurée : reflet de la colline voisine, de chaque côté du trou
blades = cv2.dilate(Mb, np.ones((19, 19), np.uint8))
hill = np.zeros((H, W), bool)
ramp = np.zeros((H, W), np.float32)
for m, L, R, ytop in ((hay | cart, 300, 668, 0), (fol | trunk, 880, 1262, 835), (mill | blades, 1440, 1830, 748)):
    mm = cv2.dilate(m, np.ones((9, 9), np.uint8)).astype(bool); mm[:ytop] = False
    hill |= mm
    r = np.clip((np.arange(H, dtype=np.float32) - ytop) / 60, 0, 1)[:, None] if ytop else np.ones((H, 1), np.float32)
    ramp = np.maximum(ramp, mm * r)
    mid = (L + R) // 2
    ys_, xs_ = np.nonzero(mm)
    src_x = np.where(xs_ < mid, 2 * L - xs_, 2 * R - xs_)
    ok = (src_x >= 0) & (src_x < W)
    ys_, xs_, src_x = ys_[ok], xs_[ok], src_x[ok]
    K[ys_, xs_] = I[ys_, src_x]
hs = cv2.GaussianBlur(ramp, (0, 0), 3)[..., None]
Kh = K.copy()
K = I * (1 - np.maximum(soft, hs)) + np.where(hs > 0.01, Kh, grainy) * np.maximum(soft, hs)

# ---------- crête cachée : raccords dessinés avec un morceau de la vraie crête (x 600-880)
def paste(xd0, xd1, yd0, yd1, bump, xs0=600, xs1=880, ys=798, half=30):
    for xd in range(xd0, xd1):
        t = (xd - xd0) / (xd1 - xd0)
        xs = int(xs0 + t * (xs1 - xs0))
        yc = int(round(yd0 + (yd1 - yd0) * t + bump * np.sin(np.pi * t)))
        src = I[ys - half:ys + half, xs]
        dst = K[yc - half:yc + half, xd]
        # fondu aux bords de la bande
        w = np.sin(np.linspace(0, np.pi, 2 * half))[:, None] ** 0.5
        mix = np.minimum(dst, src * w + dst * (1 - w))
        K[yc - half:yc + half, xd] = mix
paste(875, 1255, 800, 795, 10)     # derrière l'arbre : léger creux
paste(1455, 1795, 724, 734, -18)   # derrière le moulin : petite bosse

PK = paper_of(K)
clean = to_rgba(K, PK, thr=0.085)

def save(name, arr, box):
    x0, y0, x1, y1 = box
    a = arr[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)
    Image.fromarray(a).save(OUT + name + '.webp', quality=82, method=6)
    Image.fromarray(a).save(SP + 'v-' + name + '.png')

# montagnes : bande y 600-990, fondue en haut et en bas (pas de ligne de sol)
mont = clean.copy()
ys = np.arange(H, dtype=np.float32)
fy = np.clip((ys - 600) / 25, 0, 1) * np.clip((985 - ys) / 55, 0, 1)
mont[..., 3] = np.clip(mont[..., 3] * 1.35, 0, 255) * fy[:, None]
# taches du papier au bord gauche (elles se répéteraient d'une tuile à l'autre)
mont[:850, :125, 3] = 0
save('montagnes', mont, (0, 600, 2000, 990))
# sol du dessin : bande y 940-1110, fondue en haut
sol = full.copy()
fs = np.clip((ys - 945) / 45, 0, 1)
sol[..., 3] *= fs[:, None]
save('sol', sol, (0, 940, 2000, 1110))
# objets détourés
def obj(name, mask, box):
    a = full.copy(); m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 2.5)
    a[..., 3] *= np.clip(m * 1.3, 0, 1)
    save(name, a, box)
obj('paille', hay, (285, 812, 665, 935))
obj('charrette', cart, (285, 935, 665, 1048))
obj('feuillage', fol, (875, 585, 1255, 905))
obj('tronc', trunk, (875, 880, 1255, 1095))
obj('moulin', mill, (1468, 470, 1812, 1062))
# aperçu
prev = np.dstack([np.full((H, W, 3), 236, np.float32), np.full((H, W), 255, np.float32)])
for arr in (mont, sol):
    a = arr[..., 3:4] / 255; prev[..., :3] = prev[..., :3] * (1 - a) + arr[..., :3] * a
Image.fromarray(prev[560:1110, :, :3].astype(np.uint8)).save(SP + 'mont-apercu.png')

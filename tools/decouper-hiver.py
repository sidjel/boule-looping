"""Le paysage d'hiver (sapins, collines enneigées, barrière, bonhomme de neige, igloo) dans le plan des
champs, pendant tout l'hiver, à la place des champs de foin enneigés. Usage :
    python3 tools/decouper-hiver.py hiver.png
- ciel transparent (remplissage depuis le haut : le ciel blanc s'arrête aux traits du dessin) ;
- même échelle que les champs de foin (1,4 px du monde par pixel d'origine), horizon sur le leur ;
  bas prolongé (il passe derrière la terre) ;
- entrée : couture qui suit le dessin entre les champs de foin enneigés et le début du paysage, au
  tout début de l'hiver (là où les champs sont déjà entièrement enneigés) ;
- puis une partie du paysage se répète (sapins, barrière, collines), raccordée sur elle-même par une
  couture ; le bonhomme de neige et l'igloo ne passent qu'une fois ;
- sortie : le paysage finit par son groupe de grands sapins, puis une couture vers les champs de foin
  enneigés, juste avant la pluie ; les champs reprennent là.
Écrit images/hiver/{entree,boucle,sortie}.webp et images/hiver/hiver.json (positions dans le plan).
Lancer après decouper-automne.py (il lit images/automne/suite.json et suite-hiver.webp)."""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'images', 'hiver')
os.makedirs(OUT, exist_ok=True)
suite = json.load(open(os.path.join(ROOT, 'images', 'automne', 'suite.json')))
S, RES = 1.4, suite['res']                 # monde par pixel d'origine ; résolution des images
PX = S / RES                               # monde par pixel des images (2)
Q, ANCHOR = 0.12, 1200                     # parallaxe du plan des champs (balade.js)
u_of = lambda x: x * (1 - Q) + Q * ANCHOR  # plan ↔ monde (la colonne u passe au centre en x)
SHEET = 2000
WINTER0, WINTER1, BLEND = 8 * SHEET, 12 * SHEET, 450

# ---------- les champs de foin enneigés (même plan, même résolution) ----------
hay = np.array(Image.open(os.path.join(ROOT, 'images', 'automne', 'suite-hiver.webp')).convert('RGBA')).astype(np.float32)
hay[..., 3] /= 255
HH = hay.shape[0]
t0, t1 = [round(c * RES) for c in suite['tile']]
tile = hay[:, t0:t1]                       # la partie des champs qui se répète
TW = tile.shape[1]
OVH = 175                                  # ce qui précède le début de la partie répétée (colonnes)
pre = hay[:, t0 - OVH:t0]

# ---------- le paysage d'hiver ----------
im = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
H0, W0 = im.shape[:2]
sky = np.array([253, 253, 251.5], np.float32)
d = np.abs(im - sky).sum(2)
m = (d < 26).astype(np.uint8)
n, lab = cv2.connectedComponents(m, connectivity=4)
top = [v for v in np.unique(lab[0]) if v]
skym = np.isin(lab, top)
a = (~skym).astype(np.float32)
# bord : un peu de transparence selon l'écart au blanc du ciel (traits au crayon nets)
edge = cv2.dilate(skym.astype(np.uint8), np.ones((3, 3), np.uint8)) & (~skym)
a[edge > 0] = np.clip((d[edge > 0] - 10) / 45, 0.25, 1)
w = round(W0 * RES)
h = round(H0 * RES)
rgb = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
al = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA)
# l'horizon (pied des sapins du fond, haut des collines : ligne 400 d'origine) sur celui des champs
HORIZON_HAY, HORIZON_W = 290, round(400 * RES)
off = HORIZON_HAY - HORIZON_W
win = np.zeros((HH, w, 4), np.float32)
win[off:off + h, :, :3] = rgb
win[off:off + h, :, 3] = al
# bas prolongé en miroir (neige)
B = win[off + h - 90:off + h].copy()
y = off + h
k = 0
while y < HH:
    part = B[::-1] if k % 2 == 0 else B
    n_ = min(len(part), HH - y)
    win[y:y + n_] = part[:n_]
    y += n_
    k += 1
WW = w


def seam(left, right):
    """Couture verticale (programmation dynamique) entre deux zones RGBA qui se recouvrent."""
    diff = np.abs(left[..., :3] - right[..., :3]).mean(2) * np.minimum(left[..., 3], right[..., 3])
    diff += np.abs(left[..., 3] - right[..., 3]) * 150
    diff = cv2.GaussianBlur(diff, (0, 0), 2)
    Hh, Wd = diff.shape
    diff[:, :12] += 1e4
    diff[:, -12:] += 1e4
    # la couture peut glisser de 3 colonnes par ligne : elle suit les pentes des collines
    K = 3
    cost = diff.copy()
    back = np.zeros((Hh, Wd), np.int32)
    for yy in range(1, Hh):
        p = cost[yy - 1]
        st = np.stack([np.r_[np.full(max(0, -o), np.inf), p[max(0, o):Wd + min(0, o)], np.full(max(0, o), np.inf)]
                       + abs(o) * 1.5 for o in range(-K, K + 1)])
        kk = st.argmin(0)
        cost[yy] += st[kk, np.arange(Wd)]
        back[yy] = kk - K
    s = np.zeros(Hh, np.int32)
    s[-1] = int(cost[-1].argmin())
    for yy in range(Hh - 1, 0, -1):
        s[yy - 1] = s[yy] + back[yy, s[yy]]
    return s


def join(left, right, ov):
    """left puis right, les ov dernières colonnes de left sur les ov premières de right, raccordées
    par une couture (à gauche de la couture : left ; à droite : right ; 1 px adouci)."""
    L, R = left[:, -ov:], right[:, :ov]
    s = seam(L, R)
    c = np.arange(ov)[None, :]
    mm = np.clip(c - s[:, None] + 0.5, 0, 1)[..., None]
    mid = L * (1 - mm) + R * mm
    return np.concatenate([left[:, :-ov], mid, right[:, ov:]], 1)


# ---------- disposition dans le plan des champs ----------
OVA, OVB, OVC = 120, 70, 120
A0, B0 = round(150 * RES), round(1380 * RES)   # partie qui se répète (avant le bonhomme de neige)
uE = u_of(WINTER0 + BLEND + 30)                # début : champs déjà entièrement enneigés
uL = u_of(WINTER1 - BLEND - 50)                # fin : avant que la pluie ne colore les champs
# le morceau de champs (partie répétée) sous le début
u1 = suite['u0'] + suite['W'] * S
T = (suite['tile'][1] - suite['tile'][0]) * S
kE = int((uE - u1) // T) + 1                   # n° du morceau (suite.js : k ≥ 1)
uk = u1 + (kE - 1) * T
offE = int(round((uE - uk) / PX))
assert offE + OVA <= TW, 'la couture d’entrée déborde du morceau de champs'
uE = uk + offE * PX                            # au pixel près

entree = join(tile[:, offE:offE + OVA], win, OVA)               # champs → paysage d'hiver
entree = join(entree, win[:, A0 - OVB:A0], OVB)                 # … qui rejoint le début de la partie répétée
boucle = join(win[:, A0:B0], win[:, A0 - OVB:A0], OVB)          # partie répétée, raccordée sur elle-même
L = B0 - A0
uB = uE + entree.shape[1] * PX
rest = (uL - uB) / PX                          # place pour les répétitions et la sortie (pixels)
# la sortie finit par le groupe de grands sapins du début du dessin (colonnes 0 à PEND) : la couture
# vers les champs passe juste derrière eux
PEND = round(240 * RES)
tail = PEND - OVB                              # largeur ajoutée par les sapins
nb = max(0, int((rest - tail - OVB - 40) // L))
Ls = int(round(rest - nb * L - tail))
Ls = max(OVB + 40, min(L, Ls))
sortie = join(win[:, A0:A0 + Ls], win[:, :PEND], OVB)          # … rejoint le groupe de sapins
sortie = join(sortie, pre[:, OVH - OVC:], OVC)                  # paysage → champs (début de la partie répétée)
uS = uB + nb * L * PX
uR = uS + sortie.shape[1] * PX                 # les champs reprennent ici (début de la partie répétée)


def save(name, arr):
    out = arr.copy()
    out[..., 3] *= 255
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + '.webp'), quality=84, method=6)


save('entree', entree)
save('boucle', boucle)
save('sortie', sortie)
json.dump({
    'px': PX, 'h': HH * PX,
    'k': kE,                                   # morceau de champs sous le début (coupé à uE)
    'entree': {'u': uE, 'w': entree.shape[1] * PX},
    'boucle': {'u': uB, 'w': L * PX, 'n': nb},
    'sortie': {'u': uS, 'w': sortie.shape[1] * PX},
    'reprise': uR,
}, open(os.path.join(OUT, 'hiver.json'), 'w'), indent=1)
w_of = lambda u: (u - Q * ANCHOR) / (1 - Q)
print(f'entrée u={uE:.0f} (monde {w_of(uE):.0f}), {nb} répétition(s), sortie u={uS:.0f}, champs repris u={uR:.0f} (monde {w_of(uR):.0f})')

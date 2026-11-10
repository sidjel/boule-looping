"""Les paysages d'hiver et de pluie dans le plan des champs, à la place des champs de foin. Usage :
    python3 tools/decouper-hiver-pluie.py hiver.png pluie.png
- ciel transparent (remplissage depuis le haut : le ciel blanc s'arrête aux traits du dessin ; les
  trous blancs fermés dans le feuillage aussi) ;
- même échelle que les champs de foin (1,4 px du monde par pixel d'origine), horizon sur le leur ;
  bas prolongé (il passe derrière la terre) ;
- hiver (sapins, collines enneigées, barrière, bonhomme de neige, igloo) : entrée par une couture qui
  suit le dessin, au tout début de l'hiver, là où les champs sont déjà entièrement enneigés ; puis
  une partie du paysage se répète (sapins, barrière, collines), raccordée sur elle-même ; le bonhomme
  de neige et l'igloo ne passent qu'une fois ;
- pluie (forêt et lac) : au passage à la pluie, couture vers le grand arbre du paysage de pluie ; au
  sol, la neige s'arrête en suivant un bord irrégulier, comme une neige qui fond ; le groupe de grands
  sapins du dessin d'hiver est posé sur la couture (la pluie commence derrière eux) ; puis le paysage de pluie se répète (raccordé sur lui-même) jusqu'au bout du parcours, aux
  couleurs de la pluie, puis du soir à l'arrivée (pluie-{pluie,arrivee}.webp).
Écrit images/hiver/{entree,boucle,sortie}.webp, images/pluie/pluie-*.webp et images/hiver/hiver.json.
Lancer après decouper-automne.py (il lit images/automne/suite.json et suite-hiver.webp)."""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'images', 'hiver')
OUTP = os.path.join(ROOT, 'images', 'pluie')
os.makedirs(OUT, exist_ok=True)
os.makedirs(OUTP, exist_ok=True)
suite = json.load(open(os.path.join(ROOT, 'images', 'automne', 'suite.json')))
S, RES = 1.4, suite['res']                 # monde par pixel d'origine ; résolution des images
PX = S / RES                               # monde par pixel des images (2)
Q, ANCHOR = 0.12, 1200                     # parallaxe du plan des champs (balade.js)
u_of = lambda x: x * (1 - Q) + Q * ANCHOR  # plan ↔ monde (la colonne u passe au centre en x)
SHEET = 2000
WINTER0, WINTER1, BLEND = 8 * SHEET, 12 * SHEET, 450   # l'hiver : feuilles 8 à 11 ; puis la pluie

# ---------- les champs de foin enneigés (même plan, même résolution) ----------
hay = np.array(Image.open(os.path.join(ROOT, 'images', 'automne', 'suite-hiver.webp')).convert('RGBA')).astype(np.float32)
hay[..., 3] /= 255
HH = hay.shape[0]
t0, t1 = [round(c * RES) for c in suite['tile']]
tile = hay[:, t0:t1]                       # la partie des champs qui se répète
TW = tile.shape[1]

# ---------- les dessins ----------
def drawing(path, horizon, white_holes_above, scale=1.0):
    """Le dessin détouré, à la résolution des images, dans une bande de la hauteur des champs, son
    horizon (ligne d'origine) sur celui des champs ; bas prolongé en miroir."""
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    H0, W0 = im.shape[:2]
    sky = np.median(im[:60].reshape(-1, 3), 0)
    d = np.abs(im - sky).sum(2)
    m = (d < 26).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
    top = [v for v in np.unique(lab[0]) if v]
    skym = np.isin(lab, top)
    # trous blancs fermés dans le feuillage (au-dessus de l'horizon) : le ciel aussi
    holes = (d < 14).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(holes, connectivity=4)
    for v in range(1, n2):
        x, y, ww, hh, area = st2[v]
        if area >= 6 and y + hh < white_holes_above:
            skym |= lab2 == v
    a = (~skym).astype(np.float32)
    # bord : un peu de transparence selon l'écart au blanc du ciel (traits au crayon nets)
    edge = cv2.dilate(skym.astype(np.uint8), np.ones((3, 3), np.uint8)) & (~skym)
    a[edge > 0] = np.clip((d[edge > 0] - 10) / 45, 0.25, 1)
    w, h = round(W0 * RES * scale), round(H0 * RES * scale)
    rgb = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
    al = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA)
    off = HORIZON_HAY - round(horizon * RES * scale)
    out = np.zeros((HH, w, 4), np.float32)
    y0 = max(0, off)
    out[y0:off + h, :, :3] = rgb[y0 - off:]
    out[y0:off + h, :, 3] = al[y0 - off:]
    B = out[off + h - 110:off + h - 20].copy()   # (sans le bord du papier, tout en bas)
    y, k = off + h, 0
    while y < HH:
        part = B[::-1] if k % 2 == 0 else B
        n_ = min(len(part), HH - y)
        out[y:y + n_] = part[:n_]
        y += n_
        k += 1
    return out


HORIZON_HAY = 290
win = drawing(sys.argv[1], 400, 0)          # hiver : horizon au pied des sapins du fond (ligne 400)
SR = 0.78                                   # la pluie un peu plus petite : sa forêt laisse voir les montagnes
rain = drawing(sys.argv[2], 578, 585, SR)   # pluie : horizon sur la rive du fond du lac (ligne 578)
WW = win.shape[1]


def seam(left, right, wiggle=0):
    """Couture verticale (programmation dynamique) entre deux zones RGBA qui se recouvrent. wiggle :
    bord irrégulier là où les deux dessins diffèrent partout (neige contre herbe)."""
    diff = np.abs(left[..., :3] - right[..., :3]).mean(2) * np.minimum(left[..., 3], right[..., 3])
    diff += np.abs(left[..., 3] - right[..., 3]) * 150
    diff = cv2.GaussianBlur(diff, (0, 0), 2)
    if wiggle:
        nz = np.random.default_rng(11).random(diff.shape).astype(np.float32)
        nz = cv2.GaussianBlur(nz, (0, 0), 9)
        nz = (nz - nz.min()) / (nz.max() - nz.min())
        diff += nz * wiggle
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


def join(left, right, ov, wiggle=0):
    """left puis right, les ov dernières colonnes de left sur les ov premières de right, raccordées
    par une couture (à gauche de la couture : left ; à droite : right ; 1 px adouci)."""
    L, R = left[:, -ov:], right[:, :ov]
    s = seam(L, R, wiggle)
    c = np.arange(ov)[None, :]
    mm = np.clip(c - s[:, None] + 0.5, 0, 1)[..., None]
    mid = L * (1 - mm) + R * mm
    join.last = left.shape[1] - ov + s            # colonnes de la couture (dans le résultat)
    return np.concatenate([left[:, :-ov], mid, right[:, ov:]], 1)


# ---------- disposition dans le plan des champs ----------
OVA, OVB, OVR = 120, 70, 150
A0, B0 = round(150 * RES), round(1380 * RES)   # partie qui se répète (avant le bonhomme de neige)
uE = u_of(WINTER0 + BLEND + 30)                # début : champs déjà entièrement enneigés
uL = u_of(WINTER1 - 100)                       # fin de l'hiver : la couture vers la pluie, juste avant
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
PW = round(265 * RES)                          # largeur du groupe de sapins
nb = max(0, int((rest - OVR) // L))
Ls = int(round(rest - nb * L))
Ls = max(OVR + 40, min(L, Ls))
sortie = win[:, A0:A0 + Ls].copy()
uS = uB + nb * L * PX

# ---------- la pluie ----------
def rain_colours(rgb, kind):
    L_ = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2])[..., None]
    if kind == 'pluie':      # temps gris : un peu plus sombre, plus froid, moins saturé
        return (rgb * 0.8 + L_ * 0.2) * np.array([0.84, 0.88, 0.92]) + np.array([4, 8, 14])
    return rgb * 0.75 + (L_ * np.array([1.05, 0.85, 0.7]) + np.array([20, 5, 0])) * 0.25   # soir

XR = 0                                         # la pluie commence par son grand arbre (bord caché par les sapins)
AR = XR + OVR + 150                            # partie répétée : juste après (place pour les sapins)
OVP = 150
RW = rain.shape[1]
rain_p = rain.copy()
rain_p[..., :3] = rain_colours(rain[..., :3], 'pluie')
# hiver → pluie : au sol, la neige s'arrête en bord irrégulier (comme une neige qui fond)
sortie = join(sortie, rain_p[:, XR:AR], OVR, wiggle=220)
cut = join.last

# le groupe de grands sapins du début du dessin d'hiver, agrandi (ils sont plus près), posé sur la
# couture : il la cache jusqu'au haut de la forêt ; la pluie commence derrière eux ; à leurs pieds,
# un tas de neige au bord arrondi
grp = win[:, :PW].copy()
treepx = ((grp[..., 1] > grp[..., 0] + 8) & (grp[..., :3].mean(2) < 150) & (grp[..., 3] > 0.5)).astype(np.uint8)
treepx[:, :round(26 * RES)] = 0              # pas le petit sapin coupé par le bord gauche du dessin
rows = np.nonzero(treepx.any(1))[0]
foot = int(np.percentile(rows, 99))           # pied des sapins (ligne des images)
# silhouette des sapins (avec la neige sur les branches)
sil = cv2.morphologyEx(treepx, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
sil[foot + 1:] = 0
ff = sil.copy()
fm = np.zeros((HH + 2, PW + 2), np.uint8)
for x in range(0, PW, 4):                      # trous fermés seulement (pas le sol sous les sapins)
    for y in (0, HH - 1):
        if ff[y, x] == 0:
            cv2.floodFill(ff, fm, (x, y), 1)
sil |= 1 - ff
sil = cv2.dilate(sil, np.ones((3, 3), np.uint8))
dist = cv2.distanceTransform(1 - treepx, cv2.DIST_L2, 5)
yy = np.arange(HH)[:, None]
nz = cv2.GaussianBlur(np.random.default_rng(4).random((HH, PW)).astype(np.float32), (0, 0), 4)
nz = (nz - nz.min()) / (nz.max() - nz.min())
mound = (yy > foot - 30) & (dist < 9 + 14 * nz - 1.3 * np.maximum(0, yy - foot + 4))
# le bois (barrière, buissons) loin des troncs : pas de barrière qui flotte ; dans la neige, de la neige
brown = (grp[..., 0] > grp[..., 1] + 5) & (grp[..., 0] > grp[..., 2] + 20)
near = cv2.dilate(treepx, np.ones((7, 7), np.uint8)) > 0
xx = np.arange(PW)[None, :]
wood = (brown & ~near) | (brown & (xx > round(212 * RES)))   # la barrière commence à la colonne 212
wood = cv2.dilate(wood.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
grp[wood & ~(sil > 0), :3] = np.array([240, 244, 252], np.float32)
gm = grp[..., 3] * ((sil > 0) & ~wood | mound)
gm = cv2.GaussianBlur(gm.astype(np.float32), (0, 0), 0.7)
top_ = int(np.nonzero(gm.max(1) > 0.5)[0].min())
bot_ = int(np.nonzero(gm.max(1) > 0.02)[0].max()) + 1
# assez grands pour cacher le bord du grand arbre de la pluie (son haut, à gauche du dessin)
crown = int(np.nonzero(rain[:, XR:XR + 40, 3].max(1) > 0.5)[0].min())
G = max(1.2, (bot_ - (crown - 14)) / (bot_ - top_))
crop = slice(top_, bot_)
gw, gh = round(PW * G), round((bot_ - top_) * G)
g_rgb = cv2.resize(grp[crop, :, :3], (gw, gh), interpolation=cv2.INTER_CUBIC)
g_a = np.clip(cv2.resize(gm[crop], (gw, gh), interpolation=cv2.INTER_LINEAR), 0, 1)
gy0 = bot_ + 6 - gh                            # les pieds un peu plus bas (plus près)
cx = int(np.median(cut[foot - 60:foot]))      # là où passe la couture au pied des sapins
gx0 = cx - gw // 2
seg = sortie[gy0:gy0 + gh, gx0:gx0 + gw]
seg[..., :3] = seg[..., :3] * (1 - g_a[..., None]) + g_rgb * g_a[..., None]
seg[..., 3] = np.maximum(seg[..., 3], g_a)
print('sapins : agrandis', round(G, 2), 'haut', gy0, 'pieds', gy0 + gh, '; forêt de la pluie : haut',
      int(np.nonzero(rain[:, XR:XR + 40, 3].max(1) > 0.5)[0].min()))
uP = uS + sortie.shape[1] * PX                 # la partie répétée de la pluie commence ici
# fin de la partie répétée : là où la couture vers son début coûte le moins (lac contre lac, rives
# à la même hauteur), avant les buissons du bord droit
def seam_cost(L, R):
    sc = seam(L, R)
    diff = np.abs(L[..., :3] - R[..., :3]).mean(2) * np.minimum(L[..., 3], R[..., 3]) + np.abs(L[..., 3] - R[..., 3]) * 150
    return float(diff[np.arange(len(sc)), sc].sum())

best = None
for br in range(round(1150 * RES * SR), round(1470 * RES * SR), 6):
    c_ = seam_cost(rain_p[:, br - OVP:br], rain_p[:, AR - OVP:AR])
    if best is None or c_ < best[0]:
        best = (c_, br)
BR = best[1]
print('partie répétée de la pluie : colonnes d’origine', round(AR / RES / SR), 'à', round(BR / RES / SR))
for kind in ('pluie', 'arrivee'):
    t = rain.copy()
    t[..., :3] = rain_colours(rain[..., :3], kind)
    tile_r = join(t[:, AR:BR], t[:, AR - OVP:AR], OVP)          # raccordée sur elle-même
    out = tile_r.copy()
    out[..., 3] *= 255
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUTP, f'pluie-{kind}.webp'), quality=84, method=6)
TR = (BR - AR) * PX

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
    'pluie': {'u': uP, 'w': TR},                # puis la pluie se répète jusqu'au bout
}, open(os.path.join(OUT, 'hiver.json'), 'w'), indent=1)
w_of = lambda u: (u - Q * ANCHOR) / (1 - Q)
print(f'entrée u={uE:.0f} (monde {w_of(uE):.0f}), {nb} répétition(s), sortie u={uS:.0f}, pluie répétée dès u={uP:.0f} (monde {w_of(uP):.0f}), tous les {TR:.0f}')

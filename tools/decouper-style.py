"""Découpe du dessin de style (ciel bleu, nuages, terre, herbe) en morceaux pour le jeu.
Usage : python3 decouper-style.py dessin.png sol.json dossier/
- ciel.webp      : le ciel seul (nuages et terre remplacés par du ciel voisin) ;
- nuage-N.webp   : chaque nuage détouré, contour bleu compris (liste dans nuages.json) ;
- terre-bande.webp, terre-fond.webp : la terre (route effacée), dépliée le long de la route
  et en fond, à l'échelle du monde (calage sur la route du jeu, comme decouper-sol1.py) ;
- herbe.webp     : la bande d'herbe du bas, détourée, à l'échelle du monde."""
import sys, json, cv2, numpy as np
from PIL import Image
src, prof, out = sys.argv[1], sys.argv[2], sys.argv[3]
G = np.array(json.load(open(prof))['ground'], np.float32)
im = cv2.imread(src).astype(np.float32)
H, W = im.shape[:2]
bl = cv2.GaussianBlur(im, (0, 0), 2.5)
b, g, r = bl[..., 0], bl[..., 1], bl[..., 2]
gray = im.mean(2); sat = im.max(2) - im.min(2)
yy = np.arange(H)[:, None] * np.ones((1, W))

def save(name, arr, alpha=None, q=82):
    rgb = arr[..., ::-1].clip(0, 255).astype(np.uint8)
    if alpha is not None: rgb = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    Image.fromarray(rgb).save(out + name, quality=q, method=6)
    return rgb.shape[1], rgb.shape[0]

# ---------- masques
earth = (r - b > 40) & (g < r - 15)
earth = cv2.morphologyEx(earth.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
# la terre : tout ce qui est sous sa surface (plus haut pixel de terre de chaque colonne)
top = np.array([np.argmax(earth[:, x] > 0) if earth[:, x].any() else H for x in range(W)])
below = yy >= top[None, :]
line = ((gray < 105) & (sat < 60) & (yy < 760)).astype(np.uint8)
line = cv2.morphologyEx(line, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# la route : le plus grand trait d'un seul tenant (pas les brins d'herbe ni l'ombre)
nl, ll, sl, _ = cv2.connectedComponentsWithStats(cv2.dilate(line, np.ones((5, 5), np.uint8)))
line = line & (ll == 1 + np.argmax(sl[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
cloud_in = (b - r < 12) & (r - b < 35) & ~below
cloud_in = cv2.morphologyEx(cloud_in.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
cloud_in = cv2.morphologyEx(cloud_in, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(cloud_in)

# ---------- nuages : chaque nuage est entouré d'un trait bleu ; on prend ce qui est à l'intérieur
dd = cv2.GaussianBlur(im, (0, 0), 1.5); dd = dd[..., 0] - dd[..., 2]
O = (((dd - cv2.GaussianBlur(dd, (0, 0), 12)) > 14) & (dd > 50)).astype(np.uint8)
O = cv2.morphologyEx(O, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
bl3 = cv2.GaussianBlur(im, (0, 0), 3)
O2 = ((bl3[..., 0] - bl3[..., 2] > 78) & (bl3.sum(2) < 575)).astype(np.uint8)
O2 = cv2.morphologyEx(O2, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
clouds, cloud_all = [], np.zeros((H, W), bool)
for i in range(1, n):
    x, y, w, h, area = st[i]
    if area < 1500 or y + h > 620 or x < 4 or x + w > W - 4 or w > 3.5 * h: continue  # pas les nuages coupés
    pad = 40
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad + 30)
    seed = (lab[y0:y1, x0:x1] == i)
    # GrabCut : le blanc du nuage est sûr, le bord du cadre est du ciel ; il trouve le ventre
    # mauve et le trait bleu entre les deux
    gm = np.full(seed.shape, cv2.GC_PR_BGD, np.uint8)
    near = cv2.dilate(seed.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    down = np.zeros_like(near); down[30:] = near[:-30]; near = near | down  # le ventre est dessous
    gm[near > 0] = cv2.GC_PR_FGD
    gm[cv2.erode(seed.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = cv2.GC_FGD
    gm[:3] = gm[-3:] = cv2.GC_BGD; gm[:, :3] = gm[:, -3:] = cv2.GC_BGD
    crop = im[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)
    bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, gm, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
    m = ((gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)).astype(np.uint8)
    nc, lc, sc, _ = cv2.connectedComponentsWithStats(m)
    if nc > 1: m = (lc == 1 + np.argmax(sc[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # le trait bleu tout autour
    ring = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))) & O2[y0:y1, x0:x1]
    m = m | ring
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    m = np.zeros_like(m); cv2.drawContours(m, cs, -1, 1, -1)
    cloud_all[y0:y1, x0:x1] |= m.astype(bool)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.9)
    ys_, xs_ = np.nonzero(m)
    cx0, cy0, cx1, cy1 = max(0, xs_.min() - 3), max(0, ys_.min() - 3), min(m.shape[1], xs_.max() + 4), min(m.shape[0], ys_.max() + 4)
    k = len(clouds)
    cw, ch = save(f'nuage-{k}.webp', im[y0 + cy0:y0 + cy1, x0 + cx0:x0 + cx1], a[cy0:cy1, cx0:cx1], q=85)
    clouds.append({'w': cw, 'h': ch, 'x': int(x0 + cx0), 'y': int(y0 + cy0)})
json.dump(clouds, open(out + 'nuages.json', 'w'))
print(len(clouds), 'nuages')

# ---------- ciel : nuages, terre et boucle remplacés par du ciel voisin
cm = cv2.dilate(cloud_all.astype(np.uint8), np.ones((21, 21), np.uint8))
dn = np.zeros_like(cm); dn[35:] = cm[:-35]; cm = cm | dn
# restes : tout ce qui est mauve ou trait bleu dans le ciel
lav = ((bl3[..., 0] - bl3[..., 2] > 70) & (bl3.sum(2) < 590)).astype(np.uint8)
notsky = cm | cv2.dilate(lav, np.ones((25, 25), np.uint8)) | cv2.dilate(below.astype(np.uint8), np.ones((15, 15), np.uint8)) | cv2.dilate(line, np.ones((11, 11), np.uint8))
notsky = notsky.astype(bool)
sky = im.copy(); todo = notsky.copy()
for dx, dy in [(260, 0), (-260, 0), (520, 0), (-520, 0), (130, -60), (-130, -60), (390, -90), (-390, -90), (780, 0), (-780, 0), (0, -150), (650, -120), (-650, -120)]:
    srcimg = np.roll(np.roll(im, dy, 0), dx, 1); srcbad = np.roll(np.roll(notsky, dy, 0), dx, 1)
    if dy: srcbad[:dy] = True if dy > 0 else srcbad[:dy]
    ok = todo & ~srcbad
    sky[ok] = srcimg[ok]; todo &= ~ok
sky = cv2.inpaint(sky.clip(0, 255).astype(np.uint8), todo.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA).astype(np.float32)
soft = cv2.GaussianBlur(notsky.astype(np.float32), (0, 0), 1.5)[..., None]
sky = im * (1 - soft) + sky * soft
# on ne garde que le grain du crayon (les restes de nuages, plus flous, disparaissent) :
# un ton uni + les détails ; la couleur du haut et de l'horizon est remise par le jeu
sx0, sy1 = 90, 290
tile = sky[0:sy1, sx0:W]
tone = tile.reshape(-1, 3).mean(0)
hp = tile - cv2.GaussianBlur(tile, (0, 0), 9)
tile = cv2.GaussianBlur(tone[None, None, :] + hp * 0.8, (0, 0), 0.6)
tile = cv2.resize(tile, (round(tile.shape[1] * 0.75), round(tile.shape[0] * 0.75)), interpolation=cv2.INTER_AREA)
print('ciel', save('ciel.webp', tile, q=80), 'ton', tone[::-1].round())

# ---------- la route du dessin (bas du trait à chaque colonne), échelle du monde
ys = np.full(W, np.nan)
for x in range(W):
    rr = np.nonzero(line[:, x])[0]
    if len(rr): ys[x] = rr.max()
okc = ~np.isnan(ys)
ys = np.interp(np.arange(W), np.nonzero(okc)[0], ys[okc])
A = 2000 / W  # le dessin fait une feuille de large
# ---------- terre : route effacée, herbe remplacée par la terre du dessus
grass = ((g > r - 14) & (g > b + 22) & (yy > 640)).astype(np.uint8)
grass = cv2.dilate(grass, np.ones((7, 7), np.uint8)).astype(bool)
clean = cv2.inpaint(im.clip(0, 255).astype(np.uint8), cv2.dilate(line, np.ones((9, 9), np.uint8)) * 255, 7, cv2.INPAINT_TELEA).astype(np.float32)
fill = clean.copy(); todo = grass.copy()
for k in (60, 120, 180, 240):
    s2 = np.zeros_like(clean); s2[k:] = clean[:-k]
    bad = np.zeros_like(todo); bad[k:] = grass[:-k] | ~below[:-k]; bad[:k] = True
    okp = todo & ~bad
    fill[okp] = s2[okp]; todo &= ~okp
gs = cv2.GaussianBlur(grass.astype(np.float32), (0, 0), 2)[..., None]
clean = clean * (1 - gs) + fill * gs
# à l'échelle du monde
Ws, Hs = round(W * A), round(H * A)
cleanS = cv2.resize(clean, (Ws, Hs), interpolation=cv2.INTER_AREA)
imS = cv2.resize(im, (Ws, Hs), interpolation=cv2.INTER_AREA)
# bord de la terre : la ligne de la route (bas du trait), ou à défaut le haut de la terre
edge = np.interp(np.arange(Ws) / A, np.arange(W), np.maximum(ys, top - 6)) * A
D = 160
x0, x1 = 100, Ws - 160
band = np.zeros((D, x1 - x0, 3), np.float32)
for i, x in enumerate(range(x0, x1)):
    y0 = int(round(edge[x])) + 13  # sous le trait effacé
    seg = cleanS[y0:y0 + D, x]
    band[:len(seg), i] = seg
    if len(seg) < D: band[len(seg):, i] = seg[-1]
fade = np.clip((D - np.arange(D)) / 70, 0, 1)[:, None]
print('bande', save('terre-bande.webp', band, np.repeat(fade, band.shape[1], 1)))
# fond : un vrai rectangle de terre, sous le point le plus bas de la route (herbe remplacée)
f0 = int(np.max(edge[x0:x1])) + 16
fond = cleanS[f0:Hs - 24, x0:x1]
# seulement le grain du crayon, autour d'un gris moyen (posé en « incrustation » sur un dégradé
# de terre par le jeu) : pas de grandes taches qui se répètent en miroir
fond = 128 + (fond - cv2.GaussianBlur(fond, (0, 0), 7)) * 1.6
print('fond', save('terre-fond.webp', fond))
# herbe : bande du bas, détourée
h0 = int(np.percentile(np.nonzero(grass.any(1))[0], 1) * A) - 10
gS = cv2.GaussianBlur(imS, (0, 0), 1.2)
bb, gg, rr2 = gS[..., 0], gS[..., 1], gS[..., 2]
alpha = np.clip((gg - rr2 + 18) / 14, 0, 1) * np.clip((gg - bb - 18) / 14, 0, 1)
alpha[:h0] = 0
# seulement les touffes qui partent du sol (pas de brins isolés en l'air)
am = (alpha > 0.2).astype(np.uint8)
na, la, sa, _ = cv2.connectedComponentsWithStats(cv2.dilate(am, np.ones((3, 3), np.uint8)))
keepa = [i for i in range(1, na) if sa[i, cv2.CC_STAT_TOP] + sa[i, cv2.CC_STAT_HEIGHT] > Hs - 60]
alpha *= np.isin(la, keepa)
print('herbe', save('herbe.webp', imS[h0:, x0:x1], alpha[h0:, x0:x1]), 'haut', Hs - h0)
json.dump({'herbe_h': Hs - h0, 'echelle': A}, open(out + 'style.json', 'w'))

"""Terre de tous les niveaux, tirée du dessin du niveau 1 (même style partout) :
- terre-bande.webp : la bande sous la route (brun plus appuyé), « dépliée » le long de la
  route du dessin : la ligne n donne la terre à n px sous la route ;
- terre-fond.webp  : le fond hachuré plus bas, sans touffes (répété en miroir) ;
- terre-herbe.webp : les touffes d'herbe du bas, détourées (posées au pied de la feuille).
Tout est à l'échelle du monde du jeu. Usage :
python3 decouper-terre.py dessin.jpg sol.json dossier/"""
import sys, json, cv2, numpy as np
from PIL import Image
src, prof, out = sys.argv[1], sys.argv[2], sys.argv[3]
G = np.array(json.load(open(prof))['ground'], np.float32)
im = cv2.imread(src).astype(np.float32)
H, W = im.shape[:2]
B_, G_, R_ = im[..., 0], im[..., 1], im[..., 2]
gray = im.mean(2); sat = im.max(2) - im.min(2)
dark = ((gray < 95) & (sat < 40)).astype(np.uint8)
dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# calage sur la route du jeu (comme decouper-sol1.py)
ys = np.full(W, np.nan)
for x in range(W):
    r = np.nonzero(dark[:H - 60, x])[0]
    if len(r): ys[x] = r.max()
xs = np.arange(W); ok = ~np.isnan(ys); best = None
for a in np.arange(0.86, 1.02, 0.0025):
    for bx in range(-80, 81, 2):
        wx = a * xs + bx; m = ok & (wx >= 0) & (wx < len(G) - 1)
        res = G[np.round(wx[m]).astype(int)] - a * ys[m]; by = float(np.median(res))
        err = float(np.median(np.abs(res - by)))
        if best is None or err < best[0]: best = (err, a, bx, by)
err, A, BX, BY = best
# touffes : vert franc et foncé, en bas du dessin
tuft = ((G_ > R_ + 25) & (G_ > B_ + 10) & (im.max(2) < 200)).astype(np.uint8)
tuft[:int(H * 0.68)] = 0
tuft = cv2.dilate(tuft, np.ones((5, 5), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(tuft)
keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 250]).astype(np.uint8)
# trait noir effacé
mask = cv2.dilate(dark, np.ones((7, 7), np.uint8))
clean = cv2.inpaint(im.clip(0, 255).astype(np.uint8), mask * 255, 7, cv2.INPAINT_TELEA).astype(np.float32)
# touffes effacées : on recopie les hachures (verticales) prises plus haut dans la même colonne
tm = cv2.dilate(keep, np.ones((9, 9), np.uint8)).astype(bool)
fill = clean.copy(); todo = tm.copy()
for k in (70, 140, 210, 280):
    src = np.zeros_like(clean); src[k:] = clean[:-k]
    srcbad = np.zeros_like(tm); srcbad[k:] = tm[:-k]; srcbad[:k] = True
    okp = todo & ~srcbad
    fill[okp] = src[okp]; todo &= ~okp
soft = cv2.GaussianBlur(tm.astype(np.float32), (0, 0), 2)[..., None]
clean = (clean * (1 - soft) + fill * soft).clip(0, 255).astype(np.uint8)
# tout à l'échelle du monde
Ws, Hs = round(W * A), round(H * A)
cleanS = cv2.resize(clean, (Ws, Hs), interpolation=cv2.INTER_AREA).astype(np.float32)
imS = cv2.resize(im, (Ws, Hs), interpolation=cv2.INTER_AREA)
keepS = cv2.resize(keep.astype(np.float32), (Ws, Hs), interpolation=cv2.INTER_AREA)
xw = np.arange(Ws) + BX
edge = G[np.clip(np.round(xw), 0, len(G) - 1).astype(int)] - BY  # route, repère du dessin réduit
# bande dépliée le long de la route : profondeur 0..D
D = 260
band = np.zeros((D, Ws, 3), np.float32)
for x in range(Ws):
    y0 = int(round(edge[x])) + 5
    seg = cleanS[y0:y0 + D, x]
    band[:len(seg), x] = seg
    if len(seg) < D: band[len(seg):, x] = seg[-1]
# on garde la partie sans le looping qui se croise ni les bords
x0, x1 = 130, Ws - 20
band = band[:, x0:x1]
def save(name, arr, alpha=None):
    rgb = arr[..., ::-1].clip(0, 255).astype(np.uint8)
    if alpha is not None: rgb = np.dstack([rgb, (alpha * 255).clip(0, 255).astype(np.uint8)])
    Image.fromarray(rgb).save(out + name, quality=80, method=6)
    print(name, rgb.shape[1], 'x', rgb.shape[0])
# bas de la bande : fondu (la bande se pose sur le fond)
fade = np.clip((D - np.arange(D)) / 90, 0, 1)[:, None]
save('terre-bande.webp', band, np.repeat(fade, band.shape[1], 1))
# fond : sous la route la plus basse du dessin, au-dessus du bas (touffes effacées)
lo = int(np.nanmax(edge[x0:x1])) + 40
fond = cleanS[lo:Hs - 30, x0:x1]
save('terre-fond.webp', fond)
# touffes : du dessin d'origine, détourées, bande du bas
t0 = int(Hs * 0.66)
a = cv2.GaussianBlur(keepS[t0:], (0, 0), 0.8)
gs = imS[t0:].astype(np.float32)
green = np.clip((gs[..., 1] - gs[..., 2] - 8) / 40, 0, 1)
alpha = np.clip(a * 1.4, 0, 1) * np.clip(green * 1.5, 0, 1)
herbe = gs[:, x0:x1]
save('terre-herbe.webp', herbe, alpha[:, x0:x1])

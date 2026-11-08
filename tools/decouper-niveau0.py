"""Niveau 0 (essai) : découpe les cinq plans du dessin pour la parallaxe.
Usage : python3 decouper-niveau0.py ciel.jpg nuages.jpg butte.jpg herbe.jpg moulin.jpg sortie/
Repère du monde : le dessin de la butte (2932 × 1440). Écrit aussi geo.json (sol, looping)."""
import sys, json, cv2, numpy as np
from PIL import Image
ciel, nuages, butte, herbe, moulin, out = sys.argv[1:7]

def save(name, rgb, alpha=None, scale=1.0, q=80):
    if scale != 1:
        size = (round(rgb.shape[1] * scale), round(rgb.shape[0] * scale))
        rgb = cv2.resize(rgb, size, interpolation=cv2.INTER_AREA)
        if alpha is not None: alpha = cv2.resize(alpha, size, interpolation=cv2.INTER_AREA)
    a = rgb[..., ::-1].clip(0, 255).astype(np.uint8)
    if alpha is not None: a = np.dstack([a, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    Image.fromarray(a).save(out + name, quality=q, method=6)
    print(name, a.shape[1], 'x', a.shape[0])

def paper_alpha(im, thr=0.06, span=0.22):
    """Papier blanc → transparent ; couleurs « dé-mélangées » du papier."""
    p = cv2.dilate(im, np.ones((31, 31), np.uint8))
    p = cv2.GaussianBlur(p, (0, 0), 30)
    d = np.clip(1 - im / np.maximum(p, 1), 0, 1).max(2)
    a = np.clip((d - thr) / span, 0, 1)
    aa = np.maximum(a, 1e-3)[..., None]
    c = np.clip((im - (1 - aa) * p) / aa, 0, 255)
    return np.where(a[..., None] > 0.02, c, im), a

# ---------- plan 5 : ciel, soleil, petits nuages (opaque, demi-résolution)
im = cv2.imread(ciel).astype(np.float32)
save('plan5-ciel.webp', im, scale=0.5, q=78)

# ---------- plan 4 : les trois gros nuages, ciel transparent
im = cv2.imread(nuages).astype(np.float32)
H, W = im.shape[:2]
bl = cv2.GaussianBlur(im, (0, 0), 2.5)
white = ((bl[..., 0] - bl[..., 2] < 14) & (bl.sum(2) > 640)).astype(np.uint8)
white = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(white)
mask = np.zeros((H, W), np.uint8)
for i in range(1, n):
    x, y, w, h, area = st[i]
    if area < 8000 or y + h > H * 0.55: continue  # le bas du ciel, plus pâle, n'est pas un nuage
    pad = 420
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad + 40)
    seed = (lab[y0:y1, x0:x1] == i).astype(np.uint8)
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    gm = np.full(seed.shape, cv2.GC_PR_BGD, np.uint8)
    near = cv2.dilate(seed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (501, 121)))
    dn = np.zeros_like(near); dn[40:] = near[:-40]; near |= dn
    gm[near > 0] = cv2.GC_PR_FGD
    gm[cv2.erode(seed, np.ones((9, 9), np.uint8)) > 0] = cv2.GC_FGD
    gm[:3] = gm[-3:] = cv2.GC_BGD; gm[:, :3] = gm[:, -3:] = cv2.GC_BGD
    bgm, fgm = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(im[y0:y1, x0:x1].astype(np.uint8), gm, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
    m = ((gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)).astype(np.uint8)
    nc, lc, sc, _ = cv2.connectedComponentsWithStats(m)
    if nc > 1: m = (lc == 1 + np.argmax(sc[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # le trait bleu du contour
    ring = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    blue = ((bl[y0:y1, x0:x1, 0] - bl[y0:y1, x0:x1, 2] > 75) & (bl[y0:y1, x0:x1].sum(2) < 600)).astype(np.uint8)
    m = m | (ring & blue)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    m = np.zeros_like(m); cv2.drawContours(m, cs, -1, 1, -1)
    mask[y0:y1, x0:x1] |= m
a = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.0)
ys = np.nonzero(mask.any(1))[0]
top, bot = max(0, ys.min() - 10), min(H, ys.max() + 10)
save('plan4-nuages.webp', im[top:bot], a[top:bot], scale=0.6, q=82)
plan4 = {'y': int(top), 'h': int(bot - top)}

# ---------- plan 3 : montagnes, champs, charrette, moulin (papier transparent)
im = cv2.imread(moulin).astype(np.float32)
c, a = paper_alpha(im, 0.05, 0.18)
# sous la ligne des montagnes, tout est plein (les champs clairs ne deviennent pas transparents)
g3 = cv2.GaussianBlur(im, (0, 0), 2).mean(2) < 225
H3, W3 = g3.shape
top3 = np.full(W3, H3)
for x in range(W3):
    for y in np.nonzero(g3[:, x])[0]:
        if g3[y:y + 120, x].mean() > 0.97: top3[x] = y; break
top3 = np.array([np.median(top3[max(0, x - 15):x + 16]) for x in range(W3)])
# le moulin et ses ailes : la ligne des montagnes passe derrière (les ailes gardent leurs jours)
m0, m1 = int(W3 * 0.69), int(W3 * 0.95)
top3[m0:m1] = np.linspace(top3[m0], top3[m1], m1 - m0)
a = np.maximum(a, cv2.GaussianBlur(((np.arange(H3)[:, None] >= top3[None, :] + 6)).astype(np.float32), (0, 0), 1.5))
c = np.where(a[..., None] > 0.02, c, im)
ys = np.nonzero((a > 0.3).any(1))[0]
t3 = max(0, ys.min() - 20)
save('plan3-moulin.webp', c[t3:], a[t3:], scale=0.75, q=80)
plan3 = {'w': im.shape[1], 'h': im.shape[0], 'top': int(t3)}

# ---------- plan 2 : la butte et le looping
im = cv2.imread(butte).astype(np.float32)
H, W = im.shape[:2]
gray = cv2.GaussianBlur(im, (0, 0), 2).mean(2)
nonpaper = gray < 222
gy = np.zeros(W)
for x in range(W):
    col = nonpaper[:, x]
    for y in np.nonzero(col)[0]:
        if col[y:y + 70].mean() > 0.9: gy[x] = y; break
k = 21
gs = np.convolve(np.pad(gy, k // 2, mode='edge'), np.ones(k) / k, mode='valid')
# ellipse du looping
sat = im.max(2) - im.min(2)
dark = (cv2.GaussianBlur(im, (0, 0), 1.5).mean(2) < 120) & (sat < 50)
yy = np.arange(H)[:, None]; xx = np.arange(W)[None, :]
ly, lx = np.nonzero(dark & (yy < gs[None, :] - 35) & (xx > 700) & (xx < 1300))
(ex, ey), (ea, eb), ang = cv2.fitEllipse(np.c_[lx, ly].astype(np.float32))
# sol sous le looping : droit entre ses deux pieds
xa, xb = 790, 1215
gs[xa:xb] = np.linspace(gs[xa], gs[xb], xb - xa)
c, a = paper_alpha(im, 0.08, 0.25)
# la terre commence au premier crayon sous la ligne du sol (pas de liseré de papier)
etop = gs.copy()
for x in range(W):
    y = int(gs[x]) - 6
    while y < H - 40 and im[y:y + 3, x].sum(1).min() > 520: y += 1
    etop[x] = max(gs[x] + 4, y + 1)
etop = np.array([np.median(etop[max(0, x - 3):x + 4]) for x in range(W)])
earth = (yy >= etop[None, :])
a = np.maximum(a, earth.astype(np.float32))  # la terre : opaque, avec ses couleurs d'origine
c = np.where(earth[..., None], im, c)
# hors de la terre : seulement le trait du looping (pas les poussières du papier)
spk = ((a > 0.08) & ~earth).astype(np.uint8)
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(spk)
a[np.isin(lab2, [k for k in range(1, n2) if st2[k, cv2.CC_STAT_AREA] < 1500])] = 0
# sous le looping (sol redressé entre ses deux pieds) : pas de bande de papier, de la terre
t2 = 560
save('plan2-butte.webp', c[t2:], a[t2:], q=80)
# ---------- plan 1 : l'herbe (papier transparent)
im = cv2.imread(herbe).astype(np.float32)
c, a = paper_alpha(im, 0.07, 0.2)
ys = np.nonzero((a > 0.4).sum(1) > 20)[0]
t1 = max(0, ys.min() - 20)
save('plan1-herbe.webp', c[t1:], a[t1:], scale=0.8, q=80)
json.dump({'W': W, 'H': H, 'ground': [round(float(v), 1) for v in gs], 'ellipse': [ex, ey, ea / 2, eb / 2, ang],
           'plan2': {'top': t2}, 'plan1': {'top': int(t1), 'h': int(im.shape[0] - t1)}, 'plan3': plan3, 'plan4': plan4},
          open(out + 'geo.json', 'w'))

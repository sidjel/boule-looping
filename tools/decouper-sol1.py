"""Premier plan du niveau 1 : la terre (brun, herbe) sous la route, d'après le dessin.
Le dessin est calé sur la route du jeu (échelle et décalage trouvés par ajustement sur la
ligne noire), le trait noir est effacé (le jeu dessine sa propre route), le ciel devient
transparent et la terre s'efface doucement à la fin de la feuille.
Usage : python3 decouper-sol1.py dessin.jpg sol.json sortie.webp
(sol.json : {"ground": [y du sol pour x = 0, 1, 2, ...]} tiré de track.js)"""
import sys, json, cv2, numpy as np
from PIL import Image
src, prof, out = sys.argv[1], sys.argv[2], sys.argv[3]
G = np.array(json.load(open(prof))['ground'], np.float32)
im = cv2.imread(src).astype(np.float32)
H, W = im.shape[:2]
gray = im.mean(2); sat = im.max(2) - im.min(2)
dark = ((gray < 95) & (sat < 40)).astype(np.uint8)
dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# calage : ligne du bas (plus bas pixel foncé de chaque colonne) contre le sol du jeu
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
print(f'calage : échelle {A:.4f}, décalage ({BX}, {BY:.1f}), écart médian {err:.1f} px')
# trait noir effacé
mask = cv2.dilate(dark, np.ones((7, 7), np.uint8))
clean = cv2.inpaint(im.clip(0, 255).astype(np.uint8), mask * 255, 6, cv2.INPAINT_TELEA).astype(np.float32)
# ciel transparent : la terre commence juste sous la route du jeu
wx = A * xs + BX
edge = (G[np.clip(np.round(wx), 0, len(G) - 1).astype(int)] - BY) / A  # y de la route, repère du dessin
yy = np.arange(H, dtype=np.float32)[:, None]
alpha = np.clip((yy - (edge[None, :] - 3)) / 3, 0, 1)
# fondu vers la feuille suivante (x monde 1780 → 2000)
fade = np.clip((2000 - wx) / 220, 0, 1) ** 1.3
alpha *= fade[None, :]
# bas : jusqu'au bas du monde (1433)
ybot = int(np.ceil((1433 - BY) / A)) + 2
top = int(max(0, np.floor(np.nanmin(edge) - 6)))
rgba = np.dstack([clean[..., ::-1], alpha * 255]).clip(0, 255).astype(np.uint8)[top:min(H, ybot)]
Image.fromarray(rgba).save(out, quality=80, method=6)
x_w, y_w = BX, BY + A * top
print(json.dumps({'x': round(x_w, 2), 'y': round(float(y_w), 2), 'w': round(A * W, 2), 'h': round(A * rgba.shape[0], 2)}))

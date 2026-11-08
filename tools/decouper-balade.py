"""La balade (niveaux 1 et 2, puis les suivants) : plans continus d'un niveau à l'autre.
Usage : python3 decouper-balade.py terre.jpg ciel.jpg dossier/
- terre.webp : la texture de terre (une période, répétée en miroir par le jeu) ;
- ciel.webp  : le ciel au crayon bleu (bords du papier retirés) ;
- montagnes.webp : les montagnes du niveau 1 seules (sans champs), base prolongée vers le bas ;
- champs.webp : les champs du niveau 1 (haies, champs, charrette), sans les montagnes.
Les deux derniers viennent de images/niveau0/plan3-moulin.webp. Écrit balade.json."""
import sys, json, cv2, numpy as np
from PIL import Image
terre, ciel, out = sys.argv[1:4]
meta = {}
def save(name, rgba, q=82):
    Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8)).save(out + name, quality=q, method=6)
    print(name, rgba.shape[1], 'x', rgba.shape[0])
    return [int(rgba.shape[1]), int(rgba.shape[0])]
# terre : une tuile qui se raccorde sur elle-même (sans miroir, pour ne pas faire de motifs en « X ») :
# en largeur, la période de la texture (1369 px) ; en hauteur, 1200 px ; les bords sont fondus
# avec la suite de l'image, si bien que le bas continue le haut et la droite continue la gauche
t = np.array(Image.open(terre).convert('RGB')).astype(np.float32)
w, h, B = 1369, 1200, 160
T = t[:h + B, :w + B].copy()
a = (np.arange(B) / B)[:, None, None]
T[:B] = T[:B] * a + T[h:h + B] * (1 - a)
a = (np.arange(B) / B)[None, :, None]
T[:, :B] = T[:, :B] * a + T[:, w:w + B] * (1 - a)
tile = T[:h, :w]
tile = cv2.resize(tile, (tile.shape[1] * 3 // 4, tile.shape[0] * 3 // 4), interpolation=cv2.INTER_AREA)
meta['terre'] = save('terre.webp', np.dstack([tile, np.full(tile.shape[:2], 255)]), 84)
# ciel : seulement le grain du crayon de la texture (ses grandes taches, qui se verraient en se
# répétant, sont retirées), posé sur un dégradé du bleu foncé en haut au bleu clair en bas.
# La bande se raccorde sur elle-même en largeur (sans miroir) : bords fondus avec la suite.
s = np.array(Image.open(ciel).convert('RGB')).astype(np.float32)[90:-90, 90:-90]
grain = s / np.maximum(cv2.GaussianBlur(s, (0, 0), 40), 1)
w, B = 2350, 200
G = grain[:, :w + B].copy()
a = (np.arange(B) / B)[None, :, None]
G[:, :B] = G[:, :B] * a + G[:, w:w + B] * (1 - a)
G = G[:, :w]
Hs = G.shape[0]
top, bottom = np.array([112, 166, 214], np.float32), np.array([214, 233, 246], np.float32)
t = (np.arange(Hs) / (Hs - 1))[:, None, None] ** 0.9
base = top * (1 - t) + bottom * t
sky = np.clip(base * (1 + (G - 1) * 1.15), 0, 255)
sky = cv2.resize(sky, (w // 2, Hs // 2), interpolation=cv2.INTER_AREA)
meta['ciel'] = save('ciel.webp', np.dstack([sky, np.full(sky.shape[:2], 255)]), 80)
meta['ciel_haut'] = top.tolist(); meta['ciel_bas'] = bottom.tolist()
# les trois gros nuages du niveau 1, chacun à part
p4 = np.array(Image.open('images/niveau0/plan4-nuages.webp').convert('RGBA')).astype(np.float32)
m = (p4[..., 3] > 20).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((15, 15), np.uint8)))
big = []
for i in sorted(range(1, n), key=lambda i: st[i, cv2.CC_STAT_LEFT]):
    x, y, ww, hh, area = st[i]
    if area < 4000: continue
    part = p4[y:y + hh, x:x + ww].copy()
    part[..., 3] *= (lab[y:y + hh, x:x + ww] == i)
    big.append(save(f'gros-nuage-{len(big)}.webp', part))
meta['gros_nuages'] = big
# montagnes et champs du niveau 1
a = np.array(Image.open('images/niveau0/plan3-moulin.webp').convert('RGBA')).astype(np.float32)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
field = ((((g > r + 12) & (g > b + 5)) | (r > b + 35)) & (al > 200)).astype(np.uint8)
field = cv2.morphologyEx(field, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
H, W = field.shape
line = np.array([next((y for y in range(H) if field[y:y + 16, x].mean() > 0.8), H) for x in range(W)], float)
# pas de creux dans la ligne des haies (là où était l'ancien moulin) : au plus 15 px sous la médiane voisine
med = np.array([np.median(line[max(0, x - 120):x + 121]) for x in range(W)])
line = np.minimum(line, med + 15)
yy = np.arange(H)[:, None]
# champs : à partir de la ligne des haies (fondu de 3 px)
fa = np.clip((yy - line[None, :] + 3) / 3, 0, 1)
ch = a.copy(); ch[..., 3] *= fa
top = int(line.min()) - 4
meta['champs'] = {'size': save('champs.webp', ch[top:]), 'top': top, 'src': [W, H]}
# montagnes : au-dessus des haies ; dessous, la montagne continue en reflet (cachée par les champs,
# elle ne se voit qu'un peu quand la parallaxe décale les deux plans)
mo = a.copy()
for x in range(W):
    y = int(line[x])
    for d in range(0, 90):
        if y + d < H and y - 3 - d >= 0: mo[y + d, x] = mo[y - 3 - d, x]
mo[..., 3] = np.where(yy < line[None, :] + 90, mo[..., 3], 0)
# trous dans les montagnes (là où étaient les ailes de l'ancien moulin) : rebouchés
solid = mo[..., 3] > 200
mtop = np.array([np.argmax(solid[:, x]) if solid[:, x].any() else H for x in range(W)])
mtop = np.array([np.median(mtop[max(0, x - 40):x + 41]) for x in range(W)])
holes = (~solid) & (yy > mtop[None, :] + 4) & (yy < line[None, :] + 90)
rgb = cv2.inpaint(mo[..., :3].clip(0, 255).astype(np.uint8), holes.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA).astype(np.float32)
mo[..., :3] = np.where(holes[..., None], rgb, mo[..., :3])
mo[..., 3] = np.where(holes, 255, mo[..., 3])
bot = int(min(H, line.max() + 90))
meta['montagnes'] = {'size': save('montagnes.webp', mo[:bot]), 'line': float(np.median(line))}
meta['ligne_haies'] = float(np.median(line))
json.dump(meta, open(out + 'balade.json', 'w'))

"""Les montagnes de tous les niveaux : la bande fournie (déjà dessinée pour se raccorder sur
elle-même), fond noir → transparent, raccord adouci, bas prolongé (il passe derrière la terre),
et une version par saison. Usage : python3 decouper-montagnes.py montagnes.jpg dossier/"""
import sys, json, cv2, numpy as np
from PIL import Image
src, out = sys.argv[1:3]
im = cv2.imread(src).astype(np.float32)[..., ::-1]
H, W = im.shape[:2]
v = im.max(2)
a = np.clip((v - 25) / 40, 0, 1)
# raccord : les 60 dernières colonnes se fondent dans les 60 premières (la bande se répète)
B = 60
t = (np.arange(B) / B)[None, :]
pa = im * a[..., None]
pa[:, W - B:] = pa[:, W - B:] * (1 - t[..., None]) + pa[:, :B] * t[..., None]
a[:, W - B:] = a[:, W - B:] * (1 - t) + a[:, :B] * t
col = pa / np.maximum(a, 1e-4)[..., None]
# bas : le pied des montagnes s'efface dans la brume (sur 160 px au-dessus du bord dessiné)
solid = a > 0.9
bot = np.array([H - 1 - np.argmax(solid[::-1, x]) for x in range(W)])
bot = np.array([np.min(bot[max(0, x - 60):x + 61]) for x in range(W)])
yy = np.arange(H)[:, None]
A = a * np.clip((bot[None, :] - yy) / 160, 0, 1)
C = col
top = int(np.argmax((A > 0.1).any(1))) - 4
bottom = int(bot.max()) + 4
C, A = C[top:bottom], A[top:bottom]
L = (0.3 * C[..., 0] + 0.59 * C[..., 1] + 0.11 * C[..., 2])[..., None]
snow = np.clip((L - 190) / 45, 0, 1)                    # les sommets enneigés (clairs)
VAR = {
    'ete': C,
    # automne : versants roux et ocres, les neiges restent sur les sommets
    'automne': C * snow + (C * 0.45 + (L * np.array([0.98, 0.8, 0.62]) + np.array([30, 14, 0])) * 0.55) * (1 - snow),
    # hiver : tout plus blanc, ombres bleutées
    'hiver': C * 0.45 + (L * np.array([0.95, 0.98, 1.0]) + np.array([40, 44, 52])) * 0.55,
    # pluie : grises, plus sombres et ternes
    'pluie': (L * np.array([0.78, 0.82, 0.88]) + np.array([2, 6, 14])) * 0.85 + C * 0.15 * 0.85,
    # arrivée : lumière du soir, rose et orangé
    'arrivee': C * 0.55 + (L * np.array([1.05, 0.82, 0.8]) + np.array([30, 10, 15])) * 0.45,
}
SCALE = 0.6
meta = {}
for name, img in VAR.items():
    rgba = np.dstack([np.clip(img, 0, 255), A * 255]).astype(np.uint8)
    rgba = cv2.resize(rgba, (round(W * SCALE), round(rgba.shape[0] * SCALE)), interpolation=cv2.INTER_AREA)
    Image.fromarray(rgba).save(out + name + '.webp', quality=82, method=6)
    meta[name] = [rgba.shape[1], rgba.shape[0]]
    print(name, rgba.shape[1], 'x', rgba.shape[0])
meta['base'] = round((float(np.median(bot)) - top) * SCALE)      # le pied (effacé dans la brume), dans l'image
json.dump(meta, open(out + 'montagnes.json', 'w'))

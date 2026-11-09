"""La suite du plan des champs après le niveau 3 : la bande du lac et des champs de foin, qui court
jusqu'au bout du parcours, aux couleurs de chaque saison (été, automne roux et doré, hiver enneigé,
pluie sombre, arrivée du soir). Usage : python3 decouper-automne.py bande.png dossier/
- ciel transparent, bas prolongé (il passe derrière la terre) ;
- raccord avec la bande du niveau 3 : couture qui suit le dessin (lac contre lac), sans fondu ;
- au-delà, les champs de foin (colonnes C0 à W) se répètent : la fin de la bande rejoint son propre
  début par une seconde couture, si bien que la répétition n'a pas de raccord visible.
Écrit suite-<saison>.webp et suite.json."""
import sys, json, cv2, numpy as np
from PIL import Image
src, out = sys.argv[1:3]
n3 = json.load(open('images/niveau3/niveau3.json'))
S = 1.4
C3 = 690                                                  # 1re colonne d'origine de la bande du niveau 3

def load_band(path):
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = im.shape[:2]
    skyish = ((im.mean(2) > 222) & (im[..., 2] >= im[..., 0] - 4)).astype(np.uint8)
    ff = skyish.copy()
    for x in range(0, W, 3):
        if ff[0, x] == 1:
            cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (x, 0), 2, flags=4)
    a = (ff != 2).astype(np.float32)
    a = cv2.GaussianBlur(cv2.erode(a, np.ones((2, 2), np.uint8)), (0, 0), 0.8)
    B = im[-140:]
    pp = np.concatenate([B[::-1], B] * 3, 0)[:420]
    return np.concatenate([im, pp], 0), np.concatenate([a, np.ones((420, W), np.float32)], 0)

def seam(left, right):
    """Couture verticale (programmation dynamique) dans une zone de recouvrement : left et right sont
    RGBA (même taille). Renvoie, pour chaque ligne, la colonne de la couture."""
    diff = np.abs(left[..., :3] - right[..., :3]).mean(2) * np.minimum(left[..., 3], right[..., 3])
    diff += np.abs(left[..., 3] - right[..., 3]) * 150
    diff = cv2.GaussianBlur(diff, (0, 0), 2)
    H, W = diff.shape
    diff[:, :20] += 1e4; diff[:, -20:] += 1e4
    cost = diff.copy(); back = np.zeros((H, W), np.int32)
    for y in range(1, H):
        p = cost[y - 1]; l = np.r_[np.inf, p[:-1]]; r = np.r_[p[1:], np.inf]
        st = np.stack([l, p, r]); k = st.argmin(0)
        cost[y] += st[k, np.arange(W)]; back[y] = k - 1
    s = np.zeros(H, np.int32); s[-1] = int(cost[-1].argmin())
    for y in range(H - 1, 0, -1): s[y - 1] = s[y] + back[y, s[y]]
    return s

im, a = load_band(src)
H, W = im.shape[:2]
A = np.dstack([im, a])
# ---- raccord avec la bande du niveau 3 : son bout (colonnes d'origine 1810 → 2057) contre le début
n3img = np.array(Image.open('images/niveau3/bande.webp').convert('RGBA')).astype(np.float32)
n3img[..., 3] /= 255
start = 1810 - C3
OV1 = n3img.shape[1] - start
assert n3img.shape[0] == H, (n3img.shape, H)
s1 = seam(n3img[:, start:], A[:, :OV1])
cols = np.arange(W)[None, :]
A[..., 3] *= np.clip(cols - s1[:, None] + 0.5, 0, 1)        # à gauche de la couture : le niveau 3
uA = n3['u0'] + start * S
# ---- boucle des champs de foin : la fin rejoint le début de la partie répétée
C0, OV = 760, 250
L = A[:, W - OV:].copy(); R = A[:, C0:C0 + OV].copy()
s2 = seam(L, R)
c = np.arange(OV)[None, :]
m = np.clip(c - s2[:, None] + 0.5, 0, 1)[..., None]        # 1 : à droite de la couture → début répété
A[:, W - OV:] = L * (1 - m) + R * m
tile0, tile1 = C0 + OV, W                                   # partie qui se répète (colonnes)

# ---- saisons
def hsv_masks(rgb):
    hsv = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    green = np.clip(1 - np.abs(h - 92) / 62, 0, 1) * np.clip(s * 3, 0, 1)
    hay = np.clip(1 - np.abs(h - 45) / 18, 0, 1) * np.clip(s * 2, 0, 1)
    water = np.clip(1 - np.abs(h - 205) / 30, 0, 1) * np.clip(s * 2, 0, 1)
    return green, hay, water

rgb = A[..., :3]
L_ = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2])[..., None]
green, hay, water = hsv_masks(rgb)
yy = np.arange(H)[:, None] / H
noise = cv2.GaussianBlur(np.random.default_rng(5).random((H, W)).astype(np.float32), (0, 0), 18)
noise = ((noise - noise.min()) / (noise.max() - noise.min()))[..., None]
trees = (green[..., None] > 0.3) & (np.arange(H)[:, None, None] < 425)
trees_w = (green[..., None] > 0.3) & (np.arange(H)[:, None, None] < 445)   # en hiver, un peu plus bas   # arbres et haies lointaines (en haut)

def autumn():
    rust = np.dstack([L_[..., 0] * 1.0 + 70, L_[..., 0] * 0.62 + 18, L_[..., 0] * 0.22]) * (1 - noise) \
        + np.dstack([L_[..., 0] * 1.05 + 75, L_[..., 0] * 0.85 + 30, L_[..., 0] * 0.25]) * noise
    meadow = np.dstack([L_[..., 0] * 0.95 + 50, L_[..., 0] * 0.85 + 32, L_[..., 0] * 0.4 + 5])
    g = green[..., None]
    out = rgb * (1 - g) + np.where(trees, rust, meadow * 0.7 + rgb * 0.3) * g
    out = out * (1 - hay[..., None] * 0.4) + (out * np.array([1.05, 0.95, 0.75])) * hay[..., None] * 0.4
    w = water[..., None]
    return out * (1 - w) + (rgb * 0.75 + L_ * 0.25 * np.array([0.8, 0.9, 1.0])) * w

def winter():
    # neige comme sur le dessin d'hiver (tools/decouper-hiver.py) : blanche, ombres et traits de crayon
    # bleutés (le bleu reste fort, le rouge baisse) ; la lumière du dessin d'origine donne les ombres
    lo, hi = np.percentile(L_[350:700], 4), np.percentile(L_[350:700], 97)
    dark = np.clip((hi - L_) / (hi - lo), 0, 1) ** 0.85
    out = np.array([254, 254, 254], np.float32) - dark * np.array([84, 50, 12], np.float32)
    # arbres du fond : vert sombre bleuté comme les sapins du dessin, neige sur les parties claires
    tl = L_ / 255
    pine = np.array([38, 72, 70], np.float32) + tl * np.array([60, 70, 70], np.float32)
    cover = np.clip((tl - 0.42) / 0.25, 0, 1)
    tree_col = pine * (1 - cover) + np.array([236, 243, 252], np.float32) * cover
    out = np.where(trees_w, tree_col, out)
    w = water[..., None]
    out = out * (1 - w) + (L_ * np.array([0.82, 0.9, 1.0]) + 45) * w
    wood = ((rgb[..., 0] > rgb[..., 2] + 30) & (green < 0.2) & (hay < 0.3))[..., None]
    return np.where(wood, rgb * 0.8, out)

VAR = {
    'ete': rgb,
    'automne': autumn(),
    'hiver': winter(),
    'pluie': rgb * np.array([0.72, 0.8, 0.82]) + np.array([2, 6, 12]),
    'arrivee': rgb * 0.75 + (L_ * np.array([1.05, 0.85, 0.7]) + np.array([20, 5, 0])) * 0.25,
}
RES = 0.7
for name, img in VAR.items():
    rgba = np.dstack([np.clip(img, 0, 255), A[..., 3] * 255]).astype(np.uint8)
    rgba = cv2.resize(rgba, (round(W * RES), round(H * RES)), interpolation=cv2.INTER_AREA)
    Image.fromarray(rgba).save(f'{out}suite-{name}.webp', quality=82, method=6)
    print(name, rgba.shape[1], 'x', rgba.shape[0])
json.dump({'u0': uA, 'y0': n3['y0'], 'w': W * S, 'h': H * S, 'W': W, 'tile': [tile0, tile1], 'res': RES},
          open(out + 'suite.json', 'w'))
print('début', round(uA), 'bande', round(W * S), 'répétition', round((tile1 - tile0) * S))

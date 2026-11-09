"""Niveau 3 : la bande au pied des montagnes (ferme, lac, château), qui prend la suite des champs du
niveau 2 dans le même plan. Usage : python3 decouper-niveau3.py bande.png dossier/
- le ciel (papier blanc et nuages au crayon) devient transparent ;
- le bas est prolongé (prairie en reflet) pour passer derrière la terre ;
- le raccord avec la ferme du niveau 2 suit une couture naturelle : la ligne verticale (qui
  serpente) où les deux dessins se ressemblent le plus, trouvée par programmation dynamique ; à
  gauche de la couture, les champs ; à droite, la bande. Pas de fondu (2 px d'adoucissement).
Écrit bande.webp et niveau3.json (position dans le plan des champs, en unités du monde)."""
import sys, json, cv2, numpy as np
from PIL import Image
src, out = sys.argv[1:3]
K, OY = 0.6821282401091405, 224.23738062755797
P3Y = (1440 + 80 - 1536 * (2932 / 2682)) * K + OY      # haut du dessin du moulin (plan des champs)
PX = 2000 / 2012
champs = np.array(Image.open('images/balade/champs.webp').convert('RGBA')).astype(np.float32)
ferme = np.array(Image.open('images/balade/ferme.webp').convert('RGBA')).astype(np.float32)
CH_TOP = 550
# la ferme du niveau 2 (voir balade.js : FARM) : x 1500, échelle 1,05, son horizon (322) sur celui des champs
FF = 1.05
FX = 1500
FY = P3Y + 645 * PX - 322 * FF
CH_END = FX + ferme.shape[1] * FF                                   # la bande se raccorde au bord droit de la ferme
# ---- la bande
im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
# la ferme de la bande ferait doublon avec celle du niveau 2 : la bande commence juste après elle
# (à ses arbres) ; à droite, la forêt du bout est prolongée en miroir
C0, TAIL, MORE = 690, 200, 0   # (la suite : la bande des champs de foin, decouper-automne.py)
end = im[:, -TAIL:]
tail = np.concatenate([end[:, ::-1], end] * 4, 1)[:, :MORE]          # va-et-vient sur la forêt du bout
im = np.concatenate([im[:, C0:], tail], 1)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
skyish = ((im.mean(2) > 222) & (b >= r - 4)).astype(np.uint8)
ff = skyish.copy(); mask = np.zeros((H + 2, W + 2), np.uint8)
sky = np.zeros((H, W), bool)
for x in range(0, W, 3):
    if skyish[0, x] and not sky[0, x]:
        m2 = np.zeros((H + 2, W + 2), np.uint8)
        cv2.floodFill(ff, m2, (x, 0), 2, flags=4)
        sky = ff == 2
a = (~sky).astype(np.float32)
a = cv2.GaussianBlur(cv2.erode(a, np.ones((2, 2), np.uint8)), (0, 0), 0.8)
# bas prolongé : la prairie du bas en reflet
EXT = 420
B = im[-140:]
pp = np.concatenate([B[::-1], B] * 3, 0)[:EXT]                       # va-et-vient sur les 140 dernières lignes
ext = np.concatenate([im, pp], 0)
aext = np.concatenate([a, np.ones((EXT, W), np.float32)], 0)
# ---- échelle et position : largeur ~2300 monde, la ligne d'horizon sur celle des champs
S = 1.4                                                              # assez large pour que son bout reste
                                                                     # caché derrière la grande bosse du niveau 4
top_b = np.array([np.argmax(aext[:, x] > 0.5) for x in range(W)])
hz_b = float(np.median(top_b[720 - C0:1234 - C0]))                 # collines lointaines, avant le lac
top_c = np.array([np.argmax(champs[:, x, 3] > 128) for x in range(champs.shape[1])])
hz_c = P3Y + (CH_TOP + float(np.median(top_c))) * PX                 # monde
BARN = 2062                                                          # bord droit de la grange (image de la ferme)
U0 = FX + (BARN - 22) * FF                                           # la bande commence juste avant ce bord
Y0 = hz_c - hz_b * S
print('horizon champs', round(hz_c), 'bande', hz_b, 'U0', round(U0), 'Y0', round(Y0))
# ---- couture : dans le recouvrement [U0, CH_END], rendu des deux à l'échelle du monde (1 px = 1 unité)
OV = int(CH_END - U0) - 2
Hw = int((ext.shape[0]) * S)
band_w = cv2.resize(np.dstack([ext, aext * 255]), (int(W * S), Hw), interpolation=cv2.INTER_AREA)[:, :OV]
ch_w = np.zeros((Hw, OV, 4), np.float32)
for j in range(OV):
    c = int((U0 + j - FX) / FF)                                      # colonne de la ferme
    if 0 <= c < ferme.shape[1]:
        for yy in range(Hw):
            rr = int((Y0 + yy - FY) / FF)
            if 0 <= rr < ferme.shape[0]: ch_w[yy, j] = ferme[rr, c]
diff = np.abs(band_w[..., :3] - ch_w[..., :3]).mean(2) * (np.minimum(band_w[..., 3], ch_w[..., 3]) / 255)
diff += np.abs(band_w[..., 3] - ch_w[..., 3]) * 0.6
diff = cv2.GaussianBlur(diff, (0, 0), 2)
# pas trop près des bords du recouvrement
# la couture passe à droite de la grange (dans les arbres et l'herbe), jamais dans les maisons
barn_cols = (U0 + np.arange(OV) - FX) / FF < BARN + 4
diff += np.where(barn_cols[None, :], 1e4, 0)
diff += np.where((np.arange(OV) > OV - 6)[None, :], 1e4, 0)
cost = diff.copy(); back = np.zeros(cost.shape, np.int32)
for y in range(1, Hw):
    prev = cost[y - 1]
    l = np.r_[np.inf, prev[:-1]]; rr = np.r_[prev[1:], np.inf]
    st = np.stack([l, prev, rr]); k = st.argmin(0)
    cost[y] += st[k, np.arange(OV)]; back[y] = k - 1
seam = np.zeros(Hw, np.int32); seam[-1] = int(cost[-1].argmin())
for y in range(Hw - 1, 0, -1): seam[y - 1] = seam[y] + back[y, seam[y]]
# masque de la bande, à sa propre résolution : 0 à gauche de la couture
cols = np.arange(W)[None, :] * S
seam_src = cv2.resize(seam.astype(np.float32)[:, None], (1, ext.shape[0]), interpolation=cv2.INTER_LINEAR)[:, 0]
cut = np.clip((cols - seam_src[:, None]) / 2.0 + 0.5, 0, 1)
alpha = aext * cut
rgba = np.dstack([ext, alpha * 255]).clip(0, 255).astype(np.uint8)
Image.fromarray(rgba).save(out + 'bande.webp', quality=84, method=6)
json.dump({'u0': U0, 'y0': Y0, 'w': W * S, 'h': ext.shape[0] * S, 'fin': U0 + W * S}, open(out + 'niveau3.json', 'w'))
print('bande', W, 'x', ext.shape[0], 'monde', round(W * S), 'x', round(ext.shape[0] * S), 'fin', round(U0 + W * S))
# aperçu du raccord
prev = ch_w.copy(); bw = band_w.copy()
cm = cv2.resize(cut, (int(W * S), Hw))[:, :OV, None]
comp = ch_w[..., :3] * (1 - cm * bw[..., 3:] / 255) + bw[..., :3] * cm * bw[..., 3:] / 255
Image.fromarray(comp.clip(0, 255).astype(np.uint8)).save('/tmp/raccord3.png')

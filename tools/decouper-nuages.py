"""Les nuages de tous les niveaux, en cinq saisons.
Usage : python3 decouper-nuages.py nuages.png dossier/
- découpe chaque nuage de la planche fournie (fond déjà transparent) : b0, b1… ;
- y ajoute les trois gros nuages du niveau 1 (images/balade/gros-nuage-0…2) : g0, g1, g2 ;
- écrit pour chacun une version par saison : ete, automne (doré, rosé), hiver (blanc froid),
  pluie (gris), arrivee (rose orangé) ; nuages.json donne les noms et tailles."""
import sys, json, cv2, numpy as np
from PIL import Image
src, out = sys.argv[1:3]
sheet = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
m = (sheet[..., 3] > 20).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((9, 9), np.uint8)))
parts = []
for i in sorted(range(1, n), key=lambda i: (st[i, 1] // 400, st[i, 0])):
    x, y, w, h, area = st[i]
    if area < 3000: continue
    p = sheet[y:y + h, x:x + w].copy()
    p[..., 3] *= (lab[y:y + h, x:x + w] == i)
    p = cv2.resize(p, (round(w * 0.6), round(h * 0.6)), interpolation=cv2.INTER_AREA)
    parts.append(('b%d' % len([q for q in parts if q[0][0] == 'b']), p))
# (les six nuages de la planche sont ceux des niveaux 1 et 2 ; on y ajoute les trois gros du niveau 1)
for k in range(3):
    parts.append(('g%d' % k, np.array(Image.open(f'images/balade/gros-nuage-{k}.webp').convert('RGBA')).astype(np.float32)))
def season(p, kind):
    c, a = p[..., :3], p[..., 3:]
    L = (0.3 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2])[..., None]
    if kind == 'ete': r = c
    elif kind == 'automne': r = c * 0.6 + (L * np.array([1.0, 0.9, 0.78]) + np.array([12, 4, -6])) * 0.4
    elif kind == 'hiver': r = c * 0.55 + (L * np.array([0.96, 0.99, 1.02]) + np.array([8, 10, 14])) * 0.45
    elif kind == 'pluie': r = (L * np.array([0.74, 0.77, 0.82]) + np.array([4, 6, 12])) * 0.9 + c * 0.1 * 0.8
    else: r = c * 0.55 + (L * np.array([1.02, 0.86, 0.86]) + np.array([20, 4, 10])) * 0.45
    return np.dstack([np.clip(r, 0, 255), a]).astype(np.uint8)
meta = {}
for name, p in parts:
    for kind in ['ete', 'automne', 'hiver', 'pluie', 'arrivee']:
        Image.fromarray(season(p, kind)).save(f'{out}{name}-{kind}.webp', quality=84, method=6)
    meta[name] = [int(p.shape[1]), int(p.shape[0])]
    print(name, meta[name])
json.dump(meta, open(out + 'nuages.json', 'w'))

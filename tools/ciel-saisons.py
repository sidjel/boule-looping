"""Le ciel de chaque saison, tiré de la texture de ciel (images/balade/ciel.webp, déjà raccordée
sur elle-même) : on garde son grain de crayon et on remplace son dégradé, ligne par ligne.
Écrit images/ciel/{ete,automne,hiver,pluie,arrivee}.webp et ciel.json (couleurs du haut et du bas)."""
import json, cv2, numpy as np
from PIL import Image
s = np.array(Image.open('images/balade/ciel.webp').convert('RGB')).astype(np.float32)
H = s.shape[0]
# le grain : la luminosité de chaque point par rapport à celle de sa ligne (une seule valeur par
# point : les couleurs viennent du nouveau dégradé)
L = s.mean(2)
grain = (L / np.maximum(cv2.GaussianBlur(L.mean(1, keepdims=True), (0, 0), 6), 1))[..., None]
STOPS = {  # haut, milieu, bas
    'automne': [(38, 86, 168), (112, 152, 196), (250, 212, 168)],
    'hiver': [(92, 128, 176), (162, 186, 212), (236, 241, 247)],
    'pluie': [(74, 86, 104), (122, 132, 148), (192, 197, 204)],
    'arrivee': [(48, 70, 168), (196, 136, 170), (255, 196, 126)],
}
meta = {}
def save(name, img):
    img = cv2.resize(np.clip(img, 0, 255), (round(img.shape[1] * 0.75), round(img.shape[0] * 0.75)), interpolation=cv2.INTER_AREA)
    Image.fromarray(img.astype(np.uint8)).save(f'images/ciel/{name}.webp', quality=80, method=6)
    meta[name] = {'haut': img[:3].reshape(-1, 3).mean(0).round().tolist(), 'bas': img[-3:].reshape(-1, 3).mean(0).round().tolist()}
    print(name, img.shape[1], 'x', img.shape[0])
save('ete', s)
t = np.arange(H) / (H - 1)
for name, (a, b, c) in STOPS.items():
    a, b, c = map(np.array, (a, b, c))
    u = np.clip(t * 2, 0, 1)[:, None]; v = np.clip(t * 2 - 1, 0, 1)[:, None]
    target = np.where((t < 0.5)[:, None], a * (1 - u) + b * u, b * (1 - v) + c * v)[:, None, :]
    # le grain compte moins dans les tons clairs (sinon il blanchit trop)
    save(name, target * (1 + (grain - 1) * 0.9))
json.dump(meta, open('images/ciel/ciel.json', 'w'))

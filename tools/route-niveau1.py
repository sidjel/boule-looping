"""Niveau 1 : la route relevée sur le dessin de la butte (images/niveau0/geo.json : sol et looping),
mise à l'échelle du jeu (2932 → 2000 de large) et raccordée au début du niveau 2 (2030, 852).
Écrit js/niveau1-route.js."""
import json, math
geo = json.load(open('images/niveau0/geo.json'))
g = geo['ground']; WW = geo['W']
K = 2000 / WW
OFF_Y = 852 - g[WW - 1] * K       # la fin de la route arrive à la hauteur du début du niveau 2
ex, ey, ea, eb, ang = geo['ellipse']; ang = math.radians(ang)
E = lambda t: (ex + ea * math.cos(t) * math.cos(ang) - eb * math.sin(t) * math.sin(ang),
               ey + ea * math.cos(t) * math.sin(ang) + eb * math.sin(t) * math.cos(ang))
tb = max((i / 1000 for i in range(6284)), key=lambda t: E(t)[1])
gnd = lambda x: g[max(0, min(WW - 1, round(x)))]
dy = gnd(E(tb)[0]) - E(tb)[1]
E2 = lambda t: (E(t)[0], E(t)[1] + dy)
sign = 1 if E2(tb + 0.01)[0] > E2(tb)[0] else -1
bx, D = E2(tb)[0], 70
pts = [(-20, gnd(0))]
x = 0
while x < bx - D / 2: pts.append((x, gnd(x))); x += 18
for i in range(121):
    u = i / 120; px, py = E2(tb + sign * u * 2 * math.pi)
    pts.append((px - D / 2 + D * u, py))
x = math.ceil(bx + D / 2)
while x < 2873: pts.append((x, gnd(x))); x += 18
# lissage léger (comme le niveau 0)
sm = []
for i in range(len(pts)):
    a = pts[max(0, i - 1):i + 2]
    sm.append((sum(p[0] for p in a) / len(a), sum(p[1] for p in a) / len(a)))
sm[0] = pts[0]
out = [[round(x * K, 1), round(y * K + OFF_Y, 1)] for x, y in sm]
loop_x = [round((ex) * K), round(ea * K), round((ey + dy - eb) * K + OFF_Y)]
crest = min(range(1500, 2400), key=lambda x: g[x])
info = {'K': K, 'offY': OFF_Y, 'loop': [round(ex * K, 1), round((ey + dy) * K + OFF_Y, 1)], 'crest': [round(crest * K), round(g[crest] * K + OFF_Y)],
        'start': round(g[60] * K + OFF_Y)}
open('js/niveau1-route.js', 'w').write(
    '/** Niveau 1 : route relevée sur le dessin de la butte (tools/route-niveau1.py ; ne pas modifier à la main). */\n'
    f'export const ROUTE1 = {json.dumps(out, separators=(",", ":"))};\n'
    f'/** Placement du dessin dans le monde : x · K, y · K + offY. */\nexport const DESSIN1 = {json.dumps(info)};\n')
print(len(out), 'points', info, out[-3:])

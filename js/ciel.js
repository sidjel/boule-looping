/**
 * Le ciel de tous les niveaux : la texture de ciel au crayon (dégradé, foncé en haut, clair en bas),
 * une version par saison (tools/ciel-saisons.py) : bleu franc l'été, plus doux et doré en bas en
 * automne, pâle et froid en hiver, gris sous la pluie, coucher de soleil à l'arrivée.
 * Le ciel est très loin : il suit presque la caméra. Sa couleur suit la saison sous la caméra et
 * passe de l'une à l'autre en fondu pendant qu'on avance : aucune jonction dans l'image.
 * La bande se raccorde sur elle-même en largeur (sans miroir) ; au-dessus, la couleur du haut,
 * en dessous, celle du bas.
 */
import { biomeMix } from './biomes.js';
import { picture, ready, seasonNeed } from './ressources.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
// une version par saison, chargée seulement près de sa saison (ressources.js)
const pic = {};
for (const [name, k] of Object.entries(KIND)) pic[k] = picture(`images/ciel/${k}.webp`, seasonNeed(name));
let meta = null;
fetch('images/ciel/ciel.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});

const Q = 0.9, ANCHOR = 1200, TOP = -260, SCALE = 2.27;

/** Le ciel couvre tout l'écran dès que ses images (saison sous la caméra) sont prêtes : le papier dessous est alors inutile. */
export function skyReady(cx) {
  const m = biomeMix(cx);
  return !!meta && ready(pic[KIND[m.a.name]]) && (m.t <= 0.002 || ready(pic[KIND[m.b.name]]));
}

function paint(g, cam, i, haut, bas) {
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const w = i.width * SCALE, h = i.height * SCALE * 0.73;
  const ox = Q * (cx - ANCHOR), y = TOP + Q * 0.5 * (cy - 716);
  const x0 = cam.x - 4, x1 = cam.x + cam.viewW + 4;
  g.fillStyle = `rgb(${haut})`;
  g.fillRect(x0, cam.y - 4, x1 - x0, Math.max(0, y - cam.y + 6));
  g.fillStyle = `rgb(${bas})`;
  g.fillRect(x0, y + h - 2, x1 - x0, Math.max(0, cam.y + cam.viewH - y - h + 6));
  for (let k = Math.floor((x0 - ox) / w); ox + k * w < x1; k++) g.drawImage(i, ox + k * w, y, w + 1, h);
}

/**
 * Au passage d'une saison à l'autre, un seul ciel déjà mélangé (A × (1 − t) + B × t), refait
 * seulement quand t change d'un quarantième : à l'écran, une seule couche de ciel, pas deux (à
 * l'arrivée, en vue d'ensemble, la caméra reste dans ce passage jusqu'à la fin).
 */
let mix = null, mixKey = '';
function mixedSky(a, b, t) {
  const A = pic[a].img, B = pic[b].img, tq = Math.round(t * 40) / 40, key = `${a}|${b}|${tq}`;
  if (key !== mixKey) {
    if (!mix) mix = document.createElement('canvas');
    if (mix.width !== A.naturalWidth || mix.height !== A.naturalHeight) { mix.width = A.naturalWidth; mix.height = A.naturalHeight; }
    const g = mix.getContext('2d');
    g.globalAlpha = 1;
    g.drawImage(A, 0, 0);
    g.globalAlpha = tq;
    g.drawImage(B, 0, 0, mix.width, mix.height);
    g.globalAlpha = 1;
    mixKey = key;
  }
  return { img: mix, t: tq };
}
const lerp3 = (p, q, t) => p.map((v, k) => Math.round(v + (q[k] - v) * t)).join(',');

/** Dessine le ciel (repère du monde en place dans ctx), sous tout le reste. */
export function drawSky(ctx, cam) {
  if (!meta) return;
  const m = biomeMix(cam.x + cam.viewW / 2), a = KIND[m.a.name], b = KIND[m.b.name];
  if (!ready(pic[a])) return;
  ctx.save();
  if (m.t > 0.002 && b !== a && ready(pic[b])) {
    const { img, t } = mixedSky(a, b, m.t);
    paint(ctx, cam, img, lerp3(meta[a].haut, meta[b].haut, t), lerp3(meta[a].bas, meta[b].bas, t));
  } else paint(ctx, cam, pic[a].img, meta[a].haut, meta[a].bas);
  ctx.restore();
}

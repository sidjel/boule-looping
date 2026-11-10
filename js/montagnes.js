/**
 * Les montagnes de tous les niveaux (tools/decouper-montagnes.py) : une bande dessinée pour se
 * raccorder sur elle-même, répétée sans miroir. Elles sont loin : elles glissent bien moins vite que
 * la route. Leur couleur suit la saison (ensoleillées l'été, rousses en automne, enneigées l'hiver,
 * grises sous la pluie, roses à l'arrivée) ; d'une saison à l'autre, la bande change peu à peu,
 * colonne par colonne, comme le paysage sous elle : sans fondu ni jonction. Leur pied s'efface dans
 * la brume de l'horizon (aux niveaux 1 et 2, les champs passent devant).
 */
import { biomeMix } from './biomes.js';
import { ahead } from './avance.js';
import { picture, ready, seasonNeed } from './ressources.js';
import { mixTwo, junctionNear } from './melange.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
// une version par saison, chargée seulement près de sa saison (ressources.js) ; toutes ont la même taille
const pic = {};
for (const [name, k] of Object.entries(KIND)) pic[k] = picture(`images/montagnes/${k}.webp`, seasonNeed(name));
const anyReady = () => Object.values(pic).find(ready);

const Q = 0.3, ANCHOR = 1200;   // parallaxe : comme les montagnes du niveau 1
const TW = 2400;                // largeur d'une bande dans le monde
const PEAKS = 500;              // haut de la bande (monde), quand la caméra est à sa place

/** Plan des montagnes ↔ monde : la saison en u est celle du sol sous la caméra quand elles y passent. */
const worldOf = (u) => (u - Q * ANCHOR) / (1 - Q);

/** Morceau n° k : { kind } (une seule saison : l'image de la saison) ou { canvas } (mélange, préparé une fois). */
const tiles = new Map();
function tileImage(k) {
  if (tiles.has(k)) return tiles.get(k);
  const u0 = k * TW;
  const marks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => biomeMix(worldOf(u0 + f * TW)));
  const kinds = new Set(marks.flatMap((m) => [KIND[m.a.name], KIND[m.b.name]]));
  for (const kk of kinds) if (!ready(pic[kk])) return null;
  if (kinds.size === 1) { const t = { kind: [...kinds][0] }; tiles.set(k, t); return t; }
  const i0 = pic[[...kinds][0]], W = i0.w, H = i0.h;
  const mid = marks.find((m) => m.t > 0 && m.t < 1);
  if (kinds.size === 2 && mid) {
    // deux saisons : deux dégradés (melange.js)
    const xs = (x) => worldOf(u0 + (x / W) * TW);
    const J = junctionNear(xs(W * (marks.indexOf(mid) / 10)));
    const t = { canvas: mixTwo(pic[KIND[mid.a.name]].img, pic[KIND[mid.b.name]].img, 0, W, W, H, xs, J) };
    tiles.set(k, t);
    return t;
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  const STEP = 4;
  for (let x = 0; x < W; x += STEP) {
    const m = biomeMix(worldOf(u0 + ((x + STEP / 2) / W) * TW));
    for (const [bio, w] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      if (w < 0.004) continue;
      g.globalAlpha = w;
      g.drawImage(pic[KIND[bio.name]].img, x, 0, STEP, H, x, 0, STEP, H);
    }
  }
  const t = { canvas: c };
  tiles.set(k, t);
  return t;
}
/** L'image à dessiner pour un morceau (null si sa saison n'est pas encore chargée). */
const source = (t) => (t.canvas ? t.canvas : ready(pic[t.kind]) ? pic[t.kind].img : null);

/** Dessine les montagnes (repère du monde en place dans ctx), derrière la terre et les champs. */
export function drawMountains(ctx, cam) {
  const i0 = anyReady();
  if (!i0) return;
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const w = TW, h = (i0.h * w) / i0.w;
  const ox = Q * (cx - ANCHOR), y = PEAKS + Q * 0.5 * (cy - 716);
  if (y > cam.y + cam.viewH || y + h < cam.y) return;
  const k0 = Math.floor((cam.x - ox) / w) - 1;
  let k = k0;
  for (; ox + k * w < cam.x + cam.viewW; k++) {
    const t = tileImage(k), src = t && source(t);
    if (src) ctx.drawImage(src, ox + k * w, y, w + 1, h);
    else if (t && !t.canvas) tiles.delete(k); // sa saison a été libérée : à refaire
  }
  ahead(() => tiles.has(k), () => tileImage(k)); // la bande suivante, à l'avance
  for (const key of tiles.keys()) if (key < k0 - 2 || key > k + 2) tiles.delete(key); // loin : oubliée
}

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

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
const img = {};
for (const k of Object.values(KIND)) {
  const i = new Image();
  i.decoding = 'async';
  i.src = `images/montagnes/${k}.webp`;
  img[k] = i;
}
const ok = (i) => i && i.complete && i.naturalWidth > 0;

const Q = 0.3, ANCHOR = 1200;   // parallaxe : comme les montagnes du niveau 1
const TW = 2400;                // largeur d'une bande dans le monde
const PEAKS = 500;              // haut de la bande (monde), quand la caméra est à sa place

/** Plan des montagnes ↔ monde : la saison en u est celle du sol sous la caméra quand elles y passent. */
const worldOf = (u) => (u - Q * ANCHOR) / (1 - Q);

const tiles = new Map();
function tileImage(k) {
  if (tiles.has(k)) return tiles.get(k);
  const u0 = k * TW;
  const marks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => biomeMix(worldOf(u0 + f * TW)));
  const kinds = new Set(marks.flatMap((m) => [KIND[m.a.name], KIND[m.b.name]]));
  for (const kk of kinds) if (!ok(img[kk])) return null;
  if (kinds.size === 1) { const i = img[[...kinds][0]]; tiles.set(k, i); return i; }
  const i0 = img.ete, W = i0.naturalWidth, H = i0.naturalHeight, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  const STEP = 4;
  for (let x = 0; x < W; x += STEP) {
    const m = biomeMix(worldOf(u0 + ((x + STEP / 2) / W) * TW));
    for (const [bio, w] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      if (w < 0.004) continue;
      g.globalAlpha = w;
      g.drawImage(img[KIND[bio.name]], x, 0, STEP, H, x, 0, STEP, H);
    }
  }
  tiles.set(k, c);
  return c;
}

/** Dessine les montagnes (repère du monde en place dans ctx), derrière la terre et les champs. */
export function drawMountains(ctx, cam) {
  const i0 = img.ete;
  if (!ok(i0)) return;
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const w = TW, h = (i0.naturalHeight * w) / i0.naturalWidth;
  const ox = Q * (cx - ANCHOR), y = PEAKS + Q * 0.5 * (cy - 716);
  if (y > cam.y + cam.viewH || y + h < cam.y) return;
  let k = Math.floor((cam.x - ox) / w) - 1;
  for (; ox + k * w < cam.x + cam.viewW; k++) {
    const src = tileImage(k);
    if (src) ctx.drawImage(src, ox + k * w, y, w + 1, h);
  }
  ahead(() => tiles.has(k), () => tileImage(k)); // la bande suivante, à l'avance
}

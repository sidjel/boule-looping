/**
 * Les nuages de tous les niveaux (tools/decouper-nuages.py), organisés comme aux niveaux 1 et 2 :
 * deux rangs qui dérivent lentement et glissent moins vite que la route (ils sont loin),
 *   - au loin : les cinq petits nuages ;
 *   - devant : les trois gros nuages du niveau 1 et le plus grand des six ;
 * jamais deux nuages pareils côte à côte. Leur couleur suit la saison sous eux (blancs l'été,
 * dorés en automne, blanc froid en hiver, gris sous la pluie, rosés à l'arrivée) et change en douceur
 * d'une saison à l'autre.
 */
import { WORLD } from './track.js';
import { biomeMix } from './biomes.js';
import { picture, ready, seasonNeed } from './ressources.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
const NAMES = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'g0', 'g1', 'g2'];
// chaque nuage en cinq couleurs de saison, chargées seulement près de leur saison (ressources.js)
const pic = {};
for (const n of NAMES) for (const [name, k] of Object.entries(KIND)) pic[`${n}-${k}`] = picture(`images/nuages/${n}-${k}.webp`, seasonNeed(name));
// taille d'un nuage (la même dans toutes les saisons), prise sur la première couleur prête
const dims = {};
function dim(n) {
  if (dims[n]) return dims[n];
  for (const k of Object.values(KIND)) { const p = pic[`${n}-${k}`]; if (ready(p)) return (dims[n] = [p.w, p.h]); }
  return null;
}

const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const SPAN = WORLD.w + 6000; // longueur d'un tour de dérive
/** Un rang : chaque nuage diffère des `win` précédents (et, au bout du rang, des premiers). */
function row(seed, pool, win, gap, y, scale, v) {
  const r = rnd(seed), us = [];
  for (let u = 0; u < SPAN - gap[1]; u += gap[0] + r() * (gap[1] - gap[0])) us.push(u);
  const ks = [];
  for (let i = 0; i < us.length; i++) {
    const avoid = new Set(ks.slice(Math.max(0, i - win)));
    if (i >= us.length - win) for (let j = 0; j < win - (us.length - 1 - i); j++) avoid.add(ks[j]);
    const free = pool.filter((k) => !avoid.has(k));
    const list = free.length ? free : pool.filter((k) => k !== ks[i - 1]);
    ks.push(list[Math.floor(r() * list.length)]);
  }
  return us.map((u, i) => ({ u: u - 3000, k: ks[i], y: y[0] + r() * (y[1] - y[0]), s: scale[0] + r() * (scale[1] - scale[0]), v, flip: r() < 0.35 }));
}
// au loin, puis devant (q : part du mouvement de la caméra que le rang suit)
const ROWS = [
  { q: 0.6, list: row(7, ['b1', 'b2', 'b3', 'b4', 'b5'], 3, [560, 900], [60, 360], [0.26, 0.38], 5) },
  { q: 0.45, list: row(11, ['g0', 'g1', 'g2', 'b0'], 2, [1150, 1600], [-20, 170], [0.45, 0.6], 9) },
];
const ANCHOR = 1200;

let t = 0;
export function moveNuages(dt) { t += dt; }

/** Dessine les deux rangs de nuages (repère du monde en place dans ctx). */
export function drawNuages(ctx, cam) {
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2, x0 = cam.x - 4, x1 = cam.x + cam.viewW + 4;
  ctx.save();
  for (const R of ROWS) {
    const ox = R.q * (cx - ANCHOR), oy = R.q * 0.5 * (cy - 716);
    for (const c of R.list) {
      const d = dim(c.k);
      if (!d) continue;
      const k = c.k.startsWith('g') ? c.s * 1.25 : c.s * 1.6; // (mêmes tailles qu'aux niveaux 1 et 2)
      const w = d[0] * k, h = d[1] * k;
      const u = ((((c.u + 3000 + t * c.v) % SPAN) + SPAN) % SPAN) - 3000, x = u + ox, y = c.y + oy;
      if (x + w < x0 || x > x1) continue;
      // la saison sous le nuage (là où il est à l'écran)
      const m = biomeMix(x + w / 2);
      const layers = m.b !== m.a && m.t > 0.01 ? [[m.a, 1], [m.b, m.t]] : [[m.a, 1]];
      for (const [bio, a] of layers) {
        const p = pic[`${c.k}-${KIND[bio.name]}`];
        if (!ready(p)) continue;
        const i = p.img;
        ctx.globalAlpha = a;
        if (c.flip) {
          ctx.save();
          ctx.translate(x + w, y);
          ctx.scale(-1, 1);
          ctx.drawImage(i, 0, 0, w, h);
          ctx.restore();
        } else ctx.drawImage(i, x, y, w, h);
      }
    }
  }
  ctx.restore();
}

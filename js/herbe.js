/**
 * L'herbe fleurie du premier plan, devant tout, sur tous les niveaux (tools/decouper-herbe.py) :
 * une bande qui se raccorde sur elle-même (sans miroir ni couture), glisse un peu plus vite que la
 * route (elle est plus près) et ondule au vent. Selon la saison : en fleurs l'été et à l'arrivée,
 * fanée en automne, givrée et enneigée en hiver, mouillée sous la pluie ; d'une saison à l'autre,
 * elle change peu à peu, sans jonction.
 */
import { WORLD } from './track.js';
import { biomeMix } from './biomes.js';
import { ahead } from './avance.js';
import { picture, ready, seasonNeed } from './ressources.js';

const KINDS = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'ete' };
// une version par saison (l'été sert aussi à l'arrivée), chargée seulement près de sa saison
const pic = {
  ete: picture('images/herbe/ete.webp', seasonNeed('Été', 'Arrivée')),
  automne: picture('images/herbe/automne.webp', seasonNeed('Automne')),
  hiver: picture('images/herbe/hiver.webp', seasonNeed('Hiver')),
  pluie: picture('images/herbe/pluie.webp', seasonNeed('Pluie')),
};
const anyReady = () => Object.values(pic).find(ready);
/** L'image à dessiner pour une bande ({ kind } ou { canvas }) ; null si sa saison n'est pas chargée. */
const source = (t) => (t.canvas ? t.canvas : ready(pic[t.kind]) ? pic[t.kind].img : null);

const TW = 1400;      // largeur d'une bande (monde)
const Q = 0.3;        // l'herbe glisse 30 % plus vite que la route
const ANCHOR = 1000;  // là où l'herbe est à sa place

/** Plan de l'herbe ↔ monde : la saison de l'herbe en u est celle du sol sous la caméra quand elle y passe. */
const worldOf = (u) => (u + Q * ANCHOR) / (1 + Q); // l'herbe en u passe au centre de l'écran quand la caméra y est

/** Les couleurs (saisons) de la bande n° k ; une bande à cheval sur deux saisons est préparée une fois. */
const tiles = new Map();
function tileImage(k) {
  if (tiles.has(k)) return tiles.get(k);
  const u0 = k * TW, mid = biomeMix(worldOf(u0 + TW / 2)), a = biomeMix(worldOf(u0)), b = biomeMix(worldOf(u0 + TW));
  const pure = a.t === 0 && b.t === 0 && a.a === b.a;
  const kind0 = KINDS[a.a.name], i0 = pic[kind0];
  if (!ready(i0)) return null;
  if (pure && mid.t === 0) { const t = { kind: kind0 }; tiles.set(k, t); return t; }
  // bande de transition : on mélange les deux saisons colonne par colonne selon le mélange du sol
  const kinds = new Set([KINDS[a.a.name], KINDS[a.b.name], KINDS[b.a.name], KINDS[b.b.name], KINDS[mid.a.name], KINDS[mid.b.name]]);
  for (const kk of kinds) if (!ready(pic[kk])) return null;
  const W = i0.w, H = i0.h, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const STEP = 6;
  for (let x = 0; x < W; x += STEP) {
    const m = biomeMix(worldOf(u0 + ((x + STEP / 2) / W) * TW));
    for (const [bio, w] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      if (w < 0.004) continue;
      g.globalAlpha = w;
      g.globalCompositeOperation = 'lighter'; // les deux saisons s'additionnent (poids 1 au total)
      g.drawImage(pic[KINDS[bio.name]].img, x, 0, STEP, H, x, 0, STEP, H);
    }
  }
  const t = { canvas: c };
  tiles.set(k, t);
  return t;
}

export class Grass {
  constructor() { this.t = 0; }

  update(dt) { this.t += dt; }

  /** Dessine l'herbe devant tout (repère du monde déjà en place dans ctx). */
  draw(ctx, cam) {
    const i0 = anyReady();
    if (!i0) return;
    const t = this.t, cx = cam.x + cam.viewW / 2;
    const w = TW, h = (i0.h * w) / i0.w, base = WORLD.h + 60, top = base - h;
    if (cam.y + cam.viewH < top) return;
    const ox = -Q * (cx - ANCHOR);
    // un souffle doux, en rafales
    const gust = 0.09 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 2.7 + 1) + 0.02 * Math.sin(t * 5.1) + 0.03;
    // seulement les bandes à l'écran (le haut de l'herbe penche d'au plus |gust|·h vers la droite)
    const vx0 = cam.x, vx1 = cam.x + cam.viewW, lean = Math.abs(gust) * h + 2;
    const k0 = Math.floor((vx0 - lean - ox) / w), k1 = Math.floor((vx1 + lean - ox) / w);
    const y0 = Math.max(0, cam.y - top), yEnd = Math.min(h, cam.y + cam.viewH - top);
    // fines bandes horizontales : le pied fixe, le haut penche (pas de coupure dans les brins) ;
    // plus hautes vers le pied, où l'herbe bouge peu (le décalage d'une bande à l'autre reste petit)
    const rows = [];
    for (let y = Math.floor(y0 / 8) * 8; y < yEnd;) {
      const lift = (h - y) / h, slope = 2 * Math.abs(gust) * lift;
      const rh = Math.min(h - y, Math.max(8, Math.min(64, Math.round(1.2 / Math.max(slope, 0.01)))));
      rows.push([y, rh, gust * h * lift * lift]);
      y += rh;
    }
    for (let k = k0; k <= k1; k++) {
      const t = tileImage(k), src = t && source(t);
      if (!src) { if (t && !t.canvas) tiles.delete(k); continue; } // saison libérée : à refaire
      const sc = src.height / h, sw = src.width / w, tx = ox + k * w;
      for (const [y, rh, dx] of rows) {
        // la partie de la bande à l'écran seulement
        const a = Math.max(vx0, tx + dx), b = Math.min(vx1, tx + dx + w);
        if (b <= a) continue;
        ctx.drawImage(src, (a - tx - dx) * sw, y * sc, (b - a) * sw, rh * sc, a, top + y, b - a + 1, rh + 0.5);
      }
    }
    ahead(() => tiles.has(k1 + 1), () => tileImage(k1 + 1)); // la bande suivante, à l'avance
    for (const key of tiles.keys()) if (key < k0 - 2 || key > k1 + 3) tiles.delete(key); // loin : oubliée
  }
}

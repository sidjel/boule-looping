/**
 * L'été aux crayons de couleur, comme le niveau 0, pour les niveaux 2 et 3 (feuilles 1 et 2).
 * Cinq plans, du plus loin au plus près ; plus un plan est loin, plus il suit la caméra
 * (q : part du mouvement de la caméra qu'il suit), donc moins il glisse à l'écran :
 *   5. ciel au crayon bleu et petits nuages, soleil qui brille ;
 *   4. gros nuages, sur deux rangs ;
 *   3. montagnes enneigées, puis la ferme (niveau 2) et la forêt (niveau 3), un cochon qui se promène ;
 *   2. la terre et la route (dessinées dans les feuilles : earth.js, ink.js) ;
 *   1. l'herbe fleurie du premier plan, qui ondule au vent.
 * Les plans 3 à 5 sont peints dans une image de travail, puis fondus en entrée et en sortie de
 * zone (pas de coupure nette avec le niveau 1 et le niveau 4, restés au crayon).
 * Images : tools/decouper-ete.py, dans images/ete/.
 */
import { SHEET, WORLD } from './track.js';

/** Feuilles en couleurs (niveaux 2 et 3). */
export const STYLE_SHEETS = new Set([1, 2]);
const Z0 = SHEET, Z1 = 3 * SHEET, RAMP = 450;

const DIR = 'images/ete/';
const img = {};
function load(key, src) {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  img[key] = i;
}
for (const n of ['ciel', 'montagnes', 'ferme', 'foret', 'cochon', 'herbe']) load(n, `${DIR}${n}.webp`);
for (let k = 0; k < 6; k++) load(`nuage${k}`, `${DIR}nuage-${k}.webp`);
load('soleil', 'images/niveau0/soleil.webp');
const ok = (i) => i && i.complete && i.naturalWidth > 0;

/** Poids de la zone en couleurs à l'abscisse x (0 hors zone, 1 dedans, fondu entre les deux). */
export function colourWeight(x) {
  if (x < Z0 - RAMP || x > Z1 + RAMP) return 0;
  if (x < Z0) return (x - (Z0 - RAMP)) / RAMP;
  if (x > Z1) return 1 - (x - Z1) / RAMP;
  return 1;
}

/* ---------- outils ---------- */

const mirrors = new Map();
function mirror(i) {
  if (!mirrors.has(i)) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(i, 0, 0);
    mirrors.set(i, c);
  }
  return mirrors.get(i);
}
/** Copie de l'image dont le bord gauche s'efface (pour recouvrir la précédente sans raccord). */
const softs = new Map();
function softLeft(i, w) {
  if (!softs.has(i)) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(i, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    softs.set(i, c);
  }
  return softs.get(i);
}
let skyTile = null;
function skyPattern(g) {
  if (!ok(img.ciel)) return null;
  if (!skyTile) {
    const i = img.ciel, w = i.naturalWidth, h = i.naturalHeight, c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const t = c.getContext('2d');
    for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      t.save();
      t.translate(fx < 0 ? w * 2 : 0, fy < 0 ? h * 2 : 0);
      t.scale(fx, fy);
      t.drawImage(i, 0, 0);
      t.restore();
    }
    skyTile = c;
  }
  return g.createPattern(skyTile, 'repeat');
}
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- nuages : deux rangs ---------- */

const ROWS = [
  { q: 0.72, scale: [0.32, 0.5], y: [40, 330], gap: [380, 650], speed: [5, 9] },
  { q: 0.55, scale: [0.6, 0.9], y: [-60, 220], gap: [700, 1100], speed: [9, 15] },
];
for (const [n, R] of ROWS.entries()) {
  const r = rnd(97 + n * 31);
  R.clouds = [];
  for (let u = Z0 - 2500; u < Z1 + 2500; u += R.gap[0] + r() * (R.gap[1] - R.gap[0])) {
    R.clouds.push({ u, y: R.y[0] + r() * (R.y[1] - R.y[0]), k: Math.floor(r() * 6), s: R.scale[0] + r() * (R.scale[1] - R.scale[0]), v: R.speed[0] + r() * (R.speed[1] - R.speed[0]), flip: r() < 0.4 });
  }
}

/* ---------- le cochon, qui se promène devant la ferme ---------- */

const pig = { u: 0.35, dir: 1, wait: 0 };
function stepPig(dt) {
  if (pig.wait > 0) { pig.wait -= dt; return; }
  pig.u += pig.dir * dt * 0.012;
  if (pig.u > 0.62 || pig.u < 0.2) { pig.dir *= -1; pig.wait = 2 + Math.random() * 3; }
}

/* ---------- dessin ---------- */

/**
 * Où peindre : directement à l'écran quand toute la vue est dans la zone (rapide) ; sinon,
 * dans une image de travail à demi-résolution, fondue ensuite sur les bords de la zone.
 */
let off = null, og = null;
const RES = 0.5;
function target(ctx, cam) {
  const full = colourWeight(cam.x) === 1 && colourWeight(cam.x + cam.viewW) === 1;
  if (full) { ctx.save(); return { g: ctx, full }; }
  const W = Math.ceil(ctx.canvas.width * RES), H = Math.ceil(ctx.canvas.height * RES);
  if (!off) { off = document.createElement('canvas'); og = off.getContext('2d'); }
  if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.clearRect(0, 0, W, H);
  const m = ctx.getTransform();
  og.setTransform(m.a * RES, m.b, m.c, m.d * RES, m.e * RES, m.f * RES);
  return { g: og, full };
}
function finish(ctx, cam, t) {
  if (t.full) { ctx.restore(); return; }
  fadeOut(t.g, cam);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(off, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Efface la peinture hors de la zone en couleurs (fondu sur RAMP de chaque côté). */
function fadeOut(g, cam) {
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createLinearGradient(Z0 - RAMP, 0, Z1 + RAMP, 0), L = Z1 - Z0 + 2 * RAMP;
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(RAMP / L, 'rgba(0,0,0,1)');
  grad.addColorStop(1 - RAMP / L, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(cam.x - 10, cam.y - 10, cam.viewW + 20, cam.viewH + 20);
  g.globalCompositeOperation = 'source-over';
}
const visible = (cam) => cam.x < Z1 + RAMP && cam.x + cam.viewW > Z0 - RAMP;

export class Summer {
  constructor() { this.t = 0; }

  update(dt, cam) {
    this.t += dt;
    if (visible(cam)) stepPig(dt);
  }

  /** Plans 5, 4 et 3 : derrière la terre et la route. */
  drawFar(ctx, cam) {
    if (!visible(cam)) return;
    const tg = target(ctx, cam), g = tg.g, t = this.t;
    const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
    // décalage d'un plan : il suit la part q du mouvement de la caméra autour de l'ancre (ax, 716)
    const sx = (q, ax) => q * (cx - ax), sy = (q) => q * 0.5 * (cy - 716);
    // 5 · ciel : un motif (tuile 2 × 2 en miroir), posé d'un seul coup
    const pat = skyPattern(g);
    if (pat) {
      const k = 1.36, ox = sx(0.9, 4000);
      pat.setTransform(new DOMMatrix([k, 0, 0, k, ox, 0]));
      g.fillStyle = pat;
      g.fillRect(cam.x - 2, cam.y - 2, cam.viewW + 4, cam.viewH + 4);
    }
    // soleil : il suit presque la caméra (très loin), pulse et brille
    if (ok(img.soleil)) {
      const i = img.soleil, x = 3300 + sx(0.92, 3300), y = 230 + sy(0.9), R = 125;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      const halo = g.createRadialGradient(x, y, R * 0.9, x, y, R * (1.7 + 0.2 * pulse));
      halo.addColorStop(0, `rgba(255,214,90,${0.16 + 0.1 * pulse})`);
      halo.addColorStop(1, 'rgba(255,214,90,0)');
      g.fillStyle = halo;
      g.fillRect(x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4);
      const z = (1 + 0.035 * pulse) * 0.68 * 2, w = i.naturalWidth * z, h = i.naturalHeight * z;
      g.drawImage(i, x - w / 2, y - h / 2, w, h);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.12 + 0.12 * Math.max(0, Math.sin(t * 2.3));
      g.drawImage(i, x - w / 2, y - h / 2, w, h);
      g.restore();
    }
    // 4 · gros nuages, sur deux rangs (le plus loin d'abord), qui dérivent avec le vent
    for (const R of ROWS) {
      const span = Z1 - Z0 + 5000;
      for (const c of R.clouds) {
        const i = img[`nuage${c.k}`];
        if (!ok(i)) continue;
        const w = i.naturalWidth * c.s * 1.6, h = i.naturalHeight * c.s * 1.6;
        const u = ((c.u - (Z0 - 2500) + t * c.v) % span) + Z0 - 2500;
        const x = u + sx(R.q, 4000), y = c.y + sy(R.q);
        if (x + w < cam.x || x > cam.x + cam.viewW) continue;
        g.drawImage(c.flip ? mirror(i) : i, x, y, w, h);
      }
    }
    // 3 · montagnes enneigées, en bande répétée (à l'endroit puis en miroir)
    if (ok(img.montagnes)) {
      const i = img.montagnes, w = 1750, h = (i.naturalHeight * w) / i.naturalWidth;
      const ox = sx(0.6, 4000), y = 870 - h + sy(0.6);
      for (let k = Math.floor((cam.x - ox - Z0) / w) - 1; Z0 + k * w + ox < cam.x + cam.viewW; k++) {
        g.drawImage(k % 2 ? mirror(i) : i, Z0 + k * w + ox, y, w + 1, h);
      }
    }
    // 3 · la ferme (niveau 2) puis la forêt (niveau 3), qui la recouvre en fondu
    const planes = [['ferme', 3000], ['foret', 5000]];
    for (const [n, ax] of planes) {
      const i = img[n];
      if (!ok(i)) continue;
      const w = 2350, h = (i.naturalHeight * w) / i.naturalWidth;
      const x = ax - w / 2 + sx(0.4, 4000), y = WORLD.h + 40 - h + sy(0.4); // même référence pour les deux : ils glissent ensemble
      g.drawImage(n === 'foret' ? softLeft(i, 260 * (i.naturalWidth / w)) : i, x, y, w, h);
      if (n === 'ferme' && ok(img.cochon)) {
        // le cochon se promène sur le chemin devant la ferme ; il se dandine un peu
        const p = img.cochon, pw = 95, ph = (p.naturalHeight * pw) / p.naturalWidth;
        const px = x + w * pig.u, py = y + h * 0.53 - ph + Math.abs(Math.sin(t * 6)) * -3;
        g.save();
        g.translate(px, py);
        if (pig.dir < 0) { g.translate(pw, 0); g.scale(-1, 1); }
        g.rotate(pig.wait > 0 ? 0 : Math.sin(t * 6) * 0.03);
        g.drawImage(p, 0, 0, pw, ph);
        g.restore();
      }
    }
    finish(ctx, cam, tg);
  }

  /**
   * Plan 1 : l'herbe fleurie, devant tout. Elle glisse plus vite que la route et ondule au
   * vent : fines bandes horizontales, le pied fixe, le haut penche (pas de coupure dans les brins).
   */
  drawFront(ctx, cam) {
    if (!visible(cam) || !ok(img.herbe)) return;
    const tg = target(ctx, cam), g = tg.g, t = this.t, i = img.herbe;
    const w = 1500, h = (i.naturalHeight * w) / i.naturalWidth, base = WORLD.h + 60, top = base - h;
    const cx = cam.x + cam.viewW / 2, ox = -0.3 * (cx - 4000);
    const gust = 0.09 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 2.7 + 1) + 0.02 * Math.sin(t * 5.1) + 0.03;
    const ROW = 4, sc = i.naturalHeight / h;
    const k0 = Math.floor((cam.x - ox) / w) - 1, k1 = Math.ceil((cam.x + cam.viewW - ox) / w);
    for (let y = 0; y < h; y += ROW) {
      const lift = (h - y) / h, dx = gust * h * lift * lift, rh = Math.min(ROW, h - y);
      for (let k = k0; k <= k1; k++) {
        g.drawImage(k % 2 ? mirror(i) : i, 0, y * sc, i.naturalWidth, rh * sc, ox + k * w + dx, top + y, w + 1, rh + 0.4);
      }
    }
    finish(ctx, cam, tg);
  }
}

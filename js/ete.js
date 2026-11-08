/**
 * Le niveau 1 aux crayons de couleur (le « niveau 0 » validé), en cinq plans ; plus un plan est
 * loin, plus il suit la caméra (q : part du mouvement de la caméra qu'il suit), donc moins il
 * glisse à l'écran.
 *   5. le ciel au crayon bleu et ses petits nuages, le soleil qui brille ;
 *   4. les trois gros nuages du dessin, qui dérivent ;
 *   3. montagnes, champs, charrette (pailles qui s'envolent) et moulin (ailes qui tournent) ;
 *   2. la terre et la route : le dessin de la butte, peint dans la feuille (ink.js) ;
 *   1. l'herbe du premier plan, qui ondule au vent.
 * Quand la caméra passe au niveau 2 (au crayon), ce décor s'efface en fondu.
 * Images : images/niveau0/ (tools/decouper-niveau0.py, animer-niveau0.py, moulin-niveau0.py) ;
 * ciel sans soleil et terre : images/ete/.
 */
import { SHEET, WORLD } from './track.js';
import { DESSIN1 } from './niveau1-route.js';

/** Feuilles en couleurs (niveaux 1 à 3). */
export const STYLE_SHEETS = new Set([0]);
const Z1 = SHEET, RAMP = 450; // fin du niveau 1 ; fondu vers le niveau 2 (au crayon)
const K = DESSIN1.K, OY = DESSIN1.offY; // dessin du niveau 1 → monde

const img = {};
function load(key, src) {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  img[key] = i;
}
load('ciel', 'images/ete/ciel.webp');
for (const n of ['soleil', 'plan4-nuages', 'plan3-moulin', 'plan1-herbe', 'tour', 'ailes']) load(n, `images/niveau0/${n}.webp`);
const ok = (i) => i && i.complete && i.naturalWidth > 0;
let geo = null;
fetch('images/niveau0/geo.json').then((r) => r.json()).then((g) => (geo = g)).catch(() => {});

/** Poids de la zone en couleurs à l'abscisse x (0 hors zone, 1 dedans, fondu vers le niveau 4). */
export function colourWeight(x) {
  if (x < 0 || x > Z1 + RAMP) return 0;
  return x > Z1 ? 1 - (x - Z1) / RAMP : 1;
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
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

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

/* ---------- d'un niveau à l'autre : fondu selon la position de la caméra ---------- */

// Chaque niveau a son décor ; quand le centre de la caméra passe d'une feuille à la suivante,
// le décor suivant apparaît pendant que l'autre s'efface (sans image intermédiaire : rapide).
const SWAP = 500;
const rise = (b, cx) => Math.max(0, Math.min(1, (cx - b - 50) / SWAP));
function scenes(cx) {
  const end = 1 - rise(SHEET, cx);
  return { s1: end, all: end };
}
function layer(ctx, alpha, fn) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  fn(ctx, alpha);
  ctx.restore();
}

/* ---------- les pailles qui s'envolent de la charrette (repère du dessin du moulin) ---------- */

const straws = [];
let spawn = 0;
const rand = (a, b) => a + Math.random() * (b - a);
function stepStraws(dt, t) {
  spawn -= dt;
  if (spawn <= 0 && straws.length < 16) {
    spawn = rand(0.2, 0.7);
    straws.push({ x: rand(420, 720), y: rand(820, 870), vx: rand(30, 80), vy: rand(-55, -20), a: rand(0, Math.PI), va: rand(-2.5, 2.5),
      len: rand(16, 30), life: 0, max: rand(4, 7), ph: rand(0, 6.3), col: Math.random() < 0.5 ? '#e3b544' : '#c99232' });
  }
  for (let i = straws.length - 1; i >= 0; i--) {
    const p = straws[i];
    p.life += dt;
    if (p.life > p.max) { straws.splice(i, 1); continue; }
    p.vx += (10 + 16 * Math.sin(t * 0.9 + p.ph)) * dt;
    p.vy += (-5 + 26 * Math.sin(t * 1.7 + p.ph * 2)) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
  }
}

/** Le paysage du niveau 1 en miroir, sans la charrette : gardé sur 60 %, effacé jusqu'à 70 %. */
let side = null;
function sideCopy(i) {
  if (!side) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(mirror(i), 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createLinearGradient(0, 0, c.width, 0);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.6, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    side = c;
  }
  return side;
}

const visible = (cam) => scenes(cam.x + cam.viewW / 2).all > 0.002;

export class Summer {
  constructor() { this.t = 0; }

  update(dt, cam) {
    this.t += dt;
    if (!visible(cam)) return;
    stepStraws(dt, this.t);
  }

  /** Plans 5, 4 et 3 : derrière la terre et la route. */
  drawFar(ctx, cam) {
    if (!visible(cam)) return;
    const t = this.t, cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2, S = scenes(cx);
    // décalage d'un plan qui suit la part q du mouvement de la caméra autour de l'ancre ax
    const sx = (q, ax) => q * (cx - ax), sy = (q) => q * 0.5 * (cy - 716);

    // 5 · ciel, puis soleil (presque immobile à l'écran : il est très loin)
    layer(ctx, S.all, (g) => {
      const pat = skyPattern(g);
      if (pat) {
        const k = 1.36;
        pat.setTransform(new DOMMatrix([k, 0, 0, k, sx(0.9, 3000), 0]));
        g.fillStyle = pat;
        g.fillRect(cam.x - 2, cam.y - 2, cam.viewW + 4, cam.viewH + 4);
      }
      if (ok(img.soleil)) {
        const i = img.soleil, x = 900 + sx(0.92, 1000), y = 300 + sy(0.9), R = 125;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
        const halo = g.createRadialGradient(x, y, R * 0.9, x, y, R * (1.7 + 0.2 * pulse));
        halo.addColorStop(0, `rgba(255,214,90,${0.16 + 0.1 * pulse})`);
        halo.addColorStop(1, 'rgba(255,214,90,0)');
        g.fillStyle = halo;
        g.fillRect(x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4);
        const z = (1 + 0.035 * pulse) * 1.36, w = i.naturalWidth * z, h = i.naturalHeight * z;
        g.drawImage(i, x - w / 2, y - h / 2, w, h);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.12 + 0.12 * Math.max(0, Math.sin(t * 2.3));
        g.drawImage(i, x - w / 2, y - h / 2, w, h);
        g.restore();
      }
    });

    // 4 · niveau 1 : les trois gros nuages du dessin, qui dérivent
    if (geo) layer(ctx, S.s1, (g) => {
      const i = img['plan4-nuages'];
      if (!ok(i)) return;
      const p4 = geo.plan4, w = 2000, h = p4.h * K, y = (p4.y - 60) * K + OY + sy(0.75);
      const ox = sx(0.75, 1000) + ((t * 8) % (w * 2)) - w * 2;
      for (let k = Math.floor((cam.x - ox) / w) - 1; ox + k * w < cam.x + cam.viewW; k++) g.drawImage(k % 2 ? mirror(i) : i, ox + k * w, y, w + 1, h);
    });
    // 3 · niveau 1 : montagnes, champs, charrette, moulin (ailes qui tournent), pailles
    if (geo) layer(ctx, S.s1, (g, A) => {
      const i = img['plan3-moulin'];
      if (!ok(i)) return;
      const p3 = geo.plan3, k = 2000 / p3.w; // repère du dessin du moulin → monde
      const x0 = sx(0.15, 1200), y0 = (1440 + 80 - p3.h * (2932 / p3.w)) * K + OY + sy(0.15);
      g.save();
      g.transform(k, 0, 0, k, x0, y0);
      // le paysage, et son reflet de chaque côté (sans le moulin, dessiné à part) : pas de bord visible
      g.drawImage(i, 0, p3.top, p3.w, p3.h - p3.top);
      // reflets de chaque côté, sans la charrette : seulement des champs, effacés en douceur
      g.drawImage(sideCopy(i), p3.w, p3.top, p3.w, p3.h - p3.top);
      g.save();
      g.translate(0, 0);
      g.scale(-1, 1);
      g.drawImage(sideCopy(i), 0, p3.top, p3.w, p3.h - p3.top);
      g.restore();
      const m2 = geo.moulin2;
      if (m2 && ok(img.tour)) g.drawImage(img.tour, m2.tour[0], m2.tour[1], m2.tour[2], m2.tour[3]);
      if (m2 && ok(img.ailes)) {
        g.save();
        g.translate(m2.moyeu[0], m2.moyeu[1]);
        g.rotate(t * 0.55);
        g.drawImage(img.ailes, -m2.ailes / 2, -m2.ailes / 2, m2.ailes, m2.ailes);
        g.restore();
      }
      g.lineCap = 'round';
      for (const p of straws) {
        const a = Math.min(1, p.life / 0.6, (p.max - p.life) / 1.2), dx = (Math.cos(p.a) * p.len) / 2, dy = (Math.sin(p.a) * p.len) / 2;
        g.globalAlpha = 0.95 * a * A;
        g.strokeStyle = p.col;
        g.lineWidth = 3.2;
        g.beginPath();
        g.moveTo(p.x - dx, p.y - dy);
        g.quadraticCurveTo(p.x + dy * 0.25, p.y - dx * 0.25, p.x + dx, p.y + dy);
        g.stroke();
      }
      g.restore();
    });
  }

  /**
   * Plan 1 : l'herbe, devant tout. Elle glisse plus vite que la route et ondule au vent : fines
   * bandes horizontales, le pied fixe, le haut penche (pas de coupure dans les brins).
   */
  drawFront(ctx, cam) {
    if (!visible(cam)) return;
    const t = this.t, cx = cam.x + cam.viewW / 2, S = scenes(cx);
    const gust = 0.09 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 2.7 + 1) + 0.02 * Math.sin(t * 5.1) + 0.03;
    const grass = (g, i, w, base, ax) => {
      if (!ok(i)) return;
      const h = (i.naturalHeight * w) / i.naturalWidth, top = base - h, ox = -0.3 * (cx - ax);
      const ROW = 8, sc = i.naturalHeight / h;
      const k0 = Math.floor((cam.x - ox) / w) - 1, k1 = Math.ceil((cam.x + cam.viewW - ox) / w);
      for (let y = 0; y < h; y += ROW) {
        const lift = (h - y) / h, dx = gust * h * lift * lift, rh = Math.min(ROW, h - y);
        for (let k = k0; k <= k1; k++) g.drawImage(k % 2 ? mirror(i) : i, 0, y * sc, i.naturalWidth, rh * sc, ox + k * w + dx, top + y, w + 1, rh + 0.4);
      }
    };
    // niveau 1 : l'herbe du dessin
    layer(ctx, S.s1, (g) => {
      const i = img['plan1-herbe'];
      if (ok(i)) grass(g, i, (i.naturalWidth / 0.8) * (2932 / 2932) * K, WORLD.h + 50, 1000);
    });
  }
}

/**
 * L'été aux crayons de couleur : niveaux 1 à 3 (feuilles 0 à 2). Cinq plans ; plus un plan est
 * loin, plus il suit la caméra (q : part du mouvement de la caméra qu'il suit), donc moins il
 * glisse à l'écran.
 *   5. le ciel au crayon bleu et ses petits nuages, le soleil qui brille (communs aux trois niveaux) ;
 *   4. les gros nuages : ceux du dessin du niveau 1, puis ceux des niveaux 2 et 3 ;
 *   3. niveau 1 : montagnes, champs, charrette et moulin (ailes qui tournent, pailles qui s'envolent) ;
 *      niveaux 2 et 3 : montagnes enneigées ; niveau 2 : la ferme et ses cochons ; niveau 3 : la forêt ;
 *   2. la terre et la route (peintes dans les feuilles : earth.js, ink.js) ;
 *   1. l'herbe du premier plan, qui ondule au vent (celle du niveau 1, puis l'herbe fleurie).
 * Chaque niveau a son décor ; quand la caméra passe au niveau suivant, son décor apparaît en
 * fondu, et après le niveau 3 tout s'efface vers le niveau 4, resté au crayon.
 * Images : images/niveau0/ (tools/decouper-niveau0.py, animer-niveau0.py, moulin-niveau0.py) et
 * images/ete/ (tools/decouper-ete.py).
 */
import { SHEET, WORLD } from './track.js';
import { DESSIN1 } from './niveau1-route.js';

/** Feuilles en couleurs (niveaux 1 à 3). */
export const STYLE_SHEETS = new Set([0, 1, 2]);
const Z1 = 3 * SHEET, RAMP = 450; // fin de la zone ; fondu (terre) vers le niveau 4
const K = DESSIN1.K, OY = DESSIN1.offY; // dessin du niveau 1 → monde

const img = {};
function load(key, src) {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  img[key] = i;
}
for (const n of ['ciel', 'montagnes', 'ferme', 'foret', 'cochon', 'herbe']) load(n, `images/ete/${n}.webp`);
for (let k = 0; k < 6; k++) load(`nuage${k}`, `images/ete/nuage-${k}.webp`);
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
  const a = rise(SHEET, cx), b = rise(2 * SHEET, cx), end = 1 - rise(Z1, cx);
  // le décor qui arrive passe devant, à pleine opacité dès la moitié du fondu
  return {
    s1: Math.min(1, 2 * (1 - a)) * end,
    s2: Math.min(1, 2 * a) * Math.min(1, 2 * (1 - b)) * end,
    s3: Math.min(1, 2 * b) * end,
    s23: Math.min(1, 2 * a) * end,
    all: end,
  };
}
function layer(ctx, alpha, fn) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  fn(ctx, alpha);
  ctx.restore();
}

/* ---------- les gros nuages des niveaux 2 et 3 : deux rangs ---------- */

const ROWS = [
  { q: 0.72, scale: [0.32, 0.5], y: [40, 330], gap: [380, 650], speed: [5, 9] },
  { q: 0.55, scale: [0.6, 0.9], y: [-60, 220], gap: [700, 1100], speed: [9, 15] },
];
for (const [n, R] of ROWS.entries()) {
  const r = rnd(97 + n * 31);
  R.clouds = [];
  for (let u = -1000; u < Z1 + 3000; u += R.gap[0] + r() * (R.gap[1] - R.gap[0])) {
    R.clouds.push({ u, y: R.y[0] + r() * (R.y[1] - R.y[0]), k: Math.floor(r() * 6), s: R.scale[0] + r() * (R.scale[1] - R.scale[0]), v: R.speed[0] + r() * (R.speed[1] - R.speed[0]), flip: r() < 0.4 });
  }
}

/* ---------- les cochons de la ferme (position dans le dessin de la ferme : u en largeur, v en hauteur) ---------- */

const PIGS = [
  { u: 0.3, v: 0.56, w: 95, min: 0.18, max: 0.46, speed: 0.012, dir: 1, wait: 0 },
  { u: 0.55, v: 0.66, w: 115, min: 0.47, max: 0.72, speed: 0.009, dir: -1, wait: 1.5 },
  { u: 0.66, v: 0.47, w: 62, min: 0.6, max: 0.74, speed: 0.006, dir: 1, wait: 3 },
];
function stepPigs(dt) {
  for (const p of PIGS) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    p.u += p.dir * dt * p.speed;
    if (p.u > p.max || p.u < p.min) { p.dir *= -1; p.u = Math.max(p.min, Math.min(p.max, p.u)); p.wait = 2 + Math.random() * 4; }
  }
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

/** La forêt : largeur, chevauchement des raccords ; mirrored : en miroir ; fade : bord gauche en fondu. */
const FW = 2350, FOV = 220;
let FH = 900;
function forest(g, x, y, mirrored, fade = false) {
  const i = img.foret;
  if (!ok(i)) return;
  FH = (i.naturalHeight * FW) / i.naturalWidth;
  const src = mirrored ? mirror(i) : i;
  g.drawImage(fade ? soft(src, FOV / FW) : src, x, y, FW, FH);
}
/** Copie de l'image dont le bord gauche (part de la largeur) s'efface. */
const softs = new Map();
function soft(src, part) {
  const key = src;
  if (!softs.has(key)) {
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createLinearGradient(0, 0, w * part, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    softs.set(key, c);
  }
  return softs.get(key);
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
    stepPigs(dt);
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
    // 4 · niveaux 2 et 3 : gros nuages sur deux rangs (le plus loin d'abord)
    layer(ctx, S.s23, (g) => {
      const span = Z1 + 4000;
      for (const R of ROWS) {
        for (const c of R.clouds) {
          const i = img[`nuage${c.k}`];
          if (!ok(i)) continue;
          const w = i.naturalWidth * c.s * 1.6, h = i.naturalHeight * c.s * 1.6;
          const u = ((c.u + 1000 + t * c.v) % span) - 1000;
          const x = u + sx(R.q, 4000), y = c.y + sy(R.q);
          if (x + w < cam.x || x > cam.x + cam.viewW) continue;
          g.drawImage(c.flip ? mirror(i) : i, x, y, w, h);
        }
      }
    });

    // 3 · niveaux 2 et 3 : montagnes enneigées, en bande (à l'endroit puis en miroir)
    layer(ctx, S.s23, (g) => {
      const i = img.montagnes;
      if (!ok(i)) return;
      const w = 1750, h = (i.naturalHeight * w) / i.naturalWidth, ox = sx(0.6, 4000), y = 870 - h + sy(0.6);
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
    // 3 · niveau 2 : la ferme et ses cochons
    layer(ctx, S.s2, (g) => {
      const i = img.ferme;
      if (!ok(i)) return;
      const w = 2350, h = (i.naturalHeight * w) / i.naturalWidth, x = 3000 - w / 2 + sx(0.15, 3000), y = WORLD.h + 40 - h + sy(0.15);
      // de part et d'autre, la forêt (en miroir à gauche), raccordée en fondu : pas de bord droit
      forest(g, x - FW + FOV, y + h - FH, true);
      g.drawImage(soft(i, 0.12), x, y, w, h);
      forest(g, x + w - FOV, y + h - FH, false, true);
      if (!ok(img.cochon)) return;
      const pig = img.cochon;
      for (const p of PIGS) {
        const pw = p.w, ph = (pig.naturalHeight * pw) / pig.naturalWidth;
        const px = x + w * p.u, py = y + h * p.v - ph - (p.wait > 0 ? 0 : Math.abs(Math.sin(t * 6 + p.w)) * 3);
        g.save();
        g.translate(px, py);
        if (p.dir < 0) { g.translate(pw, 0); g.scale(-1, 1); }
        g.rotate(p.wait > 0 ? 0 : Math.sin(t * 6 + p.w) * 0.03);
        g.drawImage(pig, 0, 0, pw, ph);
        g.restore();
      }
    });
    // 3 · niveau 3 : la forêt, prolongée en miroir de chaque côté
    layer(ctx, S.s3, (g) => {
      if (!ok(img.foret)) return;
      const x = 5000 - FW / 2 + sx(0.15, 5000), y = WORLD.h + 40 - FH + sy(0.15);
      forest(g, x - FW + FOV, y, true);
      forest(g, x + FW - FOV, y, true, true);
      forest(g, x, y, false, true);
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
    // niveaux 2 et 3 : l'herbe fleurie
    layer(ctx, S.s23, (g) => grass(g, img.herbe, 1500, WORLD.h + 60, 4000));
  }
}

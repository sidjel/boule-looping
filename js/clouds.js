/**
 * Nuages : tous tirés du nuage modèle fourni (images/nuage.webp, détouré par
 * tools/detourer-nuage.py). Chaque forme en est une variante : taille, sens (miroir) et
 * léger étirement ; gris pour la pluie. Les plus gros avancent plus lentement.
 * Oiseaux au crayon dans le ciel de la deuxième feuille.
 */
import { WORLD, SHEET, SHEETS } from './track.js';
import { biomeOfSheet } from './biomes.js';
import { rng, range } from './pencil.js';

const MODEL = new Image();
MODEL.decoding = 'async';
MODEL.src = 'images/nuage.webp';
const RATIO = 335 / 585; // hauteur / largeur du modèle

/** Une variante du modèle : largeur w, miroir et étirement selon seed, grise si besoin. */
export function buildCloud(seed, w, _h, q, grey = false) {
  const rand = rng(seed), stretch = range(rand, 0.86, 1.08), flip = rand() < 0.5;
  const h = w * RATIO * stretch;
  return { seed, w, h, q, grey, flip, ox: 0, oy: 0, canvas: null };
}

/** Prépare l'image d'une variante (une fois, quand le modèle est chargé). */
function canvasOf(a) {
  if (a.canvas) return a.canvas;
  if (!(MODEL.complete && MODEL.naturalWidth)) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(a.w * a.q));
  c.height = Math.max(1, Math.ceil(a.h * a.q));
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (a.flip) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(MODEL, 0, 0, c.width, c.height);
  if (a.grey) {
    // pluie : le même nuage, assombri et grisé
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(95,105,120,0.42)';
    g.fillRect(0, 0, c.width, c.height);
  }
  a.canvas = c;
  return c;
}

/**
 * Les nuages : un petit stock de formes (blanches, et grises pour la pluie) réutilisées sur
 * tout le parcours ; chaque nuage dérive au-dessus de sa feuille et revient à son début.
 */
export const SHAPES = [
  // [graine, largeur, (hauteur inutilisée), gris, gros]
  [3, 500, 0], [8, 300, 0], [15, 230, 0], [21, 420, 0], [34, 270, 0], [55, 360, 0],
  [89, 450, 0, true], [144, 340, 0, true], [233, 250, 0, true], [377, 390, 0, true],
  // gros nuages (gris pour la pluie)
  [610, 640, 0, false, true], [987, 540, 0, false, true], [1597, 720, 0, false, true],
  [2584, 600, 0, true, true], [4181, 680, 0, true, true],
];

export const CLOUDS = (() => {
  const out = [{ shape: 0, x: 1330, y: 262, speed: 9, home: 0 }];
  for (let k = 0; k < SHEETS; k++) {
    const rain = biomeOfSheet(k).rain, n = rain ? 4 : 3;
    for (let i = 0; i < n; i++) {
      if (k === 0 && i === 0) continue;
      const shape = rain ? 6 + ((k + i) % 4) : 1 + ((k * 3 + i) % 5);
      out.push({ shape, x: k * SHEET + 150 + i * 560 + ((k * 137) % 200), y: 70 + ((k * 7 + i * 3) % 5) * 45, speed: 6 + ((k + i) % 4) * 3, home: k });
    }
    // un gros nuage par feuille, plus lent : il paraît plus loin
    const big = rain ? [13, 14] : [10, 11, 12];
    for (let j = 0; j < 1; j++) {
      const shape = big[(k + j) % big.length], w = SHAPES[shape][1];
      const x = k === 0 ? -120 : k * SHEET + ((k * 433 + j * 911) % (SHEET - w)) - 200;
      out.push({ shape, x, y: 10 + ((k * 5 + j * 2) % 4) * 30, speed: 3 + ((k + j) % 3) * 1.5, home: k });
    }
  }
  // les gros nuages passent derrière les petits
  out.sort((a, b) => (SHAPES[b.shape][4] ? 1 : 0) - (SHAPES[a.shape][4] ? 1 : 0));
  return out;
})();

export function moveClouds(dt) {
  for (const c of CLOUDS) {
    c.x += c.speed * dt;
    const w = SHAPES[c.shape][1];
    if (c.x > (c.home + 1) * SHEET + 200) c.x = c.home * SHEET - w - 200;
  }
}

/** Ne dessine que les nuages visibles. */
export function drawClouds(ctx, built, x0, x1) {
  for (const c of CLOUDS) {
    const a = built[c.shape];
    if (c.x + a.w < x0 || c.x > x1) continue;
    const img = canvasOf(a);
    if (img) ctx.drawImage(img, c.x, c.y, a.w, a.h);
  }
}

export function buildClouds(q) {
  return SHAPES.map(([seed, w, h, grey]) => buildCloud(seed, w, h, q, !!grey));
}

/** Oiseaux en « v » qui planent et battent des ailes de temps en temps (feuille 2). */
const BIRDS = [];
for (let k = 1; k < SHEETS; k++) {
  const bio = biomeOfSheet(k);
  if (bio.snow || bio.rain) continue;
  for (let i = 0; i < 2; i++) BIRDS.push({ x: k * SHEET + 300 + i * 700, y: 240 + ((k + i) % 3) * 45, ph: k * 1.9 + i, speed: 24 + (i % 3) * 5, size: 34 - (i % 3) * 4, home: k });
}

export function drawBirds(ctx, t, dt, x0, x1) {
  ctx.save();
  ctx.strokeStyle = '#55555b';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;
  ctx.globalAlpha = 0.65;
  for (const b of BIRDS) {
    b.x += b.speed * dt;
    if (b.x > (b.home + 1) * SHEET + 60) b.x = b.home * SHEET - 60;
    if (b.x < x0 - 60 || b.x > x1 + 60) continue;
    const flap = Math.sin(t * 7 + b.ph) * (Math.sin(t * 0.6 + b.ph) > 0.2 ? 1 : 0.25);
    const y = b.y + Math.sin(t * 0.8 + b.ph) * 18, s = b.size, lift = s * (0.35 + 0.35 * flap);
    ctx.beginPath();
    ctx.moveTo(b.x - s, y - lift);
    ctx.quadraticCurveTo(b.x - s * 0.45, y - lift * 0.9, b.x, y);
    ctx.quadraticCurveTo(b.x + s * 0.45, y - lift * 0.9, b.x + s, y - lift);
    ctx.stroke();
  }
  ctx.restore();
}

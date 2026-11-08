/**
 * Nuages du dessin de référence, sur deux plans qui glissent à des vitesses différentes
 * quand la caméra avance (parallaxe) :
 * - au loin : des nuages plus petits, plus bas vers l'horizon, qui suivent presque la
 *   caméra (ils défilent lentement) ;
 * - devant : de gros nuages, plus haut, qui défilent plus vite.
 * Tous dérivent doucement avec le vent. Sous la pluie, les mêmes nuages en gris.
 * Oiseaux au crayon dans le ciel.
 */
import { WORLD, SHEET, SHEETS } from './track.js';
import { biomeOfSheet, biomeMix } from './biomes.js';
import { rng, range } from './pencil.js';
import { cloudOf, cloudImgs, A } from './style.js';

/**
 * Plans de nuages. p : part du déplacement de la caméra que le plan suit (plus c'est loin,
 * plus p est grand). Les nuages sont rangés dans le repère du plan : u = x − p·(centre caméra).
 */
const LAYERS = [
  { p: 0.55, gap: [300, 560], scale: [0.45, 0.7], y: [200, 600], speed: [4, 8], alpha: 0.93, seed: 11 },
  { p: 0.2, gap: [650, 1100], scale: [0.9, 1.3], y: [-60, 330], speed: [8, 14], alpha: 1, seed: 29 },
];
const SPAN = WORLD.w + 6000;
for (const L of LAYERS) {
  const r = rng(L.seed);
  L.clouds = [];
  for (let u = -3000; u < -3000 + SPAN; u += range(r, L.gap[0], L.gap[1])) {
    L.clouds.push({ u, y: range(r, L.y[0], L.y[1]), k: Math.floor(r() * cloudImgs.length), s: range(r, L.scale[0], L.scale[1]), speed: range(r, L.speed[0], L.speed[1]), flip: r() < 0.4 });
  }
}
let drift = 0;

export function moveClouds(dt) {
  drift += dt;
}

export function buildClouds() {
  return null;
}

/**
 * Dessine un plan de nuages (0 : au loin, 1 : devant), en repère du monde.
 */
export function drawClouds(ctx, cam, layer) {
  const L = LAYERS[layer], cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const shiftX = L.p * cx, shiftY = L.p * 0.6 * (cy - 716);
  for (const c of L.clouds) {
    const img0 = cloudImgs[c.k];
    if (!img0.naturalWidth) continue;
    const w = img0.naturalWidth * A * c.s, h = img0.naturalHeight * A * c.s;
    const u = ((c.u + 3000 + drift * c.speed) % SPAN) - 3000;
    const x = u + shiftX, y = c.y + shiftY;
    if (x + w < cam.x || x > cam.x + cam.viewW || y + h < cam.y || y > cam.y + cam.viewH) continue;
    const m = biomeMix(x + w / 2);
    for (const [b, a] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      if (a < 0.02) continue;
      const img = cloudOf(c.k, b);
      if (!img) continue;
      ctx.globalAlpha = a * L.alpha;
      if (c.flip) {
        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      } else ctx.drawImage(img, x, y, w, h);
    }
  }
  ctx.globalAlpha = 1;
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

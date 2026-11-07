/**
 * Nuages blancs et moelleux : boules de coton de tailles variées, base plus plate,
 * blanc lumineux en haut, gris bleuté très léger en bas, contour au crayon seulement
 * sur le bord extérieur (avec des manques), quelques plis intérieurs à peine marqués.
 * Oiseaux au crayon dans le ciel de la deuxième feuille.
 */
import { WORLD, SHEET, SHEETS } from './track.js';
import { biomeOfSheet } from './biomes.js';
import { rng, range, pencilLine, grain } from './pencil.js';

/** Bosses du nuage : nombreuses, de tailles très variées, en dôme au centre, base plate. */
function puffs(rand, w, h) {
  const out = [], base = h * 0.82, n = Math.max(7, Math.round(w / 34));
  for (let i = 0; i < n; i++) {
    const t = range(rand, 0.04, 0.96), dome = Math.max(0, 1 - (2 * t - 1) ** 2) ** 0.7;
    const r = h * range(rand, 0.1, 0.2) * (0.7 + 0.9 * dome) * (rand() < 0.15 ? 1.4 : 1);
    out.push({ x: w * t, y: base - r * 0.45 - h * 0.42 * dome * range(rand, 0.25, 1), r });
  }
  // on ne garde que le plus grand groupe de bosses qui se touchent : pas de petites boules isolées
  const touch = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.8;
  let kept = [];
  const seen = new Set();
  for (const start of out) {
    if (seen.has(start)) continue;
    const group = [start], stack = [start];
    seen.add(start);
    while (stack.length) {
      const p = stack.pop();
      for (const q of out) if (!seen.has(q) && touch(p, q)) { seen.add(q); group.push(q); stack.push(q); }
    }
    if (group.length > kept.length) kept = group;
  }
  return kept.sort((p, q) => q.r - p.r);
}

const inside = (ps, x, y, skip) => ps.some((p, i) => i !== skip && Math.hypot(x - p.x, y - p.y) < p.r * 0.97);

export function buildCloud(seed, w, h, q, grey = false) {
  const rand = rng(seed), pad = 24;
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * q);
  c.height = Math.ceil((h + pad * 2) * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(pad, pad);
  let ps = puffs(rand, w, h);
  for (let tries = 0; tries < 15 && ps.length < 5; tries++) ps = puffs(rand, w, h);
  // corps blanc
  const base = h * 0.82;
  g.fillStyle = grey ? '#c4c8cf' : '#fdfdfc';
  g.filter = 'blur(1.2px)';
  for (const p of ps) {
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = 'none';
  // base plate et un peu fondue, comme un vrai cumulus
  g.globalCompositeOperation = 'destination-out';
  const cut = g.createLinearGradient(0, base - 6, 0, base + 10);
  cut.addColorStop(0, 'rgba(0,0,0,0)');
  cut.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = cut;
  g.fillRect(-pad, base - 6, w + pad * 2, h);
  // modelé : lumière en haut, ombre douce en bas (seulement sur le nuage)
  g.globalCompositeOperation = 'source-atop';
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(0.5, grey ? 'rgba(170,176,188,0.35)' : 'rgba(236,239,244,0.3)');
  shade.addColorStop(0.82, grey ? 'rgba(120,128,142,0.6)' : 'rgba(200,206,218,0.6)');
  g.fillStyle = shade;
  g.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
  for (const p of ps) {
    const hi = g.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.35, 0, p.x, p.y, p.r);
    hi.addColorStop(0, 'rgba(255,255,255,0.9)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hi;
    g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  // plis intérieurs : bas de quelques bosses, à peine visibles
  ps.forEach((p, i) => {
    if (rand() < 0.45) return;
    const pts = [];
    for (let a = 0.35; a <= Math.PI - 0.35; a += 0.08) {
      const x = p.x + Math.cos(a) * p.r * 0.92, y = p.y + Math.sin(a) * p.r * 0.92;
      if (inside(ps, x, y, i)) pts.push([x, y]);
    }
    if (pts.length > 5 && p.r > h * 0.16) pencilLine(g, pts, rand, { color: '#bcc0c8', width: 1.2, alpha: 0.2, passes: 1, wobble: 1 });
  });
  // contour au crayon : seulement le bord extérieur, léger, avec des manques
  ps.forEach((p, i) => {
    let run = [];
    const flush = () => {
      if (run.length > 3) pencilLine(g, run, rand, { color: '#a4a8b0', width: 1.3, alpha: 0.3, passes: 1, wobble: 1.2 });
      run = [];
    };
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.06) {
      const x = p.x + Math.cos(a) * p.r, y = p.y + Math.sin(a) * p.r;
      if (y < base - 4 && !inside(ps, x, y, i) && rand() > 0.03) run.push([x, y]);
      else flush();
    }
    flush();
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.18);
  return { canvas: c, w: w + pad * 2, h: h + pad * 2, pad };
}

/**
 * Les nuages : un petit stock de formes (blanches, et grises pour la pluie) réutilisées sur
 * tout le parcours ; chaque nuage dérive au-dessus de sa feuille et revient à son début.
 */
export const SHAPES = [
  [3, 640, 250], [8, 380, 150], [15, 280, 115], [21, 520, 200], [34, 330, 130], [55, 450, 170],
  [89, 560, 220, true], [144, 420, 170, true], [233, 300, 120, true], [377, 480, 190, true],
];

export const CLOUDS = (() => {
  const out = [{ shape: 0, x: 1330, y: 262, speed: 9, home: 0 }];
  for (let k = 0; k < SHEETS; k++) {
    const rain = biomeOfSheet(k).rain, n = rain ? 4 : 3;
    for (let i = 0; i < n; i++) {
      if (k === 0 && i === 0) continue;
      const shape = rain ? 6 + ((k + i) % 4) : 1 + ((k * 3 + i) % 5);
      out.push({ shape, x: k * SHEET + 150 + i * 560 + ((k * 137) % 200), y: 90 + ((k * 7 + i * 3) % 5) * 55, speed: 6 + ((k + i) % 4) * 3, home: k });
    }
  }
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
    if (c.x + a.w < x0 || c.x - a.pad > x1) continue;
    ctx.drawImage(a.canvas, c.x - a.pad, c.y - a.pad, a.w, a.h);
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

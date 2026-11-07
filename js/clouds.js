/**
 * Nuages blancs et moelleux : boules de coton de tailles variées, base plus plate,
 * blanc lumineux en haut, gris bleuté très léger en bas, contour au crayon seulement
 * sur le bord extérieur (avec des manques), quelques plis intérieurs à peine marqués.
 * Oiseaux au crayon dans le ciel de la deuxième feuille.
 */
import { WORLD, SHEET } from './track.js';
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

export function buildCloud(seed, w, h, q) {
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
  g.fillStyle = '#fdfdfc';
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
  shade.addColorStop(0.5, 'rgba(236,239,244,0.3)');
  shade.addColorStop(0.82, 'rgba(200,206,218,0.6)');
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

/** Les nuages du ciel : position, taille, vitesse de dérive (px/s). */
export const CLOUDS = [
  { seed: 3, w: 640, h: 250, x: 1330, y: 262, speed: 9 },
  { seed: 8, w: 380, h: 150, x: 260, y: 110, speed: 14 },
  { seed: 15, w: 280, h: 115, x: 900, y: 330, speed: 6 },
  { seed: 21, w: 520, h: 200, x: 2350, y: 170, speed: 11 },
  { seed: 34, w: 330, h: 130, x: 3100, y: 380, speed: 7 },
  { seed: 55, w: 450, h: 170, x: 3600, y: 120, speed: 12 },
  { seed: 89, w: 560, h: 210, x: 4400, y: 200, speed: 10 },
  { seed: 144, w: 300, h: 120, x: 5300, y: 330, speed: 8 },
  { seed: 233, w: 480, h: 180, x: 6100, y: 110, speed: 13 },
  { seed: 377, w: 360, h: 140, x: 7300, y: 150, speed: 9 },
];

export function moveClouds(dt) {
  for (const c of CLOUDS) {
    c.x += c.speed * dt;
    if (c.x > WORLD.w + 80) c.x = -c.w - 80;
  }
}

export function drawClouds(ctx, built) {
  CLOUDS.forEach((c, i) => {
    const a = built[i];
    ctx.drawImage(a.canvas, c.x - a.pad, c.y - a.pad, a.w, a.h);
  });
}

/** Oiseaux en « v » qui planent et battent des ailes de temps en temps (feuille 2). */
const BIRDS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: SHEET + 300 + i * 900, y: 240 + (i % 3) * 45, ph: i * 1.9, speed: 24 + (i % 3) * 5, size: 34 - (i % 3) * 4 }));

export function drawBirds(ctx, t, dt) {
  ctx.save();
  ctx.strokeStyle = '#55555b';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;
  ctx.globalAlpha = 0.65;
  for (const b of BIRDS) {
    b.x += b.speed * dt;
    if (b.x > WORLD.w + 60) b.x = SHEET - 60;
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

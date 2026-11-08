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

/* ---------- gros nuages au crayon de couleur ---------- */

/** Bosses d'un amas : dôme de bosses en haut, rangée de petites bosses en bas (base bosselée). */
function clusterPuffs(rand, x0, y0, w, h) {
  const out = [], base = y0 + h * 0.86;
  const n = Math.max(6, Math.round(w / 70));
  for (let i = 0; i < n; i++) {
    const t = (i + range(rand, 0.2, 0.8)) / n, dome = Math.max(0, 1 - (2 * t - 1) ** 2) ** 0.8;
    const r = h * range(rand, 0.17, 0.27) * (0.65 + 0.7 * dome);
    out.push({ x: x0 + w * t, y: base - r * 0.55 - h * 0.5 * dome * range(rand, 0.6, 1), r });
  }
  // le gros chou du sommet
  out.push({ x: x0 + w * range(rand, 0.4, 0.6), y: y0 + h * 0.36, r: h * range(rand, 0.3, 0.36) });
  // dessous : quelques bosses moyennes dont seul le bas dépasse (base doucement bosselée)
  for (let x = x0 + h * 0.2; x < x0 + w - h * 0.15; x += h * range(rand, 0.32, 0.42)) {
    const r = h * range(rand, 0.2, 0.26);
    out.push({ x, y: base + h * 0.1 - r, r });
  }
  // remplissage du cœur : pas de trou entre les bosses
  const core = [];
  const sorted = [...out].sort((p, q) => p.x - q.x);
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], q = sorted[i], r = Math.min(p.r, q.r) * 0.85;
    core.push({ x: (p.x + q.x) / 2, y: Math.max(p.y, q.y) + r * 0.25, r, core: true });
  }
  for (let x = x0 + w * 0.15; x < x0 + w * 0.85; x += h * 0.25) core.push({ x, y: base - h * 0.3, r: h * 0.28, core: true });
  return out.concat(core);
}

/** Points du bord extérieur d'un amas de bosses, en morceaux (là où le bord n'est pas caché). */
function outerRuns(ps, step = 0.05) {
  const runs = [];
  ps.forEach((p, i) => {
    let run = [];
    for (let a = 0; a <= Math.PI * 2 + 0.001; a += step) {
      const x = p.x + Math.cos(a) * p.r, y = p.y + Math.sin(a) * p.r;
      if (!inside(ps, x, y, i)) run.push([x, y]);
      else { if (run.length > 2) runs.push(run); run = []; }
    }
    if (run.length > 2) runs.push(run);
  });
  return runs;
}

/**
 * Un amas : blanc en haut, bleuté en bas, traits de crayon blancs et bleus, reflets,
 * contour bleu-gris repassé et quelques creux entre les bosses.
 */
function drawCluster(g, rand, ps, w, h, pad, pal) {
  const c = document.createElement('canvas');
  c.width = g.canvas.width; c.height = g.canvas.height;
  const t = c.getContext('2d');
  t.setTransform(g.getTransform());
  const top = Math.min(...ps.map((p) => p.y - p.r)), bot = Math.max(...ps.map((p) => p.y + p.r));
  // corps
  t.fillStyle = pal.fill;
  for (const p of ps) { t.beginPath(); t.arc(p.x, p.y, p.r, 0, Math.PI * 2); t.fill(); }
  t.globalCompositeOperation = 'source-atop';
  const sh = t.createLinearGradient(0, top, 0, bot);
  sh.addColorStop(0, pal.top);
  sh.addColorStop(0.55, pal.mid);
  sh.addColorStop(1, pal.bottom);
  t.fillStyle = sh;
  t.fillRect(-pad, top - 5, w + pad * 2, bot - top + 10);
  // volume de chaque bosse : clair en haut à gauche, bleuté en bas à droite
  for (const p of ps) {
    if (p.core) continue;
    const d = t.createRadialGradient(p.x + p.r * 0.35, p.y + p.r * 0.45, p.r * 0.1, p.x + p.r * 0.2, p.y + p.r * 0.3, p.r * 1.05);
    d.addColorStop(0, pal.shade);
    d.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = d;
    t.fillRect(p.x - p.r, p.y - p.r, p.r * 2.2, p.r * 2.2);
    const l = t.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.4, 0, p.x - p.r * 0.3, p.y - p.r * 0.4, p.r * 0.75);
    l.addColorStop(0, pal.light);
    l.addColorStop(1, 'rgba(255,255,255,0)');
    t.fillStyle = l;
    t.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  // crayon de couleur : traits obliques, bleus dans le bas, blancs dans le haut
  t.lineCap = 'round';
  for (let i = 0, n = Math.round((w * h) / 520); i < n; i++) {
    const x = range(rand, 0, w), y = range(rand, top, bot), k = (y - top) / (bot - top);
    const len = range(rand, 10, 26), a = -0.6 + range(rand, -0.2, 0.2);
    const blue = rand() < k * 1.1;
    t.strokeStyle = blue ? pal.pencil : '#ffffff';
    t.globalAlpha = blue ? range(rand, 0.08, 0.2) * (0.4 + k) : range(rand, 0.15, 0.4) * (1.2 - k);
    t.lineWidth = range(rand, 1.4, 2.6);
    t.beginPath();
    t.moveTo(x, y);
    t.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    t.stroke();
  }
  t.globalAlpha = 1;
  // reflets : petits traits blancs sur le haut des grosses bosses
  for (const p of ps) {
    if (p.core || p.r < h * 0.2 || rand() < 0.5) continue;
    const a0 = range(rand, -2.5, -1.9), a1 = a0 + range(rand, 0.35, 0.7), rr = p.r * 0.72;
    t.strokeStyle = 'rgba(255,255,255,0.95)';
    t.lineWidth = Math.max(2, p.r * 0.07);
    t.beginPath();
    t.arc(p.x, p.y, rr, a0, a1);
    t.stroke();
  }
  t.globalCompositeOperation = 'source-over';
  // creux entre les bosses : le bas de quelques bosses, à l'intérieur de l'amas
  ps.forEach((p, i) => {
    if (p.core || p.r < h * 0.15 || rand() < 0.55) return;
    const pts = [];
    for (let a = 0.15; a <= Math.PI - 0.15; a += 0.06) {
      const x = p.x + Math.cos(a) * p.r, y = p.y + Math.sin(a) * p.r;
      if (inside(ps, x, y, i)) pts.push([x, y]);
    }
    if (pts.length > 6) pencilLine(t, pts, rand, { color: pal.line, width: 2, alpha: 0.32, passes: 1, wobble: 0.8 });
  });
  // contour : crayon bleu-gris, repassé
  for (const run of outerRuns(ps)) pencilLine(t, run, rand, { color: pal.line, width: 2.8, alpha: 0.75, passes: 2, wobble: 0.9 });
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(c, 0, 0);
  g.restore();
}

const BIG_PAL = {
  white: {
    back: { fill: '#eef4fb', top: '#f6f9fd', mid: '#e1ebf6', bottom: '#bcd2e8', shade: 'rgba(150,185,222,0.22)', light: 'rgba(255,255,255,0.9)', pencil: '#7fa6cf', line: '#5f7f9f' },
    front: { fill: '#ffffff', top: '#ffffff', mid: '#f3f7fc', bottom: '#d3e3f2', shade: 'rgba(160,192,226,0.18)', light: 'rgba(255,255,255,1)', pencil: '#8fb2d6', line: '#5f7f9f' },
  },
  grey: {
    back: { fill: '#c9cfd8', top: '#d6dbe2', mid: '#c2c9d3', bottom: '#98a4b3', shade: 'rgba(90,105,125,0.35)', light: 'rgba(235,238,242,0.7)', pencil: '#6e7d90', line: '#4f5a68' },
    front: { fill: '#dde1e7', top: '#e6e9ee', mid: '#d3d8df', bottom: '#aab4c1', shade: 'rgba(100,112,130,0.3)', light: 'rgba(245,247,250,0.8)', pencil: '#7a889a', line: '#4f5a68' },
  },
};

/** Gros nuage : un amas du fond (plus haut, plus bleuté) et un amas de devant (plus blanc). */
export function buildBigCloud(seed, w, h, q, grey = false) {
  const rand = rng(seed), pad = 30;
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * q);
  c.height = Math.ceil((h + pad * 2) * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(pad, pad);
  const pal = BIG_PAL[grey ? 'grey' : 'white'];
  const flip = rand() < 0.5;
  const back = clusterPuffs(rand, w * (flip ? 0.26 : 0.04), 0, w * 0.7, h * 0.74);
  const front = clusterPuffs(rand, w * (flip ? 0 : 0.16), h * 0.36, w * 0.84, h * 0.6);
  drawCluster(g, rand, back, w, h, pad, pal.back);
  drawCluster(g, rand, front, w, h, pad, pal.front);
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.12);
  return { canvas: c, w: w + pad * 2, h: h + pad * 2, pad };
}

/**
 * Les nuages : un petit stock de formes (blanches, et grises pour la pluie) réutilisées sur
 * tout le parcours ; chaque nuage dérive au-dessus de sa feuille et revient à son début.
 */
export const SHAPES = [
  [3, 640, 250], [8, 380, 150], [15, 280, 115], [21, 520, 200], [34, 330, 130], [55, 450, 170],
  [89, 560, 220, true], [144, 420, 170, true], [233, 300, 120, true], [377, 480, 190, true],
  // gros nuages au crayon de couleur (blancs et bleutés, gris pour la pluie)
  [610, 820, 360, false, true], [987, 640, 290, false, true], [1597, 940, 400, false, true],
  [2584, 760, 330, true, true], [4181, 900, 380, true, true],
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
    // un gros nuage par feuille (deux une fois sur trois), plus lent : il paraît plus loin
    const big = rain ? [13, 14] : [10, 11, 12];
    for (let j = 0; j < (k % 3 === 1 ? 2 : 1); j++) {
      const shape = big[(k + j) % big.length], w = SHAPES[shape][1];
      const x = k === 0 ? -120 : k * SHEET + ((k * 433 + j * 911) % (SHEET - w)) - 200;
      out.push({ shape, x, y: 20 + ((k * 5 + j * 2) % 4) * 40, speed: 3 + ((k + j) % 3) * 1.5, home: k });
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
    if (c.x + a.w < x0 || c.x - a.pad > x1) continue;
    ctx.drawImage(a.canvas, c.x - a.pad, c.y - a.pad, a.w, a.h);
  }
}

export function buildClouds(q) {
  return SHAPES.map(([seed, w, h, grey, big]) => (big ? buildBigCloud(seed, w, h, Math.min(q, 0.8), !!grey) : buildCloud(seed, w, h, q, !!grey)));
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

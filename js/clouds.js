/**
 * Nuages façon dessin animé, d'après les modèles fournis : bosses rondes en amas, contour
 * foncé bien net, dessus blanc, ombres bleutées en aplats sous chaque bosse, petits reflets
 * brillants. Les gros nuages ont deux amas : celui du fond plus bleuté, celui de devant
 * plus blanc, chacun avec son contour. Tous les nuages du jeu ont ce même style.
 * Oiseaux au crayon dans le ciel de la deuxième feuille.
 */
import { WORLD, SHEET, SHEETS } from './track.js';
import { biomeOfSheet } from './biomes.js';
import { rng, range, grain } from './pencil.js';

/** Bosses d'un amas : dôme de bosses en haut, gros chou au sommet, base doucement bosselée. */
function clusterPuffs(rand, x0, y0, w, h) {
  const out = [], base = y0 + h * 0.86;
  const n = Math.max(4, Math.round(w / (h * 0.42)));
  for (let i = 0; i < n; i++) {
    const t = (i + range(rand, 0.25, 0.75)) / n, dome = Math.max(0, 1 - (2 * t - 1) ** 2) ** 0.8;
    const r = h * range(rand, 0.19, 0.27) * (0.7 + 0.6 * dome);
    out.push({ x: x0 + w * t, y: base - r * 0.6 - h * 0.45 * dome * range(rand, 0.6, 1), r });
  }
  out.push({ x: x0 + w * range(rand, 0.38, 0.62), y: y0 + h * 0.37, r: h * range(rand, 0.31, 0.37) });
  // dessous : bosses moyennes dont seul le bas dépasse
  for (let x = x0 + h * 0.22; x < x0 + w - h * 0.18; x += h * range(rand, 0.34, 0.44)) {
    const r = h * range(rand, 0.2, 0.25);
    out.push({ x, y: base + h * 0.1 - r, r });
  }
  // cœur plein : pas de trou entre les bosses
  const sorted = [...out].sort((p, q) => p.x - q.x), core = [];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], q = sorted[i], r = Math.min(p.r, q.r) * 0.85;
    core.push({ x: (p.x + q.x) / 2, y: Math.max(p.y, q.y) + r * 0.25, r, core: true });
  }
  for (let x = x0 + w * 0.15; x < x0 + w * 0.86; x += h * 0.25) core.push({ x, y: base - h * 0.3, r: h * 0.28, core: true });
  return out.concat(core);
}

const PAL = {
  white: {
    back: { line: '#2f3f55', base: '#9cc4e4', mid: '#c2dcf0', top: '#e8f2fb', gloss: '#ffffff' },
    front: { line: '#2f3f55', base: '#acd0ec', mid: '#d3e7f6', top: '#ffffff', gloss: '#ffffff' },
  },
  grey: {
    back: { line: '#2e3540', base: '#8a95a3', mid: '#a9b2bd', top: '#c6ccd4', gloss: '#e8ebef' },
    front: { line: '#2e3540', base: '#9ba6b3', mid: '#bcc4cd', top: '#dee2e7', gloss: '#f2f4f6' },
  },
};

/** La même couleur, transparente (pour un dégradé sans gris au milieu). */
const clear = (hex) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},0)`;
const inside = (ps, x, y, skip) => ps.some((p) => p !== skip && Math.hypot(x - p.x, y - p.y) < p.r * 0.97);

function fillPuffs(t, ps, grow = 0, dx = 0, dy = 0, k = 1) {
  t.beginPath();
  for (const p of ps) {
    const r = p.r * k + grow;
    t.moveTo(p.x + p.r * dx + r, p.y + p.r * dy);
    t.arc(p.x + p.r * dx, p.y + p.r * dy, r, 0, Math.PI * 2);
  }
  t.fill();
}

/** Un amas : contour net, aplats bleutés en bas, blanc en haut à gauche, reflets. */
function drawCluster(g, rand, ps, lw, pal) {
  const c = document.createElement('canvas');
  c.width = g.canvas.width; c.height = g.canvas.height;
  const t = c.getContext('2d');
  t.setTransform(g.getTransform());
  // contour : l'amas un peu plus gros, en foncé, sous le remplissage
  g.fillStyle = pal.line;
  fillPuffs(g, ps, lw);
  // remplissage blanc, puis les ombres bleutées, seulement sur l'amas
  t.fillStyle = pal.top;
  fillPuffs(t, ps);
  t.globalCompositeOperation = 'source-atop';
  const top = Math.min(...ps.map((p) => p.y - p.r)), bot = Math.max(...ps.map((p) => p.y + p.r));
  const grad = t.createLinearGradient(0, top, 0, bot);
  grad.addColorStop(0.45, clear(pal.mid));
  grad.addColorStop(0.75, pal.mid);
  grad.addColorStop(1, pal.base);
  t.fillStyle = grad;
  t.fillRect(-1e4, top - 10, 2e4, bot - top + 20);
  // croissants d'ombre : bas-droite de chaque bosse visible, et tout le bord bas-droite
  const solo = ps.filter((p) => !p.core && !inside(ps, p.x - p.r * 0.2, p.y - p.r * 0.92, p));
  const shadeOf = (list, color, k) => {
    const m = document.createElement('canvas');
    m.width = c.width; m.height = c.height;
    const u = m.getContext('2d');
    u.setTransform(t.getTransform());
    u.fillStyle = color;
    fillPuffs(u, list);
    u.globalCompositeOperation = 'destination-out';
    fillPuffs(u, list, 0, -k, -k * 1.25, 1);
    t.save();
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.drawImage(m, 0, 0);
    t.restore();
  };
  shadeOf(ps.filter((p) => !p.core), pal.base, 0.14);
  for (const p of solo) shadeOf([p], pal.mid, 0.16);
  // reflets : petits traits brillants en haut à gauche des grosses bosses
  t.strokeStyle = pal.gloss;
  t.lineCap = 'round';
  const big = Math.max(...solo.map((p) => p.r));
  for (const p of solo) {
    if (p.r < big * 0.55 || rand() < 0.35) continue;
    const a0 = range(rand, -2.75, -2.35), rr = p.r * 0.74;
    t.lineWidth = Math.max(2, p.r * 0.075);
    t.beginPath();
    t.arc(p.x - p.r * 0.05, p.y - p.r * 0.02, rr, a0, a0 + range(rand, 0.32, 0.55));
    t.stroke();
    if (rand() < 0.6) {
      t.beginPath();
      t.ellipse(p.x - p.r * 0.2, p.y - p.r * 0.58, p.r * 0.09, p.r * 0.045, -0.5, 0, Math.PI * 2);
      t.fillStyle = pal.gloss;
      t.fill();
    }
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(c, 0, 0);
  g.restore();
}

/**
 * Un nuage w × h. Les grands ont un amas de fond (plus haut, plus bleuté) derrière l'amas
 * de devant ; les petits n'ont qu'un amas.
 */
export function buildCloud(seed, w, h, q, grey = false) {
  const rand = rng(seed), lw = Math.max(3, Math.min(7, h * 0.022)), pad = lw + 6;
  const pal = PAL[grey ? 'grey' : 'white'];
  const layers = [];
  if (w >= 420) {
    const flip = rand() < 0.5;
    layers.push([clusterPuffs(rand, w * (flip ? 0.26 : 0.04), 0, w * 0.7, h * 0.74), pal.back]);
    layers.push([clusterPuffs(rand, w * (flip ? 0 : 0.16), h * 0.36, w * 0.84, h * 0.6), pal.front]);
  } else {
    layers.push([clusterPuffs(rand, 0, h * 0.1, w, h * 0.88), pal.front]);
  }
  // cadre : toutes les bosses, contour compris
  const all = layers.flatMap(([ps]) => ps);
  const x0 = Math.min(...all.map((p) => p.x - p.r)) - pad, y0 = Math.min(...all.map((p) => p.y - p.r)) - pad;
  const x1 = Math.max(...all.map((p) => p.x + p.r)) + pad, y1 = Math.max(...all.map((p) => p.y + p.r)) + pad;
  const c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * q);
  c.height = Math.ceil((y1 - y0) * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(-x0, -y0);
  for (const [ps, p] of layers) drawCluster(g, rand, ps, lw, p);
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.06);
  return { canvas: c, w: x1 - x0, h: y1 - y0, ox: x0, oy: y0, pad: -x0 };
}

/**
 * Les nuages : un petit stock de formes (blanches, et grises pour la pluie) réutilisées sur
 * tout le parcours ; chaque nuage dérive au-dessus de sa feuille et revient à son début.
 */
export const SHAPES = [
  [3, 640, 250], [8, 380, 150], [15, 280, 115], [21, 520, 200], [34, 330, 130], [55, 450, 170],
  [89, 560, 220, true], [144, 420, 170, true], [233, 300, 120, true], [377, 480, 190, true],
  // gros nuages (blancs et bleutés, gris pour la pluie)
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
    // un gros nuage par feuille, plus lent : il paraît plus loin
    const big = rain ? [13, 14] : [10, 11, 12];
    for (let j = 0; j < 1; j++) {
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
    if (c.x + a.ox + a.w < x0 || c.x + a.ox > x1) continue;
    ctx.drawImage(a.canvas, c.x + a.ox, c.y + a.oy, a.w, a.h);
  }
}

export function buildClouds(q) {
  return SHAPES.map(([seed, w, h, grey, big]) => buildCloud(seed, w, h, big ? Math.min(q, 0.8) : q, !!grey));
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

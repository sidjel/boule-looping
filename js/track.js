/**
 * Route du dessin : points relevés sur la photo (repère 2000 × 1433),
 * lissés en spline, puis chemin du centre de la boule (décalé d'un rayon).
 * Le côté « boule » de la route est toujours à gauche du sens de marche,
 * ce qui marche aussi bien sur le sol qu'à l'intérieur du looping.
 */
export const WORLD = { w: 2000, h: 1433 };
export const BALL_R = 30;
const STEP = 3;

const CTRL = [
  [-14, 500], [25, 498], [60, 497], [88, 498], [108, 520], [130, 590], [158, 680],
  [190, 772], [228, 858], [268, 937], [306, 1010], [355, 1070], [410, 1115], [470, 1148],
  [540, 1163], [610, 1161], [665, 1149], [705, 1132], [762, 1104], [832, 1058], [893, 1003],
  [932, 940], [950, 870], [943, 800], [916, 742], [870, 703], [810, 686], [750, 690],
  [690, 712], [636, 755], [603, 820], [594, 890], [604, 960], [628, 1030], [665, 1090],
  [710, 1135], [762, 1157], [822, 1163], [892, 1155], [962, 1134], [1040, 1104], [1112, 1064],
  [1180, 1010], [1242, 958], [1300, 921], [1350, 908], [1400, 917], [1452, 945], [1512, 995],
  [1572, 1040], [1642, 1066], [1712, 1071], [1782, 1054], [1852, 1014], [1922, 960],
  [1976, 905], [2030, 850], [2090, 790],
];

/** Spline de Catmull-Rom centripète passant par tous les points. */
function spline(pts, per = 24) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const d = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * (k / per);
      const L = (a, b, ta, tb) => [
        ((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta),
        ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta),
      ];
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Rééchantillonne une ligne brisée à pas constant. */
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let pos = step - carry;
    while (pos <= len) {
      out.push([ax + ((bx - ax) * pos) / len, ay + ((by - ay) * pos) / len]);
      pos += step;
    }
    carry = len - (pos - step);
  }
  return out;
}

/** Tangentes et normales côté boule (normale = gauche du sens de marche). */
function frames(pts) {
  const n = pts.length, tx = new Float32Array(n), ty = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    tx[i] = (b[0] - a[0]) / l;
    ty[i] = (b[1] - a[1]) / l;
  }
  return { tx, ty };
}

export function buildTrack() {
  const line = resample(spline(CTRL), STEP);
  const f0 = frames(line);
  const offset = line.map((p, i) => [p[0] + BALL_R * f0.ty[i], p[1] - BALL_R * f0.tx[i]]);
  const c = resample(offset, STEP);
  const n = c.length, { tx, ty } = frames(c);
  const x = new Float32Array(n), y = new Float32Array(n), k = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = c[i][0]; y[i] = c[i][1]; }
  const raw = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) {
    const dtx = (tx[i + 1] - tx[i - 1]) / (2 * STEP), dty = (ty[i + 1] - ty[i - 1]) / (2 * STEP);
    raw[i] = dtx * ty[i] - dty * tx[i]; // dT/ds · n, avec n = (ty, -tx)
  }
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let j = i - 4; j <= i + 4; j++) if (j >= 0 && j < n) { sum += raw[j]; cnt++; }
    k[i] = sum / cnt;
  }
  const track = { line, x, y, tx, ty, k, n, step: STEP, length: (n - 1) * STEP };
  track.sMin = indexWhere(track, (i) => x[i] >= BALL_R) * STEP;
  track.spawnS = indexWhere(track, (i) => x[i] >= 58) * STEP;
  let top = -1;
  for (let i = 0; i < n; i++) if (x[i] > 560 && x[i] < 980 && (top < 0 || y[i] < y[top])) top = i;
  track.loopTopS = top * STEP;
  track.ground = groundProfile(line);
  track.grid = buildGrid(track);
  return track;
}

function indexWhere(tr, fn) {
  for (let i = 0; i < tr.n; i++) if (fn(i)) return i;
  return 0;
}

/** Point le plus bas de la route pour chaque x : le sol (le looping est au-dessus). */
function groundProfile(line) {
  const g = new Float32Array(WORLD.w + 1).fill(-Infinity);
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const x0 = Math.ceil(Math.min(ax, bx)), x1 = Math.floor(Math.max(ax, bx));
    for (let x = Math.max(0, x0); x <= Math.min(WORLD.w, x1); x++) {
      const y = bx === ax ? Math.max(ay, by) : ay + ((by - ay) * (x - ax)) / (bx - ax);
      if (y > g[x]) g[x] = y;
    }
  }
  return g;
}

export function groundY(track, px) {
  return track.ground[Math.max(0, Math.min(WORLD.w, Math.round(px)))];
}

/** Grille de cases de 64 px → segments du chemin, pour les atterrissages. */
const CELL = 64;
function buildGrid(tr) {
  const map = new Map();
  for (let i = 0; i < tr.n - 1; i++) {
    const x0 = Math.floor(Math.min(tr.x[i], tr.x[i + 1]) / CELL), x1 = Math.floor(Math.max(tr.x[i], tr.x[i + 1]) / CELL);
    const y0 = Math.floor(Math.min(tr.y[i], tr.y[i + 1]) / CELL), y1 = Math.floor(Math.max(tr.y[i], tr.y[i + 1]) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const key = cx * 1000 + cy;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
  }
  return map;
}

export function segmentsNear(tr, px, py) {
  const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL), out = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const list = tr.grid.get((cx + dx) * 1000 + cy + dy);
    if (list) for (const i of list) out.add(i);
  }
  return out;
}

/** Position, tangente et courbure interpolées à l'abscisse s. */
export function sample(tr, s) {
  const f = Math.max(0, Math.min(tr.n - 1.0001, s / tr.step)), i = Math.floor(f), u = f - i;
  const lerp = (a) => a[i] + (a[i + 1] - a[i]) * u;
  let tx = lerp(tr.tx), ty = lerp(tr.ty);
  const l = Math.hypot(tx, ty) || 1;
  tx /= l; ty /= l;
  return { x: lerp(tr.x), y: lerp(tr.y), tx, ty, nx: ty, ny: -tx, k: lerp(tr.k) };
}

/**
 * Géométrie de la route : chaque tronçon (levels.js) est lissé en spline, puis on calcule
 * le chemin du centre de la boule (décalé d'un rayon). Le côté « boule » de la route est
 * toujours à gauche du sens de marche, ce qui marche sur le sol comme dans les loopings.
 * Les tronçons se raccordent bout à bout ; à l'aiguillage, le suivant dépend du chemin choisi.
 */
import { WORLD, SHEET, LEVELS, SHEETS, PIECES, LOOP_ZONES, JUMPS, PUDDLES, FORKS, CHECKPOINTS, BONUSES, HILL, BRIDGE, BRIDGES, FINISH, OBSTACLES, STARS, RETRIES } from './levels.js';
import { biomeAt } from './biomes.js';

export { WORLD, SHEET, LEVELS, SHEETS, JUMPS, HILL, BRIDGE, BRIDGES, FINISH, BONUSES, OBSTACLES, STARS };
export const BALL_R = 30;
const STEP = 3;

/** Spline de Catmull-Rom centripète ; prev/next : voisins fantômes pour raccorder les tronçons. */
function spline(pts, prev, next, per = 24) {
  const ext = [prev || pts[0], ...pts, next || pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
    const d = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * (k / per);
      const L = (a, b, ta, tb) => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      out.push(L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Rééchantillonne une ligne brisée à pas constant (le dernier point est gardé). */
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
  const last = pts[pts.length - 1], tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
  return out;
}

/** Tangentes ; aux bouts, la direction vient des voisins fantômes pour coller au tronçon voisin. */
function frames(pts, prevDir, nextDir) {
  const n = pts.length, tx = new Float32Array(n), ty = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    tx[i] = (b[0] - a[0]) / l;
    ty[i] = (b[1] - a[1]) / l;
  }
  if (prevDir) [tx[0], ty[0]] = prevDir;
  if (nextDir) [tx[n - 1], ty[n - 1]] = nextDir;
  return { tx, ty };
}

const dir = (a, b) => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};

function buildPiece(name, def) {
  const { pts, prev, next } = def;
  const prevDir = prev && dir(prev, pts[0]), nextDir = next && dir(pts[pts.length - 1], next);
  const line = resample(spline(pts, prev, next), STEP);
  const f0 = frames(line, prevDir, nextDir);
  const c = resample(line.map((p, i) => [p[0] + BALL_R * f0.ty[i], p[1] - BALL_R * f0.tx[i]]), STEP);
  const n = c.length, { tx, ty } = frames(c, prevDir, nextDir);
  const x = new Float32Array(n), y = new Float32Array(n), k = new Float32Array(n), raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = c[i][0]; y[i] = c[i][1]; }
  for (let i = 1; i < n - 1; i++) {
    const dtx = (tx[i + 1] - tx[i - 1]) / (2 * STEP), dty = (ty[i + 1] - ty[i - 1]) / (2 * STEP);
    raw[i] = dtx * ty[i] - dty * tx[i]; // dT/ds · n, avec n = (ty, -tx)
  }
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let j = i - 4; j <= i + 4; j++) if (j >= 0 && j < n) { sum += raw[j]; cnt++; }
    k[i] = sum / cnt;
  }
  // lèvre de tremplin : numéro du tremplin + 1 (0 ailleurs)
  const jump = new Uint8Array(n);
  JUMPS.forEach((J, z) => {
    if (J.piece && J.piece !== name) return;
    for (let i = 0; i < n; i++) if (x[i] > J.x0 && x[i] < J.x1 && y[i] < J.yMax) jump[i] = z + 1;
  });
  // inLoop : la partie d'un looping où la boule roule à l'envers (remplie par buildTrack)
  return { name, line, x, y, tx, ty, k, jump, inLoop: new Uint8Array(n), n, step: STEP, length: (n - 1) * STEP, loopTops: [], puddles: [], platform: !!def.platform };
}

export function buildTrack() {
  const p = {};
  for (const [name, def] of Object.entries(PIECES)) p[name] = buildPiece(name, def);
  const track = { pieces: Object.values(p), byName: p };
  // raccords : à l'aiguillage, le chemin choisi ; en marche arrière, celui d'où l'on vient
  track.forks = FORKS.map((f, idx) => {
    const fork = { ...f, idx, route: null, seg: p[f.seg], A: p[f.a], B: p[f.b], after: p[f.after] };
    fork.last = fork.A;
    fork.seg.next = () => (fork.route === 'b' ? fork.B : fork.A);
    fork.A.prev = fork.B.prev = () => fork.seg;
    fork.A.next = fork.B.next = () => fork.after;
    fork.after.prev = () => fork.last;
    fork.A.fork = fork.B.fork = fork;
    return fork;
  });
  // flaques, et fosses pleines d'eau quand il pleut
  for (const d of PUDDLES) p[d.piece].puddles.push({ x0: d.x0, x1: d.x1, y: d.y, deep: false, big: !!d.big });
  for (const J of JUMPS) {
    if (J.piece && biomeAt(J.pit[0]).rain) p[J.piece].puddles.push({ x0: J.pit[0] + 30, x1: J.pit[1] - 30, deep: true, yMin: J.bottom - 70 });
  }
  for (const [name, a, b] of LOOP_ZONES) {
    const pc = p[name];
    let top = -1;
    for (let i = 0; i < pc.n; i++) if (pc.x[i] > a && pc.x[i] < b && (top < 0 || pc.y[i] < pc.y[top])) top = i;
    pc.loopTops.push(top * STEP);
    // la boule y est plaquée (physics.js) : du sommet, de part et d'autre, tant que la route est
    // au-dessus d'elle (normale vers le bas, ny = -tx > 0), plus 12 points de marge
    let i0 = top, i1 = top;
    while (i0 > 0 && -pc.tx[i0 - 1] > -0.05) i0--;
    while (i1 < pc.n - 1 && -pc.tx[i1 + 1] > -0.05) i1++;
    for (let i = Math.max(0, i0 - 12); i <= Math.min(pc.n - 1, i1 + 12); i++) pc.inLoop[i] = 1;
  }
  const main = p.main;
  track.sMin = indexWhere(main, (i) => main.x[i] >= BALL_R) * STEP;
  track.checkpoints = CHECKPOINTS.map(({ piece, x }) => {
    const pc = p[piece];
    return { pc, s: indexWhere(pc, (i) => pc.x[i] >= x) * STEP };
  });
  track.spawnS = track.checkpoints[0].s;
  // reprises : débuts de niveau et points juste avant les passages difficiles, dans l'ordre
  track.retries = [...track.checkpoints.map((c) => ({ ...c, x: c.pc.x[Math.round(c.s / STEP)] })),
    ...RETRIES.map(({ piece, x }) => {
      const pc = p[piece];
      const s = indexWhere(pc, (i) => pc.x[i] >= x) * STEP;
      return { pc, s, x: pc.x[Math.round(s / STEP)] };
    })].sort((a, b) => a.x - b.x);
  track.ground = groundProfile(p);
  track.surface = surfaceProfile(track);
  track.grid = buildGrid(track.pieces);
  return track;
}

function indexWhere(pc, fn) {
  for (let i = 0; i < pc.n; i++) if (fn(i)) return i;
  return 0;
}

/** Trace une ligne dans un profil (max = point le plus bas, min = le plus haut). */
function rasterize(g, line, pick) {
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const x0 = Math.ceil(Math.min(ax, bx)), x1 = Math.floor(Math.max(ax, bx));
    for (let x = Math.max(0, x0); x <= Math.min(WORLD.w, x1); x++) {
      const y = bx === ax ? Math.max(ay, by) : ay + ((by - ay) * (x - ax)) / (bx - ax);
      g[x] = Number.isNaN(g[x]) ? y : pick(g[x], y);
    }
  }
}

/**
 * Le sol (haut de l'herbe) : point le plus bas de la route (les loopings sont au-dessus),
 * sauf sur la colline de la grande bosse, dont le dessus est le chemin du haut ;
 * le souterrain passe dessous.
 */
function groundProfile(p) {
  const low = new Float32Array(WORLD.w + 1).fill(NaN), top = new Float32Array(WORLD.w + 1).fill(NaN);
  // le sol : tout sauf les chemins du haut (grande bosse du niveau 4, ponts des aiguillages)
  for (const pc of Object.values(p)) if (pc.name !== 'hill' && !pc.platform && !BRIDGES.includes(pc.name)) rasterize(low, pc.line, Math.max);
  rasterize(top, p.hill.line, Math.min);
  const g = low;
  for (let x = HILL.x0; x <= HILL.x1; x++) g[x] = top[x];
  const yA = top[HILL.x1], yB = low[HILL.flank];
  for (let x = HILL.x1 + 1; x < HILL.flank; x++) {
    const t = (x - HILL.x1) / (HILL.flank - HILL.x1);
    g[x] = yA + (yB - yA) * (1 - (1 - t) ** 2);
  }
  let last = g.find((v) => !Number.isNaN(v));
  for (let i = 0; i <= WORLD.w; i++) if (Number.isNaN(g[i])) g[i] = last; else last = g[i];
  return g;
}

/**
 * La surface de la terre : le sol, ou le dessus d'une butte là où un chemin du haut passe
 * au-dessus (la grande bosse du niveau 4, le chemin du haut de chaque aiguillage). Sous la
 * butte, tout est de la terre ; le chemin du bas y passe en souterrain.
 */
function surfaceProfile(track) {
  const s = Float32Array.from(track.ground);
  for (const f of track.forks) {
    const deck = new Float32Array(WORLD.w + 1).fill(NaN);
    rasterize(deck, f.B.line, Math.max); // le tablier, sans les loopings posés dessus
    for (let x = 0; x <= WORLD.w; x++) if (deck[x] < s[x]) s[x] = deck[x];
  }
  return s;
}

export function surfaceY(track, px) {
  return track.surface[Math.max(0, Math.min(WORLD.w, Math.round(px)))];
}

export function groundY(track, px) {
  return track.ground[Math.max(0, Math.min(WORLD.w, Math.round(px)))];
}

/** Grille de cases de 64 px → segments [tronçon, indice], pour les atterrissages. */
const CELL = 64;
function buildGrid(pieces) {
  const map = new Map();
  for (const pc of pieces) {
    for (let i = 0; i < pc.n - 1; i++) {
      const x0 = Math.floor(Math.min(pc.x[i], pc.x[i + 1]) / CELL), x1 = Math.floor(Math.max(pc.x[i], pc.x[i + 1]) / CELL);
      const y0 = Math.floor(Math.min(pc.y[i], pc.y[i + 1]) / CELL), y1 = Math.floor(Math.max(pc.y[i], pc.y[i + 1]) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const key = cx * 1000 + cy;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push([pc, i]);
      }
    }
  }
  return map;
}

export function segmentsNear(tr, px, py) {
  const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL), out = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const list = tr.grid.get((cx + dx) * 1000 + cy + dy);
    if (list) out.push(...list);
  }
  return out;
}

/** Position, tangente et courbure interpolées à l'abscisse s d'un tronçon. */
export function sample(pc, s) {
  const f = Math.max(0, Math.min(pc.n - 1.0001, s / pc.step)), i = Math.floor(f), u = f - i;
  const lerp = (a) => a[i] + (a[i + 1] - a[i]) * u;
  let tx = lerp(pc.tx), ty = lerp(pc.ty);
  const l = Math.hypot(tx, ty) || 1;
  tx /= l; ty /= l;
  return { x: lerp(pc.x), y: lerp(pc.y), tx, ty, nx: ty, ny: -tx, k: lerp(pc.k), i };
}

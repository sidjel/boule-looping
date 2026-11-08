/**
 * Calque fixe de chaque feuille, au crayon : herbe (ou neige) en hachures, route au graphite
 * soulignée de brun (ou de glace), décor de la saison, ponts, fosses, flaques, arrivée.
 * Le dessin est découpé en étapes (générateur) : on peut le préparer petit à petit pendant
 * le jeu, sans à-coup ; buildInk() fait tout d'un coup.
 */
import { WORLD, SHEET, SHEETS, JUMPS, HILL, BRIDGE, BRIDGES, FINISH, BALL_R, surfaceY } from './track.js';
import { biomeOfSheet, biomeMix, biomeParams } from './biomes.js';
import { rng, range, pencilLine, hatch, grain } from './pencil.js';
import { paintEarth, groundPath } from './earth.js';
import { STYLE_SHEETS } from './ete.js';

const GRAPHITE = '#4b4b4f';
const GREY = '#8a8a8e';
const BROWN = '#9c6b55';
const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';

export function buildInk(track, q, sheet) {
  const steps = inkSteps(track, q, sheet);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** Étapes du dessin d'une feuille ; la dernière renvoie le canevas. */
export function* inkSteps(track, q, sheet) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(SHEET * q);
  c.height = Math.ceil(WORLD.h * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(-sheet * SHEET, 0);
  const x0 = sheet * SHEET - 120, x1 = (sheet + 1) * SHEET + 120, bio = (x) => biomeOfSheet(Math.floor(x / SHEET));
  // la terre du premier plan, tout en dessous
  const colour = STYLE_SHEETS.has(sheet); // été aux crayons de couleur (niveaux 2 et 3)
  yield* paintEarth(g, track, x0, x1, colour ? 'ete' : 'crayon');
  yield* drawGround(g, track, x0, x1, bio);
  drawUnderline(g, track, x0, x1, bio);
  yield;
  if (!colour) drawDecor(g, track, sheet); // en couleurs, le décor vient des dessins (ete.js)
  drawPits(g, track, x0, x1, bio);
  drawTunnels(g, track, x0, x1);
  if (sheet === SHEETS - 1) drawFinish(g, track);
  yield;
  drawRoad(g, track, x0, x1, bio, colour);
  drawPuddles(g, track, x0, x1);
  g.font = `600 44px ${HAND}`;
  g.fillStyle = 'rgba(70,70,76,0.55)';
  const b = biomeOfSheet(sheet);
  g.fillText(sheet === SHEETS - 1 ? 'arrivée' : `niveau ${sheet + 1} · ${b.name.toLowerCase()}`, sheet * SHEET + (sheet ? 110 : 60), 86);
  yield;
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.5);
  // le grain a piqué la terre : on rebouche par-dessous avec la couleur du papier du dessin,
  // pour qu'elle reste opaque (rien de l'arrière-plan ne passe à travers)
  g.setTransform(q, 0, 0, q, -sheet * SHEET * q, 0);
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#e4ddd3';
  groundPath(g, track, x0, x1);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  return c;
}

/**
 * Le sol (la terre du dessin est peinte à part, earth.js) : en hiver, de la neige
 * par-dessus avec des hachures bleutées.
 */
function* drawGround(g, track, x0, x1, bio) {
  // neige : on blanchit d'abord le sol, en fondu à l'arrivée de l'hiver et au dégel
  g.save();
  for (let x = Math.max(0, x0); x <= Math.min(WORLD.w, x1); x += 6) {
    const snow = biomeParams(x).snow;
    if (snow <= 0.02) continue;
    g.fillStyle = `rgba(252,253,255,${0.9 * snow})`;
    const y = surfaceY(track, x) - 2;
    g.fillRect(x, y, 6.5, WORLD.h + 40 - y);
  }
  g.restore();
  const rand = rng(2024);
  let x = -20, i = 0, n = 0;
  while (x < WORLD.w + 40) {
    const r = rng(5000 + i++);
    if (x > x0 && x < x1 && biomeParams(x).snow > 0.5) {
      // près d'une jonction, les couleurs des deux saisons se mélangent peu à peu
      const m = biomeMix(x), b = r() < m.t ? m.b : m.a, cols = b.grass;
      const top = surfaceY(track, x) + range(r, 4, 22);
      const lean = range(r, 18, 55);
      const col = cols[Math.floor(r() * cols.length)];
      const bottom = WORLD.h + 30 - (r() < 0.15 ? range(r, 40, 160) : 0);
      const light = b.snow ? 0.55 : 1;
      if (!b.snow || r() < 0.55) {
        hatch(g, r, x - lean, bottom, x, top, { color: col, width: col === GREY ? 2.4 : 3, alpha: (col === GREY ? 0.42 : 0.55) * light, passes: 2, wobble: 1.2 });
      }
      if (++n % 40 === 0) yield;
    }
    x += range(rand, 22, 44);
  }
}

/** Sous la route : ombre brune (glace bleutée en hiver). */
function drawUnderline(g, track, x0, x1, bio) {
  const under = [], rand = rng(99);
  let color = BROWN;
  const flush = () => {
    if (under.length > 4) pencilLine(g, under, rand, { color, width: 7, alpha: 0.32, passes: 3, wobble: 2.4 });
    under.length = 0;
  };
  for (const pc of track.pieces) {
    for (const [px, py] of pc.line) {
      if (px < x0 || px > x1) { flush(); continue; }
      const prev = under[under.length - 1], c = biomeParams(px).snow > 0.5 ? '#9fb7c9' : BROWN;
      if ((prev && Math.hypot(prev[0] - px, prev[1] - 6 - py) > 8) || c !== color) flush();
      color = c;
      if (Math.abs(surfaceY(track, px) - py) < 2) under.push([px, py + 6]);
      else flush();
    }
    flush();
  }
}

/** La route au graphite ; en hiver, une couche de glace bleutée avec des reflets blancs. */
function drawRoad(g, track, x0, x1, bio, colour = false) {
  track.pieces.forEach((pc, i) => {
    const pts = pc.line.filter(([x]) => x > x0 - 30 && x < x1 + 30);
    if (pts.length < 2) return;
    const icy = pts.filter(([x]) => biomeParams(x).snow > 0.5);
    if (icy.length > 2) {
      pencilLine(g, icy, rng(300 + i), { color: '#9cc3e0', width: 10, alpha: 0.5, passes: 2, wobble: 1.2 });
      const r = rng(400 + i);
      for (let j = 0; j < icy.length - 8; j += 14) {
        if (r() < 0.5) continue;
        const [ax, ay] = icy[j], [bx, by] = icy[j + 5];
        pencilLine(g, [[ax, ay - 3], [bx, by - 3]], r, { color: '#ffffff', width: 2.2, alpha: 0.8, passes: 1, wobble: 0.3 });
      }
    }
    pencilLine(g, pc.line, rng(77 + i * 10), { color: colour ? '#4a3426' : GRAPHITE, width: 5.5, alpha: 0.55, passes: 4, wobble: 1.8 });
    pencilLine(g, pc.line, rng(78 + i * 10), { color: colour ? '#2a1d15' : '#2f2f33', width: 2.2, alpha: 0.45, passes: 2, wobble: 1 });
  });
}

/** Fosses des tremplins : cailloux au fond, ou eau quand il pleut. */
function drawPits(g, track, x0, x1, bio) {
  JUMPS.forEach((J, z) => {
    const [a, b] = J.pit;
    if (b < x0 || a > x1) return;
    const rand = rng(404 + z);
    if (biomeParams(a).rain > 0.5) {
      const level = J.bottom - 60, pts = [];
      for (let x = a; x <= b; x += 4) if (surfaceY(track, x) > level) pts.push([x, surfaceY(track, x)]);
      if (pts.length < 3) return;
      g.save();
      g.fillStyle = 'rgba(110,150,185,0.45)';
      g.beginPath();
      g.moveTo(pts[0][0], level);
      for (const p of pts) g.lineTo(p[0], p[1] + 4);
      g.lineTo(pts[pts.length - 1][0], level);
      g.closePath();
      g.fill();
      g.restore();
      for (let y = level + 8; y < J.bottom; y += 12) {
        const w = pts.filter((p) => p[1] > y);
        if (w.length > 2) hatch(g, rand, w[0][0] + 6, y, w[w.length - 1][0] - 6, y + 2, { color: '#5f86a8', width: 1.8, alpha: 0.4, passes: 1, wobble: 1 });
      }
      pencilLine(g, [[pts[0][0], level], [pts[pts.length - 1][0], level]], rand, { color: '#4f7598', width: 2.4, alpha: 0.6, passes: 2, wobble: 1.5 });
      return;
    }
    for (let i = 0; i < 9; i++) {
      const x = range(rand, a + 60, b - 60), y = surfaceY(track, x) + range(rand, 10, 40);
      const rx = range(rand, 8, 18), ry = rx * range(rand, 0.5, 0.75), pts = [];
      for (let t = 0; t <= Math.PI * 2.1; t += 0.35) pts.push([x + Math.cos(t) * rx, y + Math.sin(t) * ry]);
      pencilLine(g, pts, rand, { color: '#6b6b70', width: 2, alpha: 0.5, passes: 2, wobble: 0.8 });
    }
  });
}

/** Flaques : nappe d'eau bleue posée sur la route (par-dessus), reflets et contour au crayon. */
function drawPuddles(g, track, x0, x1) {
  track.pieces.forEach((pc) => {
    for (const d of pc.puddles) {
      if (d.deep || d.x1 < x0 || d.x0 > x1) continue;
      const rand = rng(Math.round(d.x0));
      const top = [], bottom = [];
      for (let x = d.x0 - 30; x <= d.x1 + 30; x += 6) {
        const t = Math.min(1, (x - d.x0 + 30) / 40, (d.x1 + 30 - x) / 40), y = roadY(pc, x, d.y);
        top.push([x, y - 13 * t]);
        bottom.push([x, y + 7 * t]);
      }
      const shape = [...top, ...bottom.reverse()];
      g.save();
      g.fillStyle = 'rgba(80,130,180,0.55)';
      g.beginPath();
      shape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.restore();
      pencilLine(g, top, rand, { color: '#3f6b92', width: 2.6, alpha: 0.7, passes: 2, wobble: 0.8 });
      for (let i = 0; i < 4; i++) {
        const cx = range(rand, d.x0, d.x1), w = range(rand, 20, 50), y = roadY(pc, cx, d.y) - range(rand, 4, 9);
        pencilLine(g, [[cx, y], [cx + w, y]], rand, { color: '#ffffff', width: 2.2, alpha: 0.75, passes: 1, wobble: 0.4 });
      }
    }
  });
}

/** Hauteur de la ligne de route d'un tronçon en x, près de la hauteur de la flaque (pas dans un looping voisin). */
function roadY(pc, x, yRef) {
  let best = null;
  for (const p of pc.line) {
    if (Math.abs(p[1] - yRef) > 60) continue;
    if (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  }
  return best ? best[1] : yRef;
}

/** Ne pas planter un arbre au milieu d'un looping, d'un pont ou d'une fosse. */
function freeSpot(track, x) {
  for (const pc of track.pieces) {
    for (const top of pc.loopTops) {
      const i = Math.round(top / pc.step);
      if (Math.abs(pc.x[i] - x) < 330) return false;
    }
  }
  for (const f of track.forks) if (x > f.x - 120 && x < f.after.x[0] + 60) return false;
  for (const J of JUMPS) if (x > J.x0 - 260 && x < J.pitEnd + 60) return false;
  return true;
}

/** Décor de la saison : buissons, arbres, fleurs ; arbres roux ; sapins enneigés ; roseaux. */
function drawDecor(g, track, sheet) {
  const b = biomeOfSheet(sheet), r = rng(1234 + sheet * 97);
  const count = b.rain ? 6 : 7;
  for (let i = 0; i < count; i++) {
    const x = sheet * SHEET + range(r, 140, 1860);
    if (!freeSpot(track, x)) continue;
    const y = surfaceY(track, x) + 6, kind = r(), m = biomeMix(x), here = r() < m.t ? m.b : m.a;
    if (here.snow) pine(g, r, x, y, range(r, 120, 230));
    else if (here.rain) reeds(g, r, x, y);
    else if (here.wind) tree(g, r, x, y, range(r, 150, 260), ['#c9772d', '#b5502a', '#d9a23a']);
    else if (kind < 0.4) tree(g, r, x, y, range(r, 160, 270), ['#6fa83a', '#8cbd4f', '#5d9431']);
    else if (kind < 0.8) bush(g, r, x, y, range(r, 40, 70), ['#6fa83a', '#8cbd4f']);
    else flowers(g, r, x, y);
  }
  if (b.wind) {
    // feuilles mortes tombées au sol
    for (let i = 0; i < 40; i++) {
      const x = sheet * SHEET + range(r, 0, SHEET), y = surfaceY(track, x) + range(r, 6, 40);
      hatch(g, r, x, y, x + range(r, 8, 14), y + range(r, -3, 3), { color: ['#c9772d', '#b5502a', '#d9a23a'][i % 3], width: 4, alpha: 0.55, passes: 1, wobble: 0.3 });
    }
  }
}

/** Feuillage gribouillé : une suite de petites boucles qui se promènent dans une ellipse. */
function scribble(g, r, cx, cy, rx, ry, color, n = 26) {
  const pts = [], loop = Math.min(rx, ry) * 0.32;
  let px = cx, py = cy;
  for (let i = 0; i < n * 5; i++) {
    const a = i * 0.55;
    px += (cx + Math.cos(i * 0.17 + r() * 0.6) * rx * 0.62 - px) * 0.12;
    py += (cy + Math.sin(i * 0.23 + r() * 0.6) * ry * 0.62 - py) * 0.12;
    pts.push([px + Math.cos(a) * loop, py + Math.sin(a) * loop * 0.9]);
  }
  pencilLine(g, pts, r, { color, width: 2.6, alpha: 0.5, passes: 1, wobble: 0.8 });
}

function tree(g, r, x, y, h, cols) {
  pencilLine(g, [[x - 5, y], [x - 3, y - h * 0.55]], r, { color: '#7a5a3c', width: 5, alpha: 0.6, passes: 3, wobble: 1 });
  pencilLine(g, [[x + 6, y], [x + 4, y - h * 0.55]], r, { color: '#7a5a3c', width: 4, alpha: 0.5, passes: 2, wobble: 1 });
  for (let i = 0; i < 4; i++) scribble(g, r, x + range(r, -h * 0.22, h * 0.22), y - h * range(r, 0.6, 0.85), h * 0.28, h * 0.22, cols[i % cols.length]);
}

function bush(g, r, x, y, s, cols) {
  for (let i = 0; i < 3; i++) scribble(g, r, x + (i - 1) * s * 0.6, y - s * 0.45, s * 0.55, s * 0.45, cols[i % cols.length], 18);
}

function flowers(g, r, x, y) {
  for (let i = 0; i < 6; i++) {
    const fx = x + range(r, -50, 50), h = range(r, 25, 50);
    pencilLine(g, [[fx, y], [fx + range(r, -4, 4), y - h]], r, { color: '#6fa83a', width: 2, alpha: 0.6, passes: 1, wobble: 0.5 });
    g.fillStyle = ['rgba(230,90,110,0.7)', 'rgba(250,200,60,0.75)', 'rgba(170,120,220,0.65)'][i % 3];
    g.beginPath();
    g.arc(fx, y - h, 6, 0, Math.PI * 2);
    g.fill();
  }
}

function pine(g, r, x, y, h) {
  pencilLine(g, [[x, y], [x, y - h * 0.25]], r, { color: '#6b513a', width: 5, alpha: 0.6, passes: 2, wobble: 0.6 });
  for (let k = 0; k < 3; k++) {
    const by = y - h * (0.2 + k * 0.25), w = h * (0.36 - k * 0.08), ty = by - h * 0.38;
    pencilLine(g, [[x - w, by], [x, ty], [x + w, by], [x - w, by]], r, { color: '#3f6b4a', width: 3, alpha: 0.55, passes: 2, wobble: 1 });
    for (let j = 0; j < 6; j++) hatch(g, r, x - w * 0.7 + j * w * 0.28, by - 4, x - w * 0.2 + j * w * 0.18, ty + 10, { color: '#4f7d58', width: 2, alpha: 0.35, passes: 1, wobble: 0.5 });
    pencilLine(g, [[x - w * 0.5, by - h * 0.12], [x, ty + 4], [x + w * 0.5, by - h * 0.12]], r, { color: '#ffffff', width: 5, alpha: 0.85, passes: 1, wobble: 0.6 });
  }
}

function reeds(g, r, x, y) {
  for (let i = 0; i < 7; i++) {
    const fx = x + range(r, -40, 40), h = range(r, 60, 120), bend = range(r, -18, 18);
    pencilLine(g, [[fx, y], [fx + bend * 0.4, y - h * 0.6], [fx + bend, y - h]], r, { color: '#5e7a4a', width: 2.4, alpha: 0.6, passes: 1, wobble: 0.6 });
    if (i % 2) pencilLine(g, [[fx + bend * 0.8, y - h * 0.85], [fx + bend, y - h * 0.65]], r, { color: '#7a5a3c', width: 6, alpha: 0.6, passes: 1, wobble: 0.3 });
  }
}

/** Arrivée : arc-en-ciel et banderole à damier sur deux poteaux. */
function drawFinish(g, track) {
  const x = FINISH.x, y = surfaceY(track, x), r = rng(1717);
  const cols = ['#e5534b', '#f0a03c', '#f2d24a', '#7fbf4d', '#5b9bd5', '#7b6cc4'];
  cols.forEach((c, i) => {
    const pts = [];
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.04) pts.push([x + 260 + Math.cos(a) * (620 - i * 22), 1000 + Math.sin(a) * (560 - i * 22)]);
    pencilLine(g, pts, r, { color: c, width: 14, alpha: 0.28, passes: 2, wobble: 2 });
  });
  for (const dx of [-110, 110]) pencilLine(g, [[x + dx, y], [x + dx, y - 300]], r, { color: GRAPHITE, width: 5, alpha: 0.7, passes: 3, wobble: 0.8 });
  for (let i = 0; i < 11; i++) for (let j = 0; j < 2; j++) {
    if ((i + j) % 2) continue;
    g.fillStyle = 'rgba(50,50,56,0.7)';
    g.fillRect(x - 110 + i * 20, y - 300 + j * 20, 20, 20);
  }
  g.strokeStyle = 'rgba(50,50,56,0.7)';
  g.lineWidth = 3;
  g.strokeRect(x - 110, y - 300, 220, 40);
  g.font = `600 52px ${HAND}`;
  g.fillStyle = 'rgba(60,60,66,0.75)';
  g.fillText('Arrivée', x - 95, y - 330);
}

/**
 * Chemins du bas qui passent sous une butte : une galerie creusée dans la terre (plus
 * sombre), avec son plafond au crayon. Elle suit tout le chemin, loopings compris : là où
 * un looping entre dans la butte, la galerie tourne avec lui. Hors de la terre, rien.
 */
function drawTunnels(g, track, x0, x1) {
  const h = BALL_R * 2 + 18, rand = rng(606);
  for (const f of track.forks) {
    const line = f.A.line;
    if (line[line.length - 1][0] < x0 || line[0][0] > x1) continue;
    // la butte recouvre-t-elle ce chemin quelque part ?
    const covered = line.filter(([x, y]) => surfaceY(track, x) < y - 8);
    if (covered.length < 3) continue;
    const xa = Math.min(...covered.map((p) => p[0])) - 60, xb = Math.max(...covered.map((p) => p[0])) + 60;
    let ia = line.findIndex(([x]) => x >= xa), ib = line.length - 1;
    while (ib > ia && line[ib][0] > xb) ib--;
    // côté de la boule : normale à gauche du sens de la marche
    const off = (d) => {
      const out = [];
      for (let i = ia; i <= ib; i++) {
        const a = line[Math.max(ia, i - 2)], b = line[Math.min(ib, i + 2)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        out.push([line[i][0] + ((b[1] - a[1]) / l) * d, line[i][1] - ((b[0] - a[0]) / l) * d]);
      }
      return out;
    };
    const stroke = (pts, width, color) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineWidth = width;
      g.strokeStyle = color;
      g.stroke();
    };
    g.save();
    earthClip(g, track, xa - 300, xb + 300);
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    // le creux de la galerie, puis l'ombre sous le plafond
    stroke(off(h / 2 - 3), h + 6, 'rgba(78,54,38,0.38)');
    stroke(off(h - 9), 18, 'rgba(60,40,28,0.18)');
    // plafond au crayon, seulement dans la terre
    const ceil = off(h).filter(([x, y]) => surfaceY(track, x) < y - 4);
    let run = [];
    const flush = () => {
      if (run.length > 2) pencilLine(g, run, rand, { color: '#4b3a2e', width: 3, alpha: 0.55, passes: 2, wobble: 1.2 });
      run = [];
    };
    for (const p of ceil) {
      const q = run[run.length - 1];
      if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) > 12) flush();
      run.push(p);
    }
    flush();
    g.restore();
  }
}

/** Ne dessine que dans la terre (sous la surface). */
function earthClip(g, track, x0, x1) {
  groundPath(g, track, x0, x1);
  g.clip();
}

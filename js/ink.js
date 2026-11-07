/**
 * Calque fixe de chaque feuille, au crayon : herbe (ou neige) en hachures, route au graphite
 * soulignée de brun (ou de glace), décor de la saison, ponts, fosses, flaques, arrivée.
 * Le dessin est découpé en étapes (générateur) : on peut le préparer petit à petit pendant
 * le jeu, sans à-coup ; buildInk() fait tout d'un coup.
 */
import { WORLD, SHEET, SHEETS, JUMPS, HILL, BRIDGE, BRIDGES, FINISH, BALL_R, groundY } from './track.js';
import { biomeOfSheet } from './biomes.js';
import { rng, range, pencilLine, hatch, grain } from './pencil.js';

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
  yield* drawGround(g, track, x0, x1, bio);
  drawUnderline(g, track, x0, x1, bio);
  yield;
  drawDecor(g, track, sheet);
  drawPits(g, track, x0, x1, bio);
  if (x1 > HILL.x0 && x0 < HILL.flank + 600) {
    drawTunnel(g, track);
    drawBridge4(g, track);
  }
  for (const name of BRIDGES) drawBridge(g, track, track.byName[name], x0, x1);
  if (sheet === SHEETS - 1) drawFinish(g, track);
  yield;
  drawRoad(g, track, x0, x1, bio);
  drawPuddles(g, track, x0, x1);
  g.font = `600 44px ${HAND}`;
  g.fillStyle = 'rgba(70,70,76,0.55)';
  const b = biomeOfSheet(sheet);
  g.fillText(sheet === SHEETS - 1 ? 'arrivée' : `niveau ${sheet + 1} · ${b.name.toLowerCase()}`, sheet * SHEET + (sheet ? 110 : 60), 86);
  yield;
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.5);
  return c;
}

/** Herbe en hachures (couleurs de la saison) ; en hiver, neige blanche et hachures bleutées. */
function* drawGround(g, track, x0, x1, bio) {
  // neige : on blanchit d'abord le sol
  const snowy = [];
  for (let x = Math.max(0, x0); x <= Math.min(WORLD.w, x1); x += 6) if (bio(x).snow) snowy.push(x);
  if (snowy.length) {
    g.save();
    g.fillStyle = 'rgba(252,253,255,0.9)';
    g.beginPath();
    g.moveTo(snowy[0], WORLD.h + 40);
    for (const x of snowy) g.lineTo(x, groundY(track, x) - 2);
    g.lineTo(snowy[snowy.length - 1], WORLD.h + 40);
    g.closePath();
    g.fill();
    g.restore();
  }
  const rand = rng(2024);
  let x = -20, i = 0, n = 0;
  while (x < WORLD.w + 40) {
    const r = rng(5000 + i++);
    if (x > x0 && x < x1) {
      const b = bio(x), cols = b.grass;
      const top = groundY(track, x) + range(r, 4, 22);
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

/** Sous la route : ombre brune (glace bleutée en hiver), et quelques zones gribouillées. */
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
      const prev = under[under.length - 1], c = bio(px).road ? '#9fb7c9' : BROWN;
      if ((prev && Math.hypot(prev[0] - px, prev[1] - 6 - py) > 8) || c !== color) flush();
      color = c;
      if (Math.abs(groundY(track, px) - py) < 2) under.push([px, py + 6]);
      else flush();
    }
    flush();
  }
  if (x0 < HILL.flank && x1 > HILL.x1) {
    const flank = [];
    for (let x = HILL.x1; x <= HILL.flank; x += 3) flank.push([x, groundY(track, x)]);
    pencilLine(g, flank, rand, { color: GRAPHITE, width: 3.5, alpha: 0.45, passes: 3, wobble: 1.4 });
  }
  // gribouillis bruns sous le sol, deux ou trois par feuille
  for (let k = Math.floor(Math.max(0, x0) / SHEET); k <= Math.floor(x1 / SHEET); k++) {
    const r = rng(9000 + k * 31);
    if (biomeOfSheet(k).snow) continue;
    for (let z = 0; z < 3; z++) {
      const a = k * SHEET + range(r, 100, 1700), w = range(r, 150, 260), depth = range(r, 26, 60);
      for (let i = 0; i < w / 9; i++) {
        const x = range(r, a, a + w), len = range(r, 40, 120);
        if (x + len < x0 || x > x1) continue;
        const y0 = groundY(track, x) + range(r, 4, depth), y1 = groundY(track, x + len) + range(r, 4, depth);
        hatch(g, r, x, y0, x + len, y1, { color: r() < 0.7 ? BROWN : '#b4786a', width: 2, alpha: 0.28, passes: 1, wobble: 1 });
      }
    }
  }
}

/** La route au graphite ; en hiver, une couche de glace bleutée avec des reflets blancs. */
function drawRoad(g, track, x0, x1, bio) {
  track.pieces.forEach((pc, i) => {
    const pts = pc.line.filter(([x]) => x > x0 - 30 && x < x1 + 30);
    if (pts.length < 2) return;
    const icy = pts.filter(([x]) => bio(x).road);
    if (icy.length > 2) {
      pencilLine(g, icy, rng(300 + i), { color: '#9cc3e0', width: 10, alpha: 0.5, passes: 2, wobble: 1.2 });
      const r = rng(400 + i);
      for (let j = 0; j < icy.length - 8; j += 14) {
        if (r() < 0.5) continue;
        const [ax, ay] = icy[j], [bx, by] = icy[j + 5];
        pencilLine(g, [[ax, ay - 3], [bx, by - 3]], r, { color: '#ffffff', width: 2.2, alpha: 0.8, passes: 1, wobble: 0.3 });
      }
    }
    pencilLine(g, pc.line, rng(77 + i * 10), { color: GRAPHITE, width: 5.5, alpha: 0.55, passes: 4, wobble: 1.8 });
    pencilLine(g, pc.line, rng(78 + i * 10), { color: '#2f2f33', width: 2.2, alpha: 0.45, passes: 2, wobble: 1 });
  });
}

/** Fosses des tremplins : cailloux au fond, ou eau quand il pleut. */
function drawPits(g, track, x0, x1, bio) {
  JUMPS.forEach((J, z) => {
    const [a, b] = J.pit;
    if (b < x0 || a > x1) return;
    const rand = rng(404 + z);
    if (bio(a).rain) {
      const level = J.bottom - 60, pts = [];
      for (let x = a; x <= b; x += 4) if (groundY(track, x) > level) pts.push([x, groundY(track, x)]);
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
      const x = range(rand, a + 60, b - 60), y = groundY(track, x) + range(rand, 10, 40);
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

/** Ponts des aiguillages : tablier sous le chemin du haut, piliers jusqu'au sol. */
function drawBridge(g, track, pc, x0, x1) {
  if (!pc) return;
  const rand = rng(700 + Math.round(pc.line[0][0]));
  const high = pc.line.filter(([x, y]) => x > x0 && x < x1 && groundY(track, x) - y > 45);
  if (high.length < 3) return;
  pencilLine(g, high.map(([x, y]) => [x, y + 16]), rand, { color: GRAPHITE, width: 3, alpha: 0.5, passes: 2, wobble: 1 });
  for (let i = 0; i < high.length; i += 12) {
    const [x, y] = high[i];
    hatch(g, rand, x, y + 4, x + 14, y + 14, { color: GREY, width: 1.6, alpha: 0.4, passes: 1, wobble: 0.4 });
  }
  let last = -1e9;
  for (const [x, y] of high) {
    if (x - last < 260 || groundY(track, x) - y < 90) continue;
    last = x;
    const top = y + 14, bottom = groundY(track, x) + 6;
    for (const dx of [-9, 9]) pencilLine(g, [[x + dx, top], [x + dx * 1.3, bottom]], rand, { color: GRAPHITE, width: 3, alpha: 0.5, passes: 2, wobble: 0.8 });
    for (let yy = top + 30; yy < bottom - 20; yy += 46) {
      hatch(g, rand, x - 9, yy, x + 9, yy + 30, { color: GREY, width: 1.6, alpha: 0.45, passes: 1, wobble: 0.4 });
      hatch(g, rand, x + 9, yy, x - 9, yy + 30, { color: GREY, width: 1.6, alpha: 0.45, passes: 1, wobble: 0.4 });
    }
  }
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
    const y = groundY(track, x) + 6, kind = r();
    if (b.snow) pine(g, r, x, y, range(r, 120, 230));
    else if (b.rain) reeds(g, r, x, y);
    else if (b.wind) tree(g, r, x, y, range(r, 150, 260), ['#c9772d', '#b5502a', '#d9a23a']);
    else if (kind < 0.4) tree(g, r, x, y, range(r, 160, 270), ['#6fa83a', '#8cbd4f', '#5d9431']);
    else if (kind < 0.8) bush(g, r, x, y, range(r, 40, 70), ['#6fa83a', '#8cbd4f']);
    else flowers(g, r, x, y);
  }
  if (b.wind) {
    // feuilles mortes tombées au sol
    for (let i = 0; i < 40; i++) {
      const x = sheet * SHEET + range(r, 0, SHEET), y = groundY(track, x) + range(r, 6, 40);
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
  const x = FINISH.x, y = groundY(track, x), r = rng(1717);
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
 * Souterrain : le chemin du bas traverse la colline. On creuse un tube dans l'herbe
 * (plafond à une boule et demie au-dessus de la route), terre hachurée autour.
 */
function drawTunnel(g, track) {
  const pc = track.byName.under, floor = [], ceil = [];
  const h = BALL_R * 2 + 18;
  for (let i = 0; i < pc.line.length; i += 2) {
    const [x, y] = pc.line[i];
    if (x < HILL.x0 + 40 || x > HILL.flank + 10) continue;
    const j = Math.min(pc.line.length - 1, i + 2), [bx, by] = pc.line[j];
    const l = Math.hypot(bx - x, by - y) || 1, nx = (by - y) / l, ny = -(bx - x) / l;
    floor.push([x, y]);
    ceil.push([x + nx * h, y + ny * h]);
  }
  if (floor.length < 3) return;
  const tube = [...floor, ...ceil.slice().reverse()];
  g.save();
  // seulement sous la surface de la colline : l'entrée devient une ouverture dans la pente
  g.beginPath();
  g.moveTo(HILL.x0, WORLD.h + 50);
  for (let x = HILL.x0; x <= HILL.flank + 40; x += 4) g.lineTo(x, groundY(track, x) + 3);
  g.lineTo(HILL.flank + 40, WORLD.h + 50);
  g.closePath();
  g.clip();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  tube.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(120,104,88,0.16)';
  g.fill();
  g.restore();
  const rand = rng(606);
  // terre hachurée au-dessus du plafond, ombre au fond du tube
  for (let i = 0; i < ceil.length; i += 3) {
    const [x, y] = ceil[i];
    if (y < groundY(track, x) + 8) continue;
    hatch(g, rand, x - 8, y - range(rand, 4, 26), x + 10, y - 2, { color: BROWN, width: 2, alpha: 0.32, passes: 1, wobble: 0.6 });
  }
  const inside = ceil.filter(([x, y]) => y > groundY(track, x) + 4);
  if (inside.length > 2) pencilLine(g, inside, rand, { color: '#5b4f45', width: 3, alpha: 0.5, passes: 3, wobble: 1.2 });
}

/** Pont du niveau 4, au-dessus du grand looping : tablier et piliers. */
function drawBridge4(g, track) {
  const pc = track.byName.hill, rand = rng(707);
  const yAt = (x) => {
    let best = pc.line[0];
    for (const p of pc.line) if (p[0] >= BRIDGE.x0 - 60 && Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    return best[1];
  };
  const deck = pc.line.filter(([x]) => x >= BRIDGE.x0 && x <= BRIDGE.x1).map(([x, y]) => [x, y + 16]);
  pencilLine(g, deck, rand, { color: GRAPHITE, width: 3, alpha: 0.5, passes: 2, wobble: 1 });
  for (let x = BRIDGE.x0 + 20; x < BRIDGE.x1; x += 34) {
    hatch(g, rand, x, yAt(x) + 4, x + 14, yAt(x) + 14, { color: GREY, width: 1.6, alpha: 0.4, passes: 1, wobble: 0.4 });
  }
  for (const px of BRIDGE.pillars) {
    const top = yAt(px) + 14, bottom = groundY(track, px) + 6;
    for (const dx of [-9, 9]) pencilLine(g, [[px + dx, top], [px + dx * 1.3, bottom]], rand, { color: GRAPHITE, width: 3, alpha: 0.5, passes: 2, wobble: 0.8 });
    for (let y = top + 30; y < bottom - 20; y += 46) {
      hatch(g, rand, px - 9, y, px + 9, y + 30, { color: GREY, width: 1.6, alpha: 0.45, passes: 1, wobble: 0.4 });
      hatch(g, rand, px + 9, y, px - 9, y + 30, { color: GREY, width: 1.6, alpha: 0.45, passes: 1, wobble: 0.4 });
    }
  }
}


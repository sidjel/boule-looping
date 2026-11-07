/**
 * Décor d'après le dessin : deux feuilles (un niveau chacune), herbe en hachures vertes
 * et grises, route au graphite soulignée de brun, soleil jaune qui rayonne.
 * Les nuages et les oiseaux sont dans clouds.js.
 */
import { WORLD, SHEET, LEVELS, PIT, HILL, BRIDGE, BALL_R, groundY } from './track.js';
import { rng, range, pencilLine, hatch, grain, noiseTile } from './pencil.js';

const GRAPHITE = '#4b4b4f';
const GREEN = '#7fb346';
const GREY = '#8a8a8e';
const BROWN = '#9c6b55';
const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';

/**
 * Calque fixe d'une feuille (herbe, route), dessiné une fois à l'échelle q, fond transparent.
 * Chaque trait a son propre hasard : les deux feuilles se raccordent trait pour trait.
 */
export function buildInk(track, q, sheet) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(SHEET * q);
  c.height = Math.ceil(WORLD.h * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(-sheet * SHEET, 0);
  const x0 = sheet * SHEET - 120, x1 = (sheet + 1) * SHEET + 120;
  drawGrass(g, track, x0, x1);
  drawBrown(g, track, x0, x1);
  drawPit(g, track);
  if (x1 > HILL.x0) {
    drawTunnel(g, track);
    drawBridge(g, track);
  }
  track.pieces.forEach((pc, i) => {
    pencilLine(g, pc.line, rng(77 + i * 10), { color: GRAPHITE, width: 5.5, alpha: 0.55, passes: 4, wobble: 1.8 });
    pencilLine(g, pc.line, rng(78 + i * 10), { color: '#2f2f33', width: 2.2, alpha: 0.45, passes: 2, wobble: 1 });
  });
  g.font = `600 44px ${HAND}`;
  g.fillStyle = 'rgba(70,70,76,0.55)';
  g.fillText(`niveau ${sheet + 1}`, sheet * SHEET + (sheet ? 110 : 60), 86);
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.5);
  return c;
}

function drawGrass(g, track, x0, x1) {
  const rand = rng(2024);
  let x = -20, i = 0;
  while (x < WORLD.w + 40) {
    const r = rng(5000 + i++);
    if (x > x0 && x < x1) {
      const top = groundY(track, x) + range(r, 4, 22);
      const lean = range(r, 18, 55);
      const green = r() < 0.55;
      const bottom = WORLD.h + 30 - (r() < 0.15 ? range(r, 40, 160) : 0);
      hatch(g, r, x - lean, bottom, x, top, {
        color: green ? GREEN : GREY, width: green ? 3 : 2.4, alpha: green ? 0.55 : 0.42, passes: 2, wobble: 1.2,
      });
    }
    x += range(rand, 22, 44);
  }
}

/** Ombre brune sous la route et quelques zones gribouillées, comme sur la feuille. */
function drawBrown(g, track, x0, x1) {
  const under = [], rand = rng(99);
  for (const pc of track.pieces) {
    for (const [px, py] of pc.line) {
      if (px < x0 || px > x1) { flush(); continue; }
      const prev = under[under.length - 1];
      if (prev && Math.hypot(prev[0] - px, prev[1] - 6 - py) > 8) flush();
      if (Math.abs(groundY(track, px) - py) < 2) under.push([px, py + 6]);
      else flush();
    }
    flush();
  }
  // flanc de la colline, sous le début du pont
  const flank = [];
  for (let x = HILL.x1; x <= HILL.flank; x += 3) flank.push([x, groundY(track, x)]);
  pencilLine(g, flank, rand, { color: GRAPHITE, width: 3.5, alpha: 0.45, passes: 3, wobble: 1.4 });
  function flush() {
    if (under.length > 4) pencilLine(g, under, rand, { color: BROWN, width: 7, alpha: 0.32, passes: 3, wobble: 2.4 });
    under.length = 0;
  }
  const patches = [[380, 640, 26], [1110, 1330, 34], [1500, 1700, 70], [1860, 2000, 40],
    [2300, 2560, 30], [3040, 3220, 50], [3420, 3600, 40], [3880, 4000, 36],
    [4250, 4420, 30], [5250, 5450, 40], [5700, 5950, 30], [6500, 6800, 60], [7050, 7170, 40], [7500, 7700, 30]];
  patches.forEach(([a, b, depth], k) => {
    for (let i = 0; i < (b - a) / 9; i++) {
      const r = rng(9000 + k * 100 + i);
      const x = range(r, a, b), len = range(r, 40, 120);
      if (x + len < x0 || x > x1) continue;
      const y0 = groundY(track, x) + range(r, 4, depth), y1 = groundY(track, x + len) + range(r, 4, depth);
      hatch(g, r, x, y0, x + len, y1, { color: r() < 0.7 ? BROWN : '#b4786a', width: 2, alpha: 0.28, passes: 1, wobble: 1 });
    }
  });
}

/** Quelques cailloux au fond de la fosse du tremplin. */
function drawPit(g, track) {
  const rand = rng(404);
  for (let i = 0; i < 9; i++) {
    const x = range(rand, PIT.x0 + 90, PIT.x1 - 90), y = groundY(track, x) + range(rand, 10, 40);
    const rx = range(rand, 8, 18), ry = rx * range(rand, 0.5, 0.75), pts = [];
    for (let a = 0; a <= Math.PI * 2.1; a += 0.35) pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    pencilLine(g, pts, rand, { color: '#6b6b70', width: 2, alpha: 0.5, passes: 2, wobble: 0.8 });
  }
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

/** Pont du chemin du haut, au-dessus du grand looping : tablier et piliers. */
function drawBridge(g, track) {
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

/** Papier un peu gris de la photo, son grain, un pli sur chaque feuille. */
export function makePaper() {
  const tile = noiseTile(160, 9, true);
  const folds = [[1500, 700, 1700, 560, 1300, 0, 900, 1100], [2500, 300, 2700, 160, 2000, -200, 1000, 1700],
    [5300, 900, 5500, 760, 5000, 300, 1000, 1200], [6400, 200, 6600, 60, 6000, -200, 1000, 1500]];
  return function drawPaper(ctx, w, h, cam) {
    ctx.fillStyle = '#e6e5e1';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
    for (let k = 0; k < LEVELS; k++) {
      if (k * SHEET > cam.x + cam.viewW || (k + 1) * SHEET < cam.x) continue;
      const cx = k * SHEET + 900;
      const light = ctx.createRadialGradient(cx, 600, 100, cx, 600, 1500);
      light.addColorStop(0, 'rgba(255,255,255,0.55)');
      light.addColorStop(1, 'rgba(160,158,150,0.25)');
      ctx.fillStyle = light;
      ctx.fillRect(k * SHEET - (k === 0 ? 3000 : 0), -12000, SHEET + 3000, WORLD.h + 14000);
      const [ax, ay, bx, by, rx, ry, rw, rh] = folds[k];
      const fold = ctx.createLinearGradient(ax, ay, bx, by);
      fold.addColorStop(0, 'rgba(255,255,255,0)');
      fold.addColorStop(0.45, 'rgba(255,255,255,0.16)');
      fold.addColorStop(0.52, 'rgba(120,118,112,0.07)');
      fold.addColorStop(0.75, 'rgba(255,255,255,0)');
      ctx.fillStyle = fold;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(-(cam.x * cam.scale) % 160, -(cam.y * cam.scale) % 160);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(-160, -160, w + 320, h + 320);
    ctx.restore();
  };
}

/** Disque du soleil hachuré en jaune, contour orangé. */
export function buildSunDisk(radius, q) {
  const rand = rng(31), size = radius * 2 + 20;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(size / 2, size / 2);
  g.fillStyle = 'rgba(240,206,80,0.55)';
  g.beginPath();
  g.arc(0, 0, radius, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.clip();
  for (let x = -radius * 1.6; x < radius * 1.6; x += 9) {
    hatch(g, rand, x, radius * 1.2, x + radius * 0.9, -radius * 1.2, { color: '#d9a920', width: 3.5, alpha: 0.4, passes: 1, wobble: 1 });
  }
  g.restore();
  const ring = [];
  for (let a = 0; a <= Math.PI * 2.05; a += 0.08) ring.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  pencilLine(g, ring, rand, { color: '#d99a1c', width: 3, alpha: 0.75, passes: 2, wobble: 1.2 });
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.3);
  return { canvas: c, size };
}

/** Rayons qui scintillent et tournent doucement, halo qui respire. */
export function drawSun(ctx, disk, cx, cy, radius, t) {
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 3.2);
  glow.addColorStop(0, `rgba(255,224,120,${0.32 + 0.08 * Math.sin(t * 1.7)})`);
  glow.addColorStop(1, 'rgba(255,224,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius * 3.2, cy - radius * 3.2, radius * 6.4, radius * 6.4);
  ctx.save();
  ctx.lineCap = 'round';
  const rays = 30;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + t * 0.05;
    const flick = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7);
    const r0 = radius * 1.18, r1 = radius * (1.75 + 0.45 * (i % 3 === 0) + 0.35 * flick);
    ctx.strokeStyle = i % 2 ? '#e8c24a' : '#f0d36a';
    ctx.globalAlpha = 0.35 + 0.45 * flick;
    ctx.lineWidth = 2.2 + (i % 3 === 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a + 0.01) * r1, cy + Math.sin(a + 0.01) * r1);
    ctx.stroke();
  }
  ctx.restore();
  const s = disk.size * (1 + 0.015 * Math.sin(t * 1.7));
  ctx.drawImage(disk.canvas, cx - s / 2, cy - s / 2, s, s);
}

/**
 * Table sous les feuilles (visible sur les côtés en vue d'ensemble) et raccord entre
 * les deux feuilles, tenu par deux morceaux de ruban adhésif. Repère du monde.
 */
export function drawTable(ctx, cam) {
  const left = cam.x, right = cam.x + cam.viewW, top = cam.y - 20, h = cam.viewH + 40;
  ctx.save();
  if (left < -3 || right > WORLD.w + 3) {
    ctx.fillStyle = '#b9b2a6';
    if (left < 0) ctx.fillRect(left - 10, top, -left + 10, h);
    if (right > WORLD.w) ctx.fillRect(WORLD.w, top, right - WORLD.w + 10, h);
    for (const [x0, dir] of [[0, -1], [WORLD.w, 1]]) {
      const shadow = ctx.createLinearGradient(x0, 0, x0 + dir * 40, 0);
      shadow.addColorStop(0, 'rgba(60,52,40,0.35)');
      shadow.addColorStop(1, 'rgba(60,52,40,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(Math.min(x0, x0 + dir * 40), top, 40, h);
    }
  }
  for (let k = 1; k < LEVELS; k++) {
    const x = k * SHEET;
    if (x < left - 60 || x > right + 60) continue;
    const seam = ctx.createLinearGradient(x - 14, 0, x + 2, 0);
    seam.addColorStop(0, 'rgba(70,64,55,0)');
    seam.addColorStop(1, 'rgba(70,64,55,0.22)');
    ctx.fillStyle = seam;
    ctx.fillRect(x - 14, 0, 16, WORLD.h);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x, 0, 2, WORLD.h);
    for (const [ty, rot] of [[70, -0.12], [1320, 0.09]]) {
      ctx.save();
      ctx.translate(x, ty);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(236,228,200,0.55)';
      ctx.strokeStyle = 'rgba(150,140,110,0.35)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-70, -22, 140, 44);
      ctx.strokeRect(-70, -22, 140, 44);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Où dessiner le panneau de l'aiguillage (repère du monde). */
export const SIGN = { x: 6200, y: 1000 };

/**
 * Aiguillage du niveau 4, dessiné à chaque image : panneau fléché vers le chemin choisi,
 * petite barrière en travers de l'autre chemin.
 */
export function drawFork(ctx, track, t) {
  const under = track.route === 'under';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = GRAPHITE;
  ctx.globalAlpha = 0.85;
  // poteau et pancarte
  const { x, y } = SIGN, base = groundY(track, x) + 4;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x + 1, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(244,240,228,0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(x - 62, y - 66, 124, 62);
  ctx.fill();
  ctx.stroke();
  const wob = Math.sin(t * 4) * 2;
  ctx.strokeStyle = under ? '#5b4f45' : '#4f7a2b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (under) {
    ctx.moveTo(x - 34, y - 52 + wob);
    ctx.lineTo(x + 26, y - 22 + wob);
    ctx.moveTo(x + 26, y - 22 + wob);
    ctx.lineTo(x + 2, y - 20 + wob);
    ctx.moveTo(x + 26, y - 22 + wob);
    ctx.lineTo(x + 20, y - 44 + wob);
  } else {
    ctx.moveTo(x - 34, y - 18 - wob);
    ctx.lineTo(x + 26, y - 50 - wob);
    ctx.moveTo(x + 26, y - 50 - wob);
    ctx.lineTo(x + 2, y - 52 - wob);
    ctx.moveTo(x + 26, y - 50 - wob);
    ctx.lineTo(x + 20, y - 28 - wob);
  }
  ctx.stroke();
  // barrière sur le chemin fermé
  const pc = under ? track.byName.hill : track.byName.under;
  const i = Math.min(pc.line.length - 3, under ? 46 : 40), [gx, gy] = pc.line[i], [hx, hy] = pc.line[i + 2];
  const l = Math.hypot(hx - gx, hy - gy) || 1, nx = (hy - gy) / l, ny = -(hx - gx) / l;
  ctx.strokeStyle = '#8a3b2e';
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + nx * 70, gy + ny * 70);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f2ede2';
  for (let k = 1; k <= 3; k++) {
    const a = 16 * k;
    ctx.beginPath();
    ctx.moveTo(gx + nx * a, gy + ny * a);
    ctx.lineTo(gx + nx * (a + 7), gy + ny * (a + 7));
    ctx.stroke();
  }
  ctx.restore();
}

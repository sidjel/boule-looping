/**
 * Décor d'après le dessin : deux feuilles (un niveau chacune), herbe en hachures vertes
 * et grises, route au graphite soulignée de brun, soleil jaune qui rayonne.
 * Les nuages et les oiseaux sont dans clouds.js.
 */
import { WORLD, SHEET, LEVELS, PIT, groundY } from './track.js';
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
  pencilLine(g, track.line, rng(77), { color: GRAPHITE, width: 5.5, alpha: 0.55, passes: 4, wobble: 1.8 });
  pencilLine(g, track.line, rng(78), { color: '#2f2f33', width: 2.2, alpha: 0.45, passes: 2, wobble: 1 });
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
  for (const [px, py] of track.line) {
    const prev = under[under.length - 1];
    if (prev && Math.hypot(prev[0] - px, prev[1] - 6 - py) > 8) flush();
    if (Math.abs(groundY(track, px) - py) < 2) under.push([px, py + 6]);
    else flush();
  }
  flush();
  function flush() {
    if (under.length > 4) pencilLine(g, under, rand, { color: BROWN, width: 7, alpha: 0.32, passes: 3, wobble: 2.4 });
    under.length = 0;
  }
  const patches = [[380, 640, 26], [1110, 1330, 34], [1500, 1700, 70], [1860, 2000, 40],
    [2300, 2560, 30], [3040, 3220, 50], [3420, 3600, 40], [3880, 4000, 36]];
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

/** Papier un peu gris de la photo, son grain, un pli sur chaque feuille. */
export function makePaper() {
  const tile = noiseTile(160, 9, true);
  const folds = [[1500, 700, 1700, 560, 1300, 0, 900, 1100], [2500, 300, 2700, 160, 2000, -200, 1000, 1700]];
  return function drawPaper(ctx, w, h, cam) {
    ctx.fillStyle = '#e6e5e1';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
    for (let k = 0; k < LEVELS; k++) {
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

/**
 * Décor d'après le dessin : papier, herbe en hachures vertes et grises, route au
 * graphite soulignée de brun, soleil jaune qui rayonne, nuages gribouillés qui dérivent.
 */
import { WORLD, groundY } from './track.js';
import { rng, range, pencilLine, hatch, grain, noiseTile } from './pencil.js';

const GRAPHITE = '#4b4b4f';
const GREEN = '#7fb346';
const GREY = '#8a8a8e';
const BROWN = '#9c6b55';

/** Calque fixe (herbe, route) dessiné une fois à l'échelle q, fond transparent. */
export function buildInk(track, q) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(WORLD.w * q);
  c.height = Math.ceil(WORLD.h * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  const rand = rng(2024);
  drawGrass(g, track, rand);
  drawBrown(g, track, rand);
  pencilLine(g, track.line, rand, { color: GRAPHITE, width: 5.5, alpha: 0.55, passes: 4, wobble: 1.8 });
  pencilLine(g, track.line, rand, { color: '#2f2f33', width: 2.2, alpha: 0.45, passes: 2, wobble: 1 });
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.5);
  return c;
}

function drawGrass(g, track, rand) {
  let x = -20;
  while (x < WORLD.w + 40) {
    const top = groundY(track, x) + range(rand, 4, 22);
    const lean = range(rand, 18, 55);
    const green = rand() < 0.55;
    const bottom = WORLD.h + 30 - (rand() < 0.15 ? range(rand, 40, 160) : 0);
    hatch(g, rand, x - lean, bottom, x, top, {
      color: green ? GREEN : GREY,
      width: green ? 3 : 2.4,
      alpha: green ? 0.55 : 0.42,
      passes: 2,
      wobble: 1.2,
    });
    x += range(rand, 22, 44);
  }
}

/** Ombre brune sous la route et quelques zones gribouillées, comme sur la feuille. */
function drawBrown(g, track, rand) {
  const under = [];
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
  const patches = [[380, 640, 26], [1110, 1330, 34], [1500, 1700, 70], [1860, 2000, 40]];
  for (const [a, b, depth] of patches) {
    for (let i = 0; i < (b - a) / 9; i++) {
      const x = range(rand, a, b), len = range(rand, 40, 120);
      const y0 = groundY(track, x) + range(rand, 4, depth), y1 = groundY(track, x + len) + range(rand, 4, depth);
      hatch(g, rand, x, y0, x + len, y1, { color: rand() < 0.7 ? BROWN : '#b4786a', width: 2, alpha: 0.28, passes: 1, wobble: 1 });
    }
  }
}

/** Papier un peu gris de la photo, avec son grain et le pli en haut à droite. */
export function makePaper() {
  const tile = noiseTile(160, 9, true);
  return function drawPaper(ctx, w, h, cam) {
    ctx.fillStyle = '#e6e5e1';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
    const light = ctx.createRadialGradient(900, 600, 100, 900, 600, 1500);
    light.addColorStop(0, 'rgba(255,255,255,0.55)');
    light.addColorStop(1, 'rgba(160,158,150,0.25)');
    ctx.fillStyle = light;
    ctx.fillRect(-1000, -3000, WORLD.w + 2000, WORLD.h + 4000);
    const fold = ctx.createLinearGradient(1500, 700, 1700, 560);
    fold.addColorStop(0, 'rgba(255,255,255,0)');
    fold.addColorStop(0.45, 'rgba(255,255,255,0.16)');
    fold.addColorStop(0.52, 'rgba(120,118,112,0.07)');
    fold.addColorStop(0.75, 'rgba(255,255,255,0)');
    ctx.fillStyle = fold;
    ctx.fillRect(1300, 0, 900, 1100);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(-(cam.x * cam.scale) % 160, -(cam.y * cam.scale) % 160);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, w + 160, h + 160);
    ctx.restore();
  };
}

/** Nuage gribouillé : boucles grises, intérieur couleur papier pour cacher le soleil. */
export function buildCloud(seed, wCloud, hCloud, q) {
  const rand = rng(seed), pad = 20;
  const c = document.createElement('canvas');
  c.width = Math.ceil((wCloud + pad * 2) * q);
  c.height = Math.ceil((hCloud + pad * 2) * q);
  const g = c.getContext('2d');
  g.scale(q, q);
  g.translate(pad, pad);
  const bumps = [];
  const count = Math.round(wCloud / 120) + 2;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), r = hCloud * range(rand, 0.28, 0.42) * (1 - 0.35 * Math.abs(t - 0.5));
    bumps.push([r + (wCloud - 2 * r) * t, hCloud - r * range(rand, 0.9, 1.3) - (i % 2) * hCloud * 0.18, r]);
  }
  g.fillStyle = 'rgba(232,231,227,0.93)';
  for (const [bx, by, r] of bumps) {
    g.beginPath();
    g.ellipse(bx, by, r * 1.25, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const [bx, by, r] of bumps) {
    const pts = [];
    for (let a = 0; a <= Math.PI * 2.1; a += 0.12) pts.push([bx + Math.cos(a) * r * 1.25, by + Math.sin(a) * r]);
    pencilLine(g, pts, rand, { color: GREY, width: 2, alpha: 0.5, passes: 2, wobble: 2.5 });
  }
  for (let row = 0; row < 4; row++) {
    const pts = [], y0 = hCloud * (0.38 + row * 0.14), rr = hCloud * 0.15;
    for (let t = 0; t < wCloud * 0.8; t += 3) {
      const a = t / 22;
      pts.push([wCloud * 0.1 + t + Math.cos(a) * rr, y0 + Math.sin(a) * rr * 0.8]);
    }
    pencilLine(g, pts, rand, { color: '#9d9da2', width: 1.7, alpha: 0.45, passes: 1, wobble: 2 });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.35);
  return { canvas: c, w: wCloud + pad * 2, h: hCloud + pad * 2 };
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

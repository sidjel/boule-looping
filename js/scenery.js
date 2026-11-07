/**
 * Ce qui se dessine à chaque image autour du calque fixe (ink.js) : le papier (teinté selon
 * la saison, un pli par feuille), le soleil, la table et les rubans adhésifs entre les
 * feuilles, les panneaux d'aiguillage.
 */
import { WORLD, SHEET, SHEETS, groundY } from './track.js';
import { biomeOfSheet } from './biomes.js';
import { rng, range, pencilLine, hatch, grain, noiseTile } from './pencil.js';

const GRAPHITE = '#4b4b4f';

/** Papier un peu gris de la photo, son grain, un pli par feuille, la couleur du ciel de la saison. */
export function makePaper() {
  const tile = noiseTile(160, 9, true);
  const folds = Array.from({ length: SHEETS }, (_, k) => {
    const r = rng(50 + k * 13), ax = k * SHEET + range(r, 300, 1600), ay = range(r, 100, 900);
    return [ax, ay, ax + 200, ay - 140, ax - 300, ay - 700, 1000, 1500];
  });
  return function drawPaper(ctx, w, h, cam) {
    ctx.fillStyle = '#e6e5e1';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
    for (let k = 0; k < SHEETS; k++) {
      if (k * SHEET > cam.x + cam.viewW || (k + 1) * SHEET < cam.x) continue;
      const cx = k * SHEET + 900, x0 = k * SHEET - (k === 0 ? 3000 : 0), wSheet = SHEET + (k === 0 || k === SHEETS - 1 ? 3000 : 0);
      const light = ctx.createRadialGradient(cx, 600, 100, cx, 600, 1500);
      light.addColorStop(0, 'rgba(255,255,255,0.55)');
      light.addColorStop(1, 'rgba(160,158,150,0.25)');
      ctx.fillStyle = light;
      ctx.fillRect(x0, -12000, wSheet, WORLD.h + 14000);
      const sky = biomeOfSheet(k).sky;
      if (sky) {
        // ciel de la saison, qui s'efface en douceur vers une feuille d'une autre saison
        const fadeL = k > 0 && biomeOfSheet(k - 1) !== biomeOfSheet(k), fadeR = k < SHEETS - 1 && biomeOfSheet(k + 1) !== biomeOfSheet(k);
        const tint = ctx.createLinearGradient(0, 0, 0, WORLD.h);
        tint.addColorStop(0, sky);
        tint.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, -12000, wSheet, WORLD.h + 12000);
        ctx.clip();
        ctx.fillStyle = tint;
        ctx.fillRect(x0, -12000, wSheet, WORLD.h + 12000);
        ctx.globalCompositeOperation = 'destination-out';
        for (const [on, a, b] of [[fadeL, k * SHEET - 450, k * SHEET + 450], [fadeR, (k + 1) * SHEET + 450, (k + 1) * SHEET - 450]]) {
          if (!on) continue;
          const fade = ctx.createLinearGradient(a, 0, b, 0);
          fade.addColorStop(0, 'rgba(0,0,0,0.5)');
          fade.addColorStop(0.5, 'rgba(0,0,0,0.5)');
          fade.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = fade;
          ctx.fillRect(Math.min(a, b), -12000, Math.abs(b - a), WORLD.h + 12000);
        }
        ctx.restore();
      }
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
  for (let k = 1; k < SHEETS; k++) {
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


/** Où dessiner le panneau d'un aiguillage (repère du monde). */
export function signOf(track, fork) {
  const x = fork.x - 70;
  return { x, y: groundY(track, x) - 118, base: groundY(track, x) + 4 };
}

/**
 * Aiguillages, dessinés à chaque image : panneau fléché vers le chemin choisi,
 * petite barrière en travers de l'autre chemin. Le panneau pulse pendant le ralenti.
 */
export function drawForks(ctx, track, t, x0, x1, pulse) {
  for (const fork of track.forks) {
    if (fork.x < x0 - 300 || fork.x > x1 + 300) continue;
    const low = fork.route === 'a', { x, y, base } = signOf(track, fork);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = GRAPHITE;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + 1, y);
    ctx.stroke();
    const grow = 1 + 0.12 * pulse * (0.5 + 0.5 * Math.sin(t * 9));
    ctx.translate(x, y - 35);
    ctx.scale(grow, grow);
    ctx.fillStyle = pulse > 0.1 ? 'rgba(255,246,214,0.97)' : 'rgba(244,240,228,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(-62, -31, 124, 62);
    ctx.fill();
    ctx.stroke();
    const wob = Math.sin(t * 4) * 2;
    if (!fork.route) {
      // pas encore choisi : un point d'interrogation, et aucune barrière
      ctx.fillStyle = '#6a4b16';
      ctx.font = 'bold 44px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 2 + wob);
      ctx.restore();
      continue;
    }
    ctx.strokeStyle = low ? '#5b4f45' : '#4f7a2b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (low) {
      ctx.moveTo(-34, -17 + wob); ctx.lineTo(26, 13 + wob);
      ctx.moveTo(26, 13 + wob); ctx.lineTo(2, 15 + wob);
      ctx.moveTo(26, 13 + wob); ctx.lineTo(20, -9 + wob);
    } else {
      ctx.moveTo(-34, 17 - wob); ctx.lineTo(26, -15 - wob);
      ctx.moveTo(26, -15 - wob); ctx.lineTo(2, -17 - wob);
      ctx.moveTo(26, -15 - wob); ctx.lineTo(20, 7 - wob);
    }
    ctx.stroke();
    ctx.restore();
    // barrière sur le chemin fermé
    const pc = low ? fork.B : fork.A;
    const i = Math.min(pc.line.length - 3, low ? 46 : 40), [gx, gy] = pc.line[i], [hx, hy] = pc.line[i + 2];
    const l = Math.hypot(hx - gx, hy - gy) || 1, nx = (hy - gy) / l, ny = -(hx - gx) / l;
    ctx.save();
    ctx.lineCap = 'round';
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
}

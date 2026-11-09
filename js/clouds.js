/**
 * Oiseaux au crayon dans le ciel (les nuages : nuages.js).
 */
import { SHEET, SHEETS } from './track.js';
import { biomeOfSheet } from './biomes.js';

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

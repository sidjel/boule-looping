/**
 * Bille d'acier au crayon : reflets du ciel en haut et de l'herbe en bas (fixes,
 * comme sur une vraie bille polie), rayures gravées qui tournent avec elle pour
 * qu'on la voie rouler, ombre portée sur la route.
 */
import { BALL_R, groundY } from './track.js';
import { rng, range, pencilLine } from './pencil.js';

const R = BALL_R;

export function buildBallBody(q) {
  const size = R * 2 + 12, c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * q);
  const g = c.getContext('2d'), rand = rng(5);
  g.scale(q, q);
  g.translate(size / 2, size / 2);
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.clip();
  const env = g.createLinearGradient(0, -R, 0, R);
  env.addColorStop(0, '#f3f3f1');
  env.addColorStop(0.42, '#c9cacd');
  env.addColorStop(0.52, '#5d5f64');
  env.addColorStop(0.62, '#8f9a86');
  env.addColorStop(1, '#5f6a58');
  g.fillStyle = env;
  g.fillRect(-R, -R, R * 2, R * 2);
  const shade = g.createRadialGradient(R * 0.35, -R * 0.45, R * 0.1, 0, 0, R * 1.05);
  shade.addColorStop(0, 'rgba(255,255,255,0.65)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(0.8, 'rgba(40,40,45,0.25)');
  shade.addColorStop(1, 'rgba(25,25,30,0.6)');
  g.fillStyle = shade;
  g.fillRect(-R, -R, R * 2, R * 2);
  for (let x = -R * 1.4; x < R * 0.2; x += 4.5) {
    pencilLine(g, [[x, R], [x + R * 0.9, -R * 0.2]], rand, { color: '#3d3e43', width: 1.6, alpha: 0.28, passes: 1, wobble: 0.4 });
  }
  g.restore();
  const ring = [];
  for (let a = 0; a <= Math.PI * 2.08; a += 0.1) ring.push([Math.cos(a) * R, Math.sin(a) * R]);
  pencilLine(g, ring, rand, { color: '#2e2e33', width: 2.6, alpha: 0.75, passes: 3, wobble: 0.7 });
  return { canvas: c, size };
}

/** Rayures gravées (tournent avec la bille). */
const MARKS = (() => {
  const rand = rng(12), out = [];
  for (let i = 0; i < 5; i++) {
    const a = range(rand, 0, Math.PI * 2), d = range(rand, 0.25, 0.75) * R, len = range(rand, 0.25, 0.6);
    out.push({ a, d, len, curve: range(rand, -0.6, 0.6) });
  }
  return out;
})();

export function drawBall(ctx, body, ball, track, t) {
  const appear = Math.min(1, ball.age / 0.35);
  const sc = 0.55 + 0.45 * easeOutBack(appear);
  drawShadow(ctx, ball, track);
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.globalAlpha = Math.min(1, appear * 1.5);
  ctx.scale(sc, sc);
  ctx.drawImage(body.canvas, -body.size / 2, -body.size / 2, body.size, body.size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R - 1.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(ball.angle);
  ctx.strokeStyle = '#2f3035';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.4;
  ctx.globalAlpha *= 0.55;
  for (const m of MARKS) {
    const x = Math.cos(m.a) * m.d, y = Math.sin(m.a) * m.d;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(m.a + 1.6) * m.len * R * 0.5 + m.curve * 6, y + Math.sin(m.a + 1.6) * m.len * R * 0.5,
      x + Math.cos(m.a + 1.6) * m.len * R, y + Math.sin(m.a + 1.6) * m.len * R);
    ctx.stroke();
  }
  ctx.restore();
  const twinkle = 0.85 + 0.15 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,255,255,${0.9 * twinkle})`;
  ctx.beginPath();
  ctx.ellipse(R * 0.32, -R * 0.46, R * 0.2, R * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(R * 0.08, -R * 0.62, R * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShadow(ctx, ball, track) {
  let x, y, angle, alpha;
  if (ball.onTrack) {
    const i = Math.min(track.n - 1, Math.round(ball.s / track.step));
    const nx = track.ty[i], ny = -track.tx[i];
    if (ny > 0.2) return; // pas d'ombre au plafond du looping
    x = ball.x - nx * R;
    y = ball.y - ny * R + 2;
    angle = Math.atan2(track.ty[i], track.tx[i]);
    alpha = 0.32;
  } else {
    const gy = groundY(track, ball.x);
    const h = gy - ball.y;
    if (h < 0) return;
    x = ball.x;
    y = gy + 2;
    angle = 0;
    alpha = 0.3 * Math.max(0, 1 - h / 500);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.1);
  g.addColorStop(0, `rgba(60,60,64,${alpha})`);
  g.addColorStop(1, 'rgba(60,60,64,0)');
  ctx.fillStyle = g;
  ctx.scale(1.2, 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function easeOutBack(x) {
  const c = 1.7;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

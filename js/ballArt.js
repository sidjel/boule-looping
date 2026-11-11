/**
 * Bille d'acier au crayon : reflets du ciel en haut et de l'herbe en bas (fixes,
 * comme sur une vraie bille polie), rayures gravées qui tournent avec elle pour
 * qu'on la voie rouler, ombre portée sur la route.
 */
import { BALL_R, groundY, surfaceY } from './track.js';
import { rng, range, pencilLine } from './pencil.js';

const R = BALL_R;

/**
 * La boule par défaut est la bille d'acier dessinée par l'auteur (images/boule-metal.webp, 192 × 192,
 * préparée par tools/preparer-boule.py). Comme sur une vraie bille polie, son reflet (ciel, arbres,
 * sol) ne tourne pas ; de fines rayures gravées tournent avec elle pour qu'on la voie rouler. La bille
 * dessinée par le jeu reste en secours le temps que l'image arrive. La physique ne change pas.
 */
const METAL = new Image();
METAL.src = 'images/boule-metal.webp';
const metalReady = () => METAL.complete && METAL.naturalWidth > 0;

/** Couleurs de chaque boule (reflet du ciel en haut, sol en bas). */
const PALETTES = {
  acier: ['#f3f3f1', '#c9cacd', '#5d5f64', '#8f9a86', '#5f6a58'],
  verre: ['rgba(240,250,255,0.75)', 'rgba(190,220,238,0.55)', 'rgba(120,160,190,0.6)', 'rgba(160,200,170,0.5)', 'rgba(110,150,130,0.6)'],
  petanque: ['#d6d8dc', '#8e9196', '#3c3e43', '#55585e', '#2e3034'],
  rebond: ['#ff9a85', '#ef5d45', '#c7402c', '#b8382a', '#8f2a20'],
  couleurs: ['#fdf6e3', '#f3e3c3', '#c9b38f', '#b7a27f', '#8f7c5c'],
};

export function buildBallBody(q, skin = 'acier') {
  const size = R * 2 + 12, c = document.createElement('canvas');
  const pal = PALETTES[skin] || PALETTES.acier;
  c.width = c.height = Math.ceil(size * q);
  const g = c.getContext('2d'), rand = rng(5);
  g.scale(q, q);
  g.translate(size / 2, size / 2);
  g.save();
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.clip();
  const env = g.createLinearGradient(0, -R, 0, R);
  [0, 0.42, 0.52, 0.62, 1].forEach((at, i) => env.addColorStop(at, pal[i]));
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

/** Décor qui tourne avec la boule, selon la boule choisie. */
function spinDecor(ctx, skin, t) {
  if (skin === 'rebond') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-R, -4);
    ctx.quadraticCurveTo(0, 10, R, -4);
    ctx.stroke();
    return true;
  }
  if (skin === 'couleurs') {
    const cols = ['#e5534b', '#f0a03c', '#f2d24a', '#7fbf4d', '#5b9bd5', '#7b6cc4'];
    cols.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    return true;
  }
  if (skin === 'petanque') {
    ctx.strokeStyle = 'rgba(20,20,24,0.55)';
    ctx.lineWidth = 1.8;
    for (const off of [-12, -6, 6, 12]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, R, Math.abs(off) * 1.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return true;
  }
  return false;
}

export function drawBall(ctx, body, ball, track, t, skin = 'acier') {
  const appear = Math.min(1, ball.age / 0.35);
  const sc = 0.55 + 0.45 * easeOutBack(appear);
  drawShadow(ctx, ball, track);
  if (skin === 'acier' && metalReady()) return drawMetal(ctx, ball, sc, appear);
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
  if (spinDecor(ctx, skin, t)) { ctx.restore(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 1.5, 0, Math.PI * 2); ctx.clip(); ctx.rotate(ball.angle); ctx.globalAlpha = 0; }
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
  const tint = ball.tint();
  if (tint) {
    // bonus : l'acier prend la couleur du bonus (teinte multipliée, garde les reflets), halo
    const [r, g, b, h] = tint;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(${r},${g},${b},${0.75 * h})`;
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const halo = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.9);
    halo.addColorStop(0, `rgba(${r},${g},${b},${0.35 * h})`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
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

/** La bille d'acier dessinée : reflet fixe, rayures qui tournent, trait de crayon autour, teinte des bonus. */
function drawMetal(ctx, ball, sc, appear) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.globalAlpha = Math.min(1, appear * 1.5);
  ctx.scale(sc, sc);
  ctx.drawImage(METAL, -R, -R, R * 2, R * 2);
  // rayures gravées : un seul tracé, qui tourne avec la bille
  ctx.save();
  ctx.rotate(ball.angle);
  ctx.strokeStyle = 'rgba(40,42,48,0.4)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (const m of MARKS) {
    const x = Math.cos(m.a) * m.d, y = Math.sin(m.a) * m.d;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(m.a + 1.6) * m.len * R * 0.5 + m.curve * 6, y + Math.sin(m.a + 1.6) * m.len * R * 0.5,
      x + Math.cos(m.a + 1.6) * m.len * R, y + Math.sin(m.a + 1.6) * m.len * R);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(46,46,51,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, R - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  const tint = ball.tint();
  if (tint) {
    // bonus : la boule prend la couleur du bonus (teinte multipliée), halo
    const [r, g, b, h] = tint;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(${r},${g},${b},${0.6 * h})`;
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const halo = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.9);
    halo.addColorStop(0, `rgba(${r},${g},${b},${0.35 * h})`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShadow(ctx, ball, track) {
  let x, y, angle, alpha;
  if (ball.onTrack) {
    const f = ball.frame(), nx = f.nx, ny = f.ny;
    if (ny > 0.2) return; // pas d'ombre au plafond du looping
    x = ball.x - nx * R;
    y = ball.y - ny * R + 2;
    angle = Math.atan2(f.ty, f.tx);
    alpha = 0.32;
  } else {
    // sur la butte si la boule est au-dessus, sinon sur le sol du chemin du bas
    const sy = surfaceY(track, ball.x), gy = sy > ball.y ? sy : groundY(track, ball.x);
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

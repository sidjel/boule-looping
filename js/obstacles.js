/**
 * Obstacles posés sur la route, qu'on ne passe qu'en sautant par-dessus :
 * - durs (rocher, tronc couché, marche d'escalier) : trop lente, la boule bute dessus ;
 *   avec assez d'élan, elle monte dessus et passe d'elle-même ; un saut passe toujours ;
 * - mous (gros tas de feuilles, gros tas de neige) : la boule les traverse en s'y enfonçant,
 *   mais ils la freinent fort — la boule de pétanque, lourde, les écrase.
 * Les marches ont un dessus (un petit plateau de la route) : on y roule, puis on saute
 * à la suivante.
 */
import { OBSTACLES, BALL_R } from './track.js';
import { rng, range, pencilLine, hatch } from './pencil.js';
import { warmCanvas } from './ressources.js';

const R = BALL_R;
const SOFT = { leaves: true, snow: true };
const SOFT_DRAG = 2600;     // freinage dans un tas (px/s²)
const CLIMB_SPEED = 620;    // px/s : au-dessus, la boule passe d'elle-même sur un rocher, un tronc, une marche

export function obstaclesOf(track) {
  if (!track.obstacles) track.obstacles = OBSTACLES.map((o) => ({ ...o, gone: 0, passed: false }));
  return track.obstacles;
}

/** Contact avec les obstacles proches, après chaque petit pas de physique. */
export function hitObstacles(ball, dt) {
  for (const o of obstaclesOf(ball.tr)) {
    if (o.gone > 0) { o.gone -= dt; continue; }
    if (o.skip > 0) { o.skip -= dt; continue; } // la boule est en train de passer par-dessus
    const dx = ball.x - o.x;
    if (Math.abs(dx) > o.w / 2 + R + 10) {
      // passé par-dessus en l'air : petite récompense (enchaînement)
      if (!o.passed && dx > 0 && dx < o.w / 2 + R + 60 && !ball.onTrack) { o.passed = true; ball.events.push({ type: 'over', kind: o.kind }); }
      if (dx < -200) { o.passed = false; o.puffed = false; }
      continue;
    }
    const hit = o.kind === 'step' ? stepHit(ball, o) : moundHit(ball, o);
    if (!hit) continue;
    const [nx, ny, depth] = hit;
    if (SOFT[o.kind] && ball.skin.crush) {
      o.gone = 5;
      ball.v *= 0.75;
      ball.events.push({ type: 'puff', kind: o.kind, x: o.x, y: o.y - o.h / 2, crush: true });
      continue;
    }
    const soft = !!SOFT[o.kind];
    if (soft) {
      // tas de feuilles ou de neige : on le traverse en s'y enfonçant, mais il freine fort
      const sp = ball.speed(), k = Math.max(0.35, 1 - SOFT_DRAG * dt / Math.max(200, sp));
      if (ball.onTrack) ball.v *= k;
      else { ball.vx *= k; ball.vy *= k; }
      if (!o.puffed) { o.puffed = true; ball.events.push({ type: 'puff', kind: o.kind, x: ball.x, y: o.y - o.h / 2 }); }
      continue;
    }
    if (ball.onTrack) {
      const p = ball.frame(), along = Math.sign(nx * p.tx + ny * p.ty) || -Math.sign(ball.v) || -1;
      const v0 = ball.v;
      // assez d'élan : la boule monte sur l'obstacle et passe par-dessus d'elle-même
      if (Math.abs(v0) > CLIMB_SPEED && Math.sign(v0) !== along) {
        ball.takeOff(p);
        ball.vx = v0 * 0.85;
        ball.vy = -Math.min(800, 250 + Math.abs(v0) * 0.35);
        o.skip = 0.35;
        ball.events.push({ type: 'clink', power: 300 });
        continue;
      }
      // trop lente : elle bute et repart un peu en arrière
      ball.s += along * (depth + 0.5);
      ball.v = along * Math.abs(v0) * 0.35;
      if (Math.abs(v0) > 80) ball.events.push({ type: 'clink', power: Math.abs(v0) }, { type: 'bump', kind: o.kind });
    } else {
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.4 * vn * nx;
        ball.vy -= 1.4 * vn * ny;
        ball.events.push({ type: 'clink', power: -vn });
      }
      ball.x += nx * (depth + 0.5);
      ball.y += ny * (depth + 0.5);
    }
  }
}

/** Demi-ellipse posée sur le sol (rocher, tronc, tas) : [normale x, normale y, enfoncement] ou null. */
function moundHit(ball, o) {
  const a = o.w / 2, b = o.h, dx = ball.x - o.x, dy = ball.y - o.y;
  if (dy > R) return null;
  const k = Math.hypot(dx / (a + R), Math.min(0, dy) / (b + R));
  if (k >= 1) return null;
  let nx = dx / ((a + R) * (a + R)), ny = Math.min(0, dy) / ((b + R) * (b + R));
  const l = Math.hypot(nx, ny) || 1;
  nx /= l; ny /= l;
  if (dy > -R * 0.2 && Math.abs(nx) < 0.3) nx = Math.sign(dx) || -1; // au ras du sol : poussée de côté
  return [nx, ny, (1 - k) * Math.min(a, b)];
}

/** Marche (rectangle du sol au plateau) : la boule ne touche que ses côtés (le dessus est la route). */
function stepHit(ball, o) {
  const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2;
  if (ball.y < o.top - R * 0.4 || ball.y > o.y + R) return null;
  if (ball.onTrack && ball.pc.platform && Math.abs(ball.pc.y[0] + R - o.top) < 4) return null;
  const cx = Math.max(x0, Math.min(x1, ball.x)), cy = Math.max(o.top, Math.min(o.y, ball.y));
  const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy);
  if (d >= R || d === 0 && ball.x > x0 && ball.x < x1 && ball.y > o.top) {
    if (d === 0) return [ball.x - x0 < x1 - ball.x ? -1 : 1, 0, R];
    return null;
  }
  return [dx / d, dy / d, R - d];
}

/* ---------- dessin au crayon (une petite image par obstacle, faite une fois) ---------- */

const sprites = new Map();

function sprite(o, q) {
  const key = `${o.kind}-${Math.round(o.x)}`;
  if (sprites.has(key)) return sprites.get(key);
  const pad = 30, w = o.w + pad * 2, h = o.h + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * q);
  c.height = Math.ceil(h * q);
  const g = c.getContext('2d'), r = rng(Math.round(o.x));
  g.scale(q, q);
  g.translate(pad + o.w / 2, pad + o.h); // origine : milieu du pied de l'obstacle
  const a = o.w / 2, b = o.h, mound = [];
  for (let t = Math.PI; t <= Math.PI * 2 + 0.001; t += 0.08) mound.push([Math.cos(t) * a, Math.sin(t) * b]);
  const fill = (color) => {
    g.fillStyle = color;
    g.beginPath();
    mound.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  };
  if (o.kind === 'rock') {
    fill('rgba(150,148,145,0.85)');
    for (let i = 0; i < 9; i++) hatch(g, r, range(r, -a * 0.8, a * 0.2), range(r, -b * 0.2, -4), range(r, -a * 0.2, a * 0.7), range(r, -b * 0.9, -b * 0.3), { color: '#6a6a70', width: 2, alpha: 0.4, passes: 1, wobble: 0.6 });
    pencilLine(g, mound, r, { color: '#4b4b4f', width: 3.4, alpha: 0.7, passes: 3, wobble: 1.6 });
    pencilLine(g, [[-a * 0.3, -b * 0.75], [a * 0.15, -b * 0.55], [a * 0.35, -b * 0.7]], r, { color: '#55555a', width: 2, alpha: 0.5, passes: 1, wobble: 0.6 });
  } else if (o.kind === 'trunk') {
    g.fillStyle = 'rgba(150,105,65,0.85)';
    g.fillRect(-a, -b, o.w, b);
    for (let y = -b + 10; y < -4; y += 11) hatch(g, r, -a + 6, y, a - 30, y + range(r, -2, 2), { color: '#6b4a2c', width: 2, alpha: 0.45, passes: 1, wobble: 0.8 });
    pencilLine(g, [[-a, -b], [a - 20, -b]], r, { color: '#4b3a2a', width: 3, alpha: 0.7, passes: 2, wobble: 1 });
    pencilLine(g, [[-a, 0], [a - 20, 0]], r, { color: '#4b3a2a', width: 3, alpha: 0.7, passes: 2, wobble: 1 });
    const ring = [];
    for (let t = 0; t <= Math.PI * 2.05; t += 0.2) ring.push([a - 20 + Math.cos(t) * 20, -b / 2 + Math.sin(t) * (b / 2)]);
    g.fillStyle = 'rgba(214,176,128,0.95)';
    g.beginPath();
    g.ellipse(a - 20, -b / 2, 20, b / 2, 0, 0, Math.PI * 2);
    g.fill();
    pencilLine(g, ring, r, { color: '#4b3a2a', width: 2.6, alpha: 0.7, passes: 2, wobble: 0.6 });
    for (const k of [0.6, 0.3]) g.strokeRect(a - 20 - 20 * k, -b / 2 - (b / 2) * k, 0.001, 0.001);
    pencilLine(g, [[a - 32, -b / 2], [a - 20, -b * 0.3], [a - 10, -b / 2]], r, { color: '#8a6440', width: 1.6, alpha: 0.6, passes: 1, wobble: 0.4 });
  } else if (o.kind === 'leaves' || o.kind === 'snow') {
    const snow = o.kind === 'snow';
    fill(snow ? 'rgba(252,253,255,0.97)' : 'rgba(205,125,55,0.75)');
    if (snow) {
      for (let i = 0; i < 10; i++) hatch(g, r, range(r, -a * 0.6, a * 0.6), range(r, -b * 0.3, -6), range(r, -a * 0.6, a * 0.6), range(r, -b * 0.5, -b * 0.2), { color: '#a9bccf', width: 2, alpha: 0.4, passes: 1, wobble: 1 });
      pencilLine(g, mound, r, { color: '#8fa7bf', width: 3, alpha: 0.7, passes: 2, wobble: 2 });
    } else {
      const cols = ['#c9772d', '#b5502a', '#d9a23a', '#8f5a2a'];
      for (let i = 0; i < 70; i++) {
        const t = Math.PI + r() * Math.PI, k = Math.sqrt(r());
        const x = Math.cos(t) * a * k, y = Math.sin(t) * b * k;
        g.save();
        g.translate(x, y);
        g.rotate(r() * 6.3);
        g.fillStyle = cols[i % 4];
        g.globalAlpha = 0.85;
        g.beginPath();
        g.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      pencilLine(g, mound, r, { color: '#8f5a2a', width: 2.4, alpha: 0.55, passes: 2, wobble: 2.5 });
    }
  } else if (o.kind === 'step') {
    g.fillStyle = 'rgba(176,170,160,0.9)';
    g.fillRect(-a, -b, o.w, b);
    for (let y = -b + 24; y < 0; y += 24) {
      pencilLine(g, [[-a, y], [a, y]], r, { color: '#7a756d', width: 1.8, alpha: 0.5, passes: 1, wobble: 0.6 });
      const off = ((y / 24) % 2) * 30;
      for (let x = -a + 20 + off; x < a; x += 60) pencilLine(g, [[x, y - 24], [x, y]], r, { color: '#7a756d', width: 1.6, alpha: 0.45, passes: 1, wobble: 0.4 });
    }
    pencilLine(g, [[-a, 0], [-a, -b], [a, -b], [a, 0]], r, { color: '#4b4b4f', width: 3.4, alpha: 0.7, passes: 3, wobble: 1 });
  }
  const out = { canvas: c, w, h, pad };
  sprites.set(key, out);
  return out;
}

/**
 * Prépare à l'avance l'image d'un obstacle de [xa, xb] qui n'en a pas encore (un seul par appel) ;
 * renvoie false s'il n'en reste aucun. Appelé quand la feuille vient d'être préparée (main.js) :
 * avant, l'image se faisait à l'entrée de l'obstacle à l'écran (3,8 ms d'un coup, rapport du 10 novembre).
 */
export function prepareObstacle(track, xa, xb, q) {
  for (const o of obstaclesOf(track)) {
    if (o.x < xa || o.x >= xb || sprites.has(`${o.kind}-${Math.round(o.x)}`)) continue;
    warmCanvas(sprite(o, q).canvas);
    return true;
  }
  return false;
}

/** Obstacles visibles ; un tas écrasé par la pétanque s'efface puis revient. */
export function drawObstacles(ctx, track, x0, x1, q) {
  for (const o of obstaclesOf(track)) {
    if (o.x + o.w < x0 - 50 || o.x - o.w > x1 + 50) continue;
    const s = sprite(o, q);
    ctx.save();
    if (o.gone > 0) ctx.globalAlpha = o.gone < 1 ? 1 - o.gone : 0; // revient en douceur pendant la dernière seconde
    ctx.drawImage(s.canvas, o.x - o.w / 2 - s.pad, o.y - o.h - s.pad, s.w, s.h);
    ctx.restore();
  }
}

/** Plateformes flottantes : une planche sous chaque petit plateau (les marches ont leur bloc). */
export function drawPlanks(ctx, track, x0, x1) {
  const steps = obstaclesOf(track).filter((o) => o.kind === 'step');
  ctx.save();
  for (const pc of track.pieces) {
    if (!pc.platform) continue;
    const [ax, ay] = pc.line[0], [bx] = pc.line[pc.line.length - 1];
    if (bx < x0 || ax > x1) continue;
    if (steps.some((o) => Math.abs(o.top - ay) < 2 && ax >= o.x - o.w / 2 - 1 && ax <= o.x + o.w / 2)) continue;
    ctx.fillStyle = 'rgba(160,115,70,0.9)';
    ctx.fillRect(ax, ay + 2, bx - ax, 20);
    ctx.strokeStyle = 'rgba(80,58,38,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(ax, ay + 2, bx - ax, 20);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = ax + 28; x < bx; x += 34) { ctx.moveTo(x, ay + 4); ctx.lineTo(x, ay + 20); }
    ctx.stroke();
  }
  ctx.restore();
}

/** Le vent se calme près des obstacles : 0 juste à côté, 1 à plus de 450 px. */
export function windCalm(track, x) {
  let d = Infinity;
  for (const o of obstaclesOf(track)) d = Math.min(d, Math.abs(x - o.x) - o.w / 2);
  return Math.max(0, Math.min(1, (d - 60) / 390));
}

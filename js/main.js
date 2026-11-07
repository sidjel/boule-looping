/**
 * Boucle du mini-jeu : caméra qui suit la bille, physique en petits pas (1/600 s),
 * dessin du décor, de la bille et des petits effets.
 */
import { WORLD, BALL_R, buildTrack } from './track.js';
import { Ball } from './physics.js';
import { Input } from './input.js';
import { buildInk, makePaper, buildCloud, buildSunDisk, drawSun } from './scenery.js';
import { buildBallBody, drawBall } from './ballArt.js';
import { Effects } from './effects.js';

const canvas = document.getElementById('jeu');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('consigne');
const track = buildTrack();
const ball = new Ball(track);
const input = new Input(canvas);
const fx = new Effects();
const drawPaper = makePaper();
const SUN = { x: 1700, y: 238, r: 108 };
const FLICK_GAIN = 0.3;
const FLICK_MAX = 9000;

const cam = { x: 0, y: 0, scale: 1, viewW: WORLD.w, viewH: WORLD.h, dpr: 1 };
let art = null;
const clouds = [
  { seed: 3, w: 620, h: 250, x: 1340, y: 262, speed: 9 },
  { seed: 8, w: 380, h: 150, x: 260, y: 120, speed: 14 },
  { seed: 15, w: 300, h: 120, x: 900, y: 330, speed: 6 },
];

function resize() {
  cam.dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * cam.dpr);
  canvas.height = Math.round(innerHeight * cam.dpr);
  // Paysage : la feuille remplit l'écran. Portrait : on garde au moins 1000 px du dessin
  // en largeur, le ciel (papier) continue au-dessus.
  cam.scale = Math.min(Math.max(canvas.width / WORLD.w, canvas.height / WORLD.h), canvas.width / 1000);
  cam.viewW = canvas.width / cam.scale;
  cam.viewH = canvas.height / cam.scale;
  const q = Math.min(cam.scale, 1.5);
  art = {
    q,
    ink: buildInk(track, q),
    sun: buildSunDisk(SUN.r, q),
    body: buildBallBody(Math.min(cam.scale * 1.5, 3)),
    clouds: clouds.map((c) => buildCloud(c.seed, c.w, c.h, q)),
  };
  follow(1, true);
}

function follow(dt, snap = false) {
  const lookX = ball.onTrack ? ball.v * 0.1 : ball.vx * 0.1;
  const tx = clamp(ball.x + clamp(lookX, -250, 250) - cam.viewW / 2, 0, WORLD.w - cam.viewW);
  const lookY = clamp(ball.onTrack ? 0 : ball.vy * 0.12, -150, 250);
  const ty = cam.viewH >= WORLD.h ? WORLD.h - cam.viewH : clamp(ball.y + lookY - cam.viewH * 0.42, 0, WORLD.h - cam.viewH);
  const kx = snap ? 1 : 1 - Math.exp(-dt * 4), ky = snap ? 1 : 1 - Math.exp(-dt * 6);
  cam.x += (tx - cam.x) * kx;
  cam.y += (ty - cam.y) * ky;
}

let last = performance.now(), time = 0, launched = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function update(dt) {
  if (input.resetAsked) {
    input.resetAsked = false;
    ball.respawn();
  }
  for (const f of input.takeFlicks()) {
    const k = f.keyboard ? 1 : cam.dpr / cam.scale;
    let wx = f.vx * k, wy = f.vy * k;
    const m = Math.hypot(wx, wy);
    if (m > FLICK_MAX) { wx *= FLICK_MAX / m; wy *= FLICK_MAX / m; }
    if (ball.impulse(wx * FLICK_GAIN, wy * FLICK_GAIN)) {
      fx.whoosh(ball.x, ball.y, Math.sign(wx));
      if (!launched) { launched = true; hint.classList.add('cache'); }
    }
  }
  const ballScreenX = ((ball.x - cam.x) * cam.scale) / cam.dpr;
  const push = input.push(ballScreenX);
  const steps = Math.ceil(dt * 600);
  for (let i = 0; i < steps; i++) {
    ball.step(dt / steps, push);
    for (const e of ball.events.splice(0)) onEvent(e);
  }
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > WORLD.w + 60) c.x = -c.w - 60;
  }
  fx.update(dt);
  follow(dt);
}

function onEvent(e) {
  if (e.type === 'spawn') {
    follow(0, true);
    fx.sparkle(ball.x, ball.y);
  } else if (e.type === 'loop') {
    fx.text('Looping !', ball.x, ball.y + 90);
  } else if (e.type === 'clink') {
    fx.clink(ball.x, ball.y, e.power);
  }
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, W, H, cam);
  ctx.setTransform(cam.scale, 0, 0, cam.scale, -cam.x * cam.scale, -cam.y * cam.scale);
  drawSun(ctx, art.sun, SUN.x, SUN.y, SUN.r, time);
  clouds.forEach((c, i) => {
    const a = art.clouds[i];
    ctx.drawImage(a.canvas, c.x - 20, c.y - 20, a.w, a.h);
  });
  ctx.drawImage(art.ink, 0, 0, WORLD.w, WORLD.h);
  fx.drawSpeed(ctx, ball);
  drawBall(ctx, art.body, ball, track, time);
  fx.draw(ctx);
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  fx.drawTrail(ctx, input.liveTrail(), input.holding() ? input.active.last : null);
}

function clamp(v, a, b) {
  return b < a ? (a + b) / 2 : v < a ? a : v > b ? b : v;
}

document.getElementById('rejouer').addEventListener('click', () => ball.respawn());
document.getElementById('rejouer').addEventListener('pointerdown', (e) => e.stopPropagation());
canvas.addEventListener('pointerdown', () => {
  fx.unlockSound();
  if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {});
  }
}, { once: true });
let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});
resize();
requestAnimationFrame(frame);
window.__boule = { ball, track, cam, BALL_R };

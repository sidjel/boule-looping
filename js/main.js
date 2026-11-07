/**
 * Boucle du mini-jeu : caméra (vue d'ensemble ou suivi), physique en petits pas (1/600 s),
 * dessin du décor, de la boule et des petits effets.
 */
import { WORLD, buildTrack } from './track.js';
import { Ball } from './physics.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { setupFullscreen } from './fullscreen.js';
import { buildInk, makePaper, drawTable, buildCloud, buildSunDisk, drawSun } from './scenery.js';
import { buildBallBody, drawBall } from './ballArt.js';
import { Effects } from './effects.js';

const canvas = document.getElementById('jeu');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('consigne');
const zoomBtn = document.getElementById('zoom');
const track = buildTrack();
const ball = new Ball(track);
const input = new Input(canvas);
const fx = new Effects();
const cam = new Camera();
const drawPaper = makePaper();
const SUN = { x: 1700, y: 238, r: 108 };
const FLICK_GAIN = 0.3;
const FLICK_MAX = 9000;

let art = null;
const clouds = [
  { seed: 3, w: 620, h: 250, x: 1340, y: 262, speed: 9 },
  { seed: 8, w: 380, h: 150, x: 260, y: 120, speed: 14 },
  { seed: 15, w: 300, h: 120, x: 900, y: 330, speed: 6 },
];

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  cam.resize(canvas.width, canvas.height, dpr);
  // Calques dessinés pour le cadrage le plus zoomé : nets dans les deux vues.
  const q = Math.min(cam.followScale, 1.5);
  if (!art || Math.abs(art.q - q) > 0.05) {
    art = {
      q,
      ink: buildInk(track, q),
      sun: buildSunDisk(SUN.r, q),
      body: buildBallBody(Math.min(cam.followScale * 1.5, 3)),
      clouds: clouds.map((c) => buildCloud(c.seed, c.w, c.h, q)),
    };
  }
  cam.update(1, ball, true);
  refreshZoomBtn();
}

function refreshZoomBtn() {
  zoomBtn.classList.toggle('large', cam.wide);
  zoomBtn.setAttribute('aria-label', cam.wide ? 'Zoomer sur la boule' : 'Voir tout le parcours');
  zoomBtn.title = cam.wide ? 'Zoomer sur la boule (Z)' : 'Voir tout le parcours (Z)';
}

function toggleZoom() {
  cam.toggle();
  refreshZoomBtn();
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
    // Même geste, même élan, quel que soit le cadrage.
    const k = f.keyboard ? 1 : cam.dpr / cam.followScale;
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
  cam.update(dt, ball);
}

function onEvent(e) {
  if (e.type === 'spawn') {
    cam.update(0, ball, !cam.wide);
    fx.sparkle(ball.x, ball.y);
  } else if (e.type === 'loop') {
    fx.text('Looping !', ball.x, ball.y + 90);
  } else if (e.type === 'clink') {
    fx.clink(ball.x, ball.y, e.power);
  }
}

function render() {
  const W = canvas.width, H = canvas.height, s = cam.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, W, H, cam);
  ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cam.y - 10, WORLD.w, cam.viewH + 20);
  ctx.clip();
  drawSun(ctx, art.sun, SUN.x, SUN.y, SUN.r, time);
  clouds.forEach((c, i) => {
    const a = art.clouds[i];
    ctx.drawImage(a.canvas, c.x - 20, c.y - 20, a.w, a.h);
  });
  ctx.drawImage(art.ink, 0, 0, WORLD.w, WORLD.h);
  ctx.restore();
  drawTable(ctx, cam);
  fx.drawSpeed(ctx, ball);
  drawBall(ctx, art.body, ball, track, time);
  fx.draw(ctx);
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  fx.drawTrail(ctx, input.liveTrail(), input.holding() ? input.active.last : null);
}

document.getElementById('rejouer').addEventListener('click', () => ball.respawn());
for (const b of document.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
zoomBtn.addEventListener('click', toggleZoom);
addEventListener('keydown', (e) => {
  if (e.key === 'z' || e.key === 'Z') toggleZoom();
});
canvas.addEventListener('pointerdown', () => fx.unlockSound(), { once: true });
setupFullscreen(document.getElementById('plein-ecran'), document.getElementById('astuce'));

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});
resize();
requestAnimationFrame(frame);
window.__boule = { ball, track, cam };

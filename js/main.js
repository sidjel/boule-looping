/**
 * Boucle du mini-jeu : caméra (vue d'ensemble ou suivi), physique en petits pas (1/600 s),
 * dessin des deux feuilles, de la boule et des petits effets, sons.
 */
import { WORLD, SHEET, LEVELS, buildTrack } from './track.js';
import { Ball } from './physics.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { Sound } from './audio.js';
import { setupFullscreen } from './fullscreen.js';
import { buildInk, makePaper, drawTable, buildSunDisk, drawSun } from './scenery.js';
import { CLOUDS, buildCloud, moveClouds, drawClouds, drawBirds } from './clouds.js';
import { buildBallBody, drawBall } from './ballArt.js';
import { Effects } from './effects.js';

const canvas = document.getElementById('jeu');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('consigne');
const zoomBtn = document.getElementById('zoom');
const musicBtn = document.getElementById('musique');
const track = buildTrack();
const ball = new Ball(track);
const input = new Input(canvas);
const fx = new Effects();
const cam = new Camera();
const sound = new Sound();
const drawPaper = makePaper();
const SUN = { x: 1700, y: 238, r: 108 };
const FLICK_GAIN = 0.3;
const FLICK_MAX = 9000;

let art = null;

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  cam.resize(canvas.width, canvas.height, dpr);
  // Calques dessinés pour le cadrage le plus zoomé : nets dans les deux vues.
  const q = Math.min(cam.followScale, 1.25);
  if (!art || Math.abs(art.q - q) > 0.05) {
    art = {
      q,
      ink: Array.from({ length: LEVELS }, (_, k) => buildInk(track, q, k)),
      sun: buildSunDisk(SUN.r, q),
      body: buildBallBody(Math.min(cam.followScale * 1.5, 3)),
      clouds: CLOUDS.map((c) => buildCloud(c.seed, c.w, c.h, q)),
    };
  }
  cam.update(1, ball, true);
  refreshButtons();
}

function refreshButtons() {
  zoomBtn.classList.toggle('large', cam.wide);
  zoomBtn.setAttribute('aria-label', cam.wide ? 'Zoomer sur la boule' : 'Voir tout le niveau');
  zoomBtn.title = cam.wide ? 'Zoomer sur la boule (Z)' : 'Voir tout le niveau (Z)';
  musicBtn.classList.toggle('muet', !sound.musicOn);
  musicBtn.setAttribute('aria-label', sound.musicOn ? 'Couper la musique' : 'Mettre la musique');
  musicBtn.title = sound.musicOn ? 'Couper la musique (M)' : 'Mettre la musique (M)';
}

function toggleZoom() {
  cam.toggle();
  refreshButtons();
}

function toggleMusic() {
  if (!sound.ac) {
    // premier geste sur ce bouton : il lance la musique si elle était prévue, sinon il l'active
    sound.unlock();
    if (!sound.musicOn) sound.toggleMusic();
  } else sound.toggleMusic();
  refreshButtons();
}

let last = performance.now(), time = 0, launched = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  update(dt);
  render(dt);
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
  moveClouds(dt);
  fx.follow(ball, dt);
  fx.update(dt);
  cam.update(dt, ball);
  sound.update(ball.onTrack ? Math.abs(ball.v) : Math.hypot(ball.vx, ball.vy), ball.onTrack);
}

function onEvent(e) {
  if (e.type === 'spawn') {
    cam.update(0, ball, !cam.wide);
    fx.sparkle(ball.x, ball.y);
  } else if (e.type === 'loop') {
    fx.loop(ball.x, ball.y);
    fx.text('Looping !', ball.x, ball.y + 110);
    sound.loop();
    navigator.vibrate?.(14);
  } else if (e.type === 'jump') {
    fx.text('Joli saut !', ball.x, ball.y - 90);
    sound.jump();
    navigator.vibrate?.(10);
  } else if (e.type === 'pit') {
    fx.text('Oups…', ball.x, ball.y - 80);
  } else if (e.type === 'level') {
    fx.text(`Niveau ${e.n}`, ball.x + 180, Math.max(260, ball.y - 220));
  } else if (e.type === 'clink') {
    fx.clink(ball.x, ball.y, e.power);
    sound.clink(e.power);
  }
}

function render(dt) {
  const W = canvas.width, H = canvas.height, s = cam.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, W, H, cam);
  ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cam.y - 10, WORLD.w, cam.viewH + 20);
  ctx.clip();
  if (cam.x < SHEET) drawSun(ctx, art.sun, SUN.x, SUN.y, SUN.r, time);
  drawBirds(ctx, time, dt);
  drawClouds(ctx, art.clouds);
  art.ink.forEach((ink, k) => {
    if (cam.x < (k + 1) * SHEET && cam.x + cam.viewW > k * SHEET) ctx.drawImage(ink, k * SHEET, 0, SHEET, WORLD.h);
  });
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
musicBtn.addEventListener('click', toggleMusic);
addEventListener('keydown', (e) => {
  if (e.key === 'z' || e.key === 'Z') toggleZoom();
  if (e.key === 'm' || e.key === 'M') toggleMusic();
  sound.unlock();
});
// Le son ne peut démarrer qu'après un geste : premier toucher, clic ou touche.
const firstSound = (e) => {
  if (!musicBtn.contains(e.target)) sound.unlock();
};
addEventListener('pointerup', firstSound, true);
addEventListener('touchend', firstSound, true);
setupFullscreen(document.getElementById('plein-ecran'), document.getElementById('astuce'));

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});
resize();
requestAnimationFrame(frame);
window.__boule = { ball, track, cam, sound };

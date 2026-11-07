/**
 * Boucle du jeu : caméra (vue d'ensemble ou suivi), physique en petits pas (1/600 s),
 * ralenti devant les aiguillages, dessin des feuilles (préparées petit à petit), boule,
 * bonus, météo, sons, reprise au début du niveau, arrivée et temps total.
 */
import { WORLD, SHEET, SHEETS, FINISH, buildTrack } from './track.js';
import { Ball, BONUS } from './physics.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { Sound } from './audio.js';
import { setupFullscreen } from './fullscreen.js';
import { inkSteps, buildInk } from './ink.js';
import { makePaper, drawTable, buildSunDisk, drawSun, drawForks, signOf } from './scenery.js';
import { buildClouds, moveClouds, drawClouds, drawBirds } from './clouds.js';
import { buildBallBody, drawBall } from './ballArt.js';
import { Effects } from './effects.js';
import { Bonuses } from './bonus.js';
import { Weather } from './weather.js';
import { biomeAt, biomeOfSheet } from './biomes.js';

const $ = (id) => document.getElementById(id);
const canvas = $('jeu'), ctx = canvas.getContext('2d');
const hint = $('consigne'), zoomBtn = $('zoom'), musicBtn = $('musique'), forkBtn = $('aiguillage');
const hud = $('hud'), choose = $('choix'), finish = $('fin'), fpsBox = $('fps');
const track = buildTrack();
const ball = new Ball(track);
const input = new Input(canvas);
const fx = new Effects();
const cam = new Camera();
const sound = new Sound();
const bonuses = new Bonuses(track);
const weather = new Weather();
const drawPaper = makePaper();
const SUNS = [{ x: 1700, y: 238, r: 108 }, { x: 16 * SHEET + 1550, y: 330, r: 120 }];
const FLICK_GAIN = 0.3, FLICK_MAX = 9000;
const WORDS = { red: 'Boost !', blue: 'Colle !', green: 'Bond !', yellow: 'Plume !' };

let art = null;

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  cam.resize(canvas.width, canvas.height, dpr);
  // Calques dessinés pour le cadrage le plus zoomé : nets dans les deux vues.
  const q = Math.min(cam.followScale, 1);
  if (!art || Math.abs(art.q - q) > 0.05) {
    art = {
      q, ink: new Map(), pending: new Map(),
      sun: buildSunDisk(108, q),
      body: buildBallBody(Math.min(cam.followScale * 1.5, 3)),
      clouds: buildClouds(q),
    };
  }
  cam.update(1, ball, true);
  refreshButtons();
}

/* ---------- feuilles : dessinées à l'avance, petit à petit, trois ou quatre en mémoire ---------- */

const visible = (k) => cam.x < (k + 1) * SHEET && cam.x + cam.viewW > k * SHEET;

function inkFor(k) {
  if (!art.ink.has(k)) {
    const gen = art.pending.get(k);
    let canvasK;
    if (gen) {
      let r = gen.next();
      while (!r.done) r = gen.next();
      canvasK = r.value;
      art.pending.delete(k);
    } else canvasK = buildInk(track, art.q, k);
    art.ink.set(k, canvasK);
    evict(k);
  }
  return art.ink.get(k);
}

function evict(k) {
  const here = Math.floor(ball.x / SHEET);
  for (const key of [...art.ink.keys()]) {
    if (art.ink.size <= 4) break;
    if (key !== k && Math.abs(key - here) > 1 && !visible(key)) art.ink.delete(key);
  }
}

/** Avance la préparation de la feuille suivante pendant au plus 5 ms par image. */
function prepare() {
  const k = Math.floor(ball.x / SHEET), t0 = performance.now();
  for (const n of [k + 1, k, k - 1, k + 2]) {
    if (n < 0 || n >= SHEETS || art.ink.has(n)) continue;
    if (!art.pending.has(n)) art.pending.set(n, inkSteps(track, art.q, n));
    const gen = art.pending.get(n);
    while (performance.now() - t0 < 5) {
      const r = gen.next();
      if (r.done) {
        art.ink.set(n, r.value);
        art.pending.delete(n);
        evict(n);
        break;
      }
    }
    return;
  }
}

/* ---------- aiguillages ---------- */

/** L'aiguillage qui intéresse le joueur : celui devant la boule (ou tout près). */
function forkAhead() {
  let best = null;
  for (const f of track.forks) {
    const d = f.x - ball.x;
    if (d > -150 && d < 2200 && (!best || d < best.x - ball.x)) best = f;
  }
  return best;
}

/** Ralenti : la boule approche d'un aiguillage, sur le tronçon d'avant, en avançant. */
function forkSlowdown() {
  for (const f of track.forks) {
    const d = f.x - ball.x;
    if (ball.onTrack && ball.pc === f.seg && d > 0 && d < 950 && ball.v > 40) return f;
  }
  return null;
}

function toggleFork(f = forkAhead()) {
  if (!f) return;
  f.route = f.route === 'a' ? 'b' : 'a';
  refreshButtons();
}

function refreshButtons() {
  const f = forkAhead();
  if (f) forkBtn.textContent = f.labels[f.route === 'a' ? 0 : 1];
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
    sound.unlock();
    if (!sound.musicOn) sound.toggleMusic();
  } else sound.toggleMusic();
  refreshButtons();
}

/* ---------- temps de jeu, reprise, arrivée ---------- */

let last = performance.now(), time = 0, launched = false, timeScale = 1, slow = null;
let runTime = 0, running = false, finished = false;

const level = () => Math.max(0, Math.min(SHEETS - 2, Math.floor(ball.x / SHEET)));
const clock = (t) => `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;

function restart(fromStart = false) {
  ball.respawn(fromStart ? 0 : level());
  if (fromStart) {
    runTime = 0;
    running = false;
    finished = false;
    launched = false;
    hint.classList.remove('cache');
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  update(dt);
  render(dt * timeScale);
  meter(dt);
  requestAnimationFrame(frame);
}

function update(realDt) {
  if (input.resetAsked) {
    input.resetAsked = false;
    restart();
  }
  // ralenti devant un aiguillage, pour laisser le temps de choisir
  slow = forkSlowdown();
  timeScale += ((slow ? 0.28 : 1) - timeScale) * Math.min(1, realDt * 5);
  choose.classList.toggle('visible', !!slow);
  forkBtn.classList.toggle('pulse', !!slow);
  const dt = realDt * timeScale;
  for (const tap of input.takeTaps()) {
    const wx = cam.x + (tap.x * cam.dpr) / cam.scale, wy = cam.y + (tap.y * cam.dpr) / cam.scale;
    for (const f of track.forks) {
      const s = signOf(track, f);
      if (Math.hypot(wx - s.x, wy - (s.y - 35)) < 140) toggleFork(f);
    }
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
      running = running || !finished;
    }
  }
  if (running) runTime += realDt;
  const ballScreenX = ((ball.x - cam.x) * cam.scale) / cam.dpr;
  const push = input.push(ballScreenX);
  const steps = Math.ceil(dt * 600);
  for (let i = 0; i < steps; i++) {
    ball.step(dt / steps, push);
    for (const e of ball.events.splice(0)) onEvent(e);
  }
  const hit = bonuses.update(dt, ball);
  if (hit) {
    ball.bonus(hit.color);
    const c = BONUS[hit.color].color;
    fx.burst(ball.x, ball.y, [`rgb(${c})`, `rgb(${c.map((v) => Math.min(255, v + 50))})`]);
    fx.text(WORDS[hit.color], ball.x, ball.y - 90);
    sound.bonus(hit.color);
    navigator.vibrate?.(20);
  }
  if (!finished && ball.x > FINISH.x) {
    finished = true;
    running = false;
    $('temps').textContent = clock(runTime);
    finish.hidden = false;
    sound.loop();
  }
  moveClouds(dt);
  weather.update(dt, cam, ball.clock);
  fx.follow(ball, dt);
  fx.update(dt);
  cam.update(realDt, ball);
  forkBtn.classList.toggle('visible', !!forkAhead());
  if (time % 0.25 < realDt) refreshButtons();
  prepare();
  const b = ball.biome();
  sound.update(ball.speed(), ball.onTrack, { ice: !!b.snow, rain: !!biomeAt(cam.x + cam.viewW / 2).rain, gust: b.wind ? weather.wind() : 0 });
  const sheet = Math.max(0, Math.min(SHEETS - 1, Math.floor(ball.x / SHEET))), bio = biomeOfSheet(sheet);
  const where = sheet === SHEETS - 1 ? 'Arrivée' : `Niveau ${sheet + 1} · ${bio.name}`;
  hud.textContent = `${where}${running || finished ? ` · ${clock(runTime)}` : ''}`;
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
    const k = e.n - 1, bio = biomeOfSheet(k), before = biomeOfSheet(k - 1);
    const label = k === SHEETS - 1 ? 'Arrivée !' : bio !== before ? `Niveau ${e.n} · ${bio.name}` : `Niveau ${e.n}`;
    fx.text(label, ball.x + 180, Math.max(260, ball.y - 220));
  } else if (e.type === 'clink') {
    fx.clink(ball.x, ball.y, e.power);
    sound.clink(e.power);
  } else if (e.type === 'splash') {
    fx.splash(ball.x, ball.y);
    sound.splash(e.power);
  }
}

function render(dt) {
  const W = canvas.width, H = canvas.height, s = cam.scale, x0 = cam.x, x1 = cam.x + cam.viewW;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, W, H, cam);
  ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cam.y - 10, SHEET * SHEETS, cam.viewH + 20);
  ctx.clip();
  for (const sun of SUNS) if (sun.x + 400 > x0 && sun.x - 400 < x1) drawSun(ctx, art.sun, sun.x, sun.y, sun.r, time);
  drawBirds(ctx, time, dt, x0, x1);
  drawClouds(ctx, art.clouds, x0, x1);
  for (let k = Math.max(0, Math.floor(x0 / SHEET)); k <= Math.min(SHEETS - 1, Math.floor(x1 / SHEET)); k++) {
    ctx.drawImage(inkFor(k), k * SHEET, 0, SHEET, WORLD.h);
  }
  drawForks(ctx, track, time, x0, x1, slow ? 1 : 0);
  ctx.restore();
  drawTable(ctx, cam);
  bonuses.draw(ctx, time, x0, x1);
  fx.drawHeat(ctx, ball);
  fx.drawSpeed(ctx, ball);
  drawBall(ctx, art.body, ball, track, time);
  fx.draw(ctx);
  weather.draw(ctx);
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  fx.drawTrail(ctx, input.liveTrail(), input.holding() ? input.active.last : null);
}

/* ---------- compteur caché : #fps dans l'adresse, ou touche F ---------- */

let meterOn = location.hash === '#fps', frames = 0, acc = 0, worst = 0;
function meter(dt) {
  if (!meterOn) return;
  frames++;
  acc += dt;
  worst = Math.max(worst, dt);
  if (acc < 0.5) return;
  const mem = performance.memory ? ` · mémoire JS ${Math.round(performance.memory.usedJSHeapSize / 1048576)} Mo` : '';
  fpsBox.textContent = `${Math.round(frames / acc)} img/s · pire ${Math.round(worst * 1000)} ms · feuilles ${art.ink.size}${mem} · particules ${weather.parts.length}`;
  fpsBox.hidden = false;
  frames = 0;
  acc = 0;
  worst = 0;
}

/* ---------- boutons et clavier ---------- */

const replay = $('rejouer');
let pressTimer = 0, longPress = false;
replay.addEventListener('pointerdown', () => {
  longPress = false;
  pressTimer = setTimeout(() => { longPress = true; restart(true); fx.text('Retour au niveau 1', ball.x + 200, ball.y - 150); }, 700);
});
replay.addEventListener('pointerup', () => clearTimeout(pressTimer));
replay.addEventListener('pointerleave', () => clearTimeout(pressTimer));
replay.addEventListener('click', () => { if (!longPress) restart(); });
for (const b of document.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
zoomBtn.addEventListener('click', toggleZoom);
musicBtn.addEventListener('click', toggleMusic);
forkBtn.addEventListener('click', () => toggleFork(slow || forkAhead()));
$('rejouer-fin').addEventListener('click', () => { finish.hidden = true; restart(true); });
$('continuer').addEventListener('click', () => { finish.hidden = true; });
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'z') toggleZoom();
  if (k === 'm') toggleMusic();
  if (k === 'a') toggleFork(slow || forkAhead());
  if (k === 'f') { meterOn = !meterOn; fpsBox.hidden = !meterOn; }
  sound.unlock();
});
// Le son ne peut démarrer qu'après un geste : premier toucher, clic ou touche.
const firstSound = (e) => {
  if (!musicBtn.contains(e.target)) sound.unlock();
};
addEventListener('pointerup', firstSound, true);
addEventListener('touchend', firstSound, true);
setupFullscreen($('plein-ecran'), $('astuce'));

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});
resize();
requestAnimationFrame(frame);
window.__boule = { ball, track, cam, sound, bonuses, weather, restart };

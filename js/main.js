/**
 * Boucle du jeu : menu et pause, caméra (vue d'ensemble ou suivi), physique en petits pas
 * (1/600 s), quasi-arrêt du temps devant les aiguillages, saut, bonus expliqués, météo, sons,
 * reprise au début du niveau, sauvegarde de la partie, arrivée et tableau des scores.
 */
import { WORLD, SHEET, SHEETS, FINISH, buildTrack } from './track.js';
import { Ball, BONUS } from './physics.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { Sound } from './audio.js';
import { setupFullscreen } from './fullscreen.js';
import { inkSteps, buildInk } from './ink.js';
import { makePaper, drawTable, buildSunDisk, drawSun, drawForks } from './scenery.js';
import { buildClouds, moveClouds, drawClouds, drawBirds } from './clouds.js';
import { buildBallBody, drawBall } from './ballArt.js';
import { Effects } from './effects.js';
import { Bonuses, BONUS_INFO } from './bonus.js';
import { Weather } from './weather.js';
import { biomeAt, biomeOfSheet } from './biomes.js';
import { save } from './save.js';
import { Menu, scoreTable } from './menu.js';

const $ = (id) => document.getElementById(id);
const canvas = $('jeu'), ctx = canvas.getContext('2d');
const hint = $('consigne'), zoomBtn = $('zoom'), musicBtn = $('musique');
const forkLow = $('chemin-bas'), forkHigh = $('chemin-haut'), turn = $('tourner');
const hud = $('hud'), finish = $('fin'), fpsBox = $('fps'), info = $('info'), gauges = $('effets');
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
const SLOW = 0.12;            // devant un aiguillage, le temps passe 8 fois moins vite : la boule avance encore un peu
const FORK_ZONE = 750;        // px avant l'embranchement où le temps ralentit
const FORK_SHOW = 1500;       // px avant l'embranchement où les boutons apparaissent
const WORDS = { red: 'Boost !', blue: 'Colle !', green: 'Bond !', yellow: 'Plume !' };
const vibrate = (ms) => save.options.vibrate && navigator.vibrate?.(ms);

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

/* ---------- feuilles : dessinées à l'avance, petit à petit, quatre au plus en mémoire ---------- */

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

/* ---------- aiguillages : le temps s'arrête presque, deux grands boutons ---------- */

/**
 * État des aiguillages, d'après la seule position de la boule (qu'elle roule, vole ou rebondisse) :
 * - near : l'embranchement est devant, les deux boutons sont posés au début de chaque chemin ;
 * - le temps ralentit fortement dans les derniers FORK_ZONE px, tant que le joueur n'a pas choisi.
 */
let near = null, slow = null;
function updateForks() {
  near = null;
  slow = null;
  for (const f of track.forks) {
    const d = f.x - ball.x, onBranch = ball.pc === f.A || ball.pc === f.B;
    if (d > FORK_SHOW) { f.decided = false; continue; }
    if (d < -40 || onBranch) continue;
    near = f;
    const forward = ball.onTrack ? ball.v : ball.vx;
    if (!f.decided && d > 0 && d < FORK_ZONE && forward > 30) slow = f;
  }
  return slow;
}

function pick(route, f = near) {
  if (!f) return;
  f.route = route;
  f.decided = true;
  sound.clink(700);
  vibrate(12);
}

/** Les deux boutons suivent l'écran, posés au début du chemin du bas et du chemin du haut. */
function placeForkButtons() {
  for (const [btn, side] of [[forkLow, 'a'], [forkHigh, 'b']]) {
    if (!near || menu.isOpen) { btn.hidden = true; continue; }
    const pc = side === 'a' ? near.A : near.B, i = Math.min(pc.line.length - 1, side === 'a' ? 70 : 85);
    const [wx, wy] = pc.line[i];
    const sx = ((wx - cam.x) * cam.scale) / cam.dpr, sy = ((wy - cam.y) * cam.scale) / cam.dpr + (side === 'a' ? 52 : -58);
    btn.hidden = false;
    btn.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -50%)`;
    const label = near.labels[side === 'a' ? 0 : 1].split(':').pop().trim();
    const text = `${side === 'a' ? '↘' : '↗'} ${label}`;
    if (btn.textContent !== text) btn.textContent = text;
    btn.classList.toggle('choisi', near.route === side);
    btn.classList.toggle('urgent', !!slow);
  }
}

function toggleFork(f = near) {
  if (!f) return;
  pick(f.route === 'a' ? 'b' : 'a', f);
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
    sound.unlock();
    if (!sound.musicOn) sound.toggleMusic();
  } else sound.toggleMusic();
  refreshButtons();
}

/* ---------- partie : temps, statistiques, sauvegarde, reprise ---------- */

let last = performance.now(), time = 0, launched = false, timeScale = 1;
const run = { time: 0, running: false, finished: false, loops: 0, bonuses: 0 };
let lastSave = 0;

const level = () => Math.max(0, Math.min(SHEETS - 2, Math.floor(ball.x / SHEET)));
const clock = (t) => `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;

function saveProgress() {
  if (run.finished) return;
  save.setProgress({ level: level(), time: run.time, loops: run.loops, bonuses: run.bonuses });
}

function restart(fromStart = false) {
  ball.respawn(fromStart ? 0 : level());
  if (fromStart) {
    Object.assign(run, { time: 0, running: false, finished: false, loops: 0, bonuses: 0 });
    launched = false;
    hint.classList.remove('cache');
    save.setProgress(null);
  }
}

// sur téléphone, le jeu se joue à l'horizontale : en portrait, il attend qu'on tourne l'écran
const phone = matchMedia('(pointer: coarse)').matches;
const portrait = () => phone && innerHeight > innerWidth;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const paused = menu.isOpen || portrait();
  turn.hidden = !portrait();
  if (!paused) update(dt);
  else cam.update(dt, ball);
  render(paused ? 0 : dt * timeScale);
  placeForkButtons();
  meter(dt);
  requestAnimationFrame(frame);
}

function update(realDt) {
  if (input.resetAsked) {
    input.resetAsked = false;
    restart();
  }
  const wasSlow = !!slow, choosing = updateForks();
  cam.focus = near && near.x - ball.x < FORK_ZONE + 150 ? near.x : null;
  if (!!choosing !== wasSlow) sound.slow(!!choosing);
  timeScale += ((choosing ? SLOW : 1) - timeScale) * Math.min(1, realDt * 6);
  const dt = realDt * timeScale;
  // toucher bref (ou ↑) : saut
  const taps = input.takeTaps();
  if (input.hopAsked || taps.length) {
    input.hopAsked = false;
    if (ball.hop()) {
      fx.whoosh(ball.x, ball.y, 0);
      sound.clink(260);
      if (!launched) { launched = true; hint.classList.add('cache'); }
      run.running = run.running || !run.finished;
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
      run.running = run.running || !run.finished;
    }
  }
  if (run.running) run.time += realDt;
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
    run.bonuses++;
    const c = BONUS[hit.color].color;
    fx.burst(ball.x, ball.y, [`rgb(${c})`, `rgb(${c.map((v) => Math.min(255, v + 50))})`]);
    fx.text(WORDS[hit.color], ball.x, ball.y - 90);
    sound.bonus(hit.color);
    vibrate(20);
    showInfo(hit.color);
  }
  if (!run.finished && ball.x > FINISH.x) arrive();
  moveClouds(dt);
  weather.update(dt, cam, ball.clock);
  fx.follow(ball, dt);
  fx.update(dt);
  cam.update(realDt, ball);
  if (time % 0.25 < realDt) refreshButtons();
  if (time - lastSave > 5 && run.running) { lastSave = time; saveProgress(); }
  prepare();
  const b = ball.biome();
  sound.update(ball.speed(), ball.onTrack, { ice: !!b.snow, rain: !!biomeAt(cam.x + cam.viewW / 2).rain, gust: b.wind ? weather.wind() : 0 });
  const sheet = Math.max(0, Math.min(SHEETS - 1, Math.floor(ball.x / SHEET))), bio = biomeOfSheet(sheet);
  const where = sheet === SHEETS - 1 ? 'Arrivée' : `Niveau ${sheet + 1} · ${bio.name}`;
  hud.textContent = `${where}${run.running || run.finished ? ` · ${clock(run.time)}` : ''}`;
  drawGauges();
}

/** Explication du bonus attrapé, en grand, pendant quelques secondes. */
let infoTimer = 0;
function showInfo(color) {
  const b = BONUS_INFO[color];
  info.innerHTML = `<img src="images/boule-${color}.png" alt=""><span><b>${b.title}</b><br>${b.text}</span>`;
  info.className = `visible ${color}`;
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => { info.className = ''; }, 4200);
}

/** Jauges des bonus en cours (bleu, jaune…), sous le bandeau du haut. */
function drawGauges() {
  const html = Object.entries(ball.fx)
    .filter(([k, t]) => t > 0 && k !== 'green' && k !== 'red')
    .map(([k, t]) => `<span class="jauge ${k}"><i style="width:${Math.round((t / BONUS[k].time) * 100)}%"></i>${BONUS_INFO[k].word} ${Math.ceil(t)} s</span>`)
    .join('');
  if (gauges.innerHTML !== html) gauges.innerHTML = html;
}

function onEvent(e) {
  if (e.type === 'spawn') {
    cam.update(0, ball, !cam.wide);
    fx.sparkle(ball.x, ball.y);
  } else if (e.type === 'loop') {
    run.loops++;
    fx.loop(ball.x, ball.y);
    fx.text('Looping !', ball.x, ball.y + 110);
    sound.loop();
    vibrate(14);
  } else if (e.type === 'jump') {
    fx.text('Joli saut !', ball.x, ball.y - 90);
    sound.jump();
    vibrate(10);
  } else if (e.type === 'pit') {
    fx.text('Oups…', ball.x, ball.y - 80);
  } else if (e.type === 'level') {
    const k = e.n - 1, bio = biomeOfSheet(k), before = biomeOfSheet(k - 1);
    const label = k === SHEETS - 1 ? 'Arrivée !' : bio !== before ? `Niveau ${e.n} · ${bio.name}` : `Niveau ${e.n}`;
    fx.text(label, ball.x + 180, Math.max(260, ball.y - 220));
    saveProgress();
  } else if (e.type === 'clink') {
    fx.clink(ball.x, ball.y, e.power);
    sound.clink(e.power);
  } else if (e.type === 'splash') {
    fx.splash(ball.x, ball.y);
    sound.splash(e.power);
  }
}

/* ---------- arrivée et scores ---------- */

function arrive() {
  run.finished = true;
  run.running = false;
  save.setProgress(null);
  $('temps').textContent = clock(run.time);
  $('stats').textContent = `${run.loops} loopings · ${run.bonuses} bonus`;
  $('nom').value = save.lastName || '';
  $('fin-saisie').hidden = false;
  $('fin-scores').innerHTML = '';
  finish.hidden = false;
  sound.loop();
}

function recordScore() {
  const name = ($('nom').value || '').trim().slice(0, 16) || 'Anonyme';
  const rank = save.addScore({ name, time: run.time, loops: run.loops, bonuses: run.bonuses, date: Date.now() });
  $('fin-saisie').hidden = true;
  $('fin-scores').innerHTML = `${rank >= 0 ? `<p>Tu es ${rank === 0 ? '<b>premier</b>' : `<b>${rank + 1}e</b>`} du tableau !</p>` : '<p>Pas dans les 10 meilleurs temps, cette fois.</p>'}${scoreTable(rank)}`;
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
  bonuses.draw(ctx, time, x0, x1, save.options.labels);
  fx.drawHeat(ctx, ball);
  fx.drawSpeed(ctx, ball);
  drawBall(ctx, art.body, ball, track, time);
  fx.draw(ctx);
  weather.draw(ctx);
  // ralenti : écran légèrement bleuté, bords assombris
  const k = Math.max(0, Math.min(1, (1 - timeScale) / (1 - SLOW)));
  if (k > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(70,95,150,${0.13 * k})`;
    ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(30,35,60,0)');
    v.addColorStop(1, `rgba(30,35,60,${0.35 * k})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
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

/* ---------- menu, options, boutons, clavier ---------- */

function applyOptions() {
  const o = save.options;
  sound.setVolumes(o.music, o.sfx);
  cam.wideBy.landscape = o.wideLandscape;
}

const menu = new Menu($('menu'), {
  newGame: () => { finish.hidden = true; restart(true); fullscreen.start(); },
  resume: () => {},
  continueSaved: () => {
    fullscreen.start();
    const p = save.progress;
    if (!p) return restart(true);
    ball.respawn(p.level);
    Object.assign(run, { time: p.time, running: false, finished: false, loops: p.loops, bonuses: p.bonuses });
    launched = false;
    hint.classList.remove('cache');
  },
  options: (k) => {
    applyOptions();
    if (k === 'wideLandscape') refreshButtons();
  },
});

function openMenu() {
  saveProgress();
  menu.open(launched && !run.finished);
}

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
forkLow.addEventListener('click', () => pick('a'));
forkHigh.addEventListener('click', () => pick('b'));
$('menu-btn').addEventListener('click', openMenu);
$('enregistrer').addEventListener('click', recordScore);
$('nom').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') recordScore(); });
$('rejouer-fin').addEventListener('click', () => { finish.hidden = true; restart(true); });
$('fin-menu').addEventListener('click', () => { finish.hidden = true; restart(true); menu.open(false); });
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (menu.isOpen) { if (menu.paused) menu.close(); } else openMenu(); return; }
  if (menu.isOpen) return;
  if (k === 'z') toggleZoom();
  if (k === 'm') toggleMusic();
  if (k === 'a') toggleFork();
  if (k === 'arrowdown' || k === 's') pick('a');
  if (k === 'enter' && slow) pick(slow.route);
  if (k === 'f') { meterOn = !meterOn; fpsBox.hidden = !meterOn; }
  sound.unlock();
});
// Le son ne peut démarrer qu'après un geste : premier toucher, clic ou touche.
const firstSound = (e) => {
  if (!musicBtn.contains(e.target)) sound.unlock();
};
addEventListener('pointerup', firstSound, true);
addEventListener('touchend', firstSound, true);
const fullscreen = setupFullscreen($('plein-ecran'), $('astuce'), () => save.options.autoFullscreen);
addEventListener('pagehide', saveProgress);

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});
applyOptions();
resize();
menu.open(false);
requestAnimationFrame(frame);
window.__boule = { ball, track, cam, sound, bonuses, weather, restart, menu, run, pick };

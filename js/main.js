/**
 * Boucle du jeu : menu et pause, caméra (vue d'ensemble ou suivi), physique en petits pas
 * (1/600 s), quasi-arrêt du temps devant les aiguillages, saut, bonus expliqués, météo, sons,
 * reprise au début du niveau, sauvegarde de la partie, arrivée et tableau des scores.
 */
import { WORLD, SHEET, SHEETS, FINISH, buildTrack, groundY } from './track.js';
import { Ball, BONUS } from './physics.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { Sound } from './audio.js';
import { setupFullscreen } from './fullscreen.js';
import { inkSteps, buildInk } from './ink.js';
import { makePaper, drawTable, drawForks, drawWindsocks } from './scenery.js';
import { drawBirds } from './clouds.js';
import { buildBallBody, drawBall } from './ballArt.js';
import { Effects } from './effects.js';
import { Bonuses, BONUS_INFO } from './bonus.js';
import { Weather } from './weather.js';
import { Hay } from './foin.js';
import { mark, profil, countDraws } from './profil.js';
import { newFrame } from './avance.js';
import { updateResources, readyAt, loadedMB } from './ressources.js';
import { biomeAt, biomeOfSheet } from './biomes.js';
import { save } from './save.js';
import { Menu, scoreTable } from './menu.js';
import { Game, skinPhys, medalTimes } from './game.js';
import { drawObstacles, drawPlanks, obstaclesOf } from './obstacles.js';
import { Balade, baladeLoaded } from './balade.js';
import { Grass } from './herbe.js';
import { drawSky, skyReady } from './ciel.js';
import { drawSoleil } from './soleil.js';
import { drawMountains } from './montagnes.js';
import { moveNuages, drawNuages } from './nuages.js';

const $ = (id) => document.getElementById(id);
const canvas = $('jeu'), screenCtx = canvas.getContext('2d');
let ctx = screenCtx; // (le tour d'essai dessine ailleurs, warmUp)
profil.ctx = screenCtx;
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
const hay = new Hay();
const summer = new Balade();
const grass = new Grass();
const game = new Game();
ball.setSkin(skinPhys(save.skin));
const drawPaper = makePaper();
const FLICK_GAIN = 0.3, FLICK_MAX = 9000;
const SLOW = 0.12;            // devant un aiguillage, le temps passe 8 fois moins vite : la boule avance encore un peu
const FORK_ZONE = 750;        // px avant l'embranchement où le temps ralentit
const FORK_SHOW = 1500;       // px avant l'embranchement où les boutons apparaissent
const FORK_STOP = 90;         // px : sans choix, le temps s'arrête tout au bord de l'embranchement
const WORDS = { red: 'Boost !', blue: 'Colle !', green: 'Bond !', yellow: 'Plume !' };
const vibrate = (ms) => save.options.vibrate && navigator.vibrate?.(ms);

let art = null;

/**
 * Résolution du dessin (pixels de l'écran par point CSS) : qualité haute 2, moyenne 1,5, économique 1,
 * ou automatique (Options → Qualité d'image). Seuls les pixels du canevas changent : le cadrage, la
 * physique et les gestes restent les mêmes (la caméra raisonne en coordonnées du monde).
 */
const dprCap = () => save.options.quality || save.options.autoDpr || 2;
function resize() {
  const dpr = Math.min(dprCap(), devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  cam.resize(canvas.width, canvas.height, dpr);
  // Calques dessinés pour le cadrage le plus zoomé : nets dans les deux vues. En pleine partie, une
  // résolution plus basse garde les feuilles déjà prêtes (plus fines que nécessaire : pas d'à-coup).
  const q = Math.min(cam.followScale, 1);
  const lower = art && q < art.q && launched && !menu?.isOpen;
  if (!art || (Math.abs(art.q - q) > 0.05 && !lower)) {
    art = {
      q, ink: new Map(), pending: new Map(),
      body: buildBallBody(Math.min(cam.followScale * 1.5, 3), save.skin),
    };
  }
  cam.update(1, ball, true);
  refreshButtons();
}

/* ---------- feuilles : dessinées à l'avance, petit à petit, quatre au plus en mémoire ---------- */

const visible = (k) => cam.x < (k + 1) * SHEET && cam.x + cam.viewW > k * SHEET;

// la terre du premier plan est peinte dans les feuilles : une fois ses images chargées,
// on redessine les feuilles préparées sans elle
baladeLoaded.then(() => { if (art) { art.ink.clear(); art.pending.clear(); } });

/** Feuille finie : rangée (canevas sur la carte graphique, ink.js). */
function storeInk(k, c) {
  art.ink.set(k, c);
}

function inkFor(k) {
  if (!art.ink.has(k)) {
    const job = art.pending.get(k);
    let canvasK;
    if (job) {
      let r = job.gen.next();
      while (!r.done) r = job.gen.next();
      canvasK = r.value;
      art.pending.delete(k);
    } else canvasK = buildInk(track, art.q, k);
    storeInk(k, canvasK);
    evict(k);
  }
  return art.ink.get(k);
}

function evict(k) {
  const here = Math.floor(ball.x / SHEET);
  for (const key of [...art.ink.keys()]) {
    if (art.ink.size <= 4) break;
    if (key !== k && Math.abs(key - here) > 1 && !visible(key)) {
      // son canevas resservira pour la prochaine feuille
      if (!art.spare) art.spare = art.ink.get(key);
      art.ink.delete(key);
    }
  }
}

/**
 * Avance la préparation de la feuille suivante, un peu à chaque image : un seul morceau (8 ms de
 * morceaux menu ouvert), et rien si l'image d'avant a été longue (le téléphone rattrape). Après chaque
 * morceau, un pixel de la feuille est posé sur l'écran, presque transparent (render) : la carte
 * graphique fait ce morceau tout de suite, au lieu de tout faire d'un coup quand la feuille arrive
 * à l'écran.
 */
let lastDt = 0, skipped = 0, toFlush = null, lastFrame = performance.now();
function prepare() {
  const k = Math.floor(ball.x / SHEET), t0 = performance.now();
  // pause si l'image d'avant a été longue, mais pas plus de 3 images de suite, ni quand la feuille
  // suivante va bientôt entrer à l'écran
  const soon = !art.ink.has(k + 1) && ball.x > (k + 1) * SHEET - 1200;
  if (!menu.isOpen && lastDt > 0.022 && skipped < 3 && !soon) { skipped++; return; }
  skipped = 0;
  // en jeu, un seul morceau par image (chaque morceau peut être un grand remplissage pour la carte
  // graphique) ; menu ouvert, autant qu'en tiennent 8 ms
  const budget = menu.isOpen ? 8 : 0;
  for (const n of [k + 1, k, k - 1, k + 2]) {
    if (n < 0 || n >= SHEETS || art.ink.has(n)) continue;
    if (!art.pending.has(n)) {
      const holder = { reuse: art.spare };
      art.spare = null;
      art.pending.set(n, { gen: inkSteps(track, art.q, n, holder), holder });
    }
    const job = art.pending.get(n);
    do {
      const r = job.gen.next();
      if (r.done) {
        storeInk(n, r.value);
        art.pending.delete(n);
        evict(n);
        return;
      }
    } while (performance.now() - t0 < budget);
    toFlush = job.holder.canvas;
    return;
  }
}

/* ---------- tour d'essai, menu ouvert : les trois premiers niveaux sont dessinés hors de l'écran,
   une vue par image, pour que leurs grandes images (champs, moulin, ferme, château) soient déjà
   envoyées à la carte graphique et leurs copies préparées : pas d'à-coup en passant devant ---------- */
let warming = false, warmAt = 0, warmed = 0;
const warmStart = performance.now();
function warmUp() {
  // deux passages (le second pour les images arrivées entre-temps), après le chargement
  const t = performance.now() - warmStart;
  if (warmed >= 2 || t < 1200 + warmed * 3000) return;
  const step = cam.viewW * 0.8, x = warmAt * step;
  if (x > 3 * SHEET) { warmed++; warmAt = 0; return; }
  warmAt++;
  if (!warmUp.c) {
    warmUp.c = document.createElement('canvas');
    warmUp.g = warmUp.c.getContext('2d');
  }
  const c = warmUp.c;
  if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; }
  const keep = { x: cam.x, y: cam.y };
  warming = true;
  ctx = warmUp.g;
  try {
    cam.x = x;
    render(0);
  } finally {
    ctx = screenCtx;
    warming = false;
    cam.x = keep.x;
    cam.y = keep.y;
  }
  if (warmed >= 1 && x + step > 3 * SHEET) { c.width = c.height = 0; warmUp.c = null; } // fini : on libère
}

/* ---------- aiguillages : le temps s'arrête presque, deux grands boutons ---------- */

/**
 * État des aiguillages, d'après la seule position de la boule (qu'elle roule, vole ou rebondisse) :
 * - near : l'embranchement est devant, les deux boutons sont posés au début de chaque chemin ;
 * - le temps ralentit fortement dans les derniers FORK_ZONE px, tant que le joueur n'a pas choisi.
 */
let near = null, slow = null, freeze = false;
function updateForks() {
  near = null;
  slow = null;
  freeze = false;
  for (const f of track.forks) {
    const d = f.x - ball.x, onBranch = ball.pc === f.A || ball.pc === f.B;
    // loin en amont : le choix est à refaire au prochain passage (aucun chemin par défaut)
    if (d > FORK_SHOW) { f.decided = false; f.route = null; continue; }
    if (d < -40 || onBranch) continue;
    near = f;
    const forward = ball.onTrack ? ball.v : ball.vx;
    if (!f.decided && d > 0 && d < FORK_ZONE && forward > 30) slow = f;
    // tout au bord de l'embranchement sans choix : le temps s'arrête, c'est au joueur de choisir
    if (!f.decided && d > -10 && d < FORK_STOP && forward > 0) { slow = f; freeze = true; }
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

/**
 * Les deux boutons suivent l'écran, posés au début du chemin du bas et du chemin du haut,
 * toujours dans l'écran (rapprochés du bord si besoin), petits et lisibles.
 */
function placeForkButtons() {
  const W = innerWidth, H = innerHeight;
  for (const [btn, side] of [[forkLow, 'a'], [forkHigh, 'b']]) {
    if (!near || menu.isOpen || infoOpen) { btn.hidden = true; continue; }
    const pc = side === 'a' ? near.A : near.B, i = Math.min(pc.line.length - 1, side === 'a' ? 70 : 85);
    const [wx, wy] = pc.line[i];
    let sx = ((wx - cam.x) * cam.scale) / cam.dpr, sy = ((wy - cam.y) * cam.scale) / cam.dpr + (side === 'a' ? 40 : -44);
    sx = Math.max(70, Math.min(W - 130, sx));
    sy = Math.max(70, Math.min(H - 40, sy));
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

let last = performance.now(), time = 0, launched = false, timeScale = 1, airSlow = 0, infoOpen = false, airTime = 0, tutorial = false;
const run = { time: 0, running: false, finished: false, loops: 0, bonuses: 0 };
let lastSave = 0;

const level = () => Math.max(0, Math.min(SHEETS - 2, Math.floor(ball.x / SHEET)));
const clock = (t) => `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;

function saveProgress() {
  if (run.finished) return;
  save.setProgress({ level: level(), time: run.time, loops: run.loops, bonuses: run.bonuses, score: game.score });
}

/**
 * ↺ : repart du dernier point de reprise passé dans le niveau (juste avant le passage difficile),
 * ou du début du niveau ; les étoiles déjà prises restent prises.
 */
function retryPoint() {
  const lv = level(), start = lv * SHEET;
  return track.retries.filter((r) => r.x >= start - 5 && r.x < ball.x - 40).pop() || null;
}

function restart(fromStart = false) {
  const lv = fromStart ? 0 : level(), point = fromStart ? null : retryPoint();
  ball.respawn(lv, point);
  if (fromStart) game.reset();
  else if (!point || point.x < lv * SHEET + 60) game.enterLevel(lv);
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
  lastDt = (now - last) / 1000;
  last = now;
  time += dt;
  const paused = menu.isOpen || portrait() || infoOpen;
  turn.hidden = !portrait();
  newFrame();
  updateResources(cam.x + cam.viewW / 2, now); // images du décor : celles des saisons proches seulement
  mark('mise à jour');
  if (!paused) update(dt);
  else {
    cam.update(dt, ball);
    // menu ouvert : on prépare d'avance les feuilles et le tour d'essai (pas pendant la partie)
    if (menu.isOpen) { prepare(); warmUp(); }
  }
  render(paused ? 0 : dt * timeScale);
  mark('boutons');
  placeForkButtons();
  updateRecap(paused ? 0 : dt);
  mark(null);
  meter(dt);
  autoQuality((now - lastFrame) / 1000, !paused && !fading && launched);
  lastFrame = now;
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
  updateTutorial();
  const target = freeze ? 0 : choosing ? SLOW : tutorial ? 0.3 : airSlow > 0 ? 0.45 : 1;
  airSlow = Math.max(0, airSlow - realDt);
  timeScale = freeze ? 0 : timeScale + (target - timeScale) * Math.min(1, realDt * 6);
  const dt = realDt * timeScale;
  // toucher bref (ou ↑) : saut
  const taps = input.takeTaps();
  if (input.hopAsked || taps.length) {
    input.hopAsked = false;
    ball.hop(); // le retour (son, traînée) vient de l'événement « hop », y compris pour un saut gardé
    if (!launched) { launched = true; hint.classList.add('cache'); }
    run.running = run.running || !run.finished;
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
  mark('physique');
  const steps = Math.ceil(dt * 600);
  for (let i = 0; i < steps; i++) {
    const vy0 = ball.vy, wasAir = !ball.onTrack;
    ball.step(dt / steps, push);
    if (!ball.onTrack) {
      airTime += dt / steps;
      // au sommet d'un grand saut : un court ralenti pour savourer
      if (wasAir && vy0 < 0 && ball.vy >= 0 && groundY(track, ball.x) - ball.y > 330 && !slow) airSlow = 0.5;
    }
    for (const e of ball.events.splice(0)) onEvent(e);
  }
  mark('jeu');
  const got = game.update(dt, ball);
  if (got) {
    feat('star');
    sound.star();
    fx.big('★', got.x, got.y - 30);
    vibrate(15);
  }
  // étincelles quand la boule file très vite sur la route
  if (ball.onTrack && ball.speed() > 1800 && Math.random() < 0.7) {
    const f = ball.frame();
    fx.sparks(ball.x - f.nx * 28, ball.y - f.ny * 28);
  }
  const hit = bonuses.update(dt, ball);
  if (hit) {
    ball.bonus(hit.color);
    run.bonuses++;
    feat('bonus');
    const c = BONUS[hit.color].color;
    fx.burst(ball.x, ball.y, [`rgb(${c})`, `rgb(${c.map((v) => Math.min(255, v + 50))})`]);
    fx.text(WORDS[hit.color], ball.x, ball.y - 90);
    sound.bonus(hit.color);
    vibrate(20);
    showInfo(hit.color);
  }
  if (!run.finished && ball.x > FINISH.x) arrive();
  mark('décor (calcul)');
  moveNuages(dt);
  summer.update(dt, cam);
  grass.update(dt);
  mark('météo (calcul)');
  weather.update(dt, cam, ball.clock);
  hay.update(dt, cam, weather.wind());
  mark('effets (calcul)');
  fx.follow(ball, dt);
  fx.update(dt);
  cam.update(realDt, ball);
  if (time % 0.25 < realDt) refreshButtons();
  if (time - lastSave > 5 && run.running) { lastSave = time; saveProgress(); }
  mark('feuilles (préparation)');
  prepare();
  mark('son, texte');
  const b = ball.biome();
  sound.update(ball.speed(), ball.onTrack, { ice: b.snow > 0.5, rain: biomeAt(cam.x + cam.viewW / 2).rain, gust: b.wind * weather.wind() });
  const sheet = Math.max(0, Math.min(SHEETS - 1, Math.floor(ball.x / SHEET))), bio = biomeOfSheet(sheet);
  const where = sheet === SHEETS - 1 ? 'Arrivée' : `Niv. ${sheet + 1} · ${bio.name} · ${'★'.repeat(game.starsIn(sheet))}${'☆'.repeat(3 - game.starsIn(sheet))}`;
  const combo = game.combo >= 2 ? ` · ×${game.combo}` : '';
  hud.textContent = `${where} · ${game.score} pts${combo}${run.running || run.finished ? ` · ${clock(run.time)}` : ''}`;
  drawGauges();
}

/**
 * Explication d'un bonus, la première fois seulement qu'on le prend : le jeu se met en pause
 * (elle ne cache plus rien pendant qu'on joue) ; « Compris ! » ou une touche pour repartir.
 */
function showInfo(color) {
  if (save.hasSeen(color)) return;
  save.markSeen(color);
  const b = BONUS_INFO[color];
  info.innerHTML = `<img src="images/boule-${color}.png" alt=""><span><b>${b.title}</b><br>${b.text}</span><button type="button" id="compris">Compris !</button>`;
  info.className = `visible ${color}`;
  infoOpen = true;
  $('compris').addEventListener('click', closeInfo);
}

function closeInfo() {
  info.className = '';
  infoOpen = false;
}

/**
 * Premier obstacle de la partie (une seule fois) : le temps ralentit, une bulle dit
 * « Touche l'écran pour sauter ! » au-dessus de la boule, jusqu'au premier saut.
 */
function updateTutorial() {
  if (save.hasSeen('saut')) return;
  const o = obstaclesOf(track).find((q) => q.x - ball.x > 0 && q.x - ball.x < 520);
  const want = !!o && ball.onTrack && ball.v > 60;
  if (want && !tutorial) { tutorial = true; $('astuce-saut').hidden = false; }
  if (tutorial && (!o || ball.x > o.x)) { tutorial = false; save.markSeen('saut'); $('astuce-saut').hidden = true; }
  if (tutorial) {
    const sx = ((ball.x - cam.x) * cam.scale) / cam.dpr, sy = ((ball.y - cam.y) * cam.scale) / cam.dpr;
    $('astuce-saut').style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy - 90)}px) translate(-50%, -100%)`;
  }
}

/** Un exploit : points, et « ×2, ×3… » quand on enchaîne. */
function feat(kind) {
  const n = game.feat(kind);
  if (n >= 2) {
    fx.big(`×${n}`, ball.x + 80, ball.y - 150, n >= 4 ? '#c0392b' : '#c8901f');
    sound.combo(n);
  }
}

/**
 * Petit bilan du niveau terminé : une ligne en haut, sous le bandeau, sans arrêter le jeu.
 * Le choix d'un chemin passe avant : tant que les boutons d'aiguillage sont là (ou une
 * explication, ou le menu), le bilan attend ; il s'affiche une fois le choix fait.
 */
let recap = null; // { html, t : temps déjà affiché }
const RECAP_TIME = 3.2;
function showRecap(r) {
  if (!r || r.level < 0 || r.level > SHEETS - 2) return;
  const m = medalTimes(r.level), medal = r.medal ? `<span class="medaille ${r.medal}">${r.medal}</span>` : '<span class="medaille">sans médaille</span>';
  const next = r.medal === 'or' ? '' : ` <small>· or en ${Math.round(m.or)} s</small>`;
  const html = `<b>Niveau ${r.level + 1}</b> · ${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} · ${Math.round(r.time)} s ${medal}${r.combo >= 2 ? ` · enchaînement ×${r.combo}` : ''}${r.newRecord ? ' · <b>record !</b>' : ''}${next}`;
  recap = { html, t: 0 };
}

function updateRecap(dt) {
  const el = $('bilan');
  if (!recap) return;
  if (near || infoOpen || menu.isOpen) {
    // place aux boutons : on le cache ; s'il n'a été vu qu'un instant, il reviendra après
    if (el.classList.contains('visible')) {
      el.classList.remove('visible');
      if (recap.t > 1.5) recap = null;
    }
    return;
  }
  if (!el.classList.contains('visible')) {
    el.innerHTML = recap.html;
    el.classList.add('visible');
  }
  recap.t += dt;
  if (recap.t > RECAP_TIME) {
    el.classList.remove('visible');
    recap = null;
  }
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
    feat('loop');
    fx.loop(ball.x, ball.y);
    fx.text('Looping !', ball.x, ball.y + 110);
    sound.loop();
    vibrate(14);
  } else if (e.type === 'jump') {
    feat('jump');
    fx.text('Joli saut !', ball.x, ball.y - 90);
    sound.jump();
    vibrate(10);
  } else if (e.type === 'pit') {
    fx.text('Oups…', ball.x, ball.y - 80);
  } else if (e.type === 'level') {
    const k = e.n - 1, bio = biomeOfSheet(k), before = biomeOfSheet(k - 1);
    const label = k === SHEETS - 1 ? 'Arrivée !' : bio !== before ? `Niveau ${e.n} · ${bio.name}` : `Niveau ${e.n}`;
    fx.text(label, ball.x + 180, Math.max(260, ball.y - 220));
    showRecap(game.finishLevel(k - 1));
    game.enterLevel(k, false);
    saveProgress();
  } else if (e.type === 'clink') {
    fx.clink(ball.x, ball.y, e.power);
    sound.clink(e.power);
  } else if (e.type === 'hop') {
    fx.whoosh(ball.x, ball.y, 0);
    sound.clink(260);
    if (tutorial) { tutorial = false; save.markSeen('saut'); $('astuce-saut').hidden = true; }
  } else if (e.type === 'fell') {
    restart();
  } else if (e.type === 'over') {
    feat('over');
  } else if (e.type === 'puff') {
    fx.puff(e.x, e.y, e.kind);
    sound.puff(e.kind);
  } else if (e.type === 'land') {
    if (e.vn > 900) cam.shake = Math.min(1, e.vn / 2200);
    // atterrissage parfait : dans le sens de la route, sans choc, après un vrai saut
    if (airTime > 0.35 && e.vt > 650 && e.vn < 170) {
      feat('perfect');
      fx.big('Parfait !', ball.x, ball.y - 110, '#4f7a2b');
    }
    airTime = 0;
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
  const stars = Array.from({ length: SHEETS - 1 }, (_, k) => game.starsIn(k)).reduce((a, b) => a + b, 0);
  run.stars = stars;
  $('stats').textContent = `${game.score} points · ${stars} ★ sur ${(SHEETS - 1) * 3} · ${run.loops} loopings · ${run.bonuses} bonus · meilleur enchaînement ×${game.bestCombo}`;
  $('nom').value = save.lastName || '';
  $('fin-saisie').hidden = false;
  $('fin-scores').innerHTML = '';
  finish.hidden = false;
  sound.loop();
}

function recordScore() {
  const name = ($('nom').value || '').trim().slice(0, 16) || 'Anonyme';
  const rank = save.addScore({ name, time: run.time, score: game.score, stars: run.stars || 0, loops: run.loops, bonuses: run.bonuses, date: Date.now() });
  $('fin-saisie').hidden = true;
  $('fin-scores').innerHTML = `${rank >= 0 ? `<p>Tu es ${rank === 0 ? '<b>premier</b>' : `<b>${rank + 1}e</b>`} du tableau !</p>` : '<p>Pas dans les 10 meilleurs temps, cette fois.</p>'}${scoreTable(rank)}`;
}

function render(dt) {
  const W = canvas.width, H = canvas.height, s = cam.scale, x0 = cam.x, x1 = cam.x + cam.viewW;
  mark('papier');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // le papier est caché par le ciel dès qu'il est chargé (sauf hors du parcours, où le ciel s'arrête)
  if (!skyReady(cam.x + cam.viewW / 2) || x0 < 0 || x1 > SHEET * SHEETS) drawPaper(ctx, W, H, cam);
  // petit tremblement de caméra aux gros atterrissages
  cam.shake = Math.max(0, (cam.shake || 0) - dt * 3);
  const sh = (cam.shake || 0) * 10 * cam.dpr, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
  ctx.setTransform(s, 0, 0, s, -cam.x * s + ox, -cam.y * s + oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cam.y - 10, SHEET * SHEETS, cam.viewH + 20);
  ctx.clip();
  mark('ciel');
  drawSky(ctx, cam); // le ciel de la saison, sur tous les niveaux
  mark('soleil');
  drawSoleil(ctx, cam, time); // le soleil, qui descend vers les montagnes au fil des saisons
  mark('montagnes');
  drawMountains(ctx, cam); // les montagnes, de la couleur de la saison
  mark('nuages');
  drawNuages(ctx, cam); // les nuages, deux rangs, de la couleur de la saison
  mark('champs et paysages');
  summer.drawFar(ctx, cam); // la balade en couleurs : ciel, soleil, nuages, montagnes, champs, moulin, ferme
  mark('foin');
  hay.drawFar(ctx); // automne : poussière et brins de foin au-dessus des champs
  mark('oiseaux');
  drawBirds(ctx, time, dt, x0, x1);
  mark('feuilles (terre, route)');
  // seulement la partie visible de chaque feuille (les mêmes feuilles que visible() : pas de feuille
  // dessinée puis aussitôt oubliée, à refaire à chaque image)
  const vy0 = Math.max(0, cam.y - 10), vy1 = Math.min(WORLD.h, cam.y + cam.viewH + 10);
  for (let k = Math.max(0, Math.floor(x0 / SHEET)); k < Math.min(SHEETS, warming ? 0 : Math.ceil(x1 / SHEET)); k++) {
    const c = inkFor(k), q = c.width / SHEET, a = Math.max(x0 - 2, k * SHEET), b = Math.min(x1 + 2, (k + 1) * SHEET);
    if (b <= a || vy1 <= vy0) continue;
    ctx.drawImage(c, (a - k * SHEET) * q, vy0 * q, (b - a) * q, (vy1 - vy0) * q, a, vy0, b - a, vy1 - vy0);
  }
  mark('aiguillages');
  drawForks(ctx, track, time, x0, x1, slow ? 1 : 0);
  ctx.restore();
  mark('table');
  drawTable(ctx, cam);
  mark('obstacles');
  drawPlanks(ctx, track, x0, x1);
  drawObstacles(ctx, track, x0, x1, art.q);
  mark('manches à air');
  drawWindsocks(ctx, track, weather.wind(), time, x0, x1);
  mark('étoiles, fantôme, bonus');
  game.drawStars(ctx, x0, x1, time);
  game.drawGhost(ctx);
  bonuses.draw(ctx, time, x0, x1, save.options.labels);
  mark('boule et effets');
  fx.drawHeat(ctx, ball);
  fx.drawSpeed(ctx, ball);
  drawBall(ctx, art.body, ball, track, time, save.skin);
  fx.draw(ctx);
  mark('foin');
  hay.drawNear(ctx); // automne : brins de foin qui passent tout près
  mark('herbe');
  grass.draw(ctx, cam); // l'herbe fleurie du premier plan, au vent, sur tout le parcours
  mark('météo');
  weather.draw(ctx);
  mark('ralenti, trace');
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
  if (toFlush && !warming) {
    // feuille en préparation : un pixel, à 1 % (invisible), pour que la carte graphique la dessine
    // morceau par morceau (prepare)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.01;
    ctx.drawImage(toFlush, 0, 0, 1, 1, 0, 0, 1, 1);
    ctx.globalAlpha = 1;
    toFlush = null;
  }
}

/* ---------- qualité automatique : si le téléphone n'arrive pas à suivre (moins de 50 images par
   seconde pendant trois mesures de 2 s d'affilée, en jeu), la résolution baisse d'un cran (2 → 1,5 → 1)
   et le choix est gardé pour la fois suivante ---------- */
const auto = { t: 0, n: 0, slow: 0 };
function autoQuality(dt, playing) {
  if (save.options.quality || !playing || document.hidden) { auto.t = auto.n = 0; return; }
  auto.t += dt;
  auto.n++;
  if (auto.t < 2) return;
  const fps = auto.n / auto.t;
  auto.t = auto.n = 0;
  auto.slow = fps < 50 ? auto.slow + 1 : 0;
  const cur = Math.min(dprCap(), devicePixelRatio || 1);
  if (auto.slow < 3 || cur <= 1) return;
  auto.slow = 0;
  save.setOption('autoDpr', cur > 1.5 ? 1.5 : 1);
  resize();
}

/* ---------- compteur d'images par seconde : #fps dans l'adresse, touche F, ou Options ---------- */

let meterOn = location.hash === '#fps' || !!save.options.fps, frames = 0, acc = 0, worst = 0;
countDraws(meterOn);
function meter(dt) {
  if (!meterOn) return;
  frames++;
  acc += dt;
  worst = Math.max(worst, dt);
  if (acc < 0.5) return;
  const mem = performance.memory ? ` · mémoire JS ${Math.round(performance.memory.usedJSHeapSize / 1048576)} Mo` : '';
  const top = profil.top(3).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ');
  const d = profil.topDraws(2), draws = `dessins ${Math.round(d.total)} (${d.top.map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')})`;
  fpsBox.textContent = `${Math.round(frames / acc)} img/s · pire ${Math.round(worst * 1000)} ms · calcul ${(profil.total / Math.max(1, profil.frames)).toFixed(1)} ms (pire ${profil.worst.toFixed(0)}) · ${top} · ${draws} · images ${Math.round(loadedMB())} Mo · résolution ${cam.dpr} · feuilles ${art.ink.size}${mem} · particules ${weather.parts.length}`;
  profil.reset();
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

/* ---------- fondu : pour changer d'endroit d'un coup (nouvelle partie, retour au niveau 1, partie
   reprise), sans voyage de la caméra à travers tout le parcours ---------- */
const veil = $('fondu');
let fading = false;
function fadeJump(action) {
  if (fading) return;
  fading = true;
  veil.classList.add('plein');
  setTimeout(() => {
    action();
    cam.update(1, ball, true); // la caméra arrive directement au nouvel endroit
    // les images du nouvel endroit se chargent et les feuilles se préparent sous le voile (1,5 s au plus)
    const cx = cam.x + cam.viewW / 2, t0 = performance.now();
    updateResources(cx, t0, true);
    const open = () => {
      if (!readyAt(cx) && performance.now() - t0 < 1500) return requestAnimationFrame(open);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        veil.classList.remove('plein');
        fading = false;
      }));
    };
    open();
  }, 300);
}
const restartFromStart = () => fadeJump(() => restart(true));

/** Reprendre la partie enregistrée (au début du niveau atteint). */
function continueSaved() {
  const p = save.progress;
  if (!p) return restart(true);
  ball.respawn(p.level);
  game.reset();
  game.enterLevel(p.level);
  game.score = p.score || 0;
  Object.assign(run, { time: p.time, running: false, finished: false, loops: p.loops, bonuses: p.bonuses });
  launched = false;
  hint.classList.remove('cache');
}

const menu = new Menu($('menu'), {
  newGame: () => { finish.hidden = true; restartFromStart(); fullscreen.start(); },
  resume: () => {},
  continueSaved: () => {
    fullscreen.start();
    fadeJump(continueSaved);
  },
  options: (k) => {
    applyOptions();
    if (k === 'wideLandscape') refreshButtons();
    if (k === 'quality') resize();
    if (k === 'fps') { meterOn = !!save.options.fps; fpsBox.hidden = !meterOn; countDraws(meterOn); }
  },
  skin: (id) => {
    save.setSkin(id);
    ball.setSkin(skinPhys(id));
    art.body = buildBallBody(Math.min(cam.followScale * 1.5, 3), id);
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
  pressTimer = setTimeout(() => { longPress = true; fadeJump(() => { restart(true); fx.text('Retour au niveau 1', ball.x + 200, ball.y - 150); }); }, 700);
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
$('rejouer-fin').addEventListener('click', () => { finish.hidden = true; restartFromStart(); });
$('fin-menu').addEventListener('click', () => { finish.hidden = true; menu.open(false); restartFromStart(); });
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (menu.isOpen) { if (menu.paused) menu.close(); } else openMenu(); return; }
  if (menu.isOpen) return;
  if (k === 'z') toggleZoom();
  if (k === 'm') toggleMusic();
  // aiguillage au clavier : ↑ chemin du haut, ↓ chemin du bas (↑ saute quand il n'y a rien à choisir)
  if ((k === 'arrowup' || k === 'w') && near && !near.decided) { pick('b'); input.hopAsked = false; }
  if ((k === 'arrowdown' || k === 's') && near) pick('a');
  if (k === 'a') toggleFork();
  if ((k === 'enter' || k === ' ') && infoOpen) closeInfo();
  if (k === 'f') { meterOn = !meterOn; fpsBox.hidden = !meterOn; countDraws(meterOn); }
  sound.unlock();
});
// Le son ne peut démarrer qu'après un geste : premier toucher, clic ou touche.
const firstSound = (e) => {
  if (!musicBtn.contains(e.target)) sound.unlock();
};
addEventListener('pointerup', firstSound, true);
addEventListener('touchend', firstSound, true);
const fullscreen = setupFullscreen($('plein-ecran'), $('astuce'), $('demande-plein'), () => save.options.autoFullscreen);
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
window.__boule = { ball, track, cam, sound, bonuses, weather, hay, summer, art: () => art, restart, menu, run, pick };

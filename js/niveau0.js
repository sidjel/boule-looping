/**
 * Niveau 0 : essai des cinq plans de parallaxe, d'après les dessins aux crayons de couleur.
 *   plan 1 : l'herbe, devant tout, qui ondule au vent (glisse plus vite que la route) ;
 *   plan 2 : la butte de terre et le looping (la route, où roule la boule) ;
 *   plan 3 : montagnes, champs, charrette et moulin ;
 *   plan 4 : les trois gros nuages ;
 *   plan 5 : le ciel, le soleil et les petits nuages, tout au fond.
 * Plus un plan est loin, moins il suit la caméra : quand elle avance, il glisse moins vite.
 * Repère du monde : le dessin de la butte (2932 × 1440). Images : tools/decouper-niveau0.py.
 *
 * Page autonome : sa propre petite physique (la boule roule sur la route, fait le looping,
 * décolle si elle va trop vite sur une bosse, retombe) ; au bout, elle revient au départ.
 */
import { buildBallBody } from './ballArt.js';
import { Sound } from './audio.js';

const DIR = 'images/niveau0/';
const STEP = 3;
const geo = await (await fetch(DIR + 'geo.json')).json();
const WW = geo.W, WH = geo.H;
/**
 * Même physique que le jeu, à l'échelle : une feuille du jeu fait 2000 de large, celle-ci WW.
 * Tout ce qui est une longueur ou une vitesse est multiplié par K (gravité, boule, élans).
 */
const K = WW / 2000;
const G = 2400 * K, R = 30 * K, V_MAX = 4200 * K, AIR = 0.00009 / K;
const HOP = 1050 * K, HOP_FORWARD = 260 * K, PUSH = 1500 * K;
const FLICK_GAIN = 0.3, FLICK_MAX = 9000;

const img = {};
await Promise.all(['plan5-ciel', 'plan4-nuages', 'plan3-moulin', 'plan2-butte', 'plan1-herbe', 'tour', 'ailes', 'soleil'].map((n) => new Promise((ok) => {
  const i = new Image();
  i.onload = i.onerror = () => ok();
  i.src = `${DIR}${n}.webp`;
  img[n] = i;
})));

/* ---------- la route : sol du dessin, et le looping (ellipse) ---------- */

/**
 * Le parcours : le dessin de la butte, une feuille comme le niveau 1 ; au bout, la boule
 * revient au départ.
 */
const COPIES = 1;
const WORLD_W = WW * COPIES;

function buildPath() {
  const gnd0 = geo.ground, [ex0, ey0, ea, eb, angDeg] = geo.ellipse;
  const pts = [];
  for (let c = 0; c < COPIES; c++) {
    const flip = c % 2 === 1, off = c * WW;
    const gnd = (x) => gnd0[Math.max(0, Math.min(WW - 1, Math.round(flip ? WW - 1 - x : x)))];
    const ang = ((flip ? -angDeg : angDeg) * Math.PI) / 180, ex = flip ? WW - ex0 : ex0;
    let ey = ey0;
    const E = (t) => {
      const x = ea * Math.cos(t), y = eb * Math.sin(t);
      return [ex + x * Math.cos(ang) - y * Math.sin(ang), ey + x * Math.sin(ang) + y * Math.cos(ang)];
    };
    let tb = 0;
    for (let t = 0; t < Math.PI * 2; t += 0.001) if (E(t)[1] > E(tb)[1]) tb = t;
    ey += gnd(E(tb)[0]) - E(tb)[1]; // le bas du looping posé sur le sol
    const dirSign = E(tb + 0.01)[0] > E(tb)[0] ? 1 : -1;
    const bx = E(tb)[0], D = 70; // l'entrée et la sortie du looping, écartées de D
    for (let x = c ? 3 : 0; x < bx - D / 2; x += 6) pts.push([off + x, gnd(x)]);
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const u = i / n, [x, y] = E(tb + dirSign * u * Math.PI * 2);
      pts.push([off + x - D / 2 + D * u, y]);
    }
    for (let x = Math.ceil(bx + D / 2); x < WW; x += 6) pts.push([off + x, gnd(x)]);
  }
  // lissage léger puis pas constant
  const sm = pts.map((p, i) => {
    let sx = 0, sy = 0, c = 0;
    for (let j = i - 2; j <= i + 2; j++) if (pts[j]) { sx += pts[j][0]; sy += pts[j][1]; c++; }
    return [sx / c, sy / c];
  });
  const line = resample(sm, STEP);
  // centre de la boule : décalé d'un rayon à gauche du sens de marche
  const tan = tangents(line);
  const center = resample(line.map(([x, y], i) => [x + R * tan[i][1], y - R * tan[i][0]]), STEP);
  const t2 = tangents(center), k = new Float32Array(center.length);
  for (let i = 2; i < center.length - 2; i++) {
    const dtx = (t2[i + 1][0] - t2[i - 1][0]) / (2 * STEP), dty = (t2[i + 1][1] - t2[i - 1][1]) / (2 * STEP);
    k[i] = dtx * t2[i][1] - dty * t2[i][0];
  }
  const ks = k.map((_, i) => { let s = 0, c = 0; for (let j = i - 4; j <= i + 4; j++) if (j >= 0 && j < k.length) { s += k[j]; c++; } return s / c; });
  // points « en l'air » du looping : on ne s'y pose pas en tombant de l'extérieur
  const groundAt = (x) => { const c = Math.floor(x / WW), u = x - c * WW; return gnd0[Math.max(0, Math.min(WW - 1, Math.round(c % 2 ? WW - 1 - u : u)))]; };
  const loop = center.map(([x, y]) => y < groundAt(x) - R * 2 - 30);
  // le haut du looping (pour le son)
  let top = -1;
  loop.forEach((l, i) => { if (l && (top < 0 || center[i][1] < center[top][1])) top = i; });
  return { line, c: center, t: t2, k: ks, loop, top, n: center.length, L: (center.length - 1) * STEP };
}

function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
    let pos = step - carry;
    while (pos <= len) { out.push([ax + ((bx - ax) * pos) / len, ay + ((by - ay) * pos) / len]); pos += step; }
    carry = len - (pos - step);
  }
  return out;
}
function tangents(p) {
  return p.map((_, i) => {
    const a = p[Math.max(0, i - 2)], b = p[Math.min(p.length - 1, i + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  });
}
const path = buildPath();

function at(s) {
  const f = Math.max(0, Math.min(path.n - 1.001, s / STEP)), i = Math.floor(f), u = f - i;
  const L = (a) => a[i] + (a[i + 1] - a[i]) * u;
  const x = path.c[i][0] + (path.c[i + 1][0] - path.c[i][0]) * u, y = path.c[i][1] + (path.c[i + 1][1] - path.c[i][1]) * u;
  let tx = path.t[i][0] + (path.t[i + 1][0] - path.t[i][0]) * u, ty = path.t[i][1] + (path.t[i + 1][1] - path.t[i][1]) * u;
  const l = Math.hypot(tx, ty) || 1;
  return { x, y, tx: tx / l, ty: ty / l, k: L(path.k) };
}

/* ---------- la boule ---------- */

const START = 40;
const ball = { leftS: 0, on: true, s: START, v: 0, x: 0, y: 0, vx: 0, vy: 0, angle: 0, air: 0 };
function respawn() {
  Object.assign(ball, { on: true, s: START, v: 0, vx: 0, vy: 0, air: 0 });
  const p = at(START); ball.x = p.x; ball.y = p.y;
}
respawn();

function step(dt, push) {
  if (ball.on) {
    const p = at(ball.s);
    // pente, roulement (comme l'été du jeu : 5/7 · 0,018 de l'appui), air, poussée du doigt
    const Np = Math.max(0, ball.v * ball.v * p.k + G * p.tx);
    let a = G * p.ty * (5 / 7) - Math.sign(ball.v) * (5 / 7) * 0.018 * Np - AIR * ball.v * Math.abs(ball.v) + push * p.tx;
    ball.v = Math.max(-V_MAX, Math.min(V_MAX, ball.v + a * dt));
    const s0 = ball.s;
    ball.s += ball.v * dt;
    // passage au sommet du looping, à l'endroit : petite clochette
    const topS = path.top * STEP;
    if (ball.v > 0 && s0 < topS && ball.s >= topS) sound.loop();
    if (ball.s < START - 10) { ball.s = START - 10; ball.v = Math.abs(ball.v) * 0.3; }
    if (ball.s > path.L - 6) { respawn(); return; }
    const q = at(ball.s);
    ball.x = q.x; ball.y = q.y;
    ball.angle += (ball.v * dt) / R;
    // tombe du haut du looping si elle n'a pas assez d'élan (comme dans le jeu, la boule
    // reste sur la route ailleurs ; on saute d'une touche brève)
    const N = ball.v * ball.v * q.k + G * q.tx; // force de la route le long de n = (ty, −tx)
    if (N < 0 && -q.tx > 0.15) {
      ball.on = false;
      ball.leftS = ball.s;
      ball.vx = q.tx * ball.v; ball.vy = q.ty * ball.v;
      ball.air = 0;
    }
  } else {
    ball.air += dt;
    ball.vy += G * dt;
    ball.vx += push * 0.15 * dt;
    const nx = ball.x + ball.vx * dt, ny = ball.y + ball.vy * dt;
    // atterrissage : le point du chemin le plus proche, s'il est franchi
    if (ball.air > 0.05) {
      // le premier point du chemin (après celui d'où l'on a décollé) qui est assez près :
      // à l'entrée d'un looping, c'est l'entrée et non la sortie, juste à côté
      let best = -1, bd = 1e9;
      const from = Math.max(0, Math.floor(ball.leftS / STEP) - 60), inLoop = path.loop[Math.floor(ball.leftS / STEP)];
      for (let i = from; i < path.n; i += 2) {
        if (path.loop[i] && !inLoop) continue;
        const dx = path.c[i][0] - nx, dy = path.c[i][1] - ny, d = dx * dx + dy * dy;
        if (d < 400) { if (best < 0 || d < bd) { bd = d; best = i; } }
        else if (best >= 0) break;
      }
      if (best < 0) for (let i = 0; i < path.n; i += 2) {
        if (path.loop[i] && !inLoop) continue;
        const dx = path.c[i][0] - nx, dy = path.c[i][1] - ny, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      const t = path.t[best], c = path.c[best];
      const side = (nx - c[0]) * t[1] - (ny - c[1]) * t[0]; // > 0 : du côté de la boule
      if (Math.sqrt(bd) < 20 && (side < 4 || Math.sqrt(bd) < 4)) {
        ball.on = true;
        ball.s = best * STEP;
        ball.v = ball.vx * t[0] + ball.vy * t[1];
        // choc acier : la vitesse qui rentre dans la route
        const hit = Math.abs(ball.vx * t[1] - ball.vy * t[0]);
        if (hit > 150) sound.clink(hit * 1.5);
        const q = at(ball.s);
        ball.x = q.x; ball.y = q.y;
        return;
      }
    }
    ball.x = nx; ball.y = ny;
    ball.angle += (ball.vx * dt) / R;
    if (ball.y > WH + 200 || ball.x < -200 || ball.x > WORLD_W + 200) respawn();
  }
}

/* ---------- son : la musique et les bruitages du jeu ---------- */

const sound = new Sound();
const musicBtn = document.getElementById('musique');
const showMusic = () => { musicBtn.textContent = sound.musicOn ? '♪' : '♪̸'; musicBtn.style.opacity = sound.musicOn ? 1 : 0.55; };
showMusic();
musicBtn.onclick = (e) => { e.stopPropagation(); sound.unlock(); sound.toggleMusic(); showMusic(); };
// le navigateur ne laisse jouer le son qu'après un geste
addEventListener('pointerdown', () => sound.unlock(), { capture: true });
addEventListener('keydown', () => sound.unlock(), { capture: true });

/* ---------- entrées : glisser pour lancer, toucher bref pour sauter, doigt posé pour pousser ---------- */

const canvas = document.getElementById('jeu'), ctx = canvas.getContext('2d');
let touch = null, started = false;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  touch = { x0: e.clientX, x: e.clientX, t0: e.timeStamp, pts: [[e.clientX, e.timeStamp]] };
});
canvas.addEventListener('pointermove', (e) => {
  if (!touch) return;
  touch.x = e.clientX;
  touch.pts.push([e.clientX, e.timeStamp]);
  if (touch.pts.length > 8) touch.pts.shift();
});
const end = (e) => {
  if (!touch) return;
  const dt = (e.timeStamp - touch.t0) / 1000, dx = e.clientX - touch.x0;
  if (dt < 0.25 && Math.abs(dx) < 12) hop();
  else {
    const [ax, at0] = touch.pts[0], vx = (e.clientX - ax) / Math.max(0.016, (e.timeStamp - at0) / 1000);
    // comme le jeu : même geste, même élan (vitesse du doigt ramenée au cadrage « suivre »)
    const fs = Math.min(Math.max(W / 2000, H / 1433), W / 1000);
    let wx = (vx * dpr) / fs;
    if (Math.abs(wx) > 120) kick(Math.max(-FLICK_MAX, Math.min(FLICK_MAX, wx)) * FLICK_GAIN * K);
  }
  touch = null;
  hideHelp();
};
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', () => (touch = null));
const keys = new Set();
addEventListener('keyup', (e) => keys.delete(e.key));
addEventListener('keydown', (e) => {
  keys.add(e.key);
  if (e.key === ' ' && !e.repeat) kick(2600 * FLICK_GAIN * K); // comme le jeu : espace = un lancer
  if (e.key === 'ArrowUp') hop();
});
function kick(v) {
  hideHelp();
  if (ball.on) {
    // le geste est horizontal : projeté sur la route
    const p = at(ball.s);
    ball.v = Math.max(-V_MAX, Math.min(V_MAX, ball.v + v * p.tx));
  }
}
function hop() {
  if (!ball.on) return;
  sound.jump();
  const p = at(ball.s);
  ball.on = false;
  ball.leftS = ball.s;
  const dir = ball.v >= 0 ? 1 : -1;
  ball.vx = p.tx * ball.v + p.ty * HOP + p.tx * dir * HOP_FORWARD; // normale (ty, -tx)
  ball.vy = p.ty * ball.v - p.tx * HOP + p.ty * dir * HOP_FORWARD;
  ball.air = 0;
}
function pushNow() {
  const kd = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  if (kd) return kd * PUSH;
  if (!touch || performance.now() - touch.t0 < 250 && Math.abs(touch.x - touch.x0) < 12) return 0;
  const bx = (ball.x - cam.x) * cam.scaleCss;
  const d = touch.x - bx;
  if (Math.abs(touch.x - touch.x0) > 30) return 0; // c'est un glissé, pas une poussée
  return Math.sign(d) * PUSH; // horizontal, projeté sur la route dans step()
}
let helpHidden = false;
function hideHelp() {
  if (helpHidden) return;
  helpHidden = true;
  setTimeout(() => document.getElementById('aide').classList.add('cache'), 1500);
}

/* ---------- caméra ---------- */

const cam = { x: 0, y: 0, scale: 1, scaleCss: 1, zoomed: false };
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = canvas.width = Math.round(innerWidth * dpr);
  H = canvas.height = Math.round(innerHeight * dpr);
}
resize();
addEventListener('resize', resize);
document.getElementById('zoom').onclick = () => (cam.zoomed = !cam.zoomed);
document.getElementById('retour').onclick = () => (location.href = 'index.html');
document.getElementById('plein').onclick = () => {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
};

/**
 * Vue d'ensemble (par défaut) : tout le niveau en largeur, d'un coup, sans bouger ;
 * le bas de la feuille calé en bas de l'écran (sur un écran plus haut, on voit plus de ciel).
 * Loupe : la caméra suit la boule de près, et les plans glissent en parallaxe.
 */
function updateCam(dt, snap) {
  const target = cam.zoomed ? H / 900 : W / WW;
  cam.scale += (target - cam.scale) * (snap ? 1 : 1 - Math.exp(-dt * 4));
  cam.scaleCss = cam.scale / dpr;
  const vw = W / cam.scale, vh = H / cam.scale;
  const lead = Math.max(-250, Math.min(250, (ball.on ? ball.v * at(ball.s).tx : ball.vx) * 0.18));
  const tx = cam.zoomed ? Math.max(0, Math.min(WORLD_W - vw, ball.x + lead - vw * 0.42)) : 0;
  const k = snap ? 1 : 1 - Math.exp(-dt * 3.5);
  cam.x += (tx - cam.x) * k;
  cam.y = WH - vh;
}

/* ---------- dessin des plans ---------- */

const ok = (i) => i && i.complete && i.naturalWidth > 0;
const mirrors = new Map();
function mirror(i) {
  if (!mirrors.has(i)) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(i, 0, 0);
    mirrors.set(i, c);
  }
  return mirrors.get(i);
}

/**
 * Pose un plan : f = part du mouvement de la caméra qu'il suit en sens inverse
 * (1 : collé à la route ; 0,1 : très loin, il bouge à peine ; > 1 : devant la route).
 * L'image (largeur w, hauteur h, en unités du monde, coin haut-gauche à (x, y)) est répétée
 * en miroir sur les côtés pour couvrir l'écran.
 */
function layer(i, f, x, y, w, h, drift = 0, tiles = null, mirrored = true) {
  if (!ok(i)) return;
  const s = cam.scale, vw = W / s;
  // position à l'écran du point (x, y) du plan
  const ox = (x - cam.x * f + drift), oy = (y - (cam.y - (WH - H / s)) * f - (WH - H / s));
  let k0 = Math.floor((-ox) / w) - 1, k1 = Math.ceil((vw - ox) / w);
  if (tiles) { k0 = Math.max(k0, 0); k1 = Math.min(k1, tiles - 1); }
  for (let k = k0; k <= k1; k++) {
    const src = !mirrored || k % 2 === 0 ? i : mirror(i);
    ctx.drawImage(src, (ox + k * w) * s, oy * s, w * s + 1, h * s);
  }
}

/**
 * Plan répété sans miroir, avec un fondu : chaque copie recouvre la fin de la précédente
 * sur une bande dont l'opacité monte doucement (pas de coupure nette au raccord).
 */
const fades = new Map();
function fadedLeft(i, part) {
  if (!fades.has(i)) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(i, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createLinearGradient(0, 0, c.width * part, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    fades.set(i, c);
  }
  return fades.get(i);
}
function layerBlend(i, f, x, y, w, h, part = 0.22) {
  if (!ok(i)) return;
  const s = cam.scale, vw = W / s, step = w * (1 - part), src = fadedLeft(i, part);
  const ox = x - cam.x * f, oy = y - (cam.y - (WH - H / s)) * f - (WH - H / s);
  const k0 = Math.floor(-ox / step) - 1, k1 = Math.ceil((vw - ox) / step);
  for (let k = k0; k <= k1; k++) ctx.drawImage(k === k0 ? i : src, (ox + k * step) * s, oy * s, w * s + 1, h * s);
}

const body = buildBallBody(2);
let time = 0;

/**
 * L'herbe ondule au vent. Elle est découpée en fines bandes HORIZONTALES (pas verticales :
 * plus de coupures dans les brins) ; chaque bande glisse de côté d'autant plus qu'elle est
 * haute, le pied ne bouge pas. Le souffle varie lentement (rafales douces).
 */
function drawGrass() {
  const i = img['plan1-herbe'];
  if (!ok(i)) return;
  const f = 1.3, s = cam.scale, scale = WW / 2932;
  const w = (i.naturalWidth / 0.8) * scale, h = (i.naturalHeight / 0.8) * scale;
  const base = WH + 70, top = base - h, vh = H / s;
  const ox = -cam.x * f, oy = -(cam.y - (WH - vh)) * f - (WH - vh);
  const gust = 0.09 * Math.sin(time * 1.3) + 0.04 * Math.sin(time * 2.7 + 1) + 0.02 * Math.sin(time * 5.1) + 0.03;
  const ROW = 3, ih = i.naturalHeight, sc = ih / h;
  const k0 = Math.floor(-ox / w) - 1, k1 = Math.ceil((W / s - ox) / w);
  for (let y = 0; y < h; y += ROW) {
    const lift = (h - y) / h; // 1 en haut, 0 au pied
    const dx = gust * h * lift * lift;
    const rh = Math.min(ROW, h - y);
    for (let k = k0; k <= k1; k++) {
      const src = ((k % 2) + 2) % 2 === 1 ? mirror(i) : i;
      ctx.drawImage(src, 0, y * sc, i.naturalWidth, rh * sc, (ox + k * w + dx) * s, (top + oy + y) * s, w * s + 1, rh * s + 0.6);
    }
  }
}

function drawBall() {
  const s = cam.scale, x = (ball.x - cam.x) * s, y = (ball.y - cam.y) * s, r = R * s;
  // ombre sous la boule, sur la route
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ball.angle);
  const k = (r * 2) / (body.size - 12) ;
  ctx.drawImage(body.canvas, -body.size * k / 2, -body.size * k / 2, body.size * k, body.size * k);
  ctx.restore();
}

/* ---------- plan 5 : ciel et soleil qui brille ---------- */

function drawSky() {
  const i = img['plan5-ciel'];
  if (!ok(i)) return;
  const s = cam.scale, f = 0.08;
  // le ciel couvre tout l'écran, jusqu'en haut même sur un écran plus haut que la feuille
  const top = Math.min(0, cam.y), hh = WH - top, ww = Math.max(WW, (hh * WW) / WH);
  // sur un écran très large, le haut de la feuille est coupé : le ciel (très loin) descend
  // un peu pour garder le soleil entier
  const sx = (WW - ww) / 2 - cam.x * f, sy = top - cam.y + Math.max(0, cam.y) * 0.9, k = ww / WW;
  ctx.drawImage(i, sx * s, sy * s, ww * s, hh * s);
  // le soleil : un halo qui respire, et le disque qui grossit à peine
  const sun = img.soleil, g = geo.soleil;
  const cx = (sx + g.cx * k) * s, cy = (sy + g.cy * (hh / WH)) * s;
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.6), R0 = 150 * k * s;
  const halo = ctx.createRadialGradient(cx, cy, R0 * 0.9, cx, cy, R0 * (1.7 + 0.2 * pulse));
  halo.addColorStop(0, `rgba(255,214,90,${0.16 + 0.1 * pulse})`);
  halo.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - R0 * 3, cy - R0 * 3, R0 * 6, R0 * 6);
  if (ok(sun)) {
    const z = 1 + 0.035 * pulse + 0.01 * Math.sin(time * 4.3), w = (sun.naturalWidth / 0.5) * k * s * z, h = (sun.naturalHeight / 0.5) * k * s * z;
    const ox = (g.x / (sun.naturalWidth / 0.5)) * w, oy = (g.y / (sun.naturalHeight / 0.5)) * h;
    ctx.drawImage(sun, cx - ox, cy - oy, w, h);
    // reflet qui scintille
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12 + 0.12 * Math.max(0, Math.sin(time * 2.3));
    ctx.drawImage(sun, cx - ox, cy - oy, w, h);
    ctx.restore();
  }
}

/* ---------- plan 3 : montagnes, champs, charrette, moulin qui tourne, pailles qui s'envolent ---------- */

const straws = [];
let spawn = 0;
const rnd = (a, b) => a + Math.random() * (b - a);
function stepStraws(dt) {
  spawn -= dt;
  if (spawn <= 0 && straws.length < 16) {
    spawn = rnd(0.2, 0.7);
    straws.push({ x: rnd(420, 720), y: rnd(820, 870), vx: rnd(30, 80), vy: rnd(-55, -20), a: rnd(0, Math.PI), va: rnd(-2.5, 2.5),
      len: rnd(16, 30), life: 0, max: rnd(4, 7), ph: rnd(0, 6.3), col: Math.random() < 0.5 ? '#e3b544' : '#c99232' });
  }
  for (let i = straws.length - 1; i >= 0; i--) {
    const p = straws[i];
    p.life += dt;
    if (p.life > p.max) { straws.splice(i, 1); continue; }
    p.vx += (10 + 16 * Math.sin(time * 0.9 + p.ph)) * dt;
    p.vy += (-5 + 26 * Math.sin(time * 1.7 + p.ph * 2)) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
  }
}

function drawPlan3() {
  const i = img['plan3-moulin'];
  if (!ok(i)) return;
  const s = cam.scale, f = 0.45, p3 = geo.plan3, k3 = WW / p3.w;
  const y3 = WH + 80 - p3.h * k3;
  ctx.save();
  ctx.setTransform(s * k3, 0, 0, s * k3, -cam.x * f * s, (y3 - cam.y) * s);
  ctx.drawImage(i, 0, p3.top, p3.w, p3.h - p3.top);
  // le moulin, dessiné à part (même repère que le paysage) : la tour, puis les ailes qui tournent
  const m2 = geo.moulin2, tour = img.tour, ailes = img.ailes;
  if (ok(tour)) ctx.drawImage(tour, m2.tour[0], m2.tour[1], m2.tour[2], m2.tour[3]);
  if (ok(ailes)) {
    ctx.save();
    ctx.translate(m2.moyeu[0], m2.moyeu[1]);
    ctx.rotate(time * 0.55);
    ctx.drawImage(ailes, -m2.ailes / 2, -m2.ailes / 2, m2.ailes, m2.ailes);
    ctx.restore();
  }
  // fines pailles qui s'envolent de la charrette
  ctx.lineCap = 'round';
  for (const p of straws) {
    const a = Math.min(1, p.life / 0.6, (p.max - p.life) / 1.2), dx = (Math.cos(p.a) * p.len) / 2, dy = (Math.sin(p.a) * p.len) / 2;
    ctx.globalAlpha = 0.95 * a;
    ctx.strokeStyle = p.col;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(p.x - dx, p.y - dy);
    ctx.quadraticCurveTo(p.x + dy * 0.25, p.y - dx * 0.25, p.x + dx, p.y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#a9cfee';
  ctx.fillRect(0, 0, W, H);
  // plan 5 : ciel et soleil, tout au fond
  drawSky();
  // plan 4 : les gros nuages, qui dérivent aussi doucement avec le vent
  const p4 = geo.plan4;
  layer(img['plan4-nuages'], 0.25, 0, p4.y - 60, WW, p4.h, (time * 12) % (WW * 2));
  // plan 3 : montagnes, champs, une seule charrette, moulin
  drawPlan3();
  // plan 2 : la butte et le looping, puis la boule
  const p2 = geo.plan2;
  layer(img['plan2-butte'], 1, 0, p2.top, WW, WH - p2.top, 0, COPIES);
  drawBall();
  // plan 1 : l'herbe au premier plan
  drawGrass();
}

let last = performance.now();
updateCam(0, true);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const push = pushNow();
  for (let i = 0; i < 4; i++) step(dt / 4, push);
  updateCam(dt, false);
  stepStraws(dt);
  sound.update(Math.abs(ball.on ? ball.v : Math.hypot(ball.vx, ball.vy)), ball.on, {});
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__n0 = { ball, cam, path, kick, hop, sound };

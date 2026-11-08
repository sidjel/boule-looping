/**
 * Arrière-plan du niveau 1, tiré du second dessin : montagnes bleues, charrette de foin,
 * arbre, moulin. Il est posé derrière la route et se décale moins vite qu'elle quand la
 * caméra avance (parallaxe) : la profondeur donne un effet 2,5D.
 * Animations : les pales du moulin tournent, le feuillage se balance, le foin ondule dans
 * la charrette et quelques fines pailles s'envolent.
 *
 * Les images sont dans le repère du dessin (2000 de large) ; place() les pose dans le monde.
 */
import { SHEET } from './levels.js';
import { groundY } from './track.js';

const DIR = 'images/fond1/';
// boîtes des morceaux dans le repère du dessin (x0, y0, x1, y1)
const PIECES = {
  montagnes: [0, 440, 2000, 1110],
  tronc: [875, 905, 1255, 1095],
  feuillage: [875, 585, 1255, 905],
  paille: [285, 812, 665, 935],
  charrette: [285, 935, 665, 1048],
  moulin: [1468, 470, 1812, 1062],
};
const HUB = [1637, 645];          // axe des pales
const BLADE = { len: 205, from: 10, h: 84 }; // la pale (image) commence à 10 px de l'axe
const BLADE_ANGLES = [-0.73, 0.84, 2.41, 3.98]; // comme sur le dessin (en X)
const FOLIAGE_PIVOT = [1062, 885]; // haut du tronc
const HAY_BASE = 935;              // le foin ondule autour de son pied (bord de la charrette)

// pose dans le monde : le sol du dessin (y 1030) un peu sous la route, réduit (lointain)
const PIVOT = [1000, 1030], ANCHOR = [960, 1080], SCALE = 0.84;
// parallaxe : part du déplacement de la caméra que suit le décor (0 = collé à la route)
const PAR_X = 0.24, PAR_Y = 0.14, REF = [1000, 716];
const ALPHA = 0.88;
const RES = 0.5; // résolution de l'image de travail (part de celle de l'écran)

const img = {};
for (const name of [...Object.keys(PIECES), 'pale']) {
  const i = new Image();
  i.decoding = 'async';
  i.src = `${DIR}${name}.webp`;
  img[name] = i;
}
const ready = (i) => i.complete && i.naturalWidth > 0;

/** Les parties fixes (montagnes, tronc, charrette, moulin) réunies une fois en une seule image. */
let still = null;
function stillLayer() {
  if (still) return still;
  if (!['montagnes', 'tronc', 'charrette', 'moulin'].every((n) => ready(img[n]))) return null;
  const [X0, Y0, X1, Y1] = PIECES.montagnes;
  const c = document.createElement('canvas');
  c.width = X1 - X0; c.height = Y1 - Y0;
  const g = c.getContext('2d');
  g.translate(-X0, -Y0);
  for (const n of ['montagnes', 'tronc', 'charrette', 'moulin']) piece(g, n);
  still = c;
  return c;
}

/* ---------- pailles qui s'envolent ---------- */

const straws = [];
let spawn = 0;
function rnd(a, b) { return a + Math.random() * (b - a); }

function stepStraws(dt, t) {
  spawn -= dt;
  if (spawn <= 0 && straws.length < 14) {
    spawn = rnd(0.25, 0.8);
    straws.push({
      x: rnd(330, 610), y: rnd(835, 875), vx: rnd(25, 70), vy: rnd(-45, -18),
      a: rnd(0, Math.PI), va: rnd(-2.5, 2.5), len: rnd(14, 26), life: 0, max: rnd(3.5, 6.5),
      ph: rnd(0, 6.3), col: Math.random() < 0.5 ? '#d8ad45' : '#c4923a',
    });
  }
  for (let i = straws.length - 1; i >= 0; i--) {
    const s = straws[i];
    s.life += dt;
    if (s.life > s.max) { straws.splice(i, 1); continue; }
    // petite brise d'été : elles montent, tournoient et dérivent vers la droite
    s.vx += (8 + 14 * Math.sin(t * 0.9 + s.ph)) * dt;
    s.vy += (-4 + 22 * Math.sin(t * 1.7 + s.ph * 2)) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.a += s.va * dt;
  }
}

function drawStraws(ctx) {
  ctx.lineCap = 'round';
  for (const s of straws) {
    const k = Math.min(1, s.life / 0.6, (s.max - s.life) / 1.2);
    const dx = Math.cos(s.a) * s.len / 2, dy = Math.sin(s.a) * s.len / 2;
    ctx.globalAlpha = 0.9 * k;
    ctx.strokeStyle = s.col;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(s.x - dx, s.y - dy);
    // brin un peu courbe, comme un trait de crayon
    ctx.quadraticCurveTo(s.x + dy * 0.25, s.y - dx * 0.25, s.x + dx, s.y + dy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---------- dessin ---------- */

function piece(ctx, name) {
  const [x0, y0, x1, y1] = PIECES[name];
  ctx.drawImage(img[name], x0, y0, x1 - x0, y1 - y0);
}

function drawBlades(ctx, t) {
  const turn = t * 0.75;
  ctx.save();
  ctx.translate(HUB[0], HUB[1]);
  for (const a0 of BLADE_ANGLES) {
    ctx.save();
    ctx.rotate(a0 + turn);
    // le bras, du moyeu jusqu'au bout de la voile
    ctx.strokeStyle = '#7a5040';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(BLADE.len - 6, 1);
    ctx.stroke();
    ctx.drawImage(img.pale, BLADE.from, -BLADE.h / 2);
    ctx.restore();
  }
  ctx.fillStyle = '#6b4232';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class Background {
  constructor() { this.t = 0; }

  /** Visible si la première feuille (niveau 1) est à l'écran. */
  visible(x0) { return x0 < SHEET + 500; }

  update(dt, x0) {
    this.t += dt;
    if (this.visible(x0)) stepStraws(dt, this.t);
  }

  /**
   * Dessine le décor, dans le repère du monde, sous la route.
   * @param cam caméra (x, y, viewW, viewH)
   * @param ball la boule : le décor suit aussi un peu son avancée, même quand la caméra
   *   ne bouge pas (vue d'ensemble)
   */
  draw(ctx, cam, track, ball) {
    const x0 = cam.x, x1 = cam.x + cam.viewW;
    const layer = stillLayer();
    if (!this.visible(x0) || !layer) return;
    // « regard » entre le centre de l'écran et la boule
    const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
    const vx = cx + (ball.x - cx) * 0.5, vy = cy + (ball.y - cy) * 0.3;
    // lissé : pas d'à-coup quand la boule saute ou repart
    this.vx = this.vx === undefined || Math.abs(this.vx - vx) > 1500 ? vx : this.vx + (vx - this.vx) * 0.08;
    this.vy = this.vy === undefined || Math.abs(this.vy - vy) > 1500 ? vy : this.vy + (vy - this.vy) * 0.08;
    const ox = (this.vx - REF[0]) * PAR_X, oy = (this.vy - REF[1]) * PAR_Y;
    // Le décor est peint dans une image à demi-résolution (plus léger, et le léger flou
    // le met au loin), puis posé d'un seul coup sur l'écran.
    const m = ctx.getTransform();
    const k = RES;
    const toWorld = (px, py) => [ANCHOR[0] + ox + (px - PIVOT[0]) * SCALE, ANCHOR[1] + oy + (py - PIVOT[1]) * SCALE];
    const [dl, dt] = toWorld(0, 380), [dr, db] = toWorld(2000, 1110);
    const wa = Math.max(x0, dl), wb = Math.min(x1, dr), wt = Math.max(cam.y, dt), wd = Math.min(cam.y + cam.viewH, db);
    if (wb <= wa || wd <= wt) return;
    // rectangle du décor à l'écran (pixels), et l'image de travail qui le couvre
    const sx = Math.floor(m.a * wa + m.e), sy = Math.floor(m.d * wt + m.f);
    const sw = Math.ceil(m.a * (wb - wa)) + 2, sh = Math.ceil(m.d * (wd - wt)) + 2;
    const cw = Math.ceil(sw * k), ch = Math.ceil(sh * k);
    if (!this.off) { this.off = document.createElement('canvas'); this.g = this.off.getContext('2d'); }
    const off = this.off, g = this.g;
    if (off.width < cw || off.height < ch) { off.width = Math.max(off.width, cw); off.height = Math.max(off.height, ch); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw + 2, ch + 2);
    // repère du monde dans l'image de travail
    g.setTransform(m.a * k, 0, 0, m.d * k, (m.e - sx) * k, (m.f - sy) * k);
    g.save();
    g.translate(ANCHOR[0] + ox, ANCHOR[1] + oy);
    g.scale(SCALE, SCALE);
    g.translate(-PIVOT[0], -PIVOT[1]);
    this.paint(g, layer, x0, x1, cam, ox, oy);
    g.restore();
    // sous la route, c'est l'herbe du premier plan : on efface
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    const a = Math.floor(wa / 16) * 16 - 16, b = wb + 16;
    g.moveTo(a, wd + 20);
    for (let x = a; x <= b; x += 16) g.lineTo(x, groundY(track, x) + 6);
    g.lineTo(b, groundY(track, b) + 6);
    g.lineTo(b, wd + 20);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = ALPHA;
    ctx.drawImage(off, 0, 0, cw, ch, sx, sy, cw / k, ch / k);
    ctx.restore();
  }

  /** Peint le décor (repère du dessin) dans g. */
  paint(ctx, layer, x0, x1, cam, ox, oy) {
    const t = this.t;
    // parties fixes : seulement la bande visible de l'image
    const [X0, Y0, X1, Y1] = PIECES.montagnes;
    const toPic = (wx) => (wx - ANCHOR[0] - ox) / SCALE + PIVOT[0];
    const a0 = Math.max(X0, Math.floor(toPic(x0)) - 2), a1 = Math.min(X1, Math.ceil(toPic(x1)) + 2);
    const b0 = Math.max(Y0, Math.floor((cam.y - ANCHOR[1] - oy) / SCALE + PIVOT[1]) - 2);
    const b1 = Math.min(Y1, Math.ceil((cam.y + cam.viewH - ANCHOR[1] - oy) / SCALE + PIVOT[1]) + 2);
    if (a1 > a0 && b1 > b0) ctx.drawImage(layer, a0 - X0, b0 - Y0, a1 - a0, b1 - b0, a0, b0, a1 - a0, b1 - b0);
    // arbre : le feuillage se balance doucement autour du haut du tronc
    if (ready(img.feuillage)) {
      ctx.save();
      const sway = Math.sin(t * 1.1) * 0.016 + Math.sin(t * 2.6 + 1) * 0.006;
      ctx.translate(FOLIAGE_PIVOT[0], FOLIAGE_PIVOT[1]);
      ctx.rotate(sway);
      ctx.scale(1 + Math.sin(t * 1.7) * 0.008, 1 + Math.sin(t * 1.3 + 2) * 0.01);
      ctx.translate(-FOLIAGE_PIVOT[0], -FOLIAGE_PIVOT[1]);
      piece(ctx, 'feuillage');
      ctx.restore();
    }
    // charrette : le foin ondule (cisaillement autour de son pied)
    if (ready(img.paille)) {
      ctx.save();
      const k = Math.sin(t * 1.6) * 0.07 + Math.sin(t * 3.7 + 1) * 0.02 + 0.02;
      const sy = 1 + Math.sin(t * 2.2) * 0.02;
      // le pied reste en place, le haut penche de côté et se tasse un peu
      ctx.translate(0, HAY_BASE);
      ctx.transform(1, 0, -k, sy, 0, 0);
      ctx.translate(0, -HAY_BASE);
      piece(ctx, 'paille');
      ctx.restore();
    }
    if (ready(img.pale)) drawBlades(ctx, t);
    drawStraws(ctx);
  }
}

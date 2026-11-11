/**
 * L'avion de l'automne (images/avion/, préparé par tools/preparer-avion.py) : un petit avion au loin, qui
 * entre par la gauche de l'écran au début de l'automne, juste au-dessus des montagnes, traverse le ciel
 * en montant de plus en plus, passe derrière les nuages, et sort par le haut de l'écran en arrivant au
 * bout de l'automne.
 *
 * Il vole par lui-même : il a sa propre vitesse dans le ciel, il ne s'arrête jamais et ne recule jamais,
 * quoi que fasse la boule. Il est très loin (plan Q, comme le ciel) : quand la caméra avance, il glisse
 * un peu vers la gauche à l'écran ; quand elle s'arrête, il continue sa route vers la droite ; quand
 * elle recule, il file plus vite vers la droite. Pour rester en vue d'un joueur lent ou rapide, il
 * change de vitesse peu à peu (comme un vrai avion), entre VMIN et VMAX, jamais à l'arrêt ni en arrière.
 * Sa montée suit sa propre avancée (u, du départ à l'arrivée au bout de l'automne), pas la caméra.
 *
 * Dessin : une image (16 Ko, 320 × 123) et un disque (l'hélice qui tourne), seulement quand il est à
 * l'écran ; l'image est chargée bien avant l'automne (ressources.js : dès le niveau 3), libérée après.
 */
import { picture, ready, rangeNeed } from './ressources.js';

const START = 8300, END = 16000;  // centre de la caméra : il entre au début de l'automne ; bout de l'automne
const Q = 0.85, ANCHOR = 1200;    // très loin : il suit 85 % du mouvement de la caméra
const VMIN = 14, VMAX = 300;      // vitesse dans son plan (px/s) : jamais de sur-place ; assez pour un joueur rapide
const ACCEL = 25;                 // px/s² : il change de vitesse en douceur
const WIDTH = 300;                // largeur au départ (monde), 0,55 fois moins à la fin (il s'éloigne)
const Y0 = 470, CLIMB = 600;      // hauteur de départ (juste au-dessus des montagnes) et montée totale

const pic = picture('images/avion/avion.webp', rangeNeed(START - 300, END + 2000));
let meta = null;
fetch('images/avion/avion.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});

/**
 * u : position dans son plan (le dessin est en u + Q·(cx − ANCHOR)) ; u0 → u1 : son trajet, du bord gauche
 * de l'écran au début de l'automne jusqu'au-dessus du bout de l'automne ; v : sa vitesse ; state :
 * 'avant' (pas encore parti), 'vol', 'fini'.
 */
const plane = { state: 'avant', u: 0, u0: 0, u1: 1, v: 35, lastCx: 0, camV: 0 };
const layer = (cx) => Q * (cx - ANCHOR);
const progress = () => Math.max(0, Math.min(1, (plane.u - plane.u0) / (plane.u1 - plane.u0)));

/** Place l'avion sur son trajet, à la part p, là où on s'attend à le voir à l'écran (départ, reprise). */
function placeAt(p, cam) {
  plane.u0 = START - cam.viewW / 2 - WIDTH - layer(START); // juste au bord gauche de l'écran quand cx = START
  plane.u1 = END + cam.viewW * 0.1 - layer(END); // au bout de l'automne : un peu à droite du centre
  plane.u = plane.u0 + p * (plane.u1 - plane.u0);
  plane.state = p >= 1 ? 'fini' : 'vol';
}

/** À chaque image du jeu (dt : temps du jeu ; il ralentit avec lui devant les aiguillages). */
export function moveAvion(dt, cam) {
  const cx = cam.x + cam.viewW / 2, jump = Math.abs(cx - plane.lastCx) > 1500;
  if (dt > 0 && !jump) plane.camV += ((cx - plane.lastCx) / dt - plane.camV) * Math.min(1, dt * 2); // vitesse de la caméra, lissée
  plane.lastCx = cx;
  if (dt <= 0) return; // temps arrêté (devant un aiguillage)
  if (jump) {
    // la caméra a sauté (nouvelle partie, partie reprise) : l'avion est tout de suite là où il serait
    if (cx < START) plane.state = 'avant';
    else placeAt(Math.min(1, (cx - START) / (END - START)), cam);
    return;
  }
  if (plane.state === 'avant') {
    if (cx >= START) placeAt(0, cam);
    return;
  }
  if (plane.state !== 'vol') return;
  // là où on aimerait le voir à l'écran (part de la largeur), selon son avancée : de gauche à droite
  const p = progress(), x = plane.u + layer(cx), f = (x - cam.x) / cam.viewW, want = 0.1 + 0.6 * p;
  // la vitesse qui le ramènerait en 8 s là où on s'attend à le voir : son glissement à l'écran plus ce que
  // la caméra lui fait perdre (1 − Q de sa vitesse) ; il s'en approche en douceur, sans jamais s'arrêter
  const target = ((want - f) * cam.viewW) / 8 + (1 - Q) * plane.camV;
  plane.v += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, target - plane.v));
  plane.v = Math.max(VMIN, Math.min(VMAX, plane.v));
  plane.u += plane.v * dt;
  if (progress() >= 1) plane.state = 'fini';
}

/** Dessine l'avion (repère du monde en place), après les montagnes et avant les nuages. */
export function drawAvion(ctx, cam, time) {
  if (plane.state !== 'vol' || !meta || !ready(pic)) return;
  const s = progress(), cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const x = plane.u + layer(cx);
  const y = Y0 - CLIMB * s ** 1.5 + 0.43 * (cy - 716) + 5 * Math.sin(time * 0.8) + 2 * Math.sin(time * 2.1);
  const w = WIDTH * (1 - 0.45 * s), h = (w * meta.h) / meta.w;
  if (x + w < cam.x || x - w > cam.x + cam.viewW || y + h < cam.y || y - h > cam.y + cam.viewH) return;
  // assiette : le nez suit à moitié la pente de sa montée (au plus 10°), et se balance un peu
  const slope = Math.atan2(-CLIMB * 1.5 * Math.sqrt(s), plane.u1 - plane.u0);
  const pitch = Math.max(-0.18, slope * 0.55) + 0.015 * Math.sin(time * 1.1);
  ctx.save();
  ctx.globalAlpha = 0.92 - 0.12 * s; // voilé par l'air, de plus en plus en s'éloignant
  ctx.translate(x, y);
  ctx.rotate(pitch);
  ctx.drawImage(pic.img, -w / 2, -h / 2, w, h);
  // l'hélice qui tourne : un disque fin, flou, qui scintille
  const k = w / meta.w, hx = (meta.helice.x - meta.w / 2) * k, hy = (meta.helice.y - meta.h / 2) * k;
  ctx.globalAlpha *= 0.28 + 0.1 * Math.sin(time * 47);
  ctx.fillStyle = '#5a5a60';
  ctx.beginPath();
  ctx.ellipse(hx, hy, meta.helice.r * k * 0.13, meta.helice.r * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

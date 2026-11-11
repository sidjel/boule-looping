/**
 * L'avion de l'automne (images/avion/, préparé par tools/preparer-avion.py) : un petit avion au loin. Il
 * part caché derrière la grande butte de terre du niveau 4 (la grande bosse), en sort tout de suite en
 * volant vers la droite, traverse le ciel de l'automne en montant de plus en plus, passe derrière les
 * nuages, et sort par le haut de l'écran au bout de l'automne.
 *
 * Il vole par lui-même, dans le plan des montagnes (Q, la même parallaxe) : il avance toujours, et sa
 * position dans le monde ne diminue jamais, quoi que fasse la boule (caméra arrêtée : il poursuit sa
 * route ; caméra qui recule : il accélère d'autant, il ne recule ni par rapport aux montagnes, ni aux
 * nuages, ni à la route). Pour rester en vue d'un joueur lent ou rapide, il change de vitesse peu à
 * peu, vers celle qui le ramènerait en 8 s là où on s'attend à le voir à l'écran.
 * Sa montée suit sa propre avancée (u, de son départ derrière la butte au bout de l'automne).
 *
 * Dessin : une image (16 Ko, 320 × 123) et un disque (l'hélice qui tourne), seulement quand il est à
 * l'écran ; l'image est chargée bien avant (ressources.js : dès le niveau 2), libérée après l'automne.
 */
import { picture, ready, rangeNeed } from './ressources.js';

const START = 6800, END = 16000;  // centre de la caméra : il part (la butte est à l'écran) ; bout de l'automne
const HIDE = { x: 7150, y: 560 }; // son départ, caché derrière la butte (sommet en 7080, 418)
const OUT_X = 7900, OUT_V = 140;  // tant qu'il est derrière la butte (x < OUT_X) : au moins OUT_V, il en sort vite
const Q = 0.3, ANCHOR = 1200;     // dans le plan des montagnes (montagnes.js)
const VMIN = 20, VMAX = 1300;     // vitesse dans son plan (px/s) : jamais de sur-place
const ACCEL = 120;                // px/s² : il change de vitesse en douceur
const WIDTH = 300;                // largeur au départ (monde), 0,55 fois moins à la fin (il s'éloigne)
const CLIMB = 700;                // montée totale, de son départ jusqu'au-dessus de l'écran

const pic = picture('images/avion/avion.webp', rangeNeed(START - 2000, END + 2000));
let meta = null;
fetch('images/avion/avion.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});

/**
 * u : position dans son plan (le dessin est en x = u + Q·(cx − ANCHOR)) ; u0 → u1 : son trajet ; v : sa
 * vitesse ; camV : vitesse de la caméra (lissée) ; state : 'avant' (pas encore parti), 'vol', 'fini'.
 */
const plane = { state: 'avant', u: 0, u0: 0, u1: 1, v: 80, lastCx: 0, camV: 0 };
const layer = (cx) => Q * (cx - ANCHOR);
const progress = () => Math.max(0, Math.min(1, (plane.u - plane.u0) / (plane.u1 - plane.u0)));
/** Là où on s'attend à le voir à l'écran (part de la largeur), selon son avancée. */
const want = (p) => 0.62 + 0.08 * p;

/** Place l'avion sur son trajet, à la part p (départ : p = 0 ; reprise d'une partie : selon la caméra). */
function placeAt(p, cam) {
  const cx = cam.x + cam.viewW / 2;
  plane.u0 = HIDE.x - layer(START);
  plane.u1 = END + cam.viewW * (want(1) - 0.5) - layer(END); // au bout de l'automne : à sa place à l'écran
  plane.u = p <= 0 ? HIDE.x - layer(cx) : cam.x + want(p) * cam.viewW - layer(cx);
  plane.u = Math.max(plane.u0, Math.min(plane.u1, plane.u));
  plane.v = 80;
  plane.state = progress() >= 1 ? 'fini' : 'vol';
}

/** À chaque image du jeu (dt : temps du jeu ; il ralentit avec lui devant les aiguillages). */
export function moveAvion(dt, cam) {
  const cx = cam.x + cam.viewW / 2, jump = Math.abs(cx - plane.lastCx) > 1500;
  const camNow = dt > 0 && !jump ? (cx - plane.lastCx) / dt : 0; // vitesse de la caméra à cette image
  if (dt > 0 && !jump) plane.camV += (camNow - plane.camV) * Math.min(1, dt * 2); // et lissée
  plane.lastCx = cx;
  if (dt <= 0) return; // temps arrêté (devant un aiguillage)
  if (jump) {
    // la caméra a sauté (nouvelle partie, partie reprise) : l'avion est tout de suite là où il serait
    if (cx < START) plane.state = 'avant';
    else placeAt(Math.min(1, (cx - START) / (END - START)), cam);
    return;
  }
  if (plane.state === 'avant') {
    if (cx >= START && cx < START + 1500) placeAt(0, cam);
    return;
  }
  if (plane.state !== 'vol') return;
  const p = progress(), x = plane.u + layer(cx), f = (x - cam.x) / cam.viewW;
  // la vitesse qui le ramènerait en 8 s à sa place à l'écran : son glissement voulu à l'écran, plus ce que
  // la caméra lui fait perdre (1 − Q de sa vitesse) ; il s'en approche en douceur
  const target = ((want(p) - f) * cam.viewW) / 8 + (1 - Q) * plane.camV;
  plane.v += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, target - plane.v));
  // jamais en arrière dans le monde, même à l'image où la caméra fait demi-tour :
  // dx/dt = v + Q·(vitesse de la caméra) ≥ VMIN
  plane.v = Math.max(VMIN, VMIN - Q * Math.min(camNow, plane.camV), Math.min(VMAX, plane.v));
  if (x < OUT_X) plane.v = Math.max(plane.v, OUT_V);
  plane.u += plane.v * dt;
  if (progress() >= 1) plane.state = 'fini';
}

/** Dessine l'avion (repère du monde en place), après les montagnes et avant les nuages. */
export function drawAvion(ctx, cam, time) {
  if (plane.state !== 'vol' || !meta || !ready(pic)) return;
  const s = progress(), cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const x = plane.u + layer(cx);
  const y = HIDE.y - CLIMB * s ** 1.4 + Q * 0.5 * (cy - 716) + 5 * Math.sin(time * 0.8) + 2 * Math.sin(time * 2.1);
  const w = WIDTH * (1 - 0.45 * s), h = (w * meta.h) / meta.w;
  if (x + w < cam.x || x - w > cam.x + cam.viewW || y + h < cam.y || y - h > cam.y + cam.viewH) return;
  // assiette : le nez suit à moitié la pente de sa montée (au plus 10°), et se balance un peu
  const slope = Math.atan2(-CLIMB * 1.4 * s ** 0.4, plane.u1 - plane.u0);
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

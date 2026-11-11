/**
 * L'avion de l'automne (images/avion/, préparé par tools/preparer-avion.py) : un petit avion au loin, qui
 * apparaît au début de l'automne au-dessus des montagnes, traverse le ciel de gauche à droite en montant
 * peu à peu, passe derrière les nuages et disparaît par le haut de l'écran vers le début de l'hiver.
 *
 * - Très loin : comme le soleil, il glisse à peine à l'écran quand on roule ; son avancée suit celle du
 *   joueur dans l'automne (sinon un joueur lent ne le verrait pas traverser, un rapide le dépasserait),
 *   en douceur, sans jamais reculer ni s'arrêter en l'air : boule arrêtée, il continue lentement.
 * - Vol : montée de plus en plus franche (le nez se lève un peu avec elle), petits remous, plus petit et
 *   un peu voilé à mesure qu'il s'éloigne ; l'hélice qui tourne est un disque flou qui scintille.
 * - Dessin : une image (16 Ko, 320 × 123) et un disque, seulement quand il est à l'écran ; chargée bien
 *   avant l'automne (ressources.js : dès le niveau 3) et libérée après le début de l'hiver.
 */
import { picture, ready, rangeNeed } from './ressources.js';

const X0 = 8300, X1 = 16000;    // centre de la caméra : il part au début de l'automne, a disparu à l'hiver
const RATE_MIN = 1 / 400;       // part du trajet par seconde, boule arrêtée (il ne fait jamais du sur-place)
const RATE_MAX = 1 / 25;        // au plus vite (il rattrape un joueur rapide sans bondir)
const WIDTH = 300;              // largeur au départ (monde), 0,55 fois moins à la fin (il s'éloigne)
const Y0 = 470, CLIMB = 600;    // hauteur de départ (juste au-dessus des montagnes) et montée totale

const pic = picture('images/avion/avion.webp', rangeNeed(X0 - 300, X1));
let meta = null;
fetch('images/avion/avion.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});

const plane = { s: 0 }; // s : avancée sur le trajet, de 0 (départ) à 1 (disparu)

/** À chaque image du jeu (dt : temps du jeu). */
export function moveAvion(dt, cam) {
  const cx = cam.x + cam.viewW / 2, target = Math.max(0, Math.min(1, (cx - X0) / (X1 - X0)));
  // saut d'un coup (reprise d'une partie, nouvelle partie) : l'avion est tout de suite à sa place
  if (Math.abs(target - plane.s) > 0.25) { plane.s = target; return; }
  if (target <= 0 && plane.s <= 0) return; // pas encore l'automne
  const rate = Math.max(RATE_MIN, Math.min(RATE_MAX, (target - plane.s) * 0.8));
  plane.s = Math.min(1, plane.s + rate * dt);
}

/** Dessine l'avion (repère du monde en place), après les montagnes et avant les nuages. */
export function drawAvion(ctx, cam, time) {
  const s = plane.s;
  if (s <= 0 || s >= 1 || !meta || !ready(pic)) return;
  const cy = cam.y + cam.viewH / 2;
  const climb = s ** 1.5; // il monte de plus en plus franchement
  const x = cam.x + cam.viewW * (0.06 + 0.92 * s);
  const y = Y0 - CLIMB * climb + 0.43 * (cy - 716) + 5 * Math.sin(time * 0.8) + 2 * Math.sin(time * 2.1);
  const w = WIDTH * (1 - 0.45 * s), h = (w * meta.h) / meta.w;
  if (x - w > cam.x + cam.viewW || y + h < cam.y || y - h > cam.y + cam.viewH) return;
  // assiette : le nez suit à moitié la pente de la montée (au plus 10°), et se balance un peu
  const slope = Math.atan2(-CLIMB * 1.5 * Math.sqrt(s), 0.92 * cam.viewW);
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

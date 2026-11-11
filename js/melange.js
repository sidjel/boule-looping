/**
 * Mélange de deux saisons dans un morceau de décor (montagnes, herbe, champs, pluie), aux passages de
 * saison : A × (1 − t) + B × t, où t (part de la saison B) monte en ligne droite de 0 à 1 sur les
 * 2 × BLEND px du monde autour de la jonction (biomes.js : biomeMix).
 * Comme t varie en ligne droite d'une colonne à l'autre, le mélange se fait avec deux dégradés :
 * A masquée par (1 − t), B masquée par t, puis additionnées — 4 dessins d'image et 2 remplissages,
 * au lieu d'un dessin par colonne et par saison (450 à 1 100 dessins). Même résultat, au pixel près
 * (couleurs prémultipliées : le masque multiplie couleur et transparence ensemble).
 */
import { SHEET } from './levels.js';
import { BLEND } from './biomes.js';
import { warmCanvas } from './ressources.js';

// canevas de travail des mélanges, créé au chargement à la plus grande taille utile (montagnes :
// 2150 de large ; champs : 829 de haut) : un grand canevas neuf, ou agrandi, coûte cher à son premier
// dessin sur téléphone. Un seul mélange par étapes à la fois (current) s'en sert.
const work = document.createElement('canvas');
work.width = 2150; work.height = 829;
work.getContext('2d').fillRect(0, 0, 1, 1);
let current = null;

/**
 * A, B : images (ou canevas) des deux saisons ; sx, sw : colonnes de la source ; W, H : taille du
 * morceau ; worldAt(col) : x du monde où la colonne col du morceau est vue (fonction linéaire) ;
 * J : x de la jonction (A avant, B après). Renvoie un canevas W × H, tout de suite (le morceau est à
 * l'écran) ; le mélange par étapes en cours, s'il y en a un, est d'abord fini.
 */
export function mixTwo(A, B, sx, sw, W, H, worldAt, J) {
  if (current) mixFinish(current);
  const steps = mixSteps(A, B, sx, sw, W, H, worldAt, J);
  let r;
  do r = steps.next(); while (!r.done);
  return r.value;
}

/**
 * Le même mélange, préparé à l'avance en trois étapes (une par image du jeu). mixStart renvoie le
 * travail, ou null si un autre mélange est en cours (mixBusy) ; mixAdvance fait une étape et renvoie
 * le canevas une fois fini (null avant) ; mixFinish le finit d'un coup ; mixCancel l'abandonne.
 * À ne lancer qu'une fois les deux images passées par la carte graphique (ressources.js : warmed) :
 * un mélange d'un coup juste après le décodage coûtait 37 à 49 ms au téléphone (rapports du 10 novembre).
 */
export const mixBusy = () => !!current;
export function mixStart(A, B, sx, sw, W, H, worldAt, J) {
  if (current) return null;
  current = { gen: mixSteps(A, B, sx, sw, W, H, worldAt, J), canvas: null };
  return current;
}
export function mixAdvance(job) {
  if (job.canvas || job.dropped) return job.canvas;
  const r = job.gen.next();
  if (r.done) { job.canvas = r.value; if (current === job) current = null; }
  return job.canvas;
}
export function mixFinish(job) {
  while (!job.canvas && !job.dropped) mixAdvance(job);
  return job.canvas;
}
export function mixCancel(job) {
  if (job.canvas || job.dropped) return;
  job.dropped = true;
  job.gen.return();
  if (current === job) current = null;
}

/** Les trois étapes : A masquée, puis B masquée dans le canevas de travail, puis l'addition. */
function* mixSteps(A, B, sx, sw, W, H, worldAt, J) {
  const own = work;
  const w0 = worldAt(0), w1 = worldAt(W);
  const col = (x) => ((x - w0) / (w1 - w0)) * W;
  const c0 = col(J - BLEND), c1 = col(J + BLEND);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');
  // A × (1 − t)
  g.drawImage(A, sx, 0, sw, A.height, 0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = ramp(g, c0, c1, 1, 0);
  g.fillRect(0, 0, W, H);
  yield;
  // B × t, dans le canevas de travail, puis ajoutée
  if (own.width < W || own.height < H) { own.width = Math.max(own.width, W); own.height = Math.max(own.height, H); }
  const tg = own.getContext('2d');
  tg.globalCompositeOperation = 'copy';
  tg.drawImage(B, sx, 0, sw, B.height, 0, 0, W, H);
  tg.globalCompositeOperation = 'destination-in';
  tg.fillStyle = ramp(tg, c0, c1, 0, 1);
  tg.fillRect(0, 0, W, H);
  yield;
  g.globalCompositeOperation = 'lighter';
  g.drawImage(own, 0, 0, W, H, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  warmCanvas(out); // son dessin est fait maintenant (en préparation), pas à son premier affichage
  return out;
}

function ramp(g, c0, c1, a0, a1) {
  const grad = g.createLinearGradient(c0, 0, c1 === c0 ? c0 + 1 : c1, 0);
  grad.addColorStop(0, `rgba(0,0,0,${a0})`);
  grad.addColorStop(1, `rgba(0,0,0,${a1})`);
  return grad;
}

/** La jonction (x du monde) la plus proche de x. */
export const junctionNear = (x) => Math.round(x / SHEET) * SHEET;

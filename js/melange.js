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

let tmp = null;
/**
 * A, B : images (ou canevas) des deux saisons ; sx, sw : colonnes de la source ; W, H : taille du
 * morceau ; worldAt(col) : x du monde où la colonne col du morceau est vue (fonction linéaire) ;
 * J : x de la jonction (A avant, B après). Renvoie un canevas W × H.
 */
export function mixTwo(A, B, sx, sw, W, H, worldAt, J) {
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
  // B × t, dans un canevas à part, puis ajoutée
  if (!tmp) tmp = document.createElement('canvas');
  if (tmp.width < W || tmp.height < H) { tmp.width = Math.max(tmp.width, W); tmp.height = Math.max(tmp.height, H); }
  const tg = tmp.getContext('2d');
  tg.globalCompositeOperation = 'copy';
  tg.drawImage(B, sx, 0, sw, B.height, 0, 0, W, H);
  tg.globalCompositeOperation = 'destination-in';
  tg.fillStyle = ramp(tg, c0, c1, 0, 1);
  tg.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  g.drawImage(tmp, 0, 0, W, H, 0, 0, W, H);
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

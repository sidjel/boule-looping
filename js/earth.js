/**
 * Premier plan du niveau 1 : la terre brune et l'herbe du dessin, sous la route.
 * Opaque : rien de l'arrière-plan ne se voit sous la route. Calée sur la route du jeu
 * par tools/decouper-sol1.py (qui donne la position ci-dessous) ; elle s'efface à la fin
 * de la feuille, où reprend l'herbe au crayon des niveaux suivants.
 */
const POS = { x: -6, y: 489.8, w: 2014.2, h: 945.55 };
/** En dessous de ce x, le calque d'encre ne dessine pas son herbe (la terre du dessin la remplace). */
export const EARTH_END = 1800;

const img = new Image();
img.decoding = 'async';
img.src = 'images/sol1.webp';

export function drawEarth(ctx, x0, x1) {
  if (x0 > POS.x + POS.w || x1 < POS.x || !(img.complete && img.naturalWidth)) return;
  ctx.drawImage(img, POS.x, POS.y, POS.w, POS.h);
}

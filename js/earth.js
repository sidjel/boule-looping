/**
 * La forme du sol : tout ce qui est sous la route (ou sous une butte d'aiguillage). La terre
 * elle-même (texture de la balade) est peinte par ink.js, la même pour tous les niveaux.
 */
import { WORLD, surfaceY } from './track.js';

/** Chemin de la forme du sol : tout ce qui est sous la route, entre x0 et x1. */
export function groundPath(g, track, x0, x1) {
  x0 = Math.max(-10, Math.floor(x0)); x1 = Math.min(WORLD.w + 10, Math.ceil(x1));
  g.beginPath();
  g.moveTo(x0, WORLD.h + 40);
  for (let x = x0; x <= x1; x += 4) g.lineTo(x, surfaceY(track, x) - 1);
  g.lineTo(x1, surfaceY(track, x1) - 1);
  g.lineTo(x1, WORLD.h + 40);
  g.closePath();
}

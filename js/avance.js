/**
 * Préparation à l'avance des morceaux de paysage aux couleurs mêlées (passages de saison : montagnes,
 * herbe, champs, pluie) : le morceau qui va entrer à l'écran est préparé une ou deux secondes avant,
 * et jamais plus d'un par image (sinon plusieurs préparations tombent sur la même image : à-coup).
 */
let free = true;

/** Au début de chaque image (main.js). */
export function newFrame() { free = true; }

/** Prépare avec make() si ce n'est pas déjà prêt (ready()) et si aucune préparation n'a eu lieu cette image. */
export function ahead(ready, make) {
  if (!free || ready()) return;
  free = false;
  make();
}

/**
 * La bande du niveau 3 (ferme, lac, château), telle que dessinée (images/niveau3/bande.webp, faite par
 * tools/decouper-niveau3.py) : une seule image, sans animation. (Avant le 11 novembre, l'eau du lac,
 * le reflet du château et les drapeaux étaient redessinés en fines bandes à chaque image : environ
 * 250 dessins par image, pour une animation qui ne se voyait pas au téléphone.)
 */
import { picture, ready, rangeNeed } from './ressources.js';

// chargée seulement près du niveau 3 (ressources.js)
const bande = picture('images/niveau3/bande.webp', rangeNeed(2500, 7500));

/** Dessine la bande à (x, y), taille (w, h) dans le monde. */
export function drawBande3(g, x, y, w, h) {
  if (ready(bande)) g.drawImage(bande.img, x, y, w, h);
}

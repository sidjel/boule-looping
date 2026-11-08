/**
 * Premier plan : la terre sous la route de tous les niveaux. Elle est opaque : rien de
 * l'arrière-plan ne se voit à travers. Elle est peinte dans le calque d'encre de chaque feuille (ink.js).
 *
 * - Niveaux en couleurs (la balade) : la texture de terre, peinte par ink.js (balade.js).
 * - Niveaux au crayon : trois morceaux tirés d'un dessin, répétés en miroir :
 *   le fond hachuré, la bande plus brune qui suit la route, les touffes d'herbe du bas.
 * Selon la saison, la terre prend une légère teinte (automne plus chaud, pluie plus sombre) ;
 * l'hiver la couvre de neige (ink.js).
 */
import { WORLD, surfaceY as groundY } from './track.js';
import { biomeMix } from './biomes.js';


const NAMES = ['terre-bande', 'terre-fond', 'terre-herbe'];
/** Jeux de textures : le crayon d'origine, ou la terre du niveau 0 (été en couleurs, niveaux 2 et 3). */
const SETS = {
  crayon: { fond: 'terre-fond', bande: 'terre-bande', herbe: 'terre-herbe', tint: true },
};
const img = {};
export const earthReady = Promise.all(NAMES.map((n) => new Promise((ok) => {
  const i = new Image();
  i.decoding = 'async';
  i.onload = i.onerror = () => ok();
  i.src = `images/${n}.webp`;
  img[n] = i;
})));
const ready = () => NAMES.every((n) => img[n].complete && img[n].naturalWidth > 0);

/** Une image et son miroir (gauche-droite), pour répéter sans raccord visible. */
const flipped = new Map();
function mirror(name) {
  if (flipped.has(name)) return flipped.get(name);
  const i = img[name], c = document.createElement('canvas');
  c.width = i.naturalWidth; c.height = i.naturalHeight;
  const g = c.getContext('2d');
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(i, 0, 0);
  flipped.set(name, c);
  return c;
}

/** Pour le x du monde : l'image à utiliser (endroit ou miroir) et la colonne dans celle-ci. */
function tileAt(name, x) {
  const w = img[name].naturalWidth, k = Math.floor(x / w), u = x - k * w;
  return k % 2 === 0 ? { src: img[name], u } : { src: mirror(name), u, flip: true };
}

/** Répète une image en largeur sur [x0, x1], à la hauteur y (miroir une fois sur deux). */
function strip(g, name, x0, x1, y, h) {
  const w = img[name].naturalWidth, ih = img[name].naturalHeight;
  for (let k = Math.floor(x0 / w); k * w < x1; k++) {
    g.drawImage(k % 2 === 0 ? img[name] : mirror(name), 0, 0, w, ih, k * w, y, w, h ?? ih);
  }
}

const TINTS = { automne: 'rgba(214,140,60,0.16)', pluie: 'rgba(80,96,112,0.16)' };
const tintOf = (b) => TINTS[b.name.toLowerCase()] || null;

/** Chemin de la forme du sol : tout ce qui est sous la route, entre x0 et x1. */
export function groundPath(g, track, x0, x1) {
  x0 = Math.max(-10, Math.floor(x0)); x1 = Math.min(WORLD.w + 10, Math.ceil(x1));
  g.beginPath();
  g.moveTo(x0, WORLD.h + 40);
  for (let x = x0; x <= x1; x += 4) g.lineTo(x, groundY(track, x) - 1);
  g.lineTo(x1, groundY(track, x1) - 1);
  g.lineTo(x1, WORLD.h + 40);
  g.closePath();
}

/**
 * Peint la terre sous la route, entre x0 et x1 (repère du monde). Générateur : rend la main
 * de temps en temps, pour préparer la feuille sans à-coup.
 */
export function* paintEarth(g, track, x0, x1, style = 'crayon') {
  if (!ready()) return;
  const T = SETS[style];
  x0 = Math.max(-10, Math.floor(x0)); x1 = Math.min(WORLD.w + 10, Math.ceil(x1));
  const bottom = WORLD.h + 40;
  g.save();
  groundPath(g, track, x0, x1);
  g.clip();
  // fond hachuré, répété en miroir en largeur et en hauteur, calé sur le bas du monde
  const fh = img[T.fond].naturalHeight;
  let top = bottom, row = 0;
  let minY = Infinity;
  for (let x = x0; x <= x1; x += 16) minY = Math.min(minY, groundY(track, x));
  while (top > minY - fh) {
    top -= fh;
    if (row++ % 2 === 0) strip(g, T.fond, x0, x1, top, fh);
    else {
      g.save();
      g.translate(0, top + fh);
      g.scale(1, -1);
      strip(g, T.fond, x0, x1, 0, fh);
      g.restore();
    }
    yield;
  }
  // touffes d'herbe au pied de la feuille
  if (T.herbe) {
    const hh = img[T.herbe].naturalHeight;
    strip(g, T.herbe, x0, x1, WORLD.h + 12 - hh, hh);
    yield;
  }
  // bande brune qui suit la route : tranches de 3 px décalées à la hauteur de la route
  const bh = img[T.bande].naturalHeight;
  let n = 0;
  for (let x = x0; x < x1; x += 3) {
    const { src, u } = tileAt(T.bande, x);
    const sw = Math.min(3, src.width - u);
    g.drawImage(src, u, 0, sw, bh, x, groundY(track, x) - 1, sw + 0.6, bh);
    if (++n % 120 === 0) yield;
  }
  // teinte de saison, en fondu près des jonctions
  for (let x = x0; x < x1 && T.tint; x += 20) {
    const m = biomeMix(x + 10);
    for (const [b, k] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      const t = tintOf(b);
      if (!t || k < 0.02) continue;
      g.globalAlpha = k;
      g.fillStyle = t;
      g.fillRect(x, 0, 20.5, bottom);
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

/**
 * Premier plan : la terre ocre au crayon de couleur du dessin de référence, sous la route de
 * tous les niveaux. Elle est opaque : rien de l'arrière-plan ne se voit à travers. Elle est
 * peinte dans le calque d'encre de chaque feuille (ink.js).
 * Deux morceaux tirés du dessin (tools/decouper-style.py), répétés en miroir pour ne pas
 * voir de raccord : le fond, et la bande qui suit la route. L'herbe du bas est à part, devant
 * tout, et ondule au vent (style.js).
 * Selon la saison, la terre prend une teinte (automne plus rousse, pluie plus sombre) ;
 * l'hiver la couvre de neige (ink.js).
 */
import { WORLD, surfaceY as groundY } from './track.js';
import { biomeMix } from './biomes.js';

const NAMES = ['terre-bande', 'terre-fond'];
const img = {};
export const earthReady = Promise.all(NAMES.map((n) => new Promise((ok) => {
  const i = new Image();
  i.decoding = 'async';
  i.onload = i.onerror = () => ok();
  i.src = `images/style/${n}.webp`;
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

/** Le grain de la terre en motif (2 × 2 en miroir : aucun raccord). */
let grainTile = null;
function grainPattern(g) {
  if (!grainTile) {
    const i = img['terre-fond'], w = i.naturalWidth, h = i.naturalHeight, c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const t = c.getContext('2d');
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      t.save();
      t.translate(sx < 0 ? w * 2 : 0, sy < 0 ? h * 2 : 0);
      t.scale(sx, sy);
      t.drawImage(i, 0, 0);
      t.restore();
    }
    grainTile = c;
  }
  return g.createPattern(grainTile, 'repeat');
}

const TINTS = { automne: 'rgba(190,80,30,0.2)', pluie: 'rgba(55,50,48,0.28)' };
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
export function* paintEarth(g, track, x0, x1) {
  if (!ready()) return;
  x0 = Math.max(-10, Math.floor(x0)); x1 = Math.min(WORLD.w + 10, Math.ceil(x1));
  const bottom = WORLD.h + 40;
  g.save();
  groundPath(g, track, x0, x1);
  g.clip();
  // la terre : un dégradé ocre (plus clair vers le bas, comme le dessin), puis le grain du
  // crayon par-dessus, en incrustation (motif répété en miroir)
  const grad = g.createLinearGradient(0, 700, 0, WORLD.h);
  grad.addColorStop(0, '#c48e5e');
  grad.addColorStop(0.55, '#d6a774');
  grad.addColorStop(1, '#d2b77c');
  g.fillStyle = grad;
  g.fillRect(x0, 0, x1 - x0, bottom);
  yield;
  g.globalCompositeOperation = 'overlay';
  g.fillStyle = grainPattern(g);
  g.fillRect(x0, 0, x1 - x0, bottom);
  g.globalCompositeOperation = 'source-over';
  yield;
  // bande qui suit la route : tranches de 3 px décalées à la hauteur de la route
  const bh = img['terre-bande'].naturalHeight;
  let n = 0;
  for (let x = x0; x < x1; x += 3) {
    const { src, u } = tileAt('terre-bande', x);
    const sw = Math.min(3, src.width - u);
    g.drawImage(src, u, 0, sw, bh, x, groundY(track, x) - 1, sw + 0.6, bh);
    if (++n % 120 === 0) yield;
  }
  // teinte de saison, en fondu près des jonctions
  for (let x = x0; x < x1; x += 20) {
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

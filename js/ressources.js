/**
 * Images du décor chargées selon l'endroit (mémoire de la carte graphique : sur téléphone, garder
 * toutes les saisons à la fois — environ 130 Mo une fois décodées — fait déborder la réserve
 * d'images et provoque des à-coups).
 *
 * Chaque image dit où elle sert (need) : need(cx) vaut
 *   2 — elle sert ici ou bientôt (à moins de NEAR px du centre de la caméra) : chargée et décodée
 *       à l'avance, hors du jeu (decode() ne bloque pas l'affichage) ;
 *   1 — elle a servi ou va servir (à moins de FAR px) : gardée si elle est là ;
 *   0 — loin : libérée.
 * Les caches des modules ne gardent jamais une image libérée : ils demandent ready(p) avant de
 * dessiner, et onRelease les prévient.
 * Les niveaux eux-mêmes (géométrie, bonus, obstacles) restent tous en mémoire : seules les images
 * lourdes vont et viennent.
 */
import { biomeMix } from './biomes.js';
import { SHEET, SHEETS } from './levels.js';
import { note } from './diagnostic.js';

export const NEAR = 3200, FAR = 6500;
const all = [];

/** Une image du décor ; need(cx) : voir plus haut ; onRelease(p, image) : appelé quand elle est libérée. */
export function picture(src, need = () => 2, onRelease = null) {
  const p = { src, need, onRelease, img: null, state: 'off', w: 0, h: 0 };
  all.push(p);
  return p;
}

/** L'image est chargée et décodée : on peut la dessiner. */
export const ready = (p) => !!p && p.state === 'on';

function load(p) {
  const i = new Image();
  i.decoding = 'async';
  p.img = i;
  p.state = 'loading';
  const name = p.src.split('/').slice(-2).join('/'), t0 = performance.now();
  note(`chargement ${name}`);
  let tl = 0;
  const done = () => {
    if (p.img !== i || !i.naturalWidth) return;
    p.w = i.naturalWidth;
    p.h = i.naturalHeight;
    p.state = 'on';
    warm.push(p); // à envoyer à la carte graphique, en avance (main.js : nextToWarm)
    note(`image prête ${name} ${p.w}×${p.h} (${((p.w * p.h * 4) / 1048576).toFixed(1)} Mo ; reçue ${Math.round(tl - t0)} ms, décodée ${Math.round(performance.now() - tl)} ms)`);
  };
  i.onload = () => { tl = performance.now(); if (i.decode) i.decode().then(done, done); else done(); };
  i.onerror = () => { if (p.img === i) { p.img = null; p.state = 'off'; p.failed = true; } };
  i.src = p.src;
}

function release(p) {
  const i = p.img;
  note(`libérée ${p.src.split('/').slice(-2).join('/')}`);
  p.img = null;
  p.state = 'off';
  if (p.onRelease) p.onRelease(p, i);
  if (i) { i.onload = i.onerror = null; i.removeAttribute('src'); } // le navigateur libère l'image décodée
}

let last = -1e9, lastT = 0, half = 1000;
/**
 * À chaque image (main.js) ; ne travaille que quatre fois par seconde, ou si la caméra a sauté.
 * cx : centre de la caméra ; halfW : demi-largeur de ce qu'elle montre (les distances se comptent
 * depuis les bords de l'écran : en vue d'ensemble, le bord est bien plus loin que le centre).
 */
export function updateResources(cx, now, force = false, halfW = 1000) {
  if (!force && now - lastT < 250 && Math.abs(cx - last) < 1500 && Math.abs(halfW - half) < 200) return;
  last = cx;
  lastT = now;
  half = halfW;
  for (const p of all) {
    const n = p.need(cx);
    if (n >= 2 && p.state === 'off' && !p.failed) load(p);
    else if (n <= 0 && p.state !== 'off') release(p);
  }
}

/** Toutes les images qui servent en cx sont-elles prêtes ? (le fondu attend un peu avant de s'ouvrir) */
export function readyAt(cx) {
  return all.every((p) => p.need(cx) < 2 || p.state === 'on' || p.failed);
}

/** Les saisons vues entre les abscisses a et b : noms ('Été', 'Automne'…). */
export function seasonsBetween(a, b) {
  const out = new Set();
  for (let x = a; x <= b + 249; x += 250) {
    const xx = Math.max(0, Math.min(SHEET * SHEETS - 1, Math.min(x, b)));
    const m = biomeMix(xx);
    out.add(m.a.name);
    if (m.t > 0) out.add(m.b.name);
  }
  return out;
}
/** (ancien nom) Les saisons visibles depuis le centre cx, à r px près. */
export const seasonsAround = (cx, r) => seasonsBetween(cx - r, cx + r);

// fenêtres autour de ce que montre la caméra : chargée (« sert ») de BEHIND px derrière l'écran à
// NEAR px devant ; gardée jusqu'à FAR_BEHIND derrière et FAR devant
const BEHIND = 800, FAR_BEHIND = 2500;
const nearWin = (cx) => [cx - half - BEHIND, cx + half + NEAR];
const farWin = (cx) => [cx - half - FAR_BEHIND, cx + half + FAR];

/** need() d'une version de saison : sert si la saison est dans la fenêtre proche, gardée dans la lointaine. */
export function seasonNeed(...names) {
  return (cx) => {
    const near = seasonsBetween(...nearWin(cx));
    if (names.some((n) => near.has(n))) return 2;
    const far = seasonsBetween(...farWin(cx));
    return names.some((n) => far.has(n)) ? 1 : 0;
  };
}

/** need() d'une image qui sert quand la caméra montre une partie de [a, b] (centre de la caméra). */
export function rangeNeed(a, b) {
  return (cx) => {
    const [n0, n1] = nearWin(cx), [f0, f1] = farWin(cx);
    return n1 > a && n0 < b ? 2 : f1 > a && f0 < b ? 1 : 0;
  };
}

/** La prochaine image prête à envoyer à la carte graphique (une par image du jeu), ou null. */
const warm = [];
export function nextToWarm() {
  while (warm.length) {
    const p = warm.shift();
    if (p.state === 'on' && p.img) return p.img;
  }
  return null;
}

/** Mémoire des images chargées (Mo, une fois décodées) : pour le compteur. */
export function loadedMB() {
  let s = 0;
  for (const p of all) if (p.state === 'on') s += (p.w * p.h * 4) / 1048576;
  return s;
}

/** (outil) État de chaque image. */
export const debug = () => all.map((p) => `${p.src.split('/').slice(-2).join('/')}:${p.state}${p.failed ? '!' : ''}`).filter((s) => !s.endsWith(':off')).join(' ');

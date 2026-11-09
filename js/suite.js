/**
 * La suite du plan des champs après le niveau 3 (tools/decouper-automne.py) : la bande du lac et des
 * champs de foin, raccordée à la bande du niveau 3 par une couture, puis ses champs de foin répétés
 * (raccordés sur eux-mêmes par une seconde couture) jusqu'au bout du parcours. Ses couleurs suivent
 * la saison : été, automne (feuillage roux, champs dorés), hiver, pluie, arrivée ; d'une saison à
 * l'autre, elles changent colonne par colonne, comme le reste du paysage, sans jonction.
 * L'hiver, le paysage d'hiver (sapins, barrière, bonhomme de neige, igloo) remplace les champs : il
 * commence par une couture qui suit le dessin, là où les champs sont déjà enneigés, se répète en partie
 * (raccordé sur lui-même) et rejoint les champs par une autre couture juste avant la pluie
 * (tools/decouper-hiver.py, images/hiver/).
 */
import { biomeMix } from './biomes.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
const img = {};
for (const k of Object.values(KIND)) {
  const i = new Image();
  i.decoding = 'async';
  i.src = `images/automne/suite-${k}.webp`;
  img[k] = i;
}
const ok = (i) => i && i.complete && i.naturalWidth > 0;
let meta = null, winter = null;
fetch('images/automne/suite.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});
fetch('images/hiver/hiver.json').then((r) => r.json()).then((m) => (winter = m)).catch(() => {});
const snow = {};
for (const k of ['entree', 'boucle', 'sortie']) {
  const i = new Image();
  i.decoding = 'async';
  i.src = `images/hiver/${k}.webp`;
  snow[k] = i;
}

/** Morceau n° k : 0 = la bande entière, puis les champs de foin répétés. Colonnes (image d'origine) et position (plan). */
function piece(k) {
  const { W, tile: [t0, t1], u0 } = meta, S = meta.w / W;
  if (k === 0) return { c0: 0, c1: W, u: u0 };
  // après l'hiver, les champs reprennent (même partie répétée), à partir de winter.reprise
  if (k < 0) return { c0: t0, c1: t1, u: winter.reprise + (-k - 1) * (t1 - t0) * S };
  return { c0: t0, c1: t1, u: u0 + W * S + (k - 1) * (t1 - t0) * S };
}

/** Image d'un morceau aux couleurs de la saison (mélange colonne par colonne aux changements de saison). */
const cache = new Map();
function pieceImage(k, worldOf) {
  if (cache.has(k)) return cache.get(k);
  const p = piece(k), S = meta.w / meta.W, R = meta.res;
  const at = (c) => biomeMix(worldOf(p.u + (c - p.c0) * S));
  const marks = [];
  for (let c = p.c0; c <= p.c1; c += (p.c1 - p.c0) / 10) marks.push(at(c));
  const kinds = new Set(marks.flatMap((m) => [KIND[m.a.name], KIND[m.b.name]]));
  for (const kk of kinds) if (!ok(img[kk])) return null;
  let out;
  if (kinds.size === 1) out = { src: img[[...kinds][0]], sx: p.c0 * R };
  else {
    const H = img.ete.naturalHeight, w = Math.round((p.c1 - p.c0) * R), c = document.createElement('canvas');
    c.width = w; c.height = H;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    const STEP = 4;
    for (let x = 0; x < w; x += STEP) {
      const m = at(p.c0 + (x + STEP / 2) / R);
      for (const [bio, a] of [[m.a, 1 - m.t], [m.b, m.t]]) {
        if (a < 0.004) continue;
        g.globalAlpha = a;
        g.drawImage(img[KIND[bio.name]], p.c0 * R + x, 0, STEP, H, x, 0, STEP, H);
      }
    }
    out = { src: c, sx: 0 };
    if (cache.size > 6) cache.delete(cache.keys().next().value);
  }
  cache.set(k, out);
  return out;
}

/**
 * Dessine la suite dans le plan des champs : ox, oy = décalage du plan (parallaxe), worldOf(u) = le x
 * du monde où la colonne u du plan passe au centre de l'écran.
 */
export function drawSuite(g, ox, oy, x0, x1, worldOf) {
  if (!meta || !winter) return;
  const S = meta.w / meta.W, R = meta.res, H = meta.h, y = oy + meta.y0;
  const hayPiece = (k, clip) => {
    const p = piece(k), x = ox + p.u;
    let w = (p.c1 - p.c0) * S;
    if (x > x1 || x + w < x0) return x > x1;
    const im = pieceImage(k, worldOf);
    if (!im) return false;
    if (clip !== undefined) w = Math.min(w, clip - p.u); // coupé où commence le paysage d'hiver
    g.drawImage(im.src, im.sx, 0, w / S * R, im.src.height, x, y, w + 0.5, H);
    return false;
  };
  // les champs, jusqu'au début du paysage d'hiver
  for (let k = 0; k <= winter.k; k++) if (hayPiece(k, k === winter.k ? winter.entree.u + 1 : undefined)) return;
  // le paysage d'hiver : entrée, répétitions, sortie
  const seg = (img, u, w) => {
    const x = ox + u;
    if (x < x1 && x + w > x0 && ok(img)) g.drawImage(img, x, y, w + 0.5, H);
  };
  seg(snow.entree, winter.entree.u, winter.entree.w);
  for (let n = 0; n < winter.boucle.n; n++) seg(snow.boucle, winter.boucle.u + n * winter.boucle.w, winter.boucle.w);
  seg(snow.sortie, winter.sortie.u, winter.sortie.w);
  if (ox + winter.reprise > x1) return;
  // puis les champs reprennent jusqu'au bout du parcours
  for (let j = 1; j < 400; j++) if (hayPiece(-j)) return;
}

/**
 * La suite du plan des champs après le niveau 3 (tools/decouper-automne.py) : la bande du lac et des
 * champs de foin, raccordée à la bande du niveau 3 par une couture, puis ses champs de foin répétés
 * (raccordés sur eux-mêmes par une seconde couture) jusqu'au bout du parcours. Ses couleurs suivent
 * la saison : été, automne (feuillage roux, champs dorés), hiver, pluie, arrivée ; d'une saison à
 * l'autre, elles changent colonne par colonne, comme le reste du paysage, sans jonction.
 * L'hiver, le paysage d'hiver (sapins, barrière, bonhomme de neige, igloo) remplace les champs : il
 * commence par une couture qui suit le dessin, là où les champs sont déjà enneigés, et se répète en
 * partie (raccordé sur lui-même). Au passage à la pluie, derrière un groupe de grands sapins enneigés,
 * commence le paysage de pluie (forêt et lac), qui se répète jusqu'au bout du parcours, aux couleurs
 * de la pluie puis du soir à l'arrivée (tools/decouper-hiver-pluie.py, images/hiver/, images/pluie/).
 */
import { biomeMix } from './biomes.js';
import { ahead } from './avance.js';
import { picture, ready, warmed, seasonNeed, rangeNeed } from './ressources.js';
import { mixTwo, mixStart, mixAdvance, mixFinish, mixCancel, mixBusy, mixRecycle, junctionNear } from './melange.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
// les champs de foin : été, automne et hiver (le passage vers l'hiver) ; ils s'arrêtent au début de
// l'hiver (les versions pluie et arrivée ne servent plus). Chaque version n'est chargée que près de sa saison.
const HAY_END = 19500; // au-delà (centre de la caméra), plus de champs de foin à l'écran
const hayNeed = (name) => { const n = seasonNeed(name); return (cx) => (cx > HAY_END + 3000 ? 0 : cx > HAY_END ? Math.min(1, n(cx)) : n(cx)); };
const pic = {
  ete: picture('images/automne/suite-ete.webp', hayNeed('Été')),
  automne: picture('images/automne/suite-automne.webp', hayNeed('Automne')),
  hiver: picture('images/automne/suite-hiver.webp', hayNeed('Hiver')),
};
let meta = null, winter = null;
fetch('images/automne/suite.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});
fetch('images/hiver/hiver.json').then((r) => r.json()).then((m) => (winter = m)).catch(() => {});
// le paysage de pluie (couleurs de la pluie, puis du soir à l'arrivée) et celui d'hiver
const RAIN = {
  pluie: picture('images/pluie/pluie-pluie.webp', rangeNeed(23500, 40000)),
  arrivee: picture('images/pluie/pluie-arrivee.webp', seasonNeed('Arrivée')),
};
const rainKind = (name) => (name === 'Arrivée' ? 'arrivee' : 'pluie');
const snow = {};
for (const k of ['entree', 'boucle', 'sortie']) snow[k] = picture(`images/hiver/${k}.webp`, rangeNeed(16000, 24500));

/** Morceau n° k : 0 = la bande entière, puis les champs de foin répétés. Colonnes (image d'origine) et position (plan). */
function piece(k) {
  const { W, tile: [t0, t1], u0 } = meta, S = meta.w / W;
  if (k === 0) return { c0: 0, c1: W, u: u0 };
  return { c0: t0, c1: t1, u: u0 + W * S + (k - 1) * (t1 - t0) * S };
}

/** Un mélange en cours ({ job }) devient { [key]: canevas } une fois fini ; null tant qu'il ne l'est pas. */
function settle(map, k, e, key, now) {
  const c = now ? mixFinish(e.job) : mixAdvance(e.job);
  if (!c) return null;
  const out = { [key]: c, sx: 0 };
  map.set(k, out);
  return out;
}
/** Oublie le plus ancien morceau d'un cache trop plein (son mélange en cours est abandonné). */
function trim(map) {
  if (map.size <= 6) return;
  const k = map.keys().next().value, e = map.get(k);
  if (e.job) mixCancel(e.job);
  mixRecycle(e.src || e.canvas);
  map.delete(k);
}
/** Un morceau à deux saisons peut-il être mélangé à l'avance maintenant ? (images passées par la carte graphique) */
const mixable = (pics) => !mixBusy() && pics.every(warmed);

/**
 * Image d'un morceau aux couleurs de la saison (mélange colonne par colonne aux changements de saison).
 * now : le morceau est à l'écran, il le faut tout de suite ; sinon (à l'avance) le mélange se fait
 * par étapes, une par appel (melange.js).
 */
const cache = new Map();
function hayPlan(k, worldOf) {
  const p = piece(k), S = meta.w / meta.W;
  const at = (c) => biomeMix(worldOf(p.u + (c - p.c0) * S));
  const marks = [];
  for (let c = p.c0; c <= p.c1; c += (p.c1 - p.c0) / 10) marks.push(at(c));
  const kinds = new Set(marks.flatMap((m) => [KIND[m.a.name], KIND[m.b.name]]));
  const mid = marks.find((m) => m.t > 0 && m.t < 1);
  return { p, S, at, marks, kinds, mid, two: kinds.size === 2 && !!mid };
}
function hayCanAdvance(k, worldOf) {
  const e = cache.get(k);
  if (e) return !!e.job;
  const pl = hayPlan(k, worldOf);
  for (const kk of pl.kinds) if (!ready(pic[kk])) return false;
  return !pl.two || mixable([...pl.kinds].map((kk) => pic[kk]));
}
function pieceImage(k, worldOf, now = true) {
  const e = cache.get(k);
  if (e) return e.job ? settle(cache, k, e, 'src', now) : e;
  const { p, S, at, marks, kinds, mid, two } = hayPlan(k, worldOf), R = meta.res;
  for (const kk of kinds) if (!ready(pic[kk])) return null;
  let out;
  if (kinds.size === 1) out = { kind: [...kinds][0], sx: p.c0 * R }; // l'image de la saison, prise au dessin
  else if (two) {
    // deux saisons : deux dégradés (melange.js)
    const H = pic[[...kinds][0]].h, w = Math.round((p.c1 - p.c0) * R);
    const xs = (x) => worldOf(p.u + (x / R) * S);
    const J = junctionNear(xs(w * (marks.indexOf(mid) / 10)));
    const A = pic[KIND[mid.a.name]].img, B = pic[KIND[mid.b.name]].img;
    if (now) out = { src: mixTwo(A, B, p.c0 * R, w, w, H, xs, J), sx: 0 };
    else {
      const job = mixStart(A, B, p.c0 * R, w, w, H, xs, J);
      if (!job) return null; // un autre mélange est en cours : à l'image suivante
      cache.set(k, { job });
      trim(cache);
      return pieceImage(k, worldOf, false);
    }
  } else {
    const H = pic[[...kinds][0]].h, w = Math.round((p.c1 - p.c0) * R), c = document.createElement('canvas');
    c.width = w; c.height = H;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    const STEP = 4;
    for (let x = 0; x < w; x += STEP) {
      const m = at(p.c0 + (x + STEP / 2) / R);
      for (const [bio, a] of [[m.a, 1 - m.t], [m.b, m.t]]) {
        if (a < 0.004) continue;
        g.globalAlpha = a;
        g.drawImage(pic[KIND[bio.name]].img, p.c0 * R + x, 0, STEP, H, x, 0, STEP, H);
      }
    }
    out = { src: c, sx: 0 };
  }
  cache.set(k, out);
  if (!out.kind) trim(cache);
  return out;
}

/** Morceau n° j du paysage de pluie, aux couleurs de la pluie ou du soir (mélange colonne par colonne). */
const rainCache = new Map();
function rainPlan(j, worldOf) {
  const P = winter.pluie, u = P.u + j * P.w;
  const any = ready(RAIN.pluie) ? RAIN.pluie : ready(RAIN.arrivee) ? RAIN.arrivee : null;
  if (!any) return null;
  const W = any.w, px = P.w / W;
  const at = (x) => biomeMix(worldOf(u + x * px));
  const kinds = new Set();
  for (let x = 0; x <= W; x += W / 10) { const m = at(x); kinds.add(rainKind(m.a.name)); if (m.t > 0) kinds.add(rainKind(m.b.name)); }
  return { u, any, W, px, at, kinds };
}
function rainCanAdvance(j, worldOf) {
  const e = rainCache.get(j);
  if (e) return !!e.job;
  const pl = rainPlan(j, worldOf);
  if (!pl) return false;
  for (const k of pl.kinds) if (!ready(RAIN[k])) return false;
  return pl.kinds.size === 1 || mixable([RAIN.pluie, RAIN.arrivee]);
}
function rainImage(j, worldOf, now = true) {
  const e = rainCache.get(j);
  if (e) return e.job ? settle(rainCache, j, e, 'canvas', now) : e;
  const pl = rainPlan(j, worldOf);
  if (!pl) return null;
  const { u, any, W, px, at, kinds } = pl;
  for (const k of kinds) if (!ready(RAIN[k])) return null;
  let out;
  if (kinds.size === 1) out = { kind: [...kinds][0] }; // l'image de la saison, prise au dessin
  else {
    // pluie → arrivée : deux dégradés (melange.js) ; la jonction est le début de l'arrivée
    const xs = (x) => worldOf(u + x * px);
    let J = 0;
    for (let x = 0; x <= W; x += W / 10) { const m = at(x); if (m.t > 0 && m.t < 1) { J = junctionNear(xs(x)); break; } }
    J = J || junctionNear(xs(W / 2));
    if (now) out = { canvas: mixTwo(RAIN.pluie.img, RAIN.arrivee.img, 0, W, W, any.h, xs, J) };
    else {
      const job = mixStart(RAIN.pluie.img, RAIN.arrivee.img, 0, W, W, any.h, xs, J);
      if (!job) return null; // un autre mélange est en cours : à l'image suivante
      rainCache.set(j, { job });
      trim(rainCache);
      return rainImage(j, worldOf, false);
    }
  }
  rainCache.set(j, out);
  trim(rainCache);
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
    const src = im.kind ? (ready(pic[im.kind]) ? pic[im.kind].img : null) : im.src;
    if (!src) { cache.delete(k); return false; } // sa saison a été libérée : à refaire
    if (clip !== undefined) w = Math.min(w, clip - p.u); // coupé où commence le paysage d'hiver
    g.drawImage(src, im.sx, 0, w / S * R, src.height, x, y, w + 0.5, H);
    return false;
  };
  // les champs, jusqu'au début du paysage d'hiver (le morceau suivant est préparé à l'avance)
  for (let k = 0; k <= winter.k; k++) {
    if (hayPiece(k, k === winter.k ? winter.entree.u + 1 : undefined)) {
      ahead(() => !hayCanAdvance(k, worldOf), () => pieceImage(k, worldOf, false));
      return;
    }
  }
  // le paysage d'hiver : entrée, répétitions, sortie
  const seg = (img, u, w) => {
    const x = ox + u;
    if (x < x1 && x + w > x0 && ready(img)) g.drawImage(img.img, x, y, w + 0.5, H);
  };
  seg(snow.entree, winter.entree.u, winter.entree.w);
  for (let n = 0; n < winter.boucle.n; n++) seg(snow.boucle, winter.boucle.u + n * winter.boucle.w, winter.boucle.w);
  seg(snow.sortie, winter.sortie.u, winter.sortie.w);
  // puis le paysage de pluie, répété jusqu'au bout du parcours
  const P = winter.pluie;
  for (let j = Math.max(0, Math.floor((x0 - ox - P.u) / P.w)); j < 400; j++) {
    const x = ox + P.u + j * P.w;
    if (x > x1) { ahead(() => !rainCanAdvance(j, worldOf), () => rainImage(j, worldOf, false)); break; }
    const im = rainImage(j, worldOf);
    const src = im && (im.canvas || (ready(RAIN[im.kind]) ? RAIN[im.kind].img : null));
    if (src) g.drawImage(src, x, y, P.w + 0.5, H);
    else if (im) rainCache.delete(j); // sa saison a été libérée : à refaire
  }
}

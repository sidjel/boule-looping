/**
 * Les montagnes de tous les niveaux (tools/decouper-montagnes.py) : une bande dessinée pour se
 * raccorder sur elle-même, répétée sans miroir. Elles sont loin : elles glissent bien moins vite que
 * la route. Leur couleur suit la saison (ensoleillées l'été, rousses en automne, enneigées l'hiver,
 * grises sous la pluie, roses à l'arrivée) ; d'une saison à l'autre, la bande change peu à peu,
 * colonne par colonne, comme le paysage sous elle : sans fondu ni jonction. Leur pied s'efface dans
 * la brume de l'horizon (aux niveaux 1 et 2, les champs passent devant).
 */
import { biomeMix, BLEND } from './biomes.js';
import { SHEET } from './levels.js';
import { ahead } from './avance.js';
import { picture, ready, warmed, viewHalf, NEAR, FAR, BEHIND, FAR_BEHIND } from './ressources.js';
import { mixTwo, mixStart, mixAdvance, mixFinish, mixCancel, mixBusy, mixRecycle, junctionNear } from './melange.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };

const Q = 0.3, ANCHOR = 1200;   // parallaxe : comme les montagnes du niveau 1
const TW = 2400;                // largeur d'une bande dans le monde
const PEAKS = 500;              // haut de la bande (monde), quand la caméra est à sa place

/** Plan des montagnes ↔ monde : la saison en u est celle du sol sous la caméra quand elles y passent. */
const worldOf = (u) => (u - Q * ANCHOR) / (1 - Q);
/**
 * À l'arrivée de l'hiver, les montagnes sont déjà enneigées (demande de l'auteur) : leur passage à
 * l'hiver est avancé de LEAD px du monde. Quand la caméra arrive au début de l'hiver, le bord gauche
 * de l'écran montre les montagnes de x − 2 290 en vue d'ensemble (x − 1 430 en vue suivie) : avec
 * 2 700, tout l'écran est déjà en hiver. Le décalage vaut pour tout un morceau (linéaire dans le
 * morceau, pour le mélange de melange.js) : les morceaux qui touchent la zone avancée sont décalés ;
 * à leurs bords, les saisons sont pures (automne avant, hiver après), donc aucun raccord visible.
 */
const WINTER = 8 * SHEET, LEAD = 2700;
const shiftOf = (k) => {
  const a = worldOf(k * TW), b = worldOf((k + 1) * TW);
  return b > WINTER - BLEND - LEAD && a < WINTER + BLEND ? LEAD : 0;
};
/** Les saisons d'un morceau (les mêmes que tileImage). */
const marksOf = (k) => [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => biomeMix(worldOf(k * TW + f * TW) + shiftOf(k)));
function seasonsOfTiles(u0, u1) {
  const out = new Set();
  for (let k = Math.floor(u0 / TW); k <= Math.floor(u1 / TW); k++) for (const m of marksOf(k)) out.add(m.a.name).add(m.b.name);
  return out;
}
/**
 * need() d'une saison des montagnes (ressources.js). Elles glissent moins vite que le sol et se
 * dessinent par morceaux entiers de TW : un morceau entre à l'écran bien avant la saison du sol qu'il
 * annonce. Les fenêtres se comptent donc dans leur plan, en morceaux : la saison sert dès qu'un
 * morceau proche (ou le suivant, préparé à l'avance) la montre.
 */
function mountainNeed(name) {
  return (cx) => {
    const h = viewHalf(), u = (1 - Q) * cx + Q * ANCHOR; // centre de l'écran, dans le plan des montagnes
    if (seasonsOfTiles(u - h - (1 - Q) * BEHIND, u + h + (1 - Q) * NEAR + TW).has(name)) return 2;
    return seasonsOfTiles(u - h - (1 - Q) * FAR_BEHIND, u + h + (1 - Q) * FAR + TW).has(name) ? 1 : 0;
  };
}
// une version par saison, chargée seulement près de sa saison (ressources.js) ; toutes ont la même taille
const pic = {};
for (const [name, k] of Object.entries(KIND)) pic[k] = picture(`images/montagnes/${k}.webp`, mountainNeed(name));
const anyReady = () => Object.values(pic).find(ready);
/**
 * Morceau n° k : { kind } (une seule saison : l'image de la saison), { canvas } (mélange, préparé une
 * fois) ou { job } (mélange en cours, melange.js : mixStart).
 * now : le morceau est à l'écran, il le faut tout de suite (mélange fini d'un coup s'il le faut).
 * Sinon (préparation à l'avance) : une étape du mélange par appel, et seulement une fois les deux
 * images passées par la carte graphique (avant : un mélange d'un coup juste après le décodage de
 * l'image coûtait 37 à 43 ms au téléphone, rapport du 10 novembre).
 */
const tiles = new Map();
function plan(k) {
  const marks = marksOf(k);
  const kinds = new Set(marks.flatMap((m) => [KIND[m.a.name], KIND[m.b.name]]));
  const mid = marks.find((m) => m.t > 0 && m.t < 1);
  return { marks, kinds, mid, two: kinds.size === 2 && !!mid };
}
/** Le morceau k peut-il avancer sa préparation à l'avance maintenant ? */
function canAdvance(k) {
  const t = tiles.get(k);
  if (t) return !!t.job;
  const p = plan(k);
  for (const kk of p.kinds) if (!ready(pic[kk])) return false;
  return !p.two || (!mixBusy() && [...p.kinds].every((kk) => warmed(pic[kk])));
}
function tileImage(k, now = true) {
  let t = tiles.get(k);
  if (t && !t.job) return t;
  if (t) {
    // mélange en cours : une étape (à l'avance), ou la fin d'un coup (à l'écran)
    const c = now ? mixFinish(t.job) : mixAdvance(t.job);
    if (!c) return null;
    t = { canvas: c };
    tiles.set(k, t);
    return t;
  }
  const u0 = k * TW;
  const { marks, kinds, mid, two } = plan(k);
  for (const kk of kinds) if (!ready(pic[kk])) return null;
  if (kinds.size === 1) { t = { kind: [...kinds][0] }; tiles.set(k, t); return t; }
  const i0 = pic[[...kinds][0]], W = i0.w, H = i0.h;
  if (two) {
    // deux saisons : deux dégradés (melange.js)
    const sh = shiftOf(k), xs = (x) => worldOf(u0 + (x / W) * TW) + sh;
    const J = junctionNear(xs(W * (marks.indexOf(mid) / 10)));
    const A = pic[KIND[mid.a.name]].img, B = pic[KIND[mid.b.name]].img;
    if (now) { t = { canvas: mixTwo(A, B, 0, W, W, H, xs, J) }; tiles.set(k, t); return t; }
    const job = mixStart(A, B, 0, W, W, H, xs, J);
    if (!job) return null; // un autre mélange est en cours : à l'image suivante
    tiles.set(k, { job });
    return tileImage(k, false);
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  const STEP = 4;
  for (let x = 0; x < W; x += STEP) {
    const m = biomeMix(worldOf(u0 + ((x + STEP / 2) / W) * TW) + shiftOf(k));
    for (const [bio, w] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      if (w < 0.004) continue;
      g.globalAlpha = w;
      g.drawImage(pic[KIND[bio.name]].img, x, 0, STEP, H, x, 0, STEP, H);
    }
  }
  t = { canvas: c };
  tiles.set(k, t);
  return t;
}
/** L'image à dessiner pour un morceau (null si sa saison n'est pas encore chargée). */
const source = (t) => (t.canvas ? t.canvas : ready(pic[t.kind]) ? pic[t.kind].img : null);

/** Dessine les montagnes (repère du monde en place dans ctx), derrière la terre et les champs. */
export function drawMountains(ctx, cam) {
  const i0 = anyReady();
  if (!i0) return;
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const w = TW, h = (i0.h * w) / i0.w;
  const ox = Q * (cx - ANCHOR), y = PEAKS + Q * 0.5 * (cy - 716);
  if (y > cam.y + cam.viewH || y + h < cam.y) return;
  const k0 = Math.floor((cam.x - ox) / w) - 1;
  let k = k0;
  for (; ox + k * w < cam.x + cam.viewW; k++) {
    const t = tileImage(k), src = t && source(t);
    if (src) ctx.drawImage(src, ox + k * w, y, w + 1, h);
    else if (t && t.kind) tiles.delete(k); // sa saison a été libérée : à refaire
  }
  ahead(() => !canAdvance(k), () => tileImage(k, false)); // la bande suivante, à l'avance, par étapes
  for (const [key, t] of tiles) {
    if (key >= k0 - 2 && key <= k + 2) continue;
    if (t.job) mixCancel(t.job); // mélange abandonné : le canevas de travail est libre
    mixRecycle(t.canvas);
    tiles.delete(key); // loin : oubliée
  }
}

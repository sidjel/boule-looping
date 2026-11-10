/**
 * Le ciel de tous les niveaux : la texture de ciel au crayon (dégradé, foncé en haut, clair en bas),
 * une version par saison (tools/ciel-saisons.py) : bleu franc l'été, plus doux et doré en bas en
 * automne, pâle et froid en hiver, gris sous la pluie, coucher de soleil à l'arrivée.
 * Le ciel est très loin : il suit presque la caméra. Sa couleur suit la saison sous la caméra et
 * passe de l'une à l'autre en fondu pendant qu'on avance : aucune jonction dans l'image.
 * La bande se raccorde sur elle-même en largeur (sans miroir) ; au-dessus, la couleur du haut,
 * en dessous, celle du bas.
 */
import { biomeMix } from './biomes.js';
import { picture, ready, seasonNeed } from './ressources.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
// une version par saison, chargée seulement près de sa saison (ressources.js)
const pic = {};
for (const [name, k] of Object.entries(KIND)) pic[k] = picture(`images/ciel/${k}.webp`, seasonNeed(name));
let meta = null;
fetch('images/ciel/ciel.json').then((r) => r.json()).then((m) => (meta = m)).catch(() => {});

const Q = 0.9, ANCHOR = 1200, TOP = -260, SCALE = 2.27;

/** Le ciel couvre tout l'écran dès que ses images (saison sous la caméra) sont prêtes : le papier dessous est alors inutile. */
export function skyReady(cx) {
  const m = biomeMix(cx);
  return !!meta && ready(pic[KIND[m.a.name]]) && (m.t <= 0.002 || ready(pic[KIND[m.b.name]]));
}

function paint(g, cam, kind, alpha) {
  const p = pic[kind];
  if (!ready(p) || !meta || alpha <= 0.002) return;
  const i = p.img;
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const w = i.naturalWidth * SCALE, h = i.naturalHeight * SCALE * 0.73;
  const ox = Q * (cx - ANCHOR), y = TOP + Q * 0.5 * (cy - 716);
  const x0 = cam.x - 4, x1 = cam.x + cam.viewW + 4;
  const { haut, bas } = meta[kind];
  g.globalAlpha = alpha;
  g.fillStyle = `rgb(${haut})`;
  g.fillRect(x0, cam.y - 4, x1 - x0, Math.max(0, y - cam.y + 6));
  g.fillStyle = `rgb(${bas})`;
  g.fillRect(x0, y + h - 2, x1 - x0, Math.max(0, cam.y + cam.viewH - y - h + 6));
  for (let k = Math.floor((x0 - ox) / w); ox + k * w < x1; k++) g.drawImage(i, ox + k * w, y, w + 1, h);
}

/** Dessine le ciel (repère du monde en place dans ctx), sous tout le reste. */
let tmp = null, tg = null;
export function drawSky(ctx, cam) {
  const m = biomeMix(cam.x + cam.viewW / 2);
  ctx.save();
  paint(ctx, cam, KIND[m.a.name], 1);
  ctx.restore();
  if (!(m.t > 0.002 && m.b !== m.a)) return;
  // la saison suivante : peinte opaque à part (ses morceaux se chevauchent d'un pixel), puis posée
  // d'un seul coup avec la part m.t : pas de liseré aux raccords
  const W = Math.ceil(ctx.canvas.width / 2), H = Math.ceil(ctx.canvas.height / 2);
  if (!tmp) { tmp = document.createElement('canvas'); tg = tmp.getContext('2d'); }
  if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  const t = ctx.getTransform();
  tg.setTransform(t.a / 2, 0, 0, t.d / 2, t.e / 2, t.f / 2);
  paint(tg, cam, KIND[m.b.name], 1);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = m.t;
  ctx.drawImage(tmp, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

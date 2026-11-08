/**
 * Le style « crayons de couleur » du dessin de référence, pour tous les niveaux :
 * - le ciel bleu hachuré (images/style/ciel.webp), teinté selon la saison ;
 * - les nuages du dessin (images/style/nuage-N.webp), gris sous la pluie ;
 * - la bande d'herbe du premier plan (images/style/herbe.webp), qui ondule au vent,
 *   jaunie en automne, givrée en hiver, plus sombre sous la pluie.
 * Morceaux découpés par tools/decouper-style.py.
 */
import { WORLD } from './track.js';
import { biomeMix } from './biomes.js';

const DIR = 'images/style/';
const N_CLOUDS = 12;
/** Une unité de l'image de référence vaut A unités du monde (le dessin fait une feuille de large). */
export const A = 2000 / 1790;

function load(src) {
  const i = new Image();
  i.decoding = 'async';
  i.src = DIR + src;
  return i;
}
const ok = (i) => i.complete && i.naturalWidth > 0;

const sky = load('ciel.webp');
const grass = load('herbe.webp');
export const cloudImgs = Array.from({ length: N_CLOUDS }, (_, k) => load(`nuage-${k}.webp`));

/* ---------- variantes de couleur par saison (calculées une fois, au besoin) ---------- */

const RECOLOR = {
  // herbe
  'herbe:automne': (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; return mix([r, g, b], [l * 1.2 + 45, l * 0.9 + 12, l * 0.35], 0.75); },
  'herbe:hiver': (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; return mix([r, g, b], [l * 0.7 + 85, l * 0.75 + 90, l * 0.7 + 105], 0.7); },
  'herbe:pluie': (r, g, b) => [r * 0.62, g * 0.72, b * 0.7 + 8],
  // nuages
  'nuage:pluie': (r, g, b) => { const l = 0.3 * r + 0.59 * g + 0.11 * b; return mix([r, g, b], [l * 0.62 + 18, l * 0.64 + 20, l * 0.66 + 26], 0.85); },
};
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

const variants = new Map();
/** L'image (ou sa variante de saison), sous forme de canevas ; null tant qu'elle n'est pas chargée. */
function variant(img, kind, biome) {
  if (!ok(img)) return null;
  const fn = RECOLOR[`${kind}:${biome}`];
  if (!fn) return img;
  let byImg = variants.get(img);
  if (!byImg) variants.set(img, (byImg = new Map()));
  if (byImg.has(biome)) return byImg.get(biome);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const [r, gg, b] = fn(p[i], p[i + 1], p[i + 2]);
    p[i] = r; p[i + 1] = gg; p[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
  byImg.set(biome, c);
  return c;
}
const keyOf = (b) => ({ 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' })[b.name];

/* ---------- ciel ---------- */

let skyTile = null;
/** Le ciel répété en miroir (2 × 2) : aucun raccord visible. */
function skyPattern(ctx) {
  if (skyTile) return skyTile.pattern;
  if (!ok(sky)) return null;
  const w = sky.naturalWidth, h = sky.naturalHeight, c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    g.save();
    g.translate(sx < 0 ? w * 2 : 0, sy < 0 ? h * 2 : 0);
    g.scale(sx, sy);
    g.drawImage(sky, 0, 0);
    g.restore();
  }
  skyTile = { canvas: c, pattern: ctx.createPattern(c, 'repeat') };
  return skyTile.pattern;
}

/** Couleur du haut du ciel et de l'horizon, par-dessus le grain bleu, selon la saison. */
const SKY = {
  ete: ['rgba(70,140,215,0.32)', 'rgba(255,255,255,0.18)'],
  automne: ['rgba(120,150,195,0.28)', 'rgba(255,214,160,0.38)'],
  hiver: ['rgba(175,198,222,0.45)', 'rgba(242,246,250,0.5)'],
  pluie: ['rgba(88,98,114,0.62)', 'rgba(150,158,168,0.55)'],
  arrivee: ['rgba(90,140,210,0.3)', 'rgba(255,186,140,0.42)'],
};

/** Peint le ciel sur tout l'écran (repère de l'écran, en pixels). */
export function drawSky(ctx, W, H, cam) {
  ctx.fillStyle = '#bcd8e6';
  ctx.fillRect(0, 0, W, H);
  const pat = skyPattern(ctx);
  if (pat) {
    // le ciel est très loin : il glisse à peine quand la caméra avance
    const k = cam.scale * A / 0.75;
    pat.setTransform(new DOMMatrix([k, 0, 0, k, -cam.x * cam.scale * 0.12, -cam.y * cam.scale * 0.12]));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }
  const m = biomeMix(cam.x + cam.viewW / 2);
  // haut du ciel et horizon : en repère du monde (l'horizon est vers le sol)
  const top = (-200 - cam.y) * cam.scale, bottom = (1150 - cam.y) * cam.scale;
  for (const [b, a] of [[m.a, 1 - m.t], [m.b, m.t]]) {
    if (a < 0.01) continue;
    const [c0, c1] = SKY[keyOf(b)] || SKY.ete;
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.globalAlpha = a;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
}

/* ---------- nuages ---------- */

/** Un nuage (variante de saison) prêt à dessiner, ou null. */
export function cloudOf(k, biome) {
  return variant(cloudImgs[k], 'nuage', keyOf(biome));
}

/* ---------- herbe du premier plan ---------- */

const SLICE = 22; // largeur des tranches qui ondulent (monde)

/**
 * La bande d'herbe au pied de l'écran, devant tout : chaque tranche penche selon le vent
 * (souffle doux qui passe d'une touffe à l'autre, plus fort les jours de vent d'automne).
 * @param gust vent de la météo (px/s², négatif = de face)
 */
export function drawGrass(ctx, cam, t, gust = 0) {
  if (!ok(grass)) return;
  const w = grass.naturalWidth, h = grass.naturalHeight;
  const base = WORLD.h + 26, top = base - h;
  if (cam.y + cam.viewH < top) return;
  const x0 = Math.floor((cam.x - 40) / SLICE) * SLICE, x1 = cam.x + cam.viewW + 40;
  for (let x = x0; x < x1; x += SLICE) {
    const m = biomeMix(x + SLICE / 2);
    // pente des brins : souffle qui ondule le long de la bande + rafales de la saison
    let k = 0.1 * Math.sin(t * 1.5 - x * 0.0045) + 0.045 * Math.sin(t * 2.7 - x * 0.013) + 0.03 + gust * 0.00018;
    k = Math.max(-0.32, Math.min(0.32, k));
    const tile = Math.floor(x / w), u = x - tile * w, flip = tile % 2 !== 0;
    const sw = Math.min(SLICE, w - u);
    for (const [b, a] of [[m.a, 1 - m.t], [m.b, m.t]]) {
      if (a < 0.02) continue;
      const img = variant(grass, 'herbe', keyOf(b));
      if (!img) continue;
      ctx.save();
      ctx.globalAlpha = a;
      // le pied reste en place, le haut penche : x' = x + k·(base − y)
      ctx.transform(1, 0, -k, 1, k * base, 0);
      if (flip) {
        // tuile en miroir : la colonne u se lit à w − u
        ctx.translate(x + sw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, w - u - sw, 0, sw, h, 0, top, sw + 0.8, h);
      } else {
        ctx.drawImage(img, u, 0, sw, h, x, top, sw + 0.8, h);
      }
      ctx.restore();
    }
  }
}

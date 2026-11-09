/**
 * Le soleil, sur tout le parcours (le dessin du niveau 1 : images/niveau0/soleil.webp).
 * Il est très loin : il reste presque immobile à l'écran pendant qu'on roule, et ne bouge qu'avec
 * l'avancée de la balade : au fil des saisons, il glisse doucement vers la droite et descend vers
 * les montagnes, jusqu'à se coucher derrière elles à l'arrivée.
 * Sa couleur et son éclat suivent la saison : jaune vif l'été, doré-orangé en automne, pâle et
 * froid en hiver, voilé sous la pluie, rouge-orangé au coucher de l'arrivée ; d'une saison à
 * l'autre, il change peu à peu.
 */
import { WORLD } from './track.js';
import { biomeMix } from './biomes.js';

const KIND = { 'Été': 'ete', Automne: 'automne', Hiver: 'hiver', Pluie: 'pluie', 'Arrivée': 'arrivee' };
/** Par saison : teinte du disque (multiplication), éclat (opacité), halo (couleur, force), taille. */
const LOOK = {
  ete: { tint: [255, 255, 255], alpha: 1, halo: [255, 214, 90], glow: 1, size: 1 },
  automne: { tint: [255, 214, 150], alpha: 1, halo: [255, 170, 70], glow: 0.9, size: 1.04 },
  hiver: { tint: [255, 250, 225], alpha: 0.9, halo: [255, 246, 210], glow: 0.55, size: 0.92 },
  pluie: { tint: [235, 232, 215], alpha: 0.45, halo: [240, 236, 220], glow: 0.25, size: 0.95 },
  arrivee: { tint: [255, 160, 95], alpha: 1, halo: [255, 120, 60], glow: 1.3, size: 1.18 },
};

const base = new Image();
base.decoding = 'async';
base.src = 'images/niveau0/soleil.webp';
const variants = {};
/** Le disque teinté pour une saison (préparé une fois). */
function variant(kind) {
  if (variants[kind]) return variants[kind];
  if (!(base.complete && base.naturalWidth)) return null;
  const c = document.createElement('canvas');
  c.width = base.naturalWidth; c.height = base.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  const [r, gg, b] = LOOK[kind].tint;
  if (r < 255 || gg < 255 || b < 255) {
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      p[i] = (p[i] * r) / 255; p[i + 1] = (p[i + 1] * gg) / 255; p[i + 2] = (p[i + 2] * b) / 255;
    }
    g.putImageData(d, 0, 0);
  }
  variants[kind] = c;
  return c;
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Dessine le soleil (repère du monde en place dans ctx), entre le ciel et les montagnes. */
export function drawSoleil(ctx, cam, time) {
  const cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2;
  const p = Math.max(0, Math.min(1, cx / WORLD.w)); // avancée dans la balade
  // position : presque fixe à l'écran ; glisse vers la droite et descend avec l'avancée
  const x = cx + cam.viewW * (-0.13 + 0.36 * p);
  const y = 330 + 300 * Math.pow(p, 1.15) + 0.9 * 0.5 * (cy - 716);
  const m = biomeMix(cx);
  const A = LOOK[KIND[m.a.name]], B = LOOK[KIND[m.b.name]], t = m.b === m.a ? 0 : m.t;
  const mix = (k) => lerp(A[k], B[k], t);
  const halo = A.halo.map((v, i) => Math.round(lerp(v, B.halo[i], t)));
  const glow = mix('glow'), size = mix('size'), alpha = mix('alpha');
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.6), R = 125 * size;
  ctx.save();
  // halo qui respire
  const h = ctx.createRadialGradient(x, y, R * 0.9, x, y, R * (1.7 + 0.2 * pulse) * (0.8 + 0.25 * glow));
  h.addColorStop(0, `rgba(${halo},${(0.16 + 0.1 * pulse) * glow})`);
  h.addColorStop(1, `rgba(${halo},0)`);
  ctx.fillStyle = h;
  ctx.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
  // le disque : la saison d'avant, puis celle d'après par-dessus (passage peu à peu)
  const z = (1 + 0.035 * pulse) * 1.36 * size;
  for (const [kind, a] of [[KIND[m.a.name], 1], [KIND[m.b.name], t]]) {
    if (a < 0.01) continue;
    const i = variant(kind);
    if (!i) continue;
    const w = i.width * z, hh = i.height * z;
    ctx.globalAlpha = alpha * a;
    ctx.drawImage(i, x - w / 2, y - hh / 2, w, hh);
    // reflet qui scintille (moins sous la pluie et en hiver)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * a * (0.12 + 0.12 * Math.max(0, Math.sin(time * 2.3))) * Math.min(1, glow);
    ctx.drawImage(i, x - w / 2, y - hh / 2, w, hh);
    ctx.restore();
  }
  ctx.restore();
}

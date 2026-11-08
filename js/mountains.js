/**
 * Chaîne de montagnes lointaine, au crayon bleu comme sur le dessin du niveau 1 : crêtes
 * en pointe, flanc à l'ombre plus appuyé, traits fins qui suivent la pente et pâlissent
 * vers le bas, quelques longues lignes grises. Elle court sur les quatre niveaux de l'été.
 * Dessinée une fois dans une longue bande (à demi-résolution : c'est flou et lointain).
 */
import { rng, range, pencilLine, grain } from './pencil.js';

export const BAND = { u0: -2600, u1: 8600, y0: 470, y1: 1000, res: 0.5 };

/** Profil d'une rangée : le plus haut des pics (pentes droites, sommet à peine arrondi). */
function profile(peaks, u, base) {
  let y = base;
  for (const p of peaks) {
    const d = u - p.x, s = d < 0 ? p.left : p.right;
    const v = p.y + (Math.hypot(d, 14) - 14) * s;
    if (v < y) y = v;
  }
  return y + 5 * Math.sin(u / 97) + 3 * Math.sin(u / 31);
}

function peaksOf(rand, u0, u1, step, apex, base) {
  const peaks = [];
  for (let x = u0 + range(rand, 0, step * 0.5); x < u1; x += range(rand, step * 0.7, step * 1.3)) {
    peaks.push({ x, y: range(rand, apex[0], apex[1]), left: range(rand, 0.42, 0.66), right: range(rand, 0.55, 0.85) });
  }
  return peaks;
}

/** Une rangée : ombrage au crayon sous la crête, puis la crête et une ligne grise. */
function drawRow(g, rand, peaks, base, { blue, ridge, depth, strength }) {
  const { u0, u1 } = BAND;
  g.lineCap = 'round';
  // hachures parallèles à la pente, plus denses près de la crête et sur le flanc droit (ombre)
  for (let u = u0; u < u1; u += 1.8) {
    const y = profile(peaks, u, base), y2 = profile(peaks, u + 6, base), slope = (y2 - y) / 6;
    if (y > base - 8) continue;
    // plus de bleu près des sommets, presque rien dans les creux (comme sur le dessin)
    const w = Math.min(1, Math.max(0, (base - y) / (base - 600))) ** 1.1;
    const shadow = slope > 0.05 ? 1 : 0.4;
    if (rand() > 0.15 + 0.85 * w * shadow) continue;
    const d = depth * (0.35 + 0.65 * w), o = d * rand() ** 2.2, len = range(rand, 12, 38);
    const k = (1 - o / d) * strength * shadow * (0.35 + 0.65 * w);
    g.globalAlpha = Math.min(1, Math.max(0, k * range(rand, 0.4, 1)));
    g.strokeStyle = blue;
    g.lineWidth = range(rand, 2, 4);
    const n = Math.hypot(1, slope), tilt = range(rand, -0.12, 0.12);
    g.beginPath();
    g.moveTo(u, y + o + 2);
    g.lineTo(u + len / n, y + o + 2 + (len * (slope + tilt)) / n);
    g.stroke();
  }
  g.globalAlpha = 1;
  // la crête, en traits repassés
  const pts = [];
  for (let u = u0; u <= u1; u += 10) {
    const y = profile(peaks, u, base);
    if (y < base - 4) pts.push([u, y]);
    else if (pts.length) { pencilLine(g, pts.splice(0), rand, { color: ridge, width: 2.2, alpha: 0.5 * strength + 0.15, passes: 2, wobble: 1.2 }); }
  }
  if (pts.length > 1) pencilLine(g, pts, rand, { color: ridge, width: 2.2, alpha: 0.5 * strength + 0.15, passes: 2, wobble: 1.2 });
  // longues lignes grises un peu sous la crête (comme les reliefs du dessin)
  for (let u = u0; u < u1; u += range(rand, 500, 1100)) {
    const len = range(rand, 250, 600), off = range(rand, 14, 40), line = [];
    for (let v = u; v < u + len; v += 12) {
      const y = profile(peaks, v, base);
      if (y < base - 10) line.push([v, y + off]);
    }
    if (line.length > 4) pencilLine(g, line, rand, { color: '#8e959e', width: 1.6, alpha: 0.28, passes: 1, wobble: 1.5 });
  }
}

let band = null;

/** La bande dessinée (canvas) et son repère : u (x du monde, avant parallaxe), y du monde. */
export function mountainBand() {
  if (band) return band;
  const { u0, u1, y0, y1, res } = BAND;
  const c = document.createElement('canvas');
  c.width = Math.ceil((u1 - u0) * res);
  c.height = Math.ceil((y1 - y0) * res);
  const g = c.getContext('2d');
  g.scale(res, res);
  g.translate(-u0, -y0);
  const rand = rng(2024);
  // rangée du fond : plus haute, plus pâle ; rangée de devant : plus bleue
  const back = peaksOf(rand, u0, u1, 760, [560, 660], 900);
  const front = peaksOf(rand, u0 + 300, u1, 980, [640, 750], 930);
  drawRow(g, rand, back, 900, { blue: '#a2bfdb', ridge: '#8aa2bb', depth: 80, strength: 0.6 });
  drawRow(g, rand, front, 930, { blue: '#6a93bf', ridge: '#62809f', depth: 100, strength: 1 });
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.35);
  band = c;
  return c;
}

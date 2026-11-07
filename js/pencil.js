/**
 * Outils de dessin « crayon de couleur » : hasard reproductible, traits tremblés
 * repassés plusieurs fois, grain du papier.
 */

/** Générateur pseudo-aléatoire (xorshift) : le décor est identique à chaque chargement. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const range = (rand, a, b) => a + (b - a) * rand();

/**
 * Trait de crayon le long d'une ligne brisée : plusieurs passages décalés
 * par deux ondulations lentes, épaisseur et opacité variables.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} pts
 */
export function pencilLine(ctx, pts, rand, { color = '#555', width = 3, alpha = 0.5, passes = 3, wobble = 1.5 } = {}) {
  if (pts.length < 2) return;
  const n = pts.length, nx = new Float32Array(n), ny = new Float32Array(n), arc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    nx[i] = -(b[1] - a[1]) / l;
    ny[i] = (b[0] - a[0]) / l;
    if (i > 0) arc[i] = arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  for (let p = 0; p < passes; p++) {
    const l1 = range(rand, 60, 160), l2 = range(rand, 15, 40), p1 = rand() * 7, p2 = rand() * 7;
    const a1 = wobble * range(rand, 0.6, 1.2), a2 = wobble * range(rand, 0.15, 0.45);
    ctx.globalAlpha = alpha * range(rand, 0.65, 1);
    ctx.lineWidth = width * range(rand, 0.65, 1.15);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = a1 * Math.sin(arc[i] / l1 + p1) + a2 * Math.sin(arc[i] / l2 + p2);
      const x = pts[i][0] + nx[i] * o, y = pts[i][1] + ny[i] * o;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Trait droit (hachure) légèrement courbé. */
export function hatch(ctx, rand, x0, y0, x1, y1, opts) {
  const bend = range(rand, -6, 6), pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, b = Math.sin(t * Math.PI) * bend;
    pts.push([x0 + (x1 - x0) * t + b, y0 + (y1 - y0) * t]);
  }
  pencilLine(ctx, pts, rand, opts);
}

/** Petite tuile de bruit, réutilisée pour le grain du papier et des traits. */
export function noiseTile(size, seed, dark = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), rand = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand();
    const fiber = v > 0.985 ? 0.5 : 0;
    const shade = dark ? 70 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = shade;
    img.data[i + 3] = Math.round(255 * (v * v * 0.35 + fiber));
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Ronge les traits avec du bruit : effet mine de crayon sur papier à grain. */
export function grain(ctx, w, h, strength = 0.55) {
  const tile = noiseTile(128, 77, true);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = strength;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

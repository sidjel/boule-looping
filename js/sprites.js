/**
 * Petites images dessinées une fois (brins de foin, feuilles mortes, flocons…), rangées sur une
 * planche, puis posées à chaque image comme des images tournées et agrandies. Sur téléphone, poser
 * des images d'une même planche coûte bien moins cher à la carte graphique que tracer des centaines
 * de traits courbes à chaque image.
 */

/**
 * Planche de cases : cells = [{ w, h, draw(g) }] (taille dans le monde ; draw dessine centré sur 0,0).
 * Renvoie { canvas, rects } ; rects[i] = [sx, sy, sw, sh] en pixels de la planche (RES fois plus fins).
 */
export function makeAtlas(cells, RES = 2) {
  const pad = 2;
  let x = 0, y = 0, rowH = 0;
  const W = 512, pos = [];
  for (const c of cells) {
    const w = Math.ceil(c.w * RES) + pad * 2, h = Math.ceil(c.h * RES) + pad * 2;
    if (x + w > W) { x = 0; y += rowH; rowH = 0; }
    pos.push([x, y, w, h]);
    x += w;
    rowH = Math.max(rowH, h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = y + rowH;
  const g = canvas.getContext('2d');
  cells.forEach((c, i) => {
    const [px, py, w, h] = pos[i];
    g.save();
    g.translate(px + w / 2, py + h / 2);
    g.scale(RES, RES);
    c.draw(g);
    g.restore();
  });
  return { canvas, rects: pos, res: RES };
}

/**
 * Pose la case r de la planche en (x, y) (repère du monde), tournée de angle, étirée de sx, sy.
 * M : la transformation du monde (ctx.getTransform(), prise une fois pour toute la couche).
 */
export function drawSprite(ctx, M, atlas, r, x, y, angle, sx, sy) {
  const [rx, ry, rw, rh] = atlas.rects[r], k = 1 / atlas.res;
  const c = Math.cos(angle), s = Math.sin(angle);
  const ta = c * sx * k, tb = s * sx * k, tc = -s * sy * k, td = c * sy * k;
  ctx.setTransform(M.a * ta + M.c * tb, M.b * ta + M.d * tb, M.a * tc + M.c * td, M.b * tc + M.d * td,
    M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f);
  ctx.drawImage(atlas.canvas, rx, ry, rw, rh, -rw / 2, -rh / 2, rw, rh);
}

/**
 * Une planche en deux finesses (1,5 et 3 pixels par unité du monde), faites ensemble au premier
 * appel : celle qui convient à l'échelle de l'écran (pixels d'écran par unité du monde) est rendue,
 * toujours un peu plus fine que l'écran, jamais beaucoup plus (une image très réduite scintille).
 * cells() : les cases (voir makeAtlas). Renvoie pick(échelle) → planche.
 */
export function twoAtlases(cells) {
  let lo = null, hi = null;
  return (scale) => {
    if (!lo) { lo = makeAtlas(cells(), 1.5); hi = makeAtlas(cells(), 3); }
    return scale <= 1.25 ? lo : hi;
  };
}

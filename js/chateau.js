/**
 * La bande du niveau 3 (ferme, lac, château), animée (tools/animer-niveau3.py) :
 * - les drapeaux du château flottent au vent, accrochés à leur mât (découpés du dessin, redessinés
 *   en fines tranches qui ondulent, plus fort vers la pointe) ;
 * - l'eau du lac ondule doucement : l'eau du dessin, dans son masque (sans les roseaux ni les rives),
 *   redessinée en fines bandes qui glissent un peu de côté ; le reflet du château tremble ;
 *   quelques reflets de lumière s'allument et s'éteignent.
 */
const img = {};
for (const [k, src] of [['fond', 'images/niveau3/fond.webp'], ['drapeaux', 'images/niveau3/drapeaux.webp'], ['eau', 'images/niveau3/eau.png']]) {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  img[k] = i;
}
const ok = (i) => i && i.complete && i.naturalWidth > 0;
let anim = null;
fetch('images/niveau3/anim.json').then((r) => r.json()).then((a) => (anim = a)).catch(() => {});

/** L'eau du dessin, seule (dans son masque) : préparée une fois. */
let water = null;
function waterLayer() {
  if (water || !anim || !ok(img.fond) || !ok(img.eau)) return water;
  const e = anim.eau, c = document.createElement('canvas');
  c.width = e.w; c.height = e.h;
  const g = c.getContext('2d');
  g.drawImage(img.fond, e.x, e.y, e.w, e.h, 0, 0, e.w, e.h);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img.eau, 0, 0);
  water = c;
  return water;
}

const ROW = 3; // hauteur d'une bande d'eau (pixels du dessin)

/**
 * Dessine la bande à (x, y), taille (w, h) dans le monde, au temps t ; x0, x1 : ce que voit la caméra.
 */
export function drawBande3(g, x, y, w, h, t, x0, x1) {
  if (!anim || !ok(img.fond)) return;
  g.drawImage(img.fond, x, y, w, h);
  const s = w / anim.W;
  g.save();
  g.translate(x, y);
  g.scale(s, h / anim.H);
  const v0 = (x0 - x) / s, v1 = (x1 - x) / s; // partie visible, en pixels du dessin

  // l'eau du lac
  const e = anim.eau, wl = waterLayer();
  if (wl && e.x < v1 && e.x + e.w > v0) {
    for (let r = 0; r < e.h; r += ROW) {
      const d = r / e.h; // plus près (bas du lac), vagues plus amples
      const dx = (0.5 + 0.9 * d) * (Math.sin(r * 0.33 + t * 1.7) + 0.55 * Math.sin(r * 0.097 - t * 1.05));
      const rh = Math.min(ROW, e.h - r);
      g.drawImage(wl, 0, r, e.w, rh, e.x + dx, e.y + r, e.w, rh + 0.4);
    }
    // reflets de lumière : de petits traits clairs qui s'allument, glissent un peu, s'éteignent
    g.lineCap = 'round';
    g.strokeStyle = '#fff';
    anim.reflets.forEach(([px, py], i) => {
      const k = Math.sin(t * (0.55 + (i % 5) * 0.09) + i * 2.1);
      if (k <= 0.35) return;
      const a = ((k - 0.35) / 0.65) ** 2 * 0.75, len = 7 + (i % 4) * 3, ox = Math.sin(t * 0.4 + i) * 4;
      g.globalAlpha = a;
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(px + ox - len / 2, py);
      g.lineTo(px + ox + len / 2, py);
      g.moveTo(px + ox - len / 4 + 2, py + 2.2);
      g.lineTo(px + ox + len / 4 + 2, py + 2.2);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  // les drapeaux : fines tranches verticales qui ondulent, de plus en plus vers la pointe
  if (ok(img.drapeaux)) {
    const D = img.drapeaux;
    anim.drapeaux.forEach((f, n) => {
      if (f.x > v1 || f.x + f.w < v0) return;
      const ph = n * 1.7, amp = 0.9 + f.h * 0.09;
      const stretch = 0.93 + 0.07 * Math.sin(t * 2.1 + ph); // le drapeau se tend et se détend
      for (let i = 0; i < f.w; i++) {
        const u = i / f.w;
        const dy = amp * u * Math.sin(t * 5.2 + ph - i * 0.5) + u * u * 0.6;
        g.drawImage(D, f.sx + i, 0, 1, f.h, f.x + i * stretch, f.y + dy, stretch + 0.35, f.h);
      }
    });
  }
  g.restore();
}

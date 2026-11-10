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
  i.decode?.().catch(() => {}); // décodée tout de suite, pas au premier dessin (à-coup)
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

/** Le reflet du château seul (l'eau sous le château, bords effacés sur les côtés). */
let reflect = null;
function reflectLayer() {
  const wl = waterLayer();
  if (reflect || !wl) return reflect;
  const e = anim.eau, w = REFLET.x1 - REFLET.x0, c = document.createElement('canvas');
  c.width = w; c.height = e.h;
  const g = c.getContext('2d');
  g.drawImage(wl, REFLET.x0 - e.x, 0, w, e.h, 0, 0, w, e.h);
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createLinearGradient(0, 0, w, 0), f = REFLET.fade / w;
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(f, '#000'); grad.addColorStop(1 - f, '#000'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, e.h);
  reflect = c;
  return reflect;
}

const ROW = 3; // hauteur d'une bande d'eau (pixels du dessin)
const FLAG_SCALE = 2; // les drapeaux, deux fois plus grands que dans le dessin
// le reflet du château dans le lac (colonnes du dessin) : il ondule plus fort que le reste de l'eau
const REFLET = { x0: 880, x1: 1250, fade: 70 };

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
      const dx = (0.8 + 1.3 * d) * (Math.sin(r * 0.33 + t * 1.7) + 0.55 * Math.sin(r * 0.097 - t * 1.05));
      const rh = Math.min(ROW, e.h - r);
      g.drawImage(wl, 0, r, e.w, rh, e.x + dx, e.y + r, e.w, rh + 0.4);
    }
    // le reflet du château : par-dessus, il ondule plus fort, se tord et s'étire un peu en hauteur
    const rl = reflectLayer();
    if (rl && REFLET.x0 < v1 && REFLET.x1 > v0) {
      const R = 2;
      for (let r = 0; r < e.h; r += R) {
        const dx = 2.4 * Math.sin(r * 0.42 + t * 2.4) + 1.3 * Math.sin(r * 0.13 - t * 1.5);
        const sy = Math.max(0, Math.min(e.h - R, r + 1.6 * Math.sin(r * 0.21 + t * 1.9)));
        g.drawImage(rl, 0, sy, rl.width, R, REFLET.x0 + dx, e.y + r, rl.width, R + 0.4);
      }
    }
    // reflets de lumière : de petits traits clairs qui s'allument, glissent un peu, s'éteignent
    g.lineCap = 'round';
    g.strokeStyle = '#fff';
    anim.reflets.forEach(([px, py], i) => {
      const k = Math.sin(t * (0.8 + (i % 5) * 0.13) + i * 2.1);
      if (k <= 0.35) return;
      const a = ((k - 0.35) / 0.65) ** 2 * 0.8, len = 14 + (i % 4) * 6, ox = Math.sin(t * 0.7 + i) * 9;
      g.globalAlpha = a;
      g.lineWidth = 2.1;
      g.beginPath();
      g.moveTo(px + ox - len / 2, py);
      g.lineTo(px + ox + len / 2, py);
      g.moveTo(px + ox - len / 4 + 4, py + 4);
      g.lineTo(px + ox + len / 4 + 4, py + 4);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  // les drapeaux, deux fois plus grands que dans le dessin, accrochés en haut du mât : fines tranches
  // verticales qui ondulent fort vers la pointe, se tendent et se détendent, battent un peu
  if (ok(img.drapeaux)) {
    const D = img.drapeaux, Z = FLAG_SCALE;
    anim.drapeaux.forEach((f, n) => {
      if (f.x > v1 || f.x + f.w * Z < v0) return;
      const ph = n * 1.7, amp = 1.2 + f.h * 0.16;
      const gust = 0.75 + 0.25 * Math.sin(t * 0.9 + ph); // le vent forcit puis faiblit
      const stretch = (0.86 + 0.14 * Math.sin(t * 2.6 + ph)) * Z;
      const top = f.y + 3; // haut du drapeau (le sprite a 3 px de marge au-dessus)
      for (let i = 0; i < f.w; i++) {
        const u = i / f.w, wave = t * 7.5 + ph - i * 0.62;
        const dy = Z * (amp * gust * u * Math.sin(wave) + u * u * 0.8 * (1.2 - gust));
        const sh = 1 + 0.16 * u * Math.cos(wave); // le tissu tourne : il paraît plus ou moins haut
        g.drawImage(D, f.sx + i, 0, 1, f.h, f.x + i * stretch, top + (0 - 3) * Z * sh + dy, stretch + 0.4, f.h * Z * sh);
      }
    });
  }
  g.restore();
}

/**
 * Boules bonus, dessinées au crayon (la boule rouge vient du dessin ; les autres en sont
 * des copies recolorées) :
 * - rouge : coup d'élan ;
 * - bleue : la boule colle à la route pendant 6 s (elle ne tombe plus des loopings) ;
 * - verte : bond, la boule saute ;
 * - jaune : plume, gravité réduite pendant 6 s (sauts plus longs, montées plus faciles).
 * Une boule bonus touchée disparaît et revient quelques secondes après.
 */
import { BALL_R, BONUSES, sample } from './track.js';
import { makeAtlas, twoAtlases, drawSprite } from './sprites.js';

const SIZE = 36;          // rayon affiché
const RESPAWN = 4;        // s avant que la boule bonus revienne
const GLOW = { red: '240,120,70', blue: '90,150,240', green: '90,190,100', yellow: '245,205,70' };
const INK = { red: '#b8452f', blue: '#2f62a8', green: '#2f7d3a', yellow: '#9a7410' };
const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';

/** Ce que fait chaque bonus : mot écrit sous la boule, et explication affichée quand on la prend. */
export const BONUS_INFO = {
  red: { word: 'élan', title: 'Bonus rouge : élan', text: 'Coup d’accélérateur dans le sens de la marche.' },
  blue: { word: 'colle', title: 'Bonus bleu : colle', text: 'Pendant 6 s, la boule colle à la route : elle ne tombe plus du haut des loopings.' },
  green: { word: 'bond', title: 'Bonus vert : bond', text: 'La boule fait un grand saut.' },
  yellow: { word: 'plume', title: 'Bonus jaune : plume', text: 'Pendant 6 s, la boule devient légère : sauts plus longs, montées plus faciles.' },
};

export class Bonuses {
  constructor(track) {
    this.list = BONUSES.map(({ piece, x, color }, n) => {
      const pc = track.byName[piece];
      let i = 0;
      while (i < pc.n - 1 && pc.x[i] < x) i++;
      const p = sample(pc, i * pc.step);
      return { x: p.x, y: p.y, nx: p.nx, ny: p.ny, color, away: 0, seed: n * 7.3 };
    });
    this.img = {};
  }

  /** @returns {object|null} la boule bonus touchée à cette image */
  update(dt, ball) {
    let hit = null;
    for (const b of this.list) {
      if (b.away > 0) { b.away -= dt; continue; }
      if (Math.abs(ball.x - b.x) < 120 && Math.hypot(ball.x - b.x, ball.y - b.y) < BALL_R + SIZE * 0.7) {
        b.away = RESPAWN;
        hit = b;
      }
    }
    return hit;
  }

  image(color) {
    if (!this.img[color]) {
      this.img[color] = new Image();
      this.img[color].src = `images/boule-${color}.png`;
    }
    return this.img[color];
  }

  /**
   * La lueur et le mot de chaque boule bonus sont dessinés une fois (glowAtlas, wordAtlas) puis posés
   * comme des images : avant, un dégradé créé et un mot tracé deux fois (contour, encre) par boule et
   * par image du jeu.
   */
  draw(ctx, t, x0, x1, labels = true) {
    let M = null, W = null;
    for (const b of this.list) {
      if (b.x < x0 - 100 || b.x > x1 + 100 || b.away > 0.6) continue;
      const img = this.image(b.color);
      if (!img.complete || !img.naturalWidth) continue;
      if (!M) { ctx.save(); M = ctx.getTransform(); W = wordAtlas(Math.hypot(M.a, M.b)); }
      const back = b.away > 0 ? Math.max(0, 1 - b.away / 0.6) : 1; // réapparition en douceur
      const bob = Math.sin(t * 2.2 + b.seed) * 5, pulse = 1 + 0.06 * Math.sin(t * 4.1 + b.seed);
      const x = b.x + b.nx * (8 + bob), y = b.y + b.ny * (8 + bob), r = SIZE * pulse * (b.away > 0 ? 0.6 + 0.4 * back : 1);
      const ci = COLORS.indexOf(b.color);
      // lueur : dessinée à son plus fort (GLOW_MAX), posée plus ou moins transparente
      ctx.globalAlpha = (back * (0.28 + 0.1 * Math.sin(t * 4.1))) / GLOW_MAX;
      drawSprite(ctx, M, glowAtlas(), ci, x, y, 0, r / SIZE, r / SIZE);
      ctx.globalAlpha = back;
      ctx.setTransform(M);
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.7 + b.seed) * 0.2);
      ctx.drawImage(img, -r * 1.15, -r * 1.15, r * 2.3, r * 2.3);
      if (labels) {
        // le mot écrit à la main sous la boule bonus : son contour clair, puis son encre
        ctx.globalAlpha = back * 0.9;
        const ly = y - r - 22 - WORD_BASE;
        drawSprite(ctx, M, W, ci * 2, x, ly, 0, 1, 1);
        drawSprite(ctx, M, W, ci * 2 + 1, x, ly, 0, 1, 1);
      }
    }
    if (M) ctx.restore();
  }
}

const COLORS = Object.keys(GLOW);
const GLOW_MAX = 0.38; // la lueur la plus forte (0,28 + 0,1)
/** La lueur de chaque couleur, pour une boule de rayon SIZE (dégradé doux : 1 pixel par unité suffit). */
let glows = null;
function glowAtlas() {
  if (!glows) {
    glows = makeAtlas(COLORS.map((c) => ({
      w: SIZE * 4.8, h: SIZE * 4.8,
      draw(g) {
        const glow = g.createRadialGradient(0, 0, SIZE * 0.3, 0, 0, SIZE * 2.4);
        glow.addColorStop(0, `rgba(${GLOW[c]},${GLOW_MAX})`);
        glow.addColorStop(1, `rgba(${GLOW[c]},0)`);
        g.fillStyle = glow;
        g.fillRect(-SIZE * 2.4, -SIZE * 2.4, SIZE * 4.8, SIZE * 4.8);
      },
    })), 1);
  }
  return glows;
}
/** Les mots : pour chaque couleur, une case pour le contour clair et une pour l'encre (posées l'une sur l'autre). */
const WORD_BASE = 10; // la ligne d'écriture est 10 px sous le milieu de la case
const wordAtlas = twoAtlases(() => {
  const font = `700 30px ${HAND}`, m = document.createElement('canvas').getContext('2d');
  m.font = font;
  return COLORS.flatMap((c) => {
    const word = BONUS_INFO[c].word, w = Math.ceil(m.measureText(word).width) + 24, h = 64;
    const set = (g) => { g.font = font; g.textAlign = 'center'; };
    return [
      { w, h, draw(g) { set(g); g.lineWidth = 6; g.strokeStyle = 'rgba(240,238,232,0.9)'; g.strokeText(word, 0, WORD_BASE); } },
      { w, h, draw(g) { set(g); g.fillStyle = INK[c]; g.fillText(word, 0, WORD_BASE); } },
    ];
  });
});

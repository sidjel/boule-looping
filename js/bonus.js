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

  draw(ctx, t, x0, x1, labels = true) {
    for (const b of this.list) {
      if (b.x < x0 - 100 || b.x > x1 + 100 || b.away > 0.6) continue;
      const img = this.image(b.color);
      if (!img.complete || !img.naturalWidth) continue;
      const back = b.away > 0 ? Math.max(0, 1 - b.away / 0.6) : 1; // réapparition en douceur
      const bob = Math.sin(t * 2.2 + b.seed) * 5, pulse = 1 + 0.06 * Math.sin(t * 4.1 + b.seed);
      const x = b.x + b.nx * (8 + bob), y = b.y + b.ny * (8 + bob), r = SIZE * pulse * (b.away > 0 ? 0.6 + 0.4 * back : 1);
      ctx.save();
      ctx.globalAlpha = back;
      const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      glow.addColorStop(0, `rgba(${GLOW[b.color]},${0.28 + 0.1 * Math.sin(t * 4.1)})`);
      glow.addColorStop(1, `rgba(${GLOW[b.color]},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.7 + b.seed) * 0.2);
      ctx.drawImage(img, -r * 1.15, -r * 1.15, r * 2.3, r * 2.3);
      ctx.restore();
      if (labels) {
        // le mot écrit à la main sous la boule bonus
        ctx.save();
        ctx.globalAlpha = back * 0.9;
        ctx.font = `700 30px ${HAND}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(240,238,232,0.9)';
        const ly = y - r - 22;
        ctx.strokeText(BONUS_INFO[b.color].word, x, ly);
        ctx.fillStyle = INK[b.color];
        ctx.fillText(BONUS_INFO[b.color].word, x, ly);
        ctx.restore();
      }
    }
  }
}

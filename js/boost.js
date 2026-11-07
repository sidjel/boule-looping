/**
 * Boule d'élan : la petite boule rouge-orangé dessinée au crayon (images/boule-boost.png),
 * posée avant les deux loopings du niveau 3. Quand la boule d'acier la touche, elle reçoit
 * un coup d'accélérateur ; la boule d'élan disparaît puis revient quelques secondes après.
 */
import { BALL_R, sample } from './track.js';

const BOOST_AT = [{ piece: 'main', x: 4475 }];
const SIZE = 36;          // rayon affiché
const RESPAWN = 4;        // s avant que la boule d'élan revienne

export class Boosters {
  constructor(track) {
    this.img = new Image();
    this.img.src = 'images/boule-boost.png';
    this.list = BOOST_AT.map(({ piece, x }) => {
      const pc = track.byName[piece];
      let i = 0;
      while (i < pc.n - 1 && !(pc.x[i] >= x && i * pc.step > 7000)) i++;
      const p = sample(pc, i * pc.step);
      return { x: p.x, y: p.y, nx: p.nx, ny: p.ny, away: 0, seed: i };
    });
  }

  /** @returns {object|null} la boule d'élan touchée à cette image */
  update(dt, ball) {
    let hit = null;
    for (const b of this.list) {
      if (b.away > 0) { b.away -= dt; continue; }
      if (Math.hypot(ball.x - b.x, ball.y - b.y) < BALL_R + SIZE * 0.7) {
        b.away = RESPAWN;
        hit = b;
      }
    }
    return hit;
  }

  draw(ctx, t) {
    if (!this.img.complete || !this.img.naturalWidth) return;
    for (const b of this.list) {
      const back = b.away > 0 ? Math.max(0, 1 - b.away / 0.6) : 1; // réapparition en douceur
      if (b.away > 0.6) continue;
      const bob = Math.sin(t * 2.2 + b.seed) * 5, pulse = 1 + 0.06 * Math.sin(t * 4.1);
      const x = b.x + b.nx * (8 + bob), y = b.y + b.ny * (8 + bob), r = SIZE * pulse * (b.away > 0 ? 0.6 + 0.4 * back : 1);
      ctx.save();
      ctx.globalAlpha = back;
      const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      glow.addColorStop(0, `rgba(240,120,70,${0.28 + 0.1 * Math.sin(t * 4.1)})`);
      glow.addColorStop(1, 'rgba(240,120,70,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.7 + b.seed) * 0.2);
      ctx.drawImage(this.img, -r * 1.15, -r * 1.15, r * 2.3, r * 2.3);
      ctx.restore();
    }
  }
}

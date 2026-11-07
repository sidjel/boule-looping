/**
 * Petits effets au crayon : étincelles des chocs, trait du looping, reflets et traits
 * de vitesse, petits mots écrits à la main, traînée du doigt. Les sons sont dans audio.js.
 */
import { BALL_R } from './track.js';

const R = BALL_R;
const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';

export class Effects {
  constructor() {
    this.items = [];
    this.history = []; // positions récentes de la boule (traînée, fantômes)
    this.time = 0;
  }

  /** À chaque image : mémorise la position de la boule. */
  follow(ball, dt) {
    this.time += dt;
    this.history.push({ x: ball.x, y: ball.y, t: this.time });
    while (this.history.length && this.history[0].t < this.time - 1.4) this.history.shift();
    for (const it of this.items) if (it.kind === 'path' && it.grow > 0) it.pts.push([ball.x, ball.y]);
  }

  /** Looping réussi : la boule laisse un trait de crayon le long de la boucle, qui s'efface. */
  loop(x, y) {
    const pts = this.history.filter((h) => h.t > this.time - 0.55).map((h) => [h.x, h.y]);
    this.items.push({ kind: 'path', pts, grow: 0.5, life: 1.9, max: 1.9 });
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      this.items.push({ kind: 'star', x: x + Math.cos(a) * R * 2.6, y: y + Math.sin(a) * R * 2.6 + R * 1.5, s: 7 + (i % 2) * 4, life: 0.9 + i * 0.08, max: 0.9 + i * 0.08 });
    }
  }

  update(dt) {
    for (const it of this.items) {
      it.life -= dt;
      if (it.grow > 0) it.grow -= dt;
    }
    this.items = this.items.filter((it) => it.life > 0);
  }

  sparkle(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.items.push({ kind: 'line', x, y, a, r0: R * 1.2, r1: R * 2, life: 0.45, max: 0.45, color: '#8a8a8e' });
    }
  }

  whoosh(x, y, dir) {
    for (let i = -1; i <= 1; i++) {
      this.items.push({ kind: 'dash', x: x - dir * R * 1.4, y: y + i * 12, dir, life: 0.3, max: 0.3 });
    }
  }

  clink(x, y, power) {
    if (power > 250) {
      const n = Math.min(7, 2 + Math.floor(power / 300));
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        this.items.push({ kind: 'line', x, y: y + R * 0.6, a: a + Math.PI, r0: R * 0.4, r1: R * (0.9 + Math.random()), life: 0.25, max: 0.25, color: '#4b4b4f' });
      }
    }
  }

  text(label, x, y) {
    this.items.push({ kind: 'text', label, x, y, life: 1.4, max: 1.4 });
  }

  /** Boost : traînée rouge au crayon, épaisse près de la boule, qui s'effile et s'efface. */
  drawHeat(ctx, ball) {
    if (ball.heat <= 0) return;
    const pts = this.history.filter((p) => p.t > this.time - 0.45);
    if (pts.length < 3) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, a, color] of [[1.5, 0.22, '#e0553d'], [0.9, 0.35, '#d23f2e'], [0.3, 0.5, '#f08a4b']]) {
      for (let i = 1; i < pts.length; i++) {
        const k = i / pts.length;
        ctx.strokeStyle = color;
        ctx.globalAlpha = a * ball.heat * k;
        ctx.lineWidth = R * w * k * (0.6 + 0.4 * ball.heat);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Boule d'élan touchée : éclats rouge-orangé au crayon. */
  burst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      this.items.push({ kind: 'line', x, y, a, r0: R * 0.9, r1: R * (1.8 + Math.random() * 0.9), life: 0.5, max: 0.5, color: i % 2 ? '#e0553d' : '#f08a4b' });
    }
  }

  /** Vitesse : reflets fantômes de la boule et traits de vitesse quand elle file. */
  drawSpeed(ctx, ball) {
    let dx, dy, sp;
    if (ball.onTrack) {
      const f = ball.frame();
      sp = Math.abs(ball.v);
      dx = f.tx * Math.sign(ball.v);
      dy = f.ty * Math.sign(ball.v);
    } else {
      sp = Math.hypot(ball.vx, ball.vy);
      dx = ball.vx / (sp || 1);
      dy = ball.vy / (sp || 1);
    }
    const k = Math.max(0, Math.min(1, (sp - 900) / 1800));
    if (k <= 0 || ball.age < 0.4) return;
    ctx.save();
    const h = this.history;
    for (let j = 1; j <= 4; j++) {
      const p = h[h.length - 1 - j * 2];
      if (!p) break;
      ctx.globalAlpha = k * (0.22 - j * 0.045);
      ctx.fillStyle = '#9a9ca2';
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1 - j * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#4f4f55';
    ctx.lineCap = 'round';
    for (const [o, l] of [[-0.75, 0.7], [-0.3, 1.1], [0.2, 1.3], [0.65, 0.8]]) {
      ctx.globalAlpha = 0.12 + 0.45 * k;
      ctx.lineWidth = 1.6 + 1.4 * k;
      const ox = ball.x - dy * o * R, oy = ball.y + dx * o * R;
      const start = R * 1.25, len = R * (0.8 + 2.6 * k) * l;
      ctx.beginPath();
      ctx.moveTo(ox - dx * start, oy - dy * start);
      ctx.lineTo(ox - dx * (start + len), oy - dy * (start + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const it of this.items) {
      const k = it.life / it.max;
      if (it.kind === 'line') {
        ctx.strokeStyle = it.color;
        ctx.globalAlpha = k * 0.8;
        ctx.lineWidth = 2.2;
        const grow = 1 - k * 0.4;
        ctx.beginPath();
        ctx.moveTo(it.x + Math.cos(it.a) * it.r0 * grow, it.y + Math.sin(it.a) * it.r0 * grow);
        ctx.lineTo(it.x + Math.cos(it.a) * it.r1 * grow, it.y + Math.sin(it.a) * it.r1 * grow);
        ctx.stroke();
      } else if (it.kind === 'dash') {
        ctx.strokeStyle = '#6a6a6e';
        ctx.globalAlpha = k * 0.6;
        ctx.lineWidth = 2;
        const off = (1 - k) * 30;
        ctx.beginPath();
        ctx.moveTo(it.x - it.dir * off, it.y);
        ctx.lineTo(it.x - it.dir * (off + 40), it.y);
        ctx.stroke();
      } else if (it.kind === 'path' && it.pts.length > 2) {
        ctx.strokeStyle = '#5a5a60';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.5 * Math.min(1, k * 1.6);
        ctx.lineWidth = 3 + 3 * k;
        ctx.beginPath();
        it.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      } else if (it.kind === 'star') {
        const g = Math.sin(Math.min(1, (1 - k) * 2.2) * Math.PI) * it.s;
        ctx.strokeStyle = '#d1a51e';
        ctx.globalAlpha = 0.85 * Math.min(1, k * 2);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(it.x - g, it.y);
        ctx.lineTo(it.x + g, it.y);
        ctx.moveTo(it.x, it.y - g);
        ctx.lineTo(it.x, it.y + g);
        ctx.stroke();
      } else if (it.kind === 'text') {
        const rise = (1 - k) * 60;
        ctx.globalAlpha = Math.min(1, k * 2.5);
        ctx.font = `bold 64px ${HAND}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(236,235,231,0.9)';
        ctx.strokeText(it.label, it.x, it.y - rise);
        ctx.fillStyle = '#3d3d42';
        ctx.fillText(it.label, it.x, it.y - rise);
      }
    }
    ctx.restore();
  }

  /** Traînée du geste (coordonnées écran) ; un rond quand le doigt pousse. */
  drawTrail(ctx, trail, hold) {
    if (trail.length) {
      const now = performance.now();
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#4b4b4f';
      for (let i = 1; i < trail.length; i++) {
        if (trail[i].start) continue;
        const age = (now - trail[i].t) / 300;
        ctx.globalAlpha = Math.max(0, 0.45 * (1 - age));
        ctx.lineWidth = 3 * (1 - age) + 1;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (hold) {
      const p = hold;
      ctx.save();
      ctx.strokeStyle = '#4b4b4f';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 + 3 * Math.sin(performance.now() / 120), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

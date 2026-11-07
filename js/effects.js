/**
 * Petits effets au crayon : étincelles des chocs (avec un « tink » métallique),
 * traits de vitesse, mot « Looping ! », traînée du doigt.
 */
import { BALL_R } from './track.js';

const R = BALL_R;
const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';

export class Effects {
  constructor() {
    this.items = [];
    this.audio = null;
    this.lastClink = 0;
  }

  unlockSound() {
    if (this.audio) return;
    try {
      this.audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.audio = false;
    }
  }

  update(dt) {
    for (const it of this.items) it.life -= dt;
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
    this.ping(power);
  }

  ping(power) {
    const ac = this.audio, now = performance.now();
    if (!ac || now - this.lastClink < 60) return;
    this.lastClink = now;
    if (ac.state === 'suspended') ac.resume();
    const vol = Math.min(0.22, power / 6000);
    const t = ac.currentTime;
    for (const [f, d] of [[2950, 0.16], [4410, 0.09], [6230, 0.05]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f * (0.97 + Math.random() * 0.06);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    }
  }

  text(label, x, y) {
    this.items.push({ kind: 'text', label, x, y, life: 1.4, max: 1.4 });
  }

  /** Traits de vitesse derrière la bille quand elle file. */
  drawSpeed(ctx, ball) {
    const vx = ball.onTrack ? null : ball.vx;
    let dx, dy, sp;
    if (vx === null) {
      const i = Math.min(ball.tr.n - 1, Math.round(ball.s / ball.tr.step));
      sp = Math.abs(ball.v);
      dx = ball.tr.tx[i] * Math.sign(ball.v);
      dy = ball.tr.ty[i] * Math.sign(ball.v);
    } else {
      sp = Math.hypot(ball.vx, ball.vy);
      dx = ball.vx / (sp || 1);
      dy = ball.vy / (sp || 1);
    }
    if (sp < 1100) return;
    const a = Math.min(0.5, (sp - 1100) / 2400);
    ctx.save();
    ctx.strokeStyle = '#55555a';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.globalAlpha = a;
    for (const o of [-0.6, 0, 0.6]) {
      const ox = ball.x - dy * o * R, oy = ball.y + dx * o * R;
      const len = R * (1.2 + Math.abs(o) * -0.6 + sp / 1500);
      ctx.beginPath();
      ctx.moveTo(ox - dx * R * 1.3, oy - dy * R * 1.3);
      ctx.lineTo(ox - dx * (R * 1.3 + len), oy - dy * (R * 1.3 + len));
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

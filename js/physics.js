/**
 * Physique d'une bille d'acier pleine qui roule sans glisser.
 * - Sur la route : mouvement le long du chemin du centre, accélération 5/7·g·sinθ
 *   (inertie d'une sphère pleine), frottement de roulement proportionnel à la réaction.
 * - La route est une gouttière : la bille reste dedans sur les bosses. Sous un surplomb
 *   (haut du looping), si la réaction devient négative, elle tombe : parabole, rebond, reprise.
 */
import { WORLD, BALL_R, sample, segmentsNear } from './track.js';

export const G = 2400;            // px/s² (≈ 1 m pour 245 px)
const ROLL = 5 / 7;               // sphère pleine : I = 2/5·m·r²
const ROLL_RES = 0.018;           // frottement de roulement (route crayonnée)
const AIR = 0.00009;              // traînée de l'air (par px)
const STATIC = 70;                // px/s² : en dessous, la bille reste posée
const BOUNCE_MIN = 380;           // px/s : vitesse d'impact qui fait rebondir
const RESTITUTION = 0.32;         // rebond acier sur la route
const V_MAX = 4200;

export class Ball {
  constructor(track) {
    this.tr = track;
    this.events = [];
    this.respawn();
  }

  respawn() {
    const p = sample(this.tr, this.tr.spawnS);
    Object.assign(this, { onTrack: true, s: this.tr.spawnS, v: 0, x: p.x, y: p.y, vx: 0, vy: 0, omega: 0, angle: 0, age: 0 });
    this.lastS = this.s;
    this.events.push({ type: 'spawn' });
  }

  /** Coup de doigt : vitesse ajoutée le long de la route (projection du geste). */
  impulse(wx, wy) {
    if (!this.onTrack) return false;
    const p = sample(this.tr, this.s);
    this.v = clamp(this.v + wx * p.tx + wy * p.ty, -V_MAX, V_MAX);
    return true;
  }

  /** @param {number} dt @param {{x:number,y:number}} push accélération voulue par le joueur */
  step(dt, push) {
    this.age += dt;
    if (this.onTrack) this.stepTrack(dt, push);
    else this.stepAir(dt);
    this.angle += this.omega * dt;
    if (this.x > WORLD.w + BALL_R * 0.5 || this.y > WORLD.h + 400) {
      this.events.push({ type: 'exit' });
      this.respawn();
    }
  }

  stepTrack(dt, push) {
    const tr = this.tr, p = sample(tr, this.s);
    // Réaction de la route (par unité de masse). La route est une gouttière : sur les bosses
    // la bille y reste ; sous un surplomb (haut du looping), elle tombe si elle est trop lente.
    let N = this.v * this.v * p.k - G * p.ny;
    if (N < 0) {
      if (p.ny > 0.15) return this.takeOff(p);
      N = 0;
    }
    const along = ROLL * G * p.ty + ROLL * (push.x * p.tx + push.y * p.ty);
    const resist = ROLL * ROLL_RES * N + AIR * this.v * this.v;
    if (Math.abs(this.v) < 6 && Math.abs(along) < STATIC + resist) {
      this.v = 0;
    } else {
      const dir = this.v !== 0 ? Math.sign(this.v) : Math.sign(along);
      const nv = this.v + (along - dir * resist) * dt;
      this.v = this.v !== 0 && Math.sign(nv) !== Math.sign(this.v) && Math.abs(along) < resist ? 0 : nv;
    }
    this.v = clamp(this.v, -V_MAX, V_MAX);
    this.lastS = this.s;
    this.s += this.v * dt;
    if (this.s < tr.sMin) {
      this.s = tr.sMin;
      if (this.v < -40) this.events.push({ type: 'clink', power: -this.v });
      this.v = -this.v * 0.35;
    }
    if (this.lastS < tr.loopTopS && this.s >= tr.loopTopS) this.events.push({ type: 'loop' });
    const q = sample(tr, this.s);
    this.x = q.x;
    this.y = q.y;
    this.omega = this.v / BALL_R;
    if (this.s >= tr.length - 1) this.takeOff(q);
  }

  takeOff(p) {
    this.onTrack = false;
    this.vx = this.v * p.tx;
    this.vy = this.v * p.ty;
    this.x = p.x + p.nx * 0.8;
    this.y = p.y + p.ny * 0.8;
  }

  stepAir(dt) {
    const sp = Math.hypot(this.vx, this.vy);
    const drag = 1 - AIR * sp * dt;
    this.vx *= drag;
    this.vy = this.vy * drag + G * dt;
    const ox = this.x, oy = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < BALL_R) {
      this.x = BALL_R;
      this.vx = Math.abs(this.vx) * 0.4;
    }
    this.collide(ox, oy);
  }

  /** La bille traverse le chemin du centre depuis le côté libre : contact. */
  collide(ox, oy) {
    const tr = this.tr;
    let best = null;
    for (const i of segmentsNear(tr, this.x, this.y)) {
      const ax = tr.x[i], ay = tr.y[i], bx = tr.x[i + 1], by = tr.y[i + 1];
      const hit = segHit(ox, oy, this.x, this.y, ax, ay, bx, by);
      if (!hit) continue;
      const nx = tr.ty[i], ny = -tr.tx[i];
      if ((ox - ax) * nx + (oy - ay) * ny < 0) continue; // venu de dessous : on ignore
      if (!best || hit.a < best.a) best = { ...hit, i };
    }
    if (!best) return;
    const s = (best.i + best.b) * tr.step;
    const p = sample(tr, s);
    const vn = this.vx * p.nx + this.vy * p.ny, vt = this.vx * p.tx + this.vy * p.ty;
    if (-vn > BOUNCE_MIN) {
      this.vx = vt * p.tx * 0.92 - vn * RESTITUTION * p.nx;
      this.vy = vt * p.ty * 0.92 - vn * RESTITUTION * p.ny;
      this.x = p.x + p.nx;
      this.y = p.y + p.ny;
      this.omega = this.omega * 0.6 + (vt / BALL_R) * 0.4;
      this.events.push({ type: 'clink', power: -vn });
    } else {
      this.onTrack = true;
      this.s = s;
      this.lastS = s;
      // le patinage au contact égalise rotation et vitesse : un peu d'énergie perdue
      this.v = (5 * vt + 2 * this.omega * BALL_R) / 7;
      this.x = p.x;
      this.y = p.y;
      if (-vn > 120) this.events.push({ type: 'clink', power: -vn });
    }
  }
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/** Intersection des segments [o→p] et [a→b] : paramètres a (sur o→p) et b (sur a→b). */
function segHit(ox, oy, px, py, ax, ay, bx, by) {
  const rx = px - ox, ry = py - oy, sx = bx - ax, sy = by - ay;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = ax - ox, qy = ay - oy;
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { a: t, b: u } : null;
}

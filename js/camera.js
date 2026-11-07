/**
 * Caméra : deux cadrages.
 * - « Vue d'ensemble » : toute la feuille est visible (par défaut en paysage).
 *   Sur les côtés, la table sur laquelle la feuille est posée.
 * - « Suivre la boule » : zoom sur la boule, la caméra l'accompagne (par défaut en portrait).
 * Le passage de l'un à l'autre est animé.
 */
import { WORLD } from './track.js';

export class Camera {
  constructor() {
    Object.assign(this, { x: 0, y: 0, scale: 1, dpr: 1, W: 1, H: 1, followScale: 1, fitScale: 1 });
    this.wideBy = { landscape: true, portrait: false };
  }

  /** @param {number} W largeur en pixels physiques @param {number} H hauteur */
  resize(W, H, dpr) {
    Object.assign(this, { W, H, dpr });
    // Suivre : la feuille remplit l'écran, avec au moins 1000 px du dessin en largeur.
    this.followScale = Math.min(Math.max(W / WORLD.w, H / WORLD.h), W / 1000);
    // Vue d'ensemble : toute la feuille tient dans l'écran.
    this.fitScale = Math.min(W / WORLD.w, H / WORLD.h);
  }

  get landscape() {
    return this.W > this.H;
  }

  get wide() {
    return this.wideBy[this.landscape ? 'landscape' : 'portrait'];
  }

  toggle() {
    const k = this.landscape ? 'landscape' : 'portrait';
    this.wideBy[k] = !this.wideBy[k];
  }

  get viewW() {
    return this.W / this.scale;
  }

  get viewH() {
    return this.H / this.scale;
  }

  update(dt, ball, snap = false) {
    const target = this.wide ? this.fitScale : this.followScale;
    const ks = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.scale += (target - this.scale) * ks;
    const vw = this.viewW, vh = this.viewH;
    let tx, ty;
    if (vw >= WORLD.w) tx = (WORLD.w - vw) / 2;
    else {
      const look = clamp((ball.onTrack ? ball.v : ball.vx) * 0.1, -250, 250);
      tx = clamp(ball.x + look - vw / 2, 0, WORLD.w - vw);
    }
    if (vh >= WORLD.h) ty = WORLD.h - vh; // feuille calée en bas, le ciel continue au-dessus
    else {
      const look = clamp(ball.onTrack ? 0 : ball.vy * 0.12, -150, 250);
      ty = clamp(ball.y + look - vh * 0.42, 0, WORLD.h - vh);
    }
    const kx = snap ? 1 : this.wide ? ks : 1 - Math.exp(-dt * 4);
    const ky = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.x += (tx - this.x) * kx;
    this.y += (ty - this.y) * ky;
  }
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

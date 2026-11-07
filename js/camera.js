/**
 * Caméra : deux cadrages.
 * - « Vue d'ensemble » : toute la feuille du niveau en cours est visible (par défaut en paysage).
 *   Sur les côtés, la table ; on glisse d'une feuille à l'autre quand la boule change de niveau.
 * - « Suivre la boule » : zoom sur la boule, la caméra l'accompagne (par défaut en portrait).
 * Le passage de l'un à l'autre est animé. À grande vitesse, le zoom recule un peu.
 */
import { WORLD, SHEET, LEVELS } from './track.js';

export class Camera {
  constructor() {
    Object.assign(this, { x: 0, y: 0, scale: 1, dpr: 1, W: 1, H: 1, followScale: 1, fitScale: 1, rush: 0 });
    this.wideBy = { landscape: true, portrait: false };
  }

  /** @param {number} W largeur en pixels physiques @param {number} H hauteur */
  resize(W, H, dpr) {
    Object.assign(this, { W, H, dpr });
    // Suivre : la feuille remplit l'écran, avec au moins 1000 px du dessin en largeur.
    this.followScale = Math.min(Math.max(W / SHEET, H / WORLD.h), W / 1000);
    // Vue d'ensemble : toute la feuille tient dans l'écran.
    this.fitScale = Math.min(W / SHEET, H / WORLD.h);
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
    const speed = ball.onTrack ? Math.abs(ball.v) : Math.hypot(ball.vx, ball.vy);
    const rush = Math.max(0, Math.min(1, (speed - 1000) / 2000));
    this.rush += (rush - this.rush) * (snap ? 1 : 1 - Math.exp(-dt * 2));
    const target = this.wide ? this.fitScale : this.followScale * (1 - 0.12 * this.rush);
    const ks = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.scale += (target - this.scale) * ks;
    const vw = this.viewW, vh = this.viewH;
    let tx, ty;
    if (vw >= SHEET - 1) {
      const sheet = Math.max(0, Math.min(LEVELS - 1, Math.floor(ball.x / SHEET)));
      // feuille du niveau centrée ; aux bouts, calée au bord pour montrer la feuille voisine plutôt que la table
      const lo = Math.min(0, (WORLD.w - vw) / 2);
      tx = clamp(sheet * SHEET + (SHEET - vw) / 2, lo, Math.max(lo, WORLD.w - vw));
    }
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

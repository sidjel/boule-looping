/**
 * Physique d'une bille d'acier pleine qui roule sans glisser.
 * - Sur la route : mouvement le long du chemin du centre, accélération 5/7·g·sinθ
 *   (inertie d'une sphère pleine), frottement de roulement proportionnel à la réaction.
 * - La route est une gouttière : la bille reste dedans sur les bosses (sauf à la lèvre d'un
 *   tremplin). Dans un looping, elle reste plaquée à la paroi : sans assez d'élan, elle ne tombe
 *   pas, elle redescend en marche arrière le long de la courbe (track.js : pc.inLoop). Sous un
 *   autre surplomb, si la réaction devient négative, elle tombe : parabole, rebond, reprise.
 * - Vitesse plafonnée (SPEED.cap, le long de la route et pour les lancers) ; la boule rouge
 *   permet de dépasser un peu ce plafond pendant son effet, puis la vitesse y revient en douceur.
 * - Saisons : sur la glace elle glisse (accélère davantage, presque sans frottement, répond
 *   moins aux gestes, surtout pour revenir en arrière) ; le vent d'automne la pousse ;
 *   les flaques et l'eau la freinent.
 * - Bonus : rouge = élan, bleu = colle à la route, vert = bond, jaune = plume (gravité réduite).
 * - Au bout d'un tronçon, elle passe au suivant (à un aiguillage : le chemin choisi).
 */
import { WORLD, SHEET, JUMPS, BALL_R, sample, segmentsNear } from './track.js';
import { biomeParams, windAt } from './biomes.js';
import { hitObstacles, windCalm } from './obstacles.js';

export const G = 2400;            // px/s² (≈ 1 m pour 245 px)
const AIR = 0.00009;              // traînée de l'air (par px)
const STATIC = 70;                // px/s² : en dessous, la bille reste posée
/**
 * Plafond de vitesse le long de la route (px/s). Au-dessus (élan de la boule rouge, descente),
 * la vitesse redescend vers lui en douceur (OVER px/s² de freinage) ; les lancers au doigt ne le
 * dépassent jamais. redCap : plafond pendant l'effet de la boule rouge (part du plafond).
 */
export const SPEED = { cap: 1696, redCap: 1.15, stickLoops: true }; // stickLoops : plaquée dans les loopings
const OVER = 2600;
const V_MAX = 4200;               // limite absolue (sécurité)
const BOOST = 950;                // px/s ajoutés par la boule rouge
const BOND = 1250;                // px/s d'élan vers le haut donnés par la boule verte
const HOP_REST = 0.35;            // s entre deux sauts
const HOP_GRACE = 0.16;           // s de tolérance avant et après le contact avec la route
const HOP_FORWARD = 260;          // px/s de poussée vers l'avant au saut

/** Durées des effets de bonus (s) et leur couleur. */
export const BONUS = {
  red: { time: 2.6, color: [230, 75, 52] },
  blue: { time: 6, color: [70, 130, 225] },
  green: { time: 1.6, color: [70, 175, 80] },
  yellow: { time: 6, color: [235, 190, 40] },
};

export class Ball {
  constructor(track) {
    this.tr = track;
    this.events = [];
    this.clock = 0;
    this.skin = { hop: 1050, restitution: 0.32, bounceMin: 380, rollRes: 1, wind: 1, puddle: 1, crush: false };
    this.respawn();
  }

  /** Repart d'un point de reprise (début d'un niveau). */
  /** Repart d'un début de niveau, ou d'un point de reprise donné ({ pc, s }). */
  respawn(level = 0, point = null) {
    const cp = point || this.tr.checkpoints[Math.max(0, Math.min(this.tr.checkpoints.length - 1, level))];
    const p = sample(cp.pc, cp.s);
    Object.assign(this, { onTrack: true, jumpZone: null, pc: cp.pc, s: cp.s, v: 0, x: p.x, y: p.y, vx: 0, vy: 0, omega: 0, angle: 0, age: 0 });
    this.fx = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.lastS = this.s;
    this.inPuddle = false;
    this.hopWait = 0;
    this.hopBuffer = 0;
    this.leftTrack = -1;
    this.events.push({ type: 'spawn', level });
  }

  frame() {
    return sample(this.pc, this.s);
  }

  speed() {
    return this.onTrack ? Math.abs(this.v) : Math.hypot(this.vx, this.vy);
  }

  /** Saison sous la boule (réglages mélangés près des jonctions). */
  biome() {
    return biomeParams(this.x);
  }

  /** Boule choisie (acier, verre, pétanque…) : ses réglages physiques. */
  setSkin(skin) {
    this.skin = skin;
  }

  /** Teinte actuelle de la boule (effet de bonus le plus fort) : [r, g, b, force] ou null. */
  tint() {
    let best = null;
    for (const [k, t] of Object.entries(this.fx)) {
      const a = t / BONUS[k].time;
      if (a > 0 && (!best || a > best[3])) best = [...BONUS[k].color, a];
    }
    return best;
  }

  /** Une boule bonus est touchée. */
  bonus(kind) {
    this.fx[kind] = BONUS[kind].time;
    if (kind === 'red') {
      const cap = SPEED.cap * SPEED.redCap;
      if (this.onTrack) {
        const dir = this.v < -1 ? -1 : 1;
        this.v = dir * Math.max(Math.abs(this.v), Math.min(cap, Math.abs(this.v) + BOOST));
      } else {
        const sp = Math.hypot(this.vx, this.vy) || 1, k = Math.max(sp, Math.min(cap, sp + BOOST)) / sp;
        this.vx *= k;
        this.vy *= k;
      }
    } else if (kind === 'green' && this.onTrack) {
      const p = this.frame();
      this.takeOff(p);
      this.vx += p.nx * BOND;
      this.vy += p.ny * BOND;
    }
  }

  /**
   * Saut demandé par le joueur (touche brève sur l'écran). Tolérant :
   * - possible encore un court instant après avoir quitté la route (bord d'une marche) ;
   * - demandé un peu trop tôt en l'air, il est gardé et part dès que la boule touche la route.
   * Il pousse aussi un peu vers l'avant, dans le sens de la marche.
   */
  hop() {
    if (this.hopWait > 0) return false;
    let p;
    if (this.onTrack) {
      p = this.frame();
      this.takeOff(p);
    } else if (this.clock - this.leftTrack < HOP_GRACE && !this.hopped && this.lastFrame) {
      p = this.lastFrame;
      this.vy = Math.min(this.vy, 0);
    } else {
      this.hopBuffer = HOP_GRACE;
      return false;
    }
    const dir = Math.abs(this.vx) > 20 ? Math.sign(this.vx) : 1;
    this.vx += p.nx * this.skin.hop + p.tx * dir * HOP_FORWARD;
    this.vy += p.ny * this.skin.hop + p.ty * dir * HOP_FORWARD;
    this.events.push({ type: 'hop' });
    this.hopWait = HOP_REST;
    this.hopped = true;
    this.hopBuffer = 0;
    return true;
  }

  /** Geste du joueur : la glace répond moins bien, surtout pour revenir en arrière. */
  control(dv) {
    const b = this.biome();
    const back = Math.abs(this.v) > 30 && Math.sign(dv) !== Math.sign(this.v);
    return dv * (back ? b.backControl : b.control);
  }

  /** Coup de doigt : vitesse ajoutée le long de la route (projection du geste). */
  impulse(wx, wy) {
    if (!this.onTrack) return false;
    const p = this.frame();
    // un lancer ne dépasse pas le plafond (mais ne freine pas une boule déjà plus rapide)
    const nv = this.v + this.control(wx * p.tx + wy * p.ty), lim = Math.max(SPEED.cap, Math.abs(this.v));
    this.v = clamp(nv, -lim, lim);
    return true;
  }

  /** @param {number} dt @param {{x:number,y:number}} push accélération voulue par le joueur */
  step(dt, push) {
    this.age += dt;
    this.clock += dt;
    for (const k in this.fx) this.fx[k] = Math.max(0, this.fx[k] - dt);
    this.hopWait = Math.max(0, this.hopWait - dt);
    const px = this.x;
    if (this.onTrack) this.stepTrack(dt, push);
    else this.stepAir(dt);
    this.angle += this.omega * dt;
    hitObstacles(this, dt);
    // saut demandé un peu trop tôt : il part dès que la boule touche la route
    if (this.hopBuffer > 0) {
      this.hopBuffer -= dt;
      if (this.onTrack) this.hop();
    }
    const k0 = Math.floor(px / SHEET), k1 = Math.floor(this.x / SHEET);
    if (k1 > k0 && k1 > 0 && this.x < WORLD.w) this.events.push({ type: 'level', n: k1 + 1 });
    if (this.y > WORLD.h + 400) this.events.push({ type: 'fell' });
  }

  stepTrack(dt, push) {
    const tr = this.tr, b = this.biome(), grav = this.fx.yellow > 0 ? 0.45 : 1;
    let p = this.frame();
    // Réaction de la route (par unité de masse).
    let N = this.v * this.v * p.k - G * grav * p.ny;
    const looping = SPEED.stickLoops && this.pc.inLoop[p.i] === 1;
    if (N < 0) {
      const glued = this.fx.blue > 0 || looping; // dans un looping : plaquée à la paroi
      if (p.ny > 0.15 && !glued) return this.takeOff(p);
      const z = this.pc.jump[p.i];
      if (z && this.v > 0 && !glued) {
        this.jumpZone = JUMPS[z - 1];
        return this.takeOff(p);
      }
      N = Math.max(0, N);
    }
    const pushT = push.x * p.tx + push.y * p.ty;
    let along = b.roll * G * grav * p.ty + b.roll * (pushT ? this.control(pushT) : 0);
    if (b.wind) along += b.roll * windAt(this.clock) * b.wind * this.skin.wind * windCalm(this.tr, this.x) * p.tx;
    let resist = b.roll * b.rollRes * this.skin.rollRes * N + AIR * this.v * this.v;
    resist += this.puddleDrag(p);
    if (Math.abs(this.v) < 6 && Math.abs(along) < STATIC + resist && !(looping && p.ny > 0)) {
      this.v = 0;
    } else if (looping && p.ny > 0 && Math.abs(this.v) < 6 && Math.abs(along) < STATIC) {
      // arrêtée à l'envers tout en haut (équilibre instable) : elle redescend par où elle est venue
      this.v = this.lastS > this.s ? 8 : -8;
    } else {
      const dir = this.v !== 0 ? Math.sign(this.v) : Math.sign(along);
      const nv = this.v + (along - dir * resist) * dt;
      this.v = this.v !== 0 && Math.sign(nv) !== Math.sign(this.v) && Math.abs(along) < resist ? 0 : nv;
    }
    // au-dessus du plafond : retour en douceur (plafond plus haut pendant l'effet de la boule rouge)
    const cap = this.fx.red > 0 ? SPEED.cap * SPEED.redCap : SPEED.cap;
    if (Math.abs(this.v) > cap) this.v = Math.sign(this.v) * Math.max(cap, Math.abs(this.v) - OVER * dt);
    this.v = clamp(this.v, -V_MAX, V_MAX);
    this.lastS = this.s;
    this.s += this.v * dt;
    if (this.pc === tr.byName.main && this.s < tr.sMin) {
      this.s = tr.sMin;
      if (this.v < -40) this.events.push({ type: 'clink', power: -this.v });
      this.v = -this.v * 0.35;
    }
    for (const top of this.pc.loopTops) if (this.lastS < top && this.s >= top) this.events.push({ type: 'loop', pc: this.pc.name, top });
    // passage d'un tronçon à l'autre
    if (this.s > this.pc.length) {
      if (this.pc.next) {
        this.s -= this.pc.length;
        this.pc = this.pc.next();
        if (this.pc.fork) this.pc.fork.last = this.pc;
        this.lastS = 0;
      } else if (this.pc.platform) {
        // bout d'une marche ou d'une plateforme : la boule part dans le vide
        this.s = this.pc.length;
        return this.takeOff(this.frame());
      } else {
        // butoir au bout de l'arrivée
        this.s = this.pc.length;
        if (this.v > 40) this.events.push({ type: 'clink', power: this.v });
        this.v = -this.v * 0.3;
      }
    } else if (this.s < 0 && this.pc.prev) {
      this.pc = this.pc.prev();
      this.s += this.pc.length;
      this.lastS = this.s;
    } else if (this.s < 0 && this.pc.platform) {
      this.s = 0;
      return this.takeOff(this.frame());
    }
    p = this.frame();
    this.x = p.x;
    this.y = p.y;
    // sur la glace, la boule glisse : elle tourne bien moins vite qu'elle n'avance
    const target = (this.v / BALL_R) * b.spin;
    this.omega += (target - this.omega) * Math.min(1, dt * (b.spin < 1 ? 3 : 60));
  }

  /** Flaques et eau : freinage (et petit événement d'éclaboussure en entrant). */
  puddleDrag(p) {
    let drag = 0, wet = false;
    for (const d of this.pc.puddles) {
      if (p.x < d.x0 || p.x > d.x1 || (d.yMin && p.y < d.yMin)) continue;
      wet = true;
      drag = (d.deep ? 1100 + 1.8 * Math.abs(this.v) : d.big ? 1700 + 2 * Math.abs(this.v) : 650 + 1.7 * Math.abs(this.v)) * this.skin.puddle;
    }
    if (wet && !this.inPuddle && Math.abs(this.v) > 120) this.events.push({ type: 'splash', power: Math.abs(this.v) });
    this.inPuddle = wet;
    return drag;
  }

  takeOff(p) {
    this.onTrack = false;
    this.leftTrack = this.clock;
    this.lastFrame = p;
    this.hopped = false;
    this.vx = this.v * p.tx;
    this.vy = this.v * p.ty;
    this.x = p.x + p.nx * 0.8;
    this.y = p.y + p.ny * 0.8;
  }

  stepAir(dt) {
    const b = this.biome(), grav = this.fx.yellow > 0 ? 0.45 : 1;
    const sp = Math.hypot(this.vx, this.vy);
    const drag = 1 - AIR * sp * dt;
    this.vx = this.vx * drag + (b.wind ? windAt(this.clock) * 0.6 * b.wind * this.skin.wind * windCalm(this.tr, this.x) * dt : 0);
    this.vy = this.vy * drag + G * grav * dt;
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
    let best = null;
    for (const [pc, i] of segmentsNear(this.tr, this.x, this.y)) {
      const ax = pc.x[i], ay = pc.y[i], bx = pc.x[i + 1], by = pc.y[i + 1];
      const hit = segHit(ox, oy, this.x, this.y, ax, ay, bx, by);
      if (!hit) continue;
      const nx = pc.ty[i], ny = -pc.tx[i];
      if ((ox - ax) * nx + (oy - ay) * ny < 0) continue; // venu de dessous : on ignore
      // près d'un embranchement, une boule qui retombe atterrit sur le chemin choisi
      if (pc.fork && pc.fork.route && pc !== (pc.fork.route === 'a' ? pc.fork.A : pc.fork.B) && ax < pc.fork.x + 350) continue;
      if (!best || hit.a < best.a) best = { ...hit, i, pc };
    }
    if (!best) return;
    const s = (best.i + best.b) * best.pc.step;
    const p = sample(best.pc, s);
    const vn = this.vx * p.nx + this.vy * p.ny, vt = this.vx * p.tx + this.vy * p.ty;
    if (-vn > this.skin.bounceMin) {
      this.vx = vt * p.tx * 0.92 - vn * this.skin.restitution * p.nx;
      this.vy = vt * p.ty * 0.92 - vn * this.skin.restitution * p.ny;
      this.x = p.x + p.nx;
      this.y = p.y + p.ny;
      this.omega = this.omega * 0.6 + (vt / BALL_R) * 0.4;
      this.events.push({ type: 'clink', power: -vn });
    } else {
      this.onTrack = true;
      if (this.jumpZone) this.events.push({ type: this.x > this.jumpZone.pitEnd ? 'jump' : 'pit' });
      this.jumpZone = null;
      this.pc = best.pc;
      if (this.pc.fork) this.pc.fork.last = this.pc;
      this.s = s;
      this.lastS = s;
      // le patinage au contact égalise rotation et vitesse : un peu d'énergie perdue
      this.v = (5 * vt + 2 * this.omega * BALL_R) / 7;
      this.x = p.x;
      this.y = p.y;
      if (-vn > 120) this.events.push({ type: 'clink', power: -vn });
      this.events.push({ type: 'land', vn: -vn, vt: Math.abs(vt) });
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

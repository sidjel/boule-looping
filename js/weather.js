/**
 * Météo des saisons, seulement autour de ce que voit la caméra (une centaine de particules) :
 * flocons (hiver), gouttes de pluie ; en automne, des feuilles mortes posées sur la route, qui
 * s'envolent quand la boule passe dessus (ground).
 */
import { biomeShare, rainAt, windAt } from './biomes.js';
import { makeAtlas, drawSprite } from './sprites.js';
import { groundY } from './track.js';

const MAX = { snow: 90, rain: 220 };
const LEAF = ['#c9772d', '#b5502a', '#d9a23a', '#8f5a2a'];

// feuilles (une par couleur) et flocon, dessinés une fois sur une planche
let atlas = null;
function sheet() {
  if (atlas) return atlas;
  const cells = LEAF.map((color) => ({ w: 28, h: 22, draw: (g) => {
    g.fillStyle = color;
    g.globalAlpha = 0.92;
    g.beginPath();
    g.moveTo(-12, 0);
    g.quadraticCurveTo(0, -9, 12, 0);
    g.quadraticCurveTo(0, 9, -12, 0);
    g.fill();
    g.globalAlpha = 1;
    // contour sombre : la feuille se détache de la terre brune
    g.strokeStyle = 'rgba(80,45,20,0.75)';
    g.lineWidth = 1.3;
    g.stroke();
    g.strokeStyle = 'rgba(90,60,30,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-12, 0);
    g.lineTo(12, 0);
    g.stroke();
  } }));
  // flocon : 1,5 fois plus grand qu'avant le 11 novembre, blanc à peine bleuté, bord gris-bleu plus
  // marqué (on le voit mieux sur le ciel pâle et sur la neige)
  cells.push({ w: 18, h: 18, draw: (g) => {
    g.fillStyle = 'rgba(238,244,252,0.97)';
    g.beginPath();
    g.arc(0, 0, 6.75, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(105,130,165,0.75)';
    g.lineWidth = 1.4;
    g.stroke();
  } });
  atlas = makeAtlas(cells, 3);
  return atlas;
}
const SNOW = LEAF.length;
const GAP = 48; // une place de feuille morte tous les 48 px de route
/** Hasard fixe pour une place (la même feuille à chaque passage). */
const hash = (n) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export class Weather {
  constructor() {
    this.parts = [];
    this.ground = new Map(); // feuilles mortes de la route : place n° k → feuille (ou null : pas de feuille)
    this.clock = 0;
  }

  /** Vent actuel (pour les feuilles et le son), en px/s². */
  wind() {
    return windAt(this.clock);
  }

  update(dt, cam) {
    this.clock += dt;
    const x0 = cam.x - 150, x1 = cam.x + cam.viewW + 150, y0 = cam.y - 100, y1 = cam.y + cam.viewH + 50;
    const w = this.wind();
    // nouvelles particules, selon la saison sous chaque point du ciel visible
    const want = { snow: 0, rain: 0 };
    for (let i = 0; i < 6; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / 6;
      want.snow += biomeShare(x, 'snow');
      want.rain += rainAt(x);
    }
    const count = { snow: 0, rain: 0 };
    for (const p of this.parts) count[p.kind]++;
    for (const kind of ['snow', 'rain']) {
      const target = (MAX[kind] * want[kind]) / 6;
      for (let n = 0; n < 4 && count[kind] < target; n++, count[kind]++) {
        const x = x0 + Math.random() * (x1 - x0);
        if (Math.random() > (kind === 'rain' ? rainAt(x) : biomeShare(x, kind))) continue; // moins de flocons au début de l'hiver
        this.parts.push({
          kind, x, y: y0 - Math.random() * 200,
          vx: 0, vy: kind === 'rain' ? 1500 + Math.random() * 400 : 90 + Math.random() * 105, // flocons : 1,5 fois plus vite
          a: Math.random() * 6.3, s: 0.6 + Math.random() * 0.8,
        });
      }
    }
    for (const p of this.parts) {
      if (p.kind === 'snow') {
        p.vx = Math.sin(this.clock * 0.9 + p.a) * 45 - 15; // 1,5 fois plus vite
      } else {
        p.vx = -260;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.y < y1 + 40 && p.x > x0 - 300 && p.x < x1 + 300);
  }

  /**
   * Automne : les feuilles mortes posées sur la route (une place tous les GAP px, la même à chaque
   * passage), seulement autour de ce que voit la caméra. Quand la boule roule dessus, elles s'envolent
   * dans son sens (plus haut et plus loin si elle va vite), tournoient, sont poussées par le vent,
   * puis retombent et se reposent sur la route.
   */
  updateGround(dt, cam, ball, track) {
    const x0 = cam.x - 200, x1 = cam.x + cam.viewW + 200, w = this.wind(), G = this.ground;
    for (let k = Math.floor(x0 / GAP); k <= Math.ceil(x1 / GAP); k++) {
      if (G.has(k)) continue;
      const x = (k + hash(k)) * GAP;
      // moins de feuilles aux passages de saison, aucune hors de l'automne
      if (x < 0 || hash(k * 7 + 3) > biomeShare(x, 'wind')) { G.set(k, null); continue; }
      const y = groundY(track, x), slope = Math.atan2(groundY(track, x + 8) - groundY(track, x - 8), 16);
      G.set(k, { x, y, a: slope + (hash(k * 13 + 1) - 0.5) * 0.5, slope, ci: Math.floor(hash(k * 5 + 2) * LEAF.length), s: 1.4 + hash(k * 11 + 4) * 0.6, rest: true, vx: 0, vy: 0, spin: 0 });
    }
    const v = ball.speed(), dir = (ball.onTrack ? ball.v : ball.vx) < 0 ? -1 : 1, by = ball.y + 30;
    for (const [k, p] of G) {
      if (!p) { if (k * GAP < x0 - 600 || k * GAP > x1 + 600) G.delete(k); continue; }
      if (p.rest) {
        if (p.x < x0 - 600 || p.x > x1 + 600) { G.delete(k); continue; }
        // la boule roule dessus : la feuille s'envole
        if (v > 60 && Math.abs(p.x - ball.x) < 38 && Math.abs(p.y - by) < 45) {
          const f = Math.min(v, 1500);
          p.rest = false;
          p.vx = dir * f * (0.18 + 0.3 * Math.random()) + (Math.random() - 0.5) * 80;
          p.vy = -(120 + f * (0.22 + 0.18 * Math.random()));
          p.spin = (Math.random() - 0.5) * 14;
        }
        continue;
      }
      // en l'air : pesanteur, freinage par l'air, vent ; elle retombe en voltigeant
      p.vx += (w * 0.55 - p.vx) * Math.min(1, dt * 1.2);
      p.vy = Math.min(p.vy + 700 * dt, 130 + Math.sin(this.clock * 5 + k) * 40);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.spin * dt;
      const gy = groundY(track, p.x);
      if (p.vy > 0 && p.y >= gy) {
        p.rest = true;
        p.y = gy;
        p.slope = Math.atan2(groundY(track, p.x + 8) - groundY(track, p.x - 8), 16);
        p.a = p.slope + (Math.random() - 0.5) * 0.5;
      }
    }
  }

  /** Les feuilles mortes de la route (repère du monde en place), devant la route, derrière la boule. */
  drawGround(ctx, x0, x1) {
    if (!this.ground.size) return;
    const A = sheet(), M = ctx.getTransform();
    ctx.save();
    for (const p of this.ground.values()) {
      if (!p || p.x < x0 - 30 || p.x > x1 + 30) continue;
      // posée : à plat sur la route (vue de profil, plus mince) ; en l'air : elle tourne sur elle-même
      if (p.rest) drawSprite(ctx, M, A, p.ci, p.x, p.y - 6, p.a, p.s, p.s * 0.7);
      else drawSprite(ctx, M, A, p.ci, p.x, p.y - 6, p.a, p.s, p.s * (0.3 + 0.7 * Math.abs(Math.sin(p.a * 1.3))));
    }
    ctx.restore();
  }

  draw(ctx) {
    if (!this.parts.length) return;
    const A = sheet(), M = ctx.getTransform();
    ctx.save();
    // la pluie : toutes les gouttes en un seul tracé (plus longues, plus épaisses et plus foncées
    // qu'avant le 11 novembre : on ne les voyait presque pas au téléphone)
    let rain = false;
    ctx.beginPath();
    for (const p of this.parts) {
      if (p.kind !== 'rain') continue;
      rain = true;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 12, p.y - 48);
    }
    if (rain) {
      ctx.strokeStyle = 'rgba(52,72,108,0.7)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    // flocons : de petites images posées (pas des tracés)
    for (const p of this.parts) {
      if (p.kind === 'snow') drawSprite(ctx, M, A, SNOW, p.x, p.y, 0, p.s, p.s);
    }
    ctx.restore();
  }
}

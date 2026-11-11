/**
 * Météo des saisons, seulement autour de ce que voit la caméra (une centaine de particules) :
 * feuilles mortes emportées par le vent (automne), flocons (hiver), gouttes de pluie.
 */
import { biomeShare, windAt } from './biomes.js';
import { makeAtlas, drawSprite } from './sprites.js';

const MAX = { leaf: 45, snow: 90, rain: 110 };
const LEAF = ['#c9772d', '#b5502a', '#d9a23a', '#8f5a2a'];

// feuilles (une par couleur) et flocon, dessinés une fois sur une planche
let atlas = null;
function sheet() {
  if (atlas) return atlas;
  const cells = LEAF.map((color) => ({ w: 28, h: 22, draw: (g) => {
    g.fillStyle = color;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.moveTo(-12, 0);
    g.quadraticCurveTo(0, -9, 12, 0);
    g.quadraticCurveTo(0, 9, -12, 0);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(90,60,30,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-12, 0);
    g.lineTo(12, 0);
    g.stroke();
  } }));
  cells.push({ w: 12, h: 12, draw: (g) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.arc(0, 0, 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(150,170,190,0.5)';
    g.lineWidth = 1;
    g.stroke();
  } });
  atlas = makeAtlas(cells, 3);
  return atlas;
}
const SNOW = LEAF.length;

export class Weather {
  constructor() {
    this.parts = [];
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
    const want = { leaf: 0, snow: 0, rain: 0 };
    for (let i = 0; i < 6; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / 6;
      want.leaf += biomeShare(x, 'wind');
      want.snow += biomeShare(x, 'snow');
      want.rain += biomeShare(x, 'rain');
    }
    const count = { leaf: 0, snow: 0, rain: 0 };
    for (const p of this.parts) count[p.kind]++;
    for (const kind of ['leaf', 'snow', 'rain']) {
      const target = (MAX[kind] * want[kind]) / 6;
      for (let n = 0; n < 4 && count[kind] < target; n++, count[kind]++) {
        const x = x0 + Math.random() * (x1 - x0);
        if (Math.random() > biomeShare(x, kind === 'leaf' ? 'wind' : kind)) continue; // moins de flocons au début de l'hiver
        this.parts.push({
          kind, x, y: kind === 'leaf' ? y0 + Math.random() * (y1 - y0) : y0 - Math.random() * 200,
          vx: 0, vy: kind === 'rain' ? 1500 + Math.random() * 400 : kind === 'snow' ? 60 + Math.random() * 70 : 40,
          a: Math.random() * 6.3, spin: (Math.random() - 0.5) * 6, s: 0.6 + Math.random() * 0.8,
          ci: Math.floor(Math.random() * LEAF.length),
        });
      }
    }
    for (const p of this.parts) {
      if (p.kind === 'leaf') {
        p.vx += (w * 0.55 - p.vx) * Math.min(1, dt * 1.5);
        p.vy = 35 + Math.sin(this.clock * 2 + p.a) * 45;
        p.a += p.spin * dt;
      } else if (p.kind === 'snow') {
        p.vx = Math.sin(this.clock * 0.9 + p.a) * 30 - 10;
      } else {
        p.vx = -260;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.y < y1 + 40 && p.x > x0 - 300 && p.x < x1 + 300);
  }

  draw(ctx) {
    if (!this.parts.length) return;
    const A = sheet(), M = ctx.getTransform();
    ctx.save();
    // la pluie : toutes les gouttes en un seul tracé
    let rain = false;
    ctx.beginPath();
    for (const p of this.parts) {
      if (p.kind !== 'rain') continue;
      rain = true;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 9, p.y - 36);
    }
    if (rain) {
      ctx.strokeStyle = 'rgba(95,120,150,0.45)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    // flocons et feuilles : de petites images posées (pas des tracés)
    for (const p of this.parts) {
      if (p.kind === 'snow') drawSprite(ctx, M, A, SNOW, p.x, p.y, 0, p.s, p.s);
      else if (p.kind === 'leaf') drawSprite(ctx, M, A, p.ci, p.x, p.y, p.a, p.s, p.s * (0.5 + 0.5 * Math.abs(Math.sin(p.a * 1.3))));
    }
    ctx.restore();
  }
}

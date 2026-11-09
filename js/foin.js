/**
 * Le foin qui s'envole au vent, dans les champs de foin de l'automne : beaucoup de poussière dorée
 * et de fins brins de paille, soulevés des champs et emportés par les rafales (le même vent que les
 * feuilles mortes). Deux couches :
 * - au loin, au-dessus des champs, derrière la route : petits brins et poussière, nombreux ;
 * - tout près, devant la route : quelques brins plus grands, qui passent plus vite.
 * Seulement autour de ce que voit la caméra, et seulement là où c'est l'automne (moins aux passages
 * de saison) ; rien ailleurs.
 */
import { biomeParams } from './biomes.js';

const FAR = 170, NEAR = 30; // particules au plus, pour tout l'écran en automne
// des pailles claires (presque crème) et quelques-unes plus foncées : elles se voient sur le jaune des champs
const STRAW = ['#fbefc0', '#f6e09a', '#f2d47a', '#e2b552', '#c7932f'];
const EDGE = 'rgba(105,72,28,0.55)'; // le trait de crayon autour
const rand = (a, b) => a + Math.random() * (b - a);

export class Hay {
  constructor() {
    this.far = [];
    this.near = [];
    this.t = 0;
  }

  /** wind : le vent du moment (weather.wind(), négatif = vers la gauche). */
  update(dt, cam, wind) {
    this.t += dt;
    const x0 = cam.x - 220, x1 = cam.x + cam.viewW + 220;
    // part d'automne sur ce que voit la caméra
    let want = 0;
    for (let i = 0; i < 5; i++) want += biomeParams(x0 + ((x1 - x0) * (i + 0.5)) / 5).wind;
    want /= 5;
    if (want <= 0 && !this.far.length && !this.near.length) return;
    this.spawn(this.far, FAR * want, cam, x0, x1, false);
    this.spawn(this.near, NEAR * want, cam, x0, x1, true);
    for (const list of [this.far, this.near]) {
      const near = list === this.near, k = near ? 1.05 : 0.6;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life += dt;
        if (p.life > p.max || p.x < x0 - 300 || p.x > x1 + 300) { list.splice(i, 1); continue; }
        // emporté par le vent, avec des tourbillons ; les brins montent un peu, la poussière flotte
        const swirl = Math.sin(this.t * 1.9 + p.ph) * 40 + Math.sin(this.t * 4.3 + p.ph * 2) * 18;
        p.vx += (wind * k + p.drift - p.vx) * Math.min(1, dt * 1.2);
        p.vy += ((p.lift + swirl) - p.vy) * Math.min(1, dt * 1.6);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a += p.va * dt * (0.4 + Math.abs(wind) / 300);
      }
    }
  }

  spawn(list, target, cam, x0, x1, near) {
    for (let n = 0; n < (near ? 2 : 6) && list.length < target; n++) {
      const x = rand(x0, x1);
      if (Math.random() > biomeParams(x).wind) continue;
      const dust = !near && Math.random() < 0.45;
      // au loin : au-dessus des champs (milieu de l'écran) ; tout près : n'importe où
      const y = near ? rand(cam.y + cam.viewH * 0.1, cam.y + cam.viewH * 0.95) : rand(cam.y + cam.viewH * 0.22, cam.y + cam.viewH * 0.72);
      list.push({
        x, y, vx: 0, vy: 0, dust,
        drift: rand(-40, 40), lift: near ? rand(-30, 10) : rand(-26, -4),
        a: rand(0, Math.PI), va: rand(-4, 4), ph: rand(0, 6.3),
        len: near ? rand(22, 40) : rand(9, 20), wid: near ? rand(2.4, 3.6) : rand(1.6, 2.6),
        r: rand(1.8, 3.6), col: STRAW[Math.floor(Math.random() * STRAW.length)],
        life: 0, max: near ? rand(2.5, 5) : rand(4, 8), alpha: near ? rand(0.65, 0.9) : rand(0.4, 0.8),
      });
    }
  }

  drawLayer(ctx, list) {
    if (!list.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of list) {
      const a = p.alpha * Math.min(1, p.life / 0.6, (p.max - p.life) / 1.2);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      if (p.dust) {
        // un flocon de poussière de foin : un petit point clair cerné
        ctx.fillStyle = EDGE;
        ctx.fillRect(p.x - p.r / 2 - 0.6, p.y - p.r / 2 - 0.6, p.r + 1.2, p.r + 1.2);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
        continue;
      }
      // un brin de paille : un trait courbé qui tourne sur lui-même (vu de biais, il raccourcit)
      const c = Math.cos(p.a), s = Math.sin(p.a), l = (p.len / 2) * (0.35 + 0.65 * Math.abs(Math.cos(p.a * 0.7 + p.ph)));
      ctx.beginPath();
      ctx.moveTo(p.x - c * l, p.y - s * l);
      ctx.quadraticCurveTo(p.x - s * l * 0.25, p.y + c * l * 0.25, p.x + c * l, p.y + s * l);
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = p.wid + 1.6;
      ctx.stroke();
      ctx.strokeStyle = p.col;
      ctx.lineWidth = p.wid;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Au loin, au-dessus des champs (derrière la route). */
  drawFar(ctx) { this.drawLayer(ctx, this.far); }

  /** Tout près, devant la route (derrière l'herbe du premier plan). */
  drawNear(ctx) { this.drawLayer(ctx, this.near); }
}

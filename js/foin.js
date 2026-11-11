/**
 * Le foin qui s'envole au vent, dans les champs de foin de l'automne : beaucoup de poussière dorée
 * et de fins brins de paille, soulevés des champs et emportés par les rafales (le même vent que les
 * feuilles mortes). Deux couches :
 * - au loin, au-dessus des champs, derrière la route : petits brins et poussière, nombreux ;
 * - tout près, devant la route : quelques brins plus grands, qui passent plus vite.
 * Seulement autour de ce que voit la caméra, et seulement là où c'est l'automne (moins aux passages
 * de saison) ; rien ailleurs.
 */
import { biomeShare } from './biomes.js';
import { makeAtlas } from './sprites.js';

const FAR = 360, NEAR = 64; // particules au plus, pour tout l'écran en automne
// des pailles claires (presque crème) et quelques-unes plus foncées : elles se voient sur le jaune des champs
const STRAW = ['#fbefc0', '#f6e09a', '#f2d47a', '#e2b552', '#c7932f'];
const EDGE = 'rgba(105,72,28,0.55)'; // le trait de crayon autour

// les brins et la poussière, dessinés une fois : brin de 32 px (fin ou normal) et grain de 3 px, par couleur
const LEN = 32, WID = { fine: 1.2, normal: 2.4 }, DUST = 3;
let atlas = null;
const cell = { straw: {}, dust: {} };
function sheet() {
  if (atlas) return atlas;
  const cells = [];
  STRAW.forEach((col, ci) => {
    for (const kind of ['fine', 'normal']) {
      cell.straw[`${kind}${ci}`] = cells.length;
      const wd = WID[kind], edge = kind === 'fine' ? 1 : 1.6;
      cells.push({ w: LEN + 6, h: 12 + wd, draw: (g) => {
        g.lineCap = 'round';
        const l = LEN / 2;
        g.beginPath();
        g.moveTo(-l, 0);
        g.quadraticCurveTo(0, l * 0.25, l, 0); // un brin légèrement courbé
        g.strokeStyle = EDGE; g.lineWidth = wd + edge; g.stroke();
        g.strokeStyle = col; g.lineWidth = wd; g.stroke();
      } });
    }
    cell.dust[ci] = cells.length;
    cells.push({ w: DUST + 3, h: DUST + 3, draw: (g) => {
      g.fillStyle = EDGE; g.fillRect(-DUST / 2 - 0.6, -DUST / 2 - 0.6, DUST + 1.2, DUST + 1.2);
      g.fillStyle = col; g.fillRect(-DUST / 2, -DUST / 2, DUST, DUST);
    } });
  });
  atlas = makeAtlas(cells, 3);
  return atlas;
}
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
    for (let i = 0; i < 5; i++) want += biomeShare(x0 + ((x1 - x0) * (i + 0.5)) / 5, 'wind');
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
    for (let n = 0; n < (near ? 4 : 14) && list.length < target; n++) {
      const x = rand(x0, x1);
      if (Math.random() > biomeShare(x, 'wind')) continue;
      const dust = !near && Math.random() < 0.38;
      const fine = Math.random() < 0.55; // fine paille : longue et très mince
      // au loin : au-dessus des champs (milieu de l'écran) ; tout près : n'importe où
      const y = near ? rand(cam.y + cam.viewH * 0.1, cam.y + cam.viewH * 0.95) : rand(cam.y + cam.viewH * 0.22, cam.y + cam.viewH * 0.72);
      list.push({
        x, y, vx: 0, vy: 0, dust,
        drift: rand(-40, 40), lift: near ? rand(-30, 10) : rand(-26, -4),
        a: rand(0, Math.PI), va: rand(-4, 4), ph: rand(0, 6.3),
        len: (near ? rand(22, 40) : rand(9, 20)) * (fine ? 1.3 : 1), wid: fine ? (near ? rand(1.3, 1.9) : rand(0.8, 1.2)) : near ? rand(2.4, 3.6) : rand(1.6, 2.6), fine,
        r: rand(2.2, 4.2), ci: Math.floor(Math.random() * STRAW.length),
        life: 0, max: near ? rand(2.5, 5) : rand(4, 8), alpha: near ? rand(0.7, 0.95) : rand(0.55, 0.9),
      });
    }
  }

  /**
   * Même nombre de brins et de grains, moins d'appels au canevas : les brins d'abord (une
   * transformation et une image chacun), puis les grains, qui ne tournent pas, sous la transformation
   * du monde posée une seule fois (une image chacun). La case de chaque particule est cherchée une
   * fois (p.cell), et non recomposée à chaque image (4,6 ms par image en automne, rapport du 10 novembre).
   */
  drawLayer(ctx, list) {
    if (!list.length) return;
    const A = sheet(), M = ctx.getTransform(), rects = A.rects, img = A.canvas, k = 1 / A.res;
    const ma = M.a, mb = M.b, mc = M.c, md = M.d, me = M.e, mf = M.f;
    let dust = 0;
    ctx.save();
    for (const p of list) {
      if (p.dust) { dust++; continue; }
      const a = p.alpha * Math.min(1, p.life / 0.6, (p.max - p.life) / 1.2);
      if (a <= 0.01) continue;
      // un brin de paille courbé qui tourne sur lui-même (vu de biais, il raccourcit)
      const fore = 0.35 + 0.65 * Math.abs(Math.cos(p.a * 0.7 + p.ph));
      if (p.cell === undefined) p.cell = cell.straw[(p.fine ? 'fine' : 'normal') + p.ci];
      const r = rects[p.cell], sx = (p.len / LEN) * fore * k, sy = (p.wid / WID[p.fine ? 'fine' : 'normal']) * k;
      const c = Math.cos(p.a), sn = Math.sin(p.a);
      const ta = c * sx, tb = sn * sx, tc = -sn * sy, td = c * sy;
      ctx.globalAlpha = a;
      ctx.setTransform(ma * ta + mc * tb, mb * ta + md * tb, ma * tc + mc * td, mb * tc + md * td, ma * p.x + mc * p.y + me, mb * p.x + md * p.y + mf);
      ctx.drawImage(img, r[0], r[1], r[2], r[3], -r[2] / 2, -r[3] / 2, r[2], r[3]);
    }
    if (dust) {
      ctx.setTransform(M);
      for (const p of list) {
        if (!p.dust) continue;
        const a = p.alpha * Math.min(1, p.life / 0.6, (p.max - p.life) / 1.2);
        if (a <= 0.01) continue;
        // un grain de poussière de foin : un petit point clair cerné
        if (p.cell === undefined) p.cell = cell.dust[p.ci];
        const r = rects[p.cell], s = (p.r / DUST) * k, w = r[2] * s, h = r[3] * s;
        ctx.globalAlpha = a;
        ctx.drawImage(img, r[0], r[1], r[2], r[3], p.x - w / 2, p.y - h / 2, w, h);
      }
    }
    ctx.restore();
  }

  /** Au loin, au-dessus des champs (derrière la route). */
  drawFar(ctx) { this.drawLayer(ctx, this.far); }

  /** Tout près, devant la route (derrière l'herbe du premier plan). */
  drawNear(ctx) { this.drawLayer(ctx, this.near); }
}

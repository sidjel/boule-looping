#!/usr/bin/env node
/**
 * Vérifie les niveaux sans navigateur : géométrie (place dans la feuille, hauteur, courbures)
 * et jouabilité. Un petit robot joue chaque niveau depuis son point de reprise : il relance
 * la boule (élan moyen de 1300 px/s) quand elle n'avance plus. Chaque chemin de chaque
 * aiguillage est essayé. Sortie : temps, lancers, loopings, sauts, flaques, bonus.
 *   node tools/verifier-niveaux.mjs
 */
import { buildTrack, SHEET, SHEETS, FINISH, STARS, sample } from '../js/track.js';
import { obstaclesOf } from '../js/obstacles.js';
import { LEVEL_ROOM, JUMPS } from '../js/levels.js';
import { Ball } from '../js/physics.js';
import { Bonuses } from '../js/bonus.js';
import { biomeOfSheet } from '../js/biomes.js';

const track = buildTrack();
let problems = 0;
const warn = (msg) => { problems++; console.log('  ✗ ' + msg); };

console.log('Géométrie');
LEVEL_ROOM.forEach((r, k) => { if (r !== undefined && r < 0) warn(`niveau ${k + 1} déborde de ${Math.round(-r)} px sur la feuille suivante`); });
for (const pc of track.pieces) {
  for (let i = 0; i < pc.n; i++) {
    if (pc.y[i] > 1400 || pc.y[i] < 250) { warn(`${pc.name} : hauteur ${Math.round(pc.y[i])} à x=${Math.round(pc.x[i])}`); break; }
  }
  // côté boule d'une courbe concave : rayon du chemin du centre trop petit = la route se replie
  let worst = 0, at = 0;
  for (let i = 0; i < pc.n; i++) if (Math.abs(pc.k[i]) > worst) { worst = Math.abs(pc.k[i]); at = i; }
  if (worst > 1 / 18) warn(`${pc.name} : virage trop serré (rayon ${Math.round(1 / worst)} px) à x=${Math.round(pc.x[at])}`);
}
if (!problems) console.log('  ✓ rien à signaler');

function play(k, routes) {
  for (const f of track.forks) f.route = routes[f.idx] || 'a';
  const ball = new Ball(track), bonuses = new Bonuses(track);
  ball.respawn(k);
  const goal = k === SHEETS - 2 ? FINISH.x : (k + 1) * SHEET + 40;
  const stats = { flicks: 0, loops: 0, jumps: 0, pits: 0, splash: 0, bonus: [], time: 0, hops: 0, stars: 0 };
  const stars = STARS.filter((st) => Math.floor(st.x / SHEET) === k).map((st) => ({ ...st, got: false }));
  const obstacles = obstaclesOf(track);
  const bigs = track.pieces.flatMap((pc) => pc.puddles.filter((d) => d.big));
  let lastHop = 0;
  let t = 0, lastCheck = 0, lastX = ball.x;
  const trail = [];
  while (t < 180) {
    for (let i = 0; i < 10; i++) ball.step(1 / 600, { x: 0, y: 0 });
    t += 1 / 60;
    for (const e of ball.events.splice(0)) {
      if (e.type === 'loop') stats.loops++;
      if (e.type === 'jump') stats.jumps++;
      if (e.type === 'pit') stats.pits++;
      if (e.type === 'splash') stats.splash++;
    }
    for (const st of stars) if (!st.got && Math.hypot(ball.x - st.x, ball.y - st.y) < 30 + 34) { st.got = true; stats.stars++; }
    // comme un joueur : saut devant un obstacle, une marche, une grande flaque, ou au bout d'une plateforme
    if (ball.onTrack && ball.v > 120 && t - lastHop > 0.4) {
      const lead = 50 + ball.v * 0.12;
      const ahead = (x) => x - ball.x > 0 && x - ball.x < lead;
      const need = obstacles.some((o) => ahead(o.x - o.w / 2 - 30) && (o.kind !== 'step' || ball.y > o.top))
        || bigs.some((d) => ahead(d.x0 - 20))
        || (ball.pc.platform && ball.pc.length - ball.s < 40 + ball.v * 0.05);
      if (need) { ball.hop(); stats.hops++; lastHop = t; }
    }
    const hit = bonuses.update(1 / 60, ball);
    if (hit) { ball.bonus(hit.color); stats.bonus.push(hit.color); }
    if (ball.x > goal) { stats.time = t; return stats; }
    if (t - lastCheck > 0.35) {
      trail.push(ball.x);
      if (trail.length > 6) trail.shift();
      const slowProgress = trail.length === 6 && Math.max(...trail) - trail[0] < 150;
      const stuck = ball.x - lastX < 70 || (ball.onTrack && Math.abs(ball.v) < 200) || slowProgress;
      // comme un joueur : on relance quand la boule repart vers l'avant ou s'arrête, pas pendant qu'elle recule
      if (stuck && ball.onTrack && ball.v > -60) {
        const p = sample(ball.pc, ball.s);
        ball.impulse(p.tx * 1300, p.ty * 1300);
        stats.flicks++;
      }
      lastCheck = t;
      lastX = ball.x;
    }
  }
  stats.time = Infinity;
  stats.where = Math.round(ball.x);
  return stats;
}

// étoiles : sur le passage de la boule (loopings) ou à portée d'un saut (170 px au-dessus du centre)
for (const st of STARS) {
  if (JUMPS.some((J) => st.x > J.pit[0] - 60 && st.x < J.pit[1] + 60)) continue; // étoile sur la trajectoire d'un tremplin
  let best = Infinity;
  for (const pc of track.pieces) for (let i = 0; i < pc.n; i += 2) {
    if (Math.abs(pc.x[i] - st.x) > 6) continue;
    const dy = pc.y[i] - st.y;
    if (dy > -40 && dy < best) best = dy;
  }
  if (best > 165) warn(`étoile en (${Math.round(st.x)}, ${Math.round(st.y)}) : ${Math.round(best)} px au-dessus de la route, trop haut pour un saut`);
}

console.log('\nJouabilité (robot : relance de 1300 px/s quand la boule n’avance plus)');
let total = 0;
for (let k = 0; k < SHEETS - 1; k++) {
  const forks = track.forks.filter((f) => Math.floor(f.x / SHEET) === k);
  const tries = forks.length ? [{ [forks[0].idx]: 'a' }, { [forks[0].idx]: 'b' }] : [{}];
  const times = [];
  for (const routes of tries) {
    const s = play(k, routes);
    const way = forks.length ? (Object.values(routes)[0] === 'a' ? ' (bas)' : ' (haut)') : '';
    const name = `niveau ${String(k + 1).padStart(2)} ${biomeOfSheet(k).name.padEnd(8)}${way}`.padEnd(32);
    if (s.time === Infinity) { warn(`${name} pas terminé en 3 min (boule bloquée vers x=${s.where})`); continue; }
    times.push(s.time);
    console.log(`  ✓ ${name} ${s.time.toFixed(1).padStart(5)} s · ${String(s.flicks).padStart(2)} lancers · ${s.hops} sauts · ${s.stars}★ · ${s.loops} looping · ${s.jumps} saut, ${s.pits} chute · ${s.splash} flaque · bonus ${s.bonus.join(', ') || '—'}`);
  }
  if (times.length) total += times.reduce((a, b) => a + b) / times.length;
}
console.log(`\nDurée pour le robot (lancers parfaits, aucun raté) : ${(total / 60).toFixed(1)} min. Un joueur met bien plus longtemps ; le vrai temps s'affiche en haut à gauche du jeu.`);
console.log(problems ? `\n${problems} problème(s).` : '\nTout est jouable.');
process.exitCode = problems ? 1 : 0;

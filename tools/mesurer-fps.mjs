/**
 * Mesure des images par seconde et des saccades sur tout le parcours (Playwright + Chromium).
 *   node tools/mesurer-fps.mjs            téléphone à l'horizontale (Pixel 7), vue qui suit la boule
 *   node tools/mesurer-fps.mjs --pc       écran de PC (1280 × 720)
 *   node tools/mesurer-fps.mjs --pas 500  un point tous les 500 px (250 par défaut)
 *   node tools/mesurer-fps.mjs --de 24000 --a 30000   seulement une partie du parcours
 *   node tools/mesurer-fps.mjs --json mesures.json    écrit aussi toutes les mesures
 *   node tools/mesurer-fps.mjs --rapide  temps réels sans forcer le dessin de chaque étape (les étapes
 *                                        sont alors mal attribuées : le navigateur dessine d'un coup)
 * La boule est posée sur la route tous les « pas » px et laisse rouler ; à chaque point, 40 images
 * sont mesurées avec js/profil.js : temps de calcul moyen et pire image, et les étapes les plus
 * coûteuses (ciel, montagnes, feuilles…). Le navigateur de test dessine sans carte graphique : les
 * temps sont plus longs que sur un téléphone, mais les endroits lents et leurs causes sont les mêmes.
 * À la fin : les points les plus lents, et un résumé par niveau.
 *
 *   node tools/mesurer-fps.mjs --partie  une vraie partie, du niveau 1 à l'arrivée : la boule est
 *        relancée quand elle ralentit, les aiguillages et les bonus sont choisis tout seuls. Chaque
 *        image trop longue (saccade) est notée avec l'endroit et l'étape fautive. Sans dessin forcé :
 *        on voit les à-coups du calcul (feuilles préparées, images décodées, mélanges de saisons…).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PC = process.argv.includes('--pc');
const STEP = +arg('--pas', 250), FROM = +arg('--de', 0), TO = +arg('--a', 32000), OUT = arg('--json', null);

let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const { chromium, devices } = pw;

// petit serveur de fichiers
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));

// rendu par la « carte graphique » (logicielle ici, SwiftShader), comme sur un vrai téléphone ;
// --sans-gpu : tout en logiciel (les dessins sont alors faits pendant le calcul, mal répartis)
const GPU = !process.argv.includes('--sans-gpu');
const browser = await chromium.launch(GPU ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-accelerated-2d-canvas'] } : {});
const DPR = arg('--dpr', null);   // --dpr 1 : moins de pixels (le rendu logiciel de la carte graphique est lent)
const ctx = await browser.newContext({ ...(PC ? { viewport: { width: 1280, height: 720 } } : devices['Pixel 7 landscape']), ...(DPR ? { deviceScaleFactor: +DPR } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
await page.waitForTimeout(1000);
if (await page.isVisible('#demande-plein')) await page.click('[data-plein=non]');
await page.click('#menu [data-do=new]');
await page.waitForTimeout(1500);
const PARTIE = process.argv.includes('--partie');
const SYNC = !PARTIE && !process.argv.includes('--rapide');   // --rapide : sans attribution exacte des étapes
await page.evaluate((s) => { window.__profil.sync = s; }, SYNC);

if (PARTIE) {
  const res = await page.evaluate(() => new Promise((done) => {
    const { ball, pick } = window.__boule, P = window.__profil, $ = (id) => document.getElementById(id);
    const spikes = [], hist = [];
    let prev = performance.now(), lastX = ball.x, stuck = 0, frames = 0, sumMs = 0;
    P.onFrame = (ms, fr) => {
      const t = performance.now(), wall = t - prev;
      prev = t;
      frames++;
      sumMs += ms;
      hist.push(wall);
      if (ms > 8 || wall > 45) {
        const top = Object.entries(fr).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v.toFixed(1)}`);
        spikes.push({ x: Math.round(ball.x), ms: +ms.toFixed(1), wall: +wall.toFixed(0), top });
      }
    };
    const t0 = performance.now();
    const drive = setInterval(() => {
      if (!$('chemin-bas').hidden && !$('chemin-bas').classList.contains('choisi')) pick('a');
      if ($('info').classList.contains('visible')) $('compris')?.click();
      if (ball.onTrack && Math.abs(ball.v) < 900) ball.v = 1100;
      if (ball.x - lastX < 5) stuck++; else stuck = 0;
      lastX = ball.x;
      if (stuck > 60) { ball.respawn(Math.min(15, Math.floor(ball.x / 2000) + 1)); stuck = 0; }   // coincée : niveau suivant
      if (ball.x > 31900 || performance.now() - t0 > 170000) {
        clearInterval(drive);
        P.onFrame = null;
        hist.sort((a, b) => a - b);
        done({ frames, avgMs: sumMs / frames, p50: hist[hist.length >> 1], p95: hist[Math.floor(hist.length * 0.95)], spikes, end: Math.round(ball.x), secs: (performance.now() - t0) / 1000 });
      }
    }, 50);
  }));
  console.log(`\nPartie complète (${PC ? 'PC' : 'téléphone'}) : ${res.frames} images en ${res.secs.toFixed(0)} s, jusqu'à x=${res.end}`);
  console.log(`  calcul moyen ${res.avgMs.toFixed(2)} ms par image ; intervalle entre images : médiane ${res.p50.toFixed(0)} ms, 95 % sous ${res.p95.toFixed(0)} ms`);
  console.log(`  ${res.spikes.length} images longues (calcul > 8 ms ou intervalle > 45 ms) :`);
  for (const sp of res.spikes.slice(0, 60)) console.log(`    x=${String(sp.x).padStart(5)}  calcul ${String(sp.ms).padStart(5)} ms  intervalle ${String(sp.wall).padStart(4)} ms   ${sp.top.join(' · ')}`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  if (errors.length) console.log('\nErreurs dans la page :', errors);
  await browser.close();
  srv.close();
  process.exit(0);
}

const rows = [];
for (let x = FROM; x <= TO; x += STEP) {
  const r = await page.evaluate(async (x) => {
    const { ball, cam, track } = window.__boule, P = window.__profil;
    // la boule sur la route, au point le plus proche de x
    let best = null;
    for (const pc of track.pieces) {
      if (pc.platform) continue;
      pc.line.forEach(([px], i) => { const d = Math.abs(px - x); if (!best || d < best.d) best = { d, pc, i }; });
    }
    ball.respawn(Math.max(0, Math.min(15, Math.floor(x / 2000))), { pc: best.pc, s: best.i * 3 });
    ball.v = 400;
    cam.update(0, ball, true);
    const raf = () => new Promise((res) => requestAnimationFrame(res));
    for (let i = 0; i < 12; i++) await raf();   // le temps que les feuilles se préparent
    P.reset();
    const t0 = performance.now();
    let worstWall = 0, prev = t0;
    for (let i = 0; i < 40; i++) { await raf(); const t = performance.now(); worstWall = Math.max(worstWall, t - prev); prev = t; }
    const wall = (performance.now() - t0) / 40;
    return { x, ball: Math.round(ball.x), calc: P.total / P.frames, worst: P.worst, wall, worstWall, top: P.top(4), max: P.max };
  }, x);
  rows.push(r);
  process.stdout.write(`\r${x} / ${TO}   `);
}
process.stdout.write('\n');

const f1 = (v) => v.toFixed(1).padStart(5);
console.log(`\n${PC ? 'PC 1280×720' : 'Téléphone (Pixel 7, paysage)'} — temps de calcul d'une image (ms) : moyen, pire, et étapes les plus coûteuses\n`);
console.log('Les 12 points les plus lents :');
for (const r of [...rows].sort((a, b) => b.calc - a.calc).slice(0, 12)) {
  console.log(`  x=${String(r.x).padStart(5)} (niv. ${Math.min(16, Math.floor(r.x / 2000) + 1)})  moyen ${f1(r.calc)}  pire ${f1(r.worst)}  (entre images ${f1(r.wall)})   ${r.top.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}`);
}
console.log('\nLes 8 pires images (saccades) :');
for (const r of [...rows].sort((a, b) => b.worst - a.worst).slice(0, 8)) {
  const [k, v] = Object.entries(r.max).sort((a, b) => b[1] - a[1])[0];
  console.log(`  x=${String(r.x).padStart(5)}  pire ${f1(r.worst)} ms  (dont ${k} ${v.toFixed(1)})`);
}
console.log('\nPar niveau : moyen / pire');
for (let lv = 0; lv < 16; lv++) {
  const rs = rows.filter((r) => Math.floor(r.x / 2000) === lv);
  if (!rs.length) continue;
  const avg = rs.reduce((s, r) => s + r.calc, 0) / rs.length, worst = Math.max(...rs.map((r) => r.worst));
  console.log(`  niveau ${String(lv + 1).padStart(2)} : ${f1(avg)} / ${f1(worst)}`);
}
if (errors.length) console.log('\nErreurs dans la page :', errors);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
await browser.close();
srv.close();

/**
 * Diagnostic automatique des ralentissements, pendant toute la partie, sans rien demander au joueur.
 *
 * - À chaque image : l'intervalle réel entre deux appels de requestAnimationFrame (ce que voit le
 *   joueur) et, à part, le temps de calcul JavaScript de l'image et de chacune de ses étapes
 *   (js/profil.js). Le temps passé dans un appel drawImage() n'est PAS le temps de la carte
 *   graphique : celle-ci travaille ensuite, à part ; un intervalle long avec un calcul court veut
 *   dire que l'attente est ailleurs (carte graphique, navigateur, système).
 * - Historique circulaire des 10 dernières secondes (tableaux de taille fixe : mémoire bornée).
 * - Image longue : > 20 ms (modéré), > 25 ms (important), > 33 ms (sévère), > 50 ms (critique).
 *   Les images longues à moins de 400 ms d'écart forment un même événement ; on garde les 5 plus
 *   importants (somme des millisecondes de retard), avec 1 s d'historique avant et 0,5 s après.
 * - Statistiques globales : intervalles (histogramme), secondes à moins de 57 / 50 images par
 *   seconde, et par contexte (looping, passage de saison, passage de niveau, ailleurs) et par niveau.
 * - Journal : chargements et décodages d'images, créations et changements de taille de canevas,
 *   préparations à l'avance, préparation des feuilles, changements de résolution.
 * Rien n'est écrit dans le stockage permanent pendant le jeu ; seul un résumé (les 5 événements)
 * est gardé en quittant la page, pour pouvoir l'exporter à la visite suivante.
 */
import { profil, countDraws } from './profil.js';

const HIST = 1200;               // 10 s à 120 images par seconde au plus
const STEPS_MAX = 40;            // étapes de profil.js (environ 25)
const LEVELS = ['modéré', 'important', 'sévère', 'critique'];
const LIMITS = [20, 25, 33, 50];
const GAP = 400;                 // ms : deux images longues plus proches = même événement
const BEFORE = 1000, AFTER = 500, EVENT_FRAMES_MAX = 480;
const KEEP = 5;
const SAVE_KEY = 'boule-looping-diagnostic';

// ---------- historique circulaire ----------
const stepNames = [];
const stepIndex = new Map();
const idx = (name) => {
  let i = stepIndex.get(name);
  if (i === undefined) { i = stepNames.length; if (i >= STEPS_MAX) return -1; stepNames.push(name); stepIndex.set(name, i); }
  return i;
};
const H = {
  t: new Float64Array(HIST),      // instant (ms depuis le début de la session)
  dt: new Float32Array(HIST),     // intervalle réel depuis l'image précédente (ms)
  js: new Float32Array(HIST),     // calcul JavaScript de l'image (ms)
  steps: new Float32Array(HIST * STEPS_MAX),
  images: new Uint16Array(HIST * STEPS_MAX), // appels drawImage par étape
  draws: new Uint16Array(HIST),   // tous les dessins (traits, remplissages, images)
  bx: new Float32Array(HIST), by: new Float32Array(HIST), bv: new Float32Array(HIST),
  cx: new Float32Array(HIST), cy: new Float32Array(HIST), cs: new Float32Array(HIST),
  parts: new Uint16Array(HIST),
  ctx: new Uint8Array(HIST),      // contexte (bits) : 1 looping, 2 saison, 4 niveau, 8 vue d'ensemble
  level: new Uint8Array(HIST),
  notes: new Array(HIST).fill(null),
};
let head = 0, count = 0;

// ---------- journal (notes de l'image en cours) ----------
let pending = [];
/** Une note pour l'image en cours (chargement, canevas, résolution…). */
export function note(text) {
  if (pending.length < 30) pending.push(text);
  session.log.push([Math.round(now()), text]);
  if (session.log.length > 800) session.log.splice(100, 200); // garde le début (chargements) et la fin
}

// ---------- session ----------
const t0 = performance.now();
const now = () => performance.now() - t0;
let session = fresh();
function fresh() {
  return {
    start: new Date().toISOString(), startT: now(),
    frames: 0, playFrames: 0, playMs: 0, jsMs: 0,
    hist: new Uint32Array(101),       // intervalles en ms (0 à 100, le dernier = 100 et plus)
    byLevel: LEVELS.map(() => 0),
    ctx: { looping: [0, 0, 0], saison: [0, 0, 0], niveau: [0, 0, 0], ailleurs: [0, 0, 0] }, // images, longues, ms de retard
    perLevel: Array.from({ length: 17 }, () => [0, 0, 0]),
    seconds: { total: 0, under57: 0, under50: 0, under40: 0 }, sec: { t: 0, n: 0 },
    events: [], open: null, log: [],
  };
}

/** Remet les statistiques à zéro (avant une nouvelle partie). */
export function resetDiagnostic() {
  session = fresh();
  head = count = 0;
  pending = [];
  note('remise à zéro');
}

// ---------- surveillance des canevas (créations, changements de taille) ----------
let canvasCreated = 0;
const resized = new Set();
(function watchCanvases() {
  if (typeof document === 'undefined') return;
  const create = document.createElement.bind(document);
  document.createElement = function (tag, ...a) {
    const e = create(tag, ...a);
    if (String(tag).toLowerCase() === 'canvas') canvasCreated++;
    return e;
  };
  for (const side of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, side);
    if (!d || !d.set) continue;
    Object.defineProperty(HTMLCanvasElement.prototype, side, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) {
        const before = d.get.call(this);
        d.set.call(this, v);
        if (v !== before) resized.add(this); // noté à la fin de l'image, à sa taille finale
      },
    });
  }
})();

// ---------- une image ----------
/**
 * À la fin de chaque image (main.js). dt : intervalle réel (ms) ; js : calcul (ms) ; playing : partie
 * en cours (pas de menu, pas de pause) ; info : { level, bx, by, bv, cx, cy, cs, parts, loop, season, sheet, wide }.
 */
export function frame(dt, js, playing, info) {
  const i = head;
  head = (head + 1) % HIST;
  count = Math.min(HIST, count + 1);
  const t = now();
  H.t[i] = t; H.dt[i] = dt; H.js[i] = js;
  const base = i * STEPS_MAX;
  H.steps.fill(0, base, base + STEPS_MAX);
  H.images.fill(0, base, base + STEPS_MAX);
  for (const k in profil.frame) { const j = idx(k); if (j >= 0) H.steps[base + j] = profil.frame[k]; }
  let draws = 0;
  for (const k in profil.frameDraws) draws += profil.frameDraws[k];
  for (const k in profil.frameImages) { const j = idx(k); if (j >= 0) H.images[base + j] = profil.frameImages[k]; }
  H.draws[i] = Math.min(65535, draws);
  H.bx[i] = info.bx; H.by[i] = info.by; H.bv[i] = info.bv;
  H.cx[i] = info.cx; H.cy[i] = info.cy; H.cs[i] = info.cs;
  H.parts[i] = Math.min(65535, info.parts);
  H.ctx[i] = (info.loop ? 1 : 0) | (info.season ? 2 : 0) | (info.sheet ? 4 : 0) | (info.wide ? 8 : 0);
  H.level[i] = info.level;
  if (canvasCreated) { pending.push(`${canvasCreated} canevas créé${canvasCreated > 1 ? 's' : ''}`); canvasCreated = 0; }
  if (resized.size) {
    // seulement les grands canevas (plus de 256 px de côté) : les petits ne comptent pas
    for (const c of resized) if (c.width > 256 || c.height > 256) note(`canevas ${c.width}×${c.height}${c.id ? ` (${c.id})` : ''}`);
    resized.clear();
  }
  if (pending.length) { H.notes[i] = pending; pending = []; } else H.notes[i] = null;

  const S = session;
  S.frames++;
  if (!playing) { closeEvent(t, true); return; }
  // statistiques globales
  S.playFrames++; S.playMs += dt; S.jsMs += js;
  S.hist[Math.min(100, Math.round(dt))]++;
  let lvl = -1;
  for (let k = LIMITS.length - 1; k >= 0; k--) if (dt > LIMITS[k]) { lvl = k; break; }
  const late = Math.max(0, dt - 1000 / 60);
  const key = info.loop ? 'looping' : info.season ? 'saison' : info.sheet ? 'niveau' : 'ailleurs';
  const C = S.ctx[key];
  C[0]++; if (lvl >= 0) { C[1]++; C[2] += late; }
  const L = S.perLevel[Math.min(16, info.level)];
  L[0]++; if (lvl >= 0) { L[1]++; L[2] += late; }
  if (lvl >= 0) S.byLevel[lvl]++;
  // images par seconde, seconde par seconde
  S.sec.t += dt; S.sec.n++;
  if (S.sec.t >= 1000) {
    const fps = (S.sec.n * 1000) / S.sec.t;
    S.seconds.total++;
    if (fps < 57) S.seconds.under57++;
    if (fps < 50) S.seconds.under50++;
    if (fps < 40) S.seconds.under40++;
    S.sec.t = 0; S.sec.n = 0;
  }
  // événements
  if (lvl >= 0) {
    if (!S.open) S.open = { startT: t - dt, startI: i, lastT: t, frames: 0, slow: 0, worst: 0, late: 0, levels: [0, 0, 0, 0], info: { ...info } };
    const E = S.open;
    E.lastT = t; E.frames++; E.slow++; E.late += late; E.levels[lvl]++;
    if (dt > E.worst) { E.worst = dt; E.worstI = i; E.worstInfo = { ...info }; }
  } else if (S.open) {
    S.open.frames++;
    closeEvent(t, false);
  }
}

function closeEvent(t, force) {
  const E = session.open;
  if (!E || (!force && t - E.lastT < Math.max(GAP, AFTER))) return;
  session.open = null;
  // l'événement compte-t-il parmi les 5 plus importants ?
  const ev = session.events;
  if (ev.length >= KEEP && E.late <= ev[ev.length - 1].late) return;
  const rec = {
    rang: 0, gravite: LEVELS[E.levels.findLastIndex((n) => n > 0)],
    debut_ms: Math.round(E.startT - session.startT), duree_ms: Math.round(E.lastT - E.startT),
    date: new Date(Date.now() - (now() - E.startT)).toISOString(),
    images_longues: E.slow, par_gravite: Object.fromEntries(LEVELS.map((n, k) => [n, E.levels[k]])),
    pire_intervalle_ms: +E.worst.toFixed(1), retard_total_ms: Math.round(E.late),
    au_debut: describe(E.info), au_pire: describe(E.worstInfo || E.info),
    historique: window_(E.startT - BEFORE, E.lastT + AFTER),
  };
  ev.push(rec);
  ev.sort((a, b) => b.retard_total_ms - a.retard_total_ms);
  if (ev.length > KEEP) ev.length = KEEP;
  ev.forEach((e, k) => (e.rang = k + 1));
}

function describe(info) {
  if (!info) return null;
  return {
    niveau: info.level >= 16 ? 'arrivée' : info.level + 1, saison: info.biome,
    boule: { x: Math.round(info.bx), y: Math.round(info.by), vitesse: Math.round(info.bv) },
    camera: { x: Math.round(info.cx), y: Math.round(info.cy), echelle: +info.cs.toFixed(3) },
    looping: !!info.loop, passage_de_saison: !!info.season, passage_de_niveau: !!info.sheet, vue_ensemble: !!info.wide,
    particules: info.parts,
  };
}

/** Les images de l'historique entre a et b (ms), au plus EVENT_FRAMES_MAX. */
function window_(a, b) {
  const out = [];
  for (let k = count - 1; k >= 0; k--) {
    const i = (head - 1 - k + HIST * 2) % HIST;
    const t = H.t[i];
    if (t < a || t > b) continue;
    if (out.length >= EVENT_FRAMES_MAX) break;
    const base = i * STEPS_MAX, steps = {}, images = {};
    for (let j = 0; j < stepNames.length; j++) {
      const v = H.steps[base + j];
      if (v >= 0.05) steps[stepNames[j]] = +v.toFixed(2);
      if (H.images[base + j]) images[stepNames[j]] = H.images[base + j];
    }
    const prev = (i - 1 + HIST) % HIST;
    out.push({
      t_ms: Math.round(t - session.startT), intervalle_ms: +H.dt[i].toFixed(1), calcul_js_ms: +H.js[i].toFixed(2),
      etapes_js_ms: steps, drawImage_par_etape: images, dessins: H.draws[i],
      niveau: H.level[i] >= 16 ? 'arrivée' : H.level[i] + 1,
      boule: [Math.round(H.bx[i]), Math.round(H.by[i]), Math.round(H.bv[i])],
      camera: [Math.round(H.cx[i]), Math.round(H.cy[i]), +H.cs[i].toFixed(3)], camera_dx: Math.round(H.cx[i] - H.cx[prev]),
      particules: H.parts[i],
      contexte: [H.ctx[i] & 1 ? 'looping' : '', H.ctx[i] & 2 ? 'saison' : '', H.ctx[i] & 4 ? 'niveau' : '', H.ctx[i] & 8 ? 'vue' : ''].filter(Boolean),
      ...(H.notes[i] ? { journal: H.notes[i] } : {}),
    });
  }
  return out;
}

// ---------- rapport ----------
function pct(hist, total, p) {
  let n = 0;
  for (let ms = 0; ms <= 100; ms++) { n += hist[ms]; if (n >= total * p) return ms; }
  return 100;
}

/** Le rapport complet (objet), pour l'export. env : informations sur l'appareil et le jeu. */
export function report(env = {}) {
  closeEvent(now(), true);
  const S = session, n = Math.max(1, S.playFrames), ctx = {};
  for (const [k, [f, slow, late]] of Object.entries(S.ctx)) {
    ctx[k] = { images: f, images_longues: slow, part_longues: f ? +((100 * slow) / f).toFixed(1) : 0, retard_ms: Math.round(late) };
  }
  const intervals = {};
  for (let ms = 0; ms <= 100; ms++) if (S.hist[ms]) intervals[ms === 100 ? '100+' : ms] = S.hist[ms];
  return {
    jeu: 'La boule et le looping', format: 1,
    session: {
      debut: S.start, duree_s: Math.round((now() - S.startT) / 1000), export: new Date().toISOString(),
      ...env,
    },
    a_lire: [
      'intervalle_ms : temps réel entre deux images (ce que voit le joueur). 16,7 ms = 60 images par seconde.',
      'calcul_js_ms : temps de calcul JavaScript de l’image ; etapes_js_ms : ce temps, étape par étape.',
      'Le temps passé dans drawImage n’est pas le temps de la carte graphique : elle travaille ensuite, à part.',
      'Un intervalle long avec un calcul court : l’attente vient de la carte graphique, du navigateur ou du système.',
    ],
    statistiques: {
      images_en_jeu: S.playFrames, images_par_seconde_moyennes: +((S.playFrames * 1000) / Math.max(1, S.playMs)).toFixed(1),
      calcul_js_moyen_ms: +(S.jsMs / n).toFixed(2),
      intervalle_median_ms: pct(S.hist, n, 0.5), intervalle_95_pourcent_ms: pct(S.hist, n, 0.95), intervalle_99_pourcent_ms: pct(S.hist, n, 0.99),
      images_longues: Object.fromEntries(LEVELS.map((nm, k) => [`${nm} (> ${LIMITS[k]} ms)`, S.byLevel[k]])),
      secondes: { en_jeu: S.seconds.total, sous_57_ips: S.seconds.under57, sous_50_ips: S.seconds.under50, sous_40_ips: S.seconds.under40 },
      par_contexte: ctx,
      par_niveau: S.perLevel.map(([f, slow, late], k) => ({ niveau: k === 16 ? 'arrivée' : k + 1, images: f, images_longues: slow, retard_ms: Math.round(late) })).filter((r) => r.images),
      histogramme_intervalles_ms: intervals,
    },
    evenements: S.events,
    journal: S.log.map(([t, s]) => ({ t_ms: t - Math.round(S.startT), quoi: s })),
  };
}

/**
 * Le résumé court d'un rapport (texte, environ 2 000 caractères) : ce qu'il faut pour comprendre une
 * partie, facile à copier dans un message. Le rapport complet (plus de 100 000 caractères avec ses
 * historiques image par image) se copiait mal et arrivait tronqué.
 * Pour chaque événement : les pires images (intervalle, calcul, étapes les plus longues), les calculs
 * les plus longs, la moyenne des étapes les plus coûteuses, et le journal regroupé.
 */
export function summaryText(r) {
  if (!r || !r.statistiques) return '';
  const S = r.statistiques, e = r.session || {}, L = [];
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const top = (steps, n) => Object.entries(steps || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${f1(v)}`).join(', ');
  const ua = /Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_.]+/.exec(e.appareil || '') || [''];
  const br = /(Chrome|Firefox|Version)\/(\d+)/.exec(e.appareil || '') || ['', '', ''];
  const lg = Object.values(S.images_longues || {});
  L.push(`BOULE résumé v1 · ${(e.debut || '').slice(0, 16)} · ${e.duree_s} s · ${S.images_en_jeu} images · ${S.images_par_seconde_moyennes} ips · calcul ${S.calcul_js_moyen_ms} ms · p50 ${S.intervalle_median_ms} p95 ${S.intervalle_95_pourcent_ms} p99 ${S.intervalle_99_pourcent_ms}`);
  L.push(`Appareil : ${ua[0]} ${br[1]} ${br[2]} · canevas ${e.canevas} rés. ${e.resolution_du_jeu} (${e.qualite}) · plein écran ${e.plein_ecran ? 'oui' : 'non'} · vue d'ensemble ${e.vue_ensemble ? 'oui' : 'non'} · décor ${e.images_decor_mo} Mo`);
  L.push(`Longues : >20 ${lg[0]} · >25 ${lg[1]} · >33 ${lg[2]} · >50 ${lg[3]} | secondes ${S.secondes.en_jeu} : <57 ${S.secondes.sous_57_ips} · <50 ${S.secondes.sous_50_ips} · <40 ${S.secondes.sous_40_ips}`);
  L.push('Contexte (longues/images) : ' + Object.entries(S.par_contexte || {}).map(([k, v]) => `${k} ${v.images_longues}/${v.images}`).join(' · '));
  L.push('Niveaux (longues/retard ms) : ' + (S.par_niveau || []).map((n) => `${n.niveau === 'arrivée' ? 'A' : n.niveau}:${n.images_longues}/${n.retard_ms}`).join(' '));
  L.push('Intervalles ms (nombre) : ' + Object.entries(S.histogramme_intervalles_ms || {}).map(([k, v]) => `${k}:${v}`).join(' '));
  for (const ev of r.evenements || []) {
    const h = ev.historique || [], g = ev.par_gravite || {};
    L.push(`#${ev.rang} niv ${ev.au_debut?.niveau}→${ev.au_pire?.niveau} ${ev.au_pire?.saison} · t ${ev.debut_ms} +${ev.duree_ms} ms · ${ev.images_longues} longues (${g['sévère'] || 0} sév., ${g.critique || 0} crit.) · pire ${ev.pire_intervalle_ms} · retard ${ev.retard_total_ms}${ev.au_pire?.looping ? ' · looping' : ''}`);
    if (!h.length) continue;
    const one = (x) => `t${x.t_ms} ${Math.round(x.intervalle_ms)}/${f1(x.calcul_js_ms)} [${top(x.etapes_js_ms, 2)}]`;
    L.push('  pires (intervalle/calcul) : ' + [...h].sort((a, b) => b.intervalle_ms - a.intervalle_ms).slice(0, 4).sort((a, b) => a.t_ms - b.t_ms).map(one).join(' | '));
    const heavy = [...h].filter((x) => x.calcul_js_ms > 14).sort((a, b) => b.calcul_js_ms - a.calcul_js_ms).slice(0, 4).sort((a, b) => a.t_ms - b.t_ms);
    if (heavy.length) L.push('  calculs longs : ' + heavy.map(one).join(' | '));
    const mean = {};
    for (const x of h) for (const [k, v] of Object.entries(x.etapes_js_ms || {})) mean[k] = (mean[k] || 0) + v / h.length;
    L.push(`  moyennes sur ${h.length} images : calcul ${f1(h.reduce((s, x) => s + x.calcul_js_ms, 0) / h.length)} [${top(mean, 5)}] · dessins ${Math.round(h.reduce((s, x) => s + (x.dessins || 0), 0) / h.length)} · particules ${Math.round(h.reduce((s, x) => s + (x.particules || 0), 0) / h.length)}`);
    // journal regroupé : chargements et images prêtes comptés, le reste tel quel
    let loads = 0, readyN = 0, dec = 0, freed = 0;
    const other = [];
    for (const x of h) for (const n of x.journal || []) {
      if (n.startsWith('chargement ')) loads++;
      else if (n.startsWith('libérée ')) freed++;
      else if (n.startsWith('image prête ')) { readyN++; dec = Math.max(dec, +(/décodée (\d+) ms/.exec(n) || [0, 0])[1]); }
      else if (other.length < 8) other.push(`t${x.t_ms} ${n}`);
    }
    const j = [loads ? `${loads} chargements` : '', readyN ? `${readyN} images prêtes (décodage ≤ ${dec} ms)` : '', freed ? `${freed} libérées` : '', ...other].filter(Boolean);
    if (j.length) L.push('  journal : ' + j.join(' ; '));
  }
  // (seulement pendant la partie : après la première feuille montrée)
  const jr = r.journal || [], from = jr.findIndex((n) => / à l'écran$/.test(n.quoi));
  const made = jr.slice(Math.max(0, from)).filter((n) => /^canevas \d|préparation,|d'un coup|préparation à l'avance/.test(n.quoi) && !/réutilisé/.test(n.quoi));
  if (made.length) L.push('À noter : ' + made.slice(0, 14).map((n) => `t${n.t_ms} ${n.quoi}`).join(' ; ') + (made.length > 14 ? ` ; … (${made.length})` : ''));
  return L.join('\n');
}

/** Garde un résumé (sans les historiques des 10 s) en quittant la page. */
export function keepSummary(env) {
  try {
    const r = report(env);
    if (!r.statistiques.images_en_jeu) return;
    const s = JSON.stringify(r);
    if (s.length < 1_500_000) localStorage.setItem(SAVE_KEY, s);
  } catch { /* pas de place */ }
}
export function previousReport() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

/** Les dessins sont comptés en permanence (coût négligeable) pour le diagnostic. */
countDraws(true);

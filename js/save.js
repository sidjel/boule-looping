/**
 * Sauvegarde dans le navigateur (localStorage) : réglages, partie en cours, tableau des scores.
 * Si le stockage est refusé (navigation privée, page intégrée), le jeu marche quand même,
 * simplement sans mémoire d'une visite à l'autre.
 */
const KEY = 'boule-looping';

const DEFAULTS = {
  options: { music: 0.8, sfx: 1, vibrate: true, autoFullscreen: true, wideLandscape: true, labels: true, fps: false, flushEnd: false, quality: 0, autoDpr: 2 },
  progress: null,          // { level, time, loops, bonuses, jumps }
  scores: [],              // [{ name, time, score, stars, loops, bonuses, date }]
  lastName: '',
  levels: {},              // records par niveau : { stars, time, medal }
  skin: 'acier',           // boule choisie
  seen: [],                // bonus déjà expliqués (l'explication ne s'affiche qu'une fois)
};

let data = structuredClone(DEFAULTS);
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    data = { ...data, ...saved, options: { ...DEFAULTS.options, ...(saved.options || {}) } };
  }
} catch { /* pas de stockage */ }

/**
 * Les écritures (et le fantôme d'un niveau) sont faites à un moment calme du navigateur, groupées,
 * pas pendant l'image où la boule passe d'un niveau à l'autre ; en quittant la page, tout est écrit
 * tout de suite (save.flush).
 */
let dirty = false;
const pendingGhosts = new Map();
const idle = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  idle(flush);
}
function flush() {
  scheduled = false;
  if (dirty) {
    dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* pas de stockage */ }
  }
  for (const [k, ghost] of pendingGhosts) {
    try { localStorage.setItem(`${KEY}-fantome-${k}`, JSON.stringify(ghost)); } catch { /* plein */ }
  }
  pendingGhosts.clear();
}
function write() {
  dirty = true;
  schedule();
}
const ghostCache = new Map(); // fantômes déjà lus (et décodés)

export const save = {
  get options() { return data.options; },
  setOption(name, value) {
    data.options[name] = value;
    write();
  },
  get progress() { return data.progress; },
  setProgress(p) {
    data.progress = p;
    write();
  },
  get scores() { return data.scores; },
  get levels() { return data.levels; },
  /** Record d'un niveau, et fantôme du meilleur passage (positions toutes les 1/20 s). */
  setLevel(k, best, ghost) {
    data.levels[k] = best;
    write();
    if (ghost) { pendingGhosts.set(k, ghost); ghostCache.set(k, ghost); schedule(); }
  },
  ghost(k) {
    if (ghostCache.has(k)) return ghostCache.get(k);
    let g = null;
    try { g = JSON.parse(localStorage.getItem(`${KEY}-fantome-${k}`) || 'null'); } catch { /* rien */ }
    ghostCache.set(k, g);
    return g;
  },
  /** Lit à l'avance (moment calme) le fantôme d'un niveau. */
  prefetchGhost(k) {
    if (!ghostCache.has(k)) idle(() => this.ghost(k));
  },
  /** Écrit tout de suite ce qui attend (en quittant la page). */
  flush,
  get skin() { return data.skin; },
  setSkin(id) {
    data.skin = id;
    write();
  },
  hasSeen(kind) { return data.seen.includes(kind); },
  markSeen(kind) {
    if (!data.seen.includes(kind)) data.seen.push(kind);
    write();
  },
  get lastName() { return data.lastName; },
  /** Ajoute un score ; renvoie son rang (0 = meilleur) dans les 10 premiers, ou -1. */
  addScore(entry) {
    data.lastName = entry.name;
    data.scores.push(entry);
    data.scores.sort((a, b) => (b.score || 0) - (a.score || 0) || a.time - b.time);
    const rank = data.scores.indexOf(entry);
    data.scores = data.scores.slice(0, 10);
    write();
    return rank < 10 ? rank : -1;
  },
  clearScores() {
    data.scores = [];
    write();
  },
};

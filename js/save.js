/**
 * Sauvegarde dans le navigateur (localStorage) : réglages, partie en cours, tableau des scores.
 * Si le stockage est refusé (navigation privée, page intégrée), le jeu marche quand même,
 * simplement sans mémoire d'une visite à l'autre.
 */
const KEY = 'boule-looping';

const DEFAULTS = {
  options: { music: 0.8, sfx: 1, vibrate: true, autoFullscreen: true, wideLandscape: true, labels: true },
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

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* pas de stockage */ }
}

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
    if (ghost) try { localStorage.setItem(`${KEY}-fantome-${k}`, JSON.stringify(ghost)); } catch { /* plein */ }
  },
  ghost(k) {
    try { return JSON.parse(localStorage.getItem(`${KEY}-fantome-${k}`) || 'null'); } catch { return null; }
  },
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

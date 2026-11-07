/**
 * Sauvegarde dans le navigateur (localStorage) : réglages, partie en cours, tableau des scores.
 * Si le stockage est refusé (navigation privée, page intégrée), le jeu marche quand même,
 * simplement sans mémoire d'une visite à l'autre.
 */
const KEY = 'boule-looping';

const DEFAULTS = {
  options: { music: 0.8, sfx: 1, vibrate: true, autoFullscreen: true, wideLandscape: true, labels: true },
  progress: null,          // { level, time, loops, bonuses, jumps }
  scores: [],              // [{ name, time, loops, bonuses, date }]
  lastName: '',
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
  get lastName() { return data.lastName; },
  /** Ajoute un score ; renvoie son rang (0 = meilleur) dans les 10 premiers, ou -1. */
  addScore(entry) {
    data.lastName = entry.name;
    data.scores.push(entry);
    data.scores.sort((a, b) => a.time - b.time);
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

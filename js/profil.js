/**
 * Mesure du temps de calcul de chaque image, étape par étape (ciel, montagnes, feuilles, boule…).
 * Toujours en marche (quelques dizaines d'appels à performance.now() par image : négligeable).
 * - mark('nom') : l'étape « nom » commence (la précédente s'arrête) ; mark(null) : fin de l'image.
 * - le compteur caché (#fps ou touche F) affiche les étapes les plus lentes ;
 * - tools/mesurer-fps.mjs parcourt tous les niveaux et lit window.__profil.
 */
const now = () => performance.now();

export const profil = {
  cur: null, t: 0, start: 0,
  sum: {},          // ms cumulées par étape depuis reset()
  max: {},          // pire image par étape
  frames: 0,        // images depuis reset()
  total: 0,         // ms cumulées (calcul de l'image entière)
  worst: 0,         // pire image (ms de calcul)
  frame: {},        // étapes de l'image en cours
  // mesure exacte (outil seulement) : le navigateur garde les dessins en attente et les fait d'un coup
  // plus tard ; avec sync, chaque étape est dessinée tout de suite (lecture d'un pixel) et comptée à part
  sync: false, ctx: null,
  onFrame: null,    // appelé à la fin de chaque image : onFrame(ms, étapes) (outil)
  reset() {
    this.sum = {}; this.max = {}; this.frames = 0; this.total = 0; this.worst = 0;
  },
  /** Les n étapes les plus coûteuses en moyenne : [[nom, ms par image], …]. */
  top(n = 3) {
    const f = Math.max(1, this.frames);
    return Object.entries(this.sum).map(([k, v]) => [k, v / f]).sort((a, b) => b[1] - a[1]).slice(0, n);
  },
};

export function mark(name) {
  if (profil.sync && profil.ctx) profil.ctx.getImageData(0, 0, 1, 1);
  const t = now();
  if (profil.cur) profil.frame[profil.cur] = (profil.frame[profil.cur] || 0) + t - profil.t;
  else if (name) { profil.start = t; profil.frame = {}; }
  profil.cur = name;
  profil.t = t;
  if (name) return;
  // fin de l'image
  const ms = t - profil.start;
  profil.frames++;
  profil.total += ms;
  profil.worst = Math.max(profil.worst, ms);
  for (const [k, v] of Object.entries(profil.frame)) {
    profil.sum[k] = (profil.sum[k] || 0) + v;
    profil.max[k] = Math.max(profil.max[k] || 0, v);
  }
  if (profil.onFrame) profil.onFrame(ms, profil.frame);
}

if (typeof window !== 'undefined') window.__profil = profil;

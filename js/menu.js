/**
 * Menu du jeu, sur une feuille de papier : Continuer / Reprendre, Nouvelle partie, Comment jouer,
 * Scores, Options, Crédits. Le jeu est en pause tant que le menu est ouvert.
 */
import { save } from './save.js';
import { BONUS_INFO } from './bonus.js';

const clock = (t) => `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function scoreTable(highlight = -1) {
  const rows = save.scores;
  if (!rows.length) return '<p class="vide">Pas encore de score : termine le parcours pour inscrire ton temps.</p>';
  return `<table class="scores"><thead><tr><th>#</th><th>Nom</th><th>Temps</th><th>Loopings</th><th>Bonus</th><th>Date</th></tr></thead><tbody>${
    rows.map((r, i) => `<tr${i === highlight ? ' class="moi"' : ''}><td>${i + 1}</td><td>${esc(r.name)}</td><td>${clock(r.time)}</td><td>${r.loops}</td><td>${r.bonuses}</td><td>${new Date(r.date).toLocaleDateString('fr-FR')}</td></tr>`).join('')
  }</tbody></table>`;
}

export class Menu {
  /**
   * @param {HTMLElement} root
   * @param {{ newGame: Function, resume: Function, continueSaved: Function, options: Function }} actions
   */
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.paused = false;
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('input', (e) => this.onInput(e));
  }

  get isOpen() { return !this.root.hidden; }

  /** @param {boolean} paused ouvert pendant une partie (Reprendre) ou à l'accueil (Continuer) */
  open(paused) {
    this.paused = paused;
    this.root.hidden = false;
    this.show('accueil');
  }

  close() { this.root.hidden = true; }

  show(screen) {
    const p = save.progress;
    const card = (title, body, back = true) => `<div class="carte"><h2>${title}</h2>${body}${back ? '<button data-go="accueil" class="retour">← Retour</button>' : ''}</div>`;
    let html;
    if (screen === 'accueil') {
      const cont = this.paused
        ? '<button data-do="resume" class="grand">Reprendre</button>'
        : p ? `<button data-do="continue" class="grand">Continuer <small>niveau ${p.level + 1} · ${clock(p.time)}</small></button>` : '';
      html = `<div class="carte accueil"><h1>La boule <br><span>et le looping</span></h1>${cont}
        <button data-do="new" class="${cont ? '' : 'grand'}">Nouvelle partie</button>
        <button data-go="aide">Comment jouer</button>
        <button data-go="scores">Scores</button>
        <button data-go="options">Options</button>
        <button data-go="credits">Crédits</button></div>`;
    } else if (screen === 'aide') {
      html = card('Comment jouer', `<ul class="aide">
        <li><b>Glisser puis lâcher</b> : lance la boule. Plus le doigt va vite, plus elle part vite.</li>
        <li><b>Toucher brièvement l'écran</b> : la boule saute (si elle touche la route).</li>
        <li><b>Doigt posé sans bouger</b> : la boule roule doucement vers le doigt.</li>
        <li><b>Aiguillage</b> : à l'approche, le temps ralentit fortement ; touche le bouton posé au début du chemin que tu veux (en haut ou en bas).</li>
        <li><b>↺</b> : recommencer le niveau ; appui long : niveau 1. <b>Loupe</b> : vue d'ensemble ou zoom.</li>
        <li><b>Au clavier</b> : ← → pousser, Espace lancer, ↑ sauter, R recommencer, Z zoom, M musique, Échap menu.</li></ul>
        <h3>Les bonus</h3><ul class="bonus">${Object.entries(BONUS_INFO).map(([c, b]) => `<li><img src="images/boule-${c}.png" alt=""><span><b>${b.title}</b><br>${b.text}</span></li>`).join('')}</ul>
        <h3>Les saisons</h3><ul class="aide"><li><b>Automne</b> : le vent souffle en rafales, surtout de face.</li>
        <li><b>Hiver</b> : route glacée, la boule glisse, va plus vite et se contrôle moins bien.</li>
        <li><b>Pluie</b> : les flaques et l'eau freinent la boule.</li></ul>`);
    } else if (screen === 'scores') {
      html = card('Meilleurs temps', `${scoreTable()}${save.scores.length ? '<button data-do="clear" class="petit">Effacer les scores</button>' : ''}`);
    } else if (screen === 'options') {
      const o = save.options;
      const check = (k, label) => `<label class="ligne"><input type="checkbox" data-opt="${k}"${o[k] ? ' checked' : ''}> ${label}</label>`;
      html = card('Options', `
        <label class="ligne">Musique <input type="range" min="0" max="1" step="0.05" value="${o.music}" data-opt="music"></label>
        <label class="ligne">Bruitages <input type="range" min="0" max="1" step="0.05" value="${o.sfx}" data-opt="sfx"></label>
        ${check('vibrate', 'Vibrations (téléphone)')}
        ${check('autoFullscreen', 'Plein écran automatique au premier toucher')}
        ${check('wideLandscape', 'En paysage, commencer en vue d’ensemble')}
        ${check('labels', 'Écrire le nom des bonus au-dessus des boules')}`);
    } else if (screen === 'credits') {
      html = card('Crédits', `<p><b>Idée, dessins et décors d'origine</b><br>sidjel — la route au crayon, le looping, le soleil, les nuages et la boule rouge viennent de ses dessins.</p>
        <p><b>Programmation, niveaux 2 à 16, saisons</b><br>écrits avec Claude (Anthropic), d'après les demandes de l'auteur.</p>
        <p><b>Musique et sons</b><br>composés et fabriqués directement dans le navigateur (Web Audio) : aucun fichier, aucun droit d'auteur tiers.</p>
        <p><b>Technique</b><br>HTML, Canvas 2D et JavaScript, sans bibliothèque.</p>`);
    }
    this.root.innerHTML = html;
  }

  onClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.go) return this.show(t.dataset.go);
    const what = t.dataset.do;
    if (what === 'resume') { this.close(); this.actions.resume(); }
    if (what === 'continue') { this.close(); this.actions.continueSaved(); }
    if (what === 'new') { this.close(); this.actions.newGame(); }
    if (what === 'clear') { save.clearScores(); this.show('scores'); }
  }

  onInput(e) {
    const k = e.target.dataset.opt;
    if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
    save.setOption(k, v);
    this.actions.options(k, v);
  }
}

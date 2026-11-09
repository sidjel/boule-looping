/**
 * Plein écran.
 * - Le bouton (en haut à droite) est visible tout le temps, même sur le menu d'accueil.
 * - Au lancement, une petite fenêtre demande si l'on veut jouer en plein écran (si l'option
 *   « Proposer le plein écran au lancement » est cochée). « Oui » passe en plein écran tout de suite
 *   (le clic est un vrai geste du joueur, le navigateur l'accepte) et bloque l'écran à l'horizontale.
 * - iPhone : Safari n'a pas de plein écran pour les pages. « Oui » explique comment ajouter le jeu
 *   à l'écran d'accueil : il s'ouvre alors en plein écran (manifest + balises Apple).
 * - Déjà lancé depuis l'écran d'accueil, ou plein écran impossible ici : ni bouton ni question.
 */
export function setupFullscreen(btn, tip, ask, askAllowed = () => true) {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
  const enabled = !!request && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const iosTip = !enabled && ios && touch;

  if (installed) {
    btn.hidden = true;
    return { start() {} };
  }

  let wanted = false; // le joueur a répondu « Oui » : on y revient à chaque nouvelle partie
  const enter = () => {
    try {
      const p = request.call(root, { navigationUI: 'hide' });
      // en plein écran, Android accepte de bloquer l'écran à l'horizontale
      const lock = () => screen.orientation?.lock?.('landscape')?.catch?.(() => {});
      if (p && p.then) p.then(lock, () => {}); else lock();
    } catch { /* refusé par le navigateur */ }
  };
  const refresh = () => btn.classList.toggle('actif', active());
  document.addEventListener('fullscreenchange', refresh);
  document.addEventListener('webkitfullscreenchange', refresh);

  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', () => {
    closeAsk();
    if (!enabled) return showTip(tip, ios);
    if (active()) { wanted = false; exitFs?.call(document); } else { wanted = true; enter(); }
  });

  // la question, au lancement
  function closeAsk() { ask.hidden = true; }
  ask.addEventListener('pointerdown', (e) => e.stopPropagation());
  ask.addEventListener('click', (e) => {
    const r = e.target.closest?.('[data-plein]')?.dataset.plein;
    if (!r) return;
    closeAsk();
    if (r !== 'oui') return;
    wanted = true;
    if (enabled) enter(); else showTip(tip, true);
  });
  if ((enabled || iosTip) && askAllowed() && !active()) ask.hidden = false;

  // appelé par les boutons « Nouvelle partie » et « Continuer » (un vrai geste du joueur)
  return {
    start() {
      closeAsk();
      if (enabled && wanted && !active()) enter();
    },
  };
}

function showTip(tip, ios, autoHide = 0) {
  tip.innerHTML = ios
    ? '<b>Plein écran sur iPhone</b>Touche <span class="partage">Partager</span> en bas de Safari, puis « Sur l\'écran d\'accueil ». Lance ensuite le jeu depuis son icône : il s\'ouvre en plein écran.'
    : '<b>Plein écran indisponible ici</b>Ouvre le jeu directement dans ton navigateur (Chrome, Firefox…) pour jouer en plein écran.';
  tip.hidden = false;
  const hide = () => { tip.hidden = true; };
  tip.onclick = hide;
  if (autoHide) setTimeout(hide, autoHide);
}

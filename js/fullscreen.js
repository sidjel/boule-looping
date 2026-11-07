/**
 * Plein écran.
 * - Android et navigateurs qui le permettent : plein écran au premier geste sur le jeu
 *   (fin du premier toucher), puis bouton pour sortir ou revenir.
 * - iPhone : Safari n'a pas de plein écran pour les pages. On explique comment ajouter le jeu
 *   à l'écran d'accueil : il s'ouvre alors en plein écran (manifest + balises Apple).
 * - Déjà lancé depuis l'écran d'accueil : bouton caché.
 */
export function setupFullscreen(btn, tip, autoAllowed = () => true) {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
  const enabled = !!request && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

  if (installed) {
    btn.hidden = true;
    return { start() {} };
  }

  const enter = () => {
    try {
      request.call(root, { navigationUI: 'hide' })?.catch?.(() => {});
    } catch { /* refusé par le navigateur */ }
  };
  const refresh = () => btn.classList.toggle('actif', active());
  document.addEventListener('fullscreenchange', refresh);
  document.addEventListener('webkitfullscreenchange', refresh);

  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', () => {
    if (!enabled) return showTip(tip, ios);
    if (active()) exitFs?.call(document);
    else enter();
  });

  if (enabled && touch) {
    // Le navigateur n'accepte le plein écran qu'à la fin d'un toucher (pointerup).
    const auto = (e) => {
      if (btn.contains(e.target) || e.target.closest?.('button, #menu')) return;
      removeEventListener('pointerup', auto, true);
      if (!active() && autoAllowed()) enter();
    };
    addEventListener('pointerup', auto, true);
  } else if (ios && touch) {
    setTimeout(() => showTip(tip, true, 7000), 1800);
  }
  // appelé par les boutons « Nouvelle partie » et « Continuer » (un vrai geste du joueur)
  return { start() { if (enabled && touch && autoAllowed() && !active()) enter(); } };
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

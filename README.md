# La boule et le looping

Mini-jeu pour navigateur (téléphone et PC), dessiné au crayon d'après un dessin à la main :
une boule en métal roule sur une route avec un looping. Pas de but : on lance la boule,
on tente le looping, et quand elle sort à droite elle revient en haut de la butte.

## Jouer
- **Glisser puis lâcher** : lance la boule. Plus le doigt va vite, plus elle part vite.
- **Doigt posé** : la boule roule doucement vers le doigt.
- **Loupe** (en bas à droite) : passe de la vue d'ensemble (tout le parcours) au zoom sur la boule.
  En paysage, la vue d'ensemble est le réglage de départ ; en portrait, c'est le zoom.
- **↺** : retour au départ.
- **Plein écran** (en haut à droite) : automatique au premier toucher sur Android ; sur iPhone,
  ajouter le jeu à l'écran d'accueil (Partager → « Sur l'écran d'accueil »), il s'ouvre alors en plein écran.
- **PC** : glisser à la souris, flèches ← → pour pousser, Espace pour lancer, R pour recommencer, Z pour zoomer.

## Technique
HTML + Canvas 2D + JavaScript en modules natifs, sans dépendance ni outil de construction.

- `js/track.js` : route relevée sur le dessin (spline), chemin du centre de la boule.
- `js/physics.js` : bille d'acier pleine (5/7·g), chute en haut du looping si elle est trop lente, rebonds.
- `js/input.js` : glissé, doigt posé, clavier.
- `js/scenery.js`, `js/pencil.js`, `js/ballArt.js`, `js/effects.js` : dessin au crayon, soleil, nuages, effets.
- `js/camera.js` : vue d'ensemble ou suivi de la boule.
- `js/fullscreen.js` : plein écran, astuce iPhone ; `manifest.webmanifest` et `icones/` pour l'écran d'accueil.
- `js/main.js` : boucle de jeu.

En local : servir le dossier avec n'importe quel serveur statique (les modules ne marchent pas en `file://`),
par exemple `npx serve .` ou `python3 -m http.server`.

## Mise en ligne (GitHub Pages)
Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.

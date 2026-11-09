# La boule et le looping

Mini-jeu pour navigateur (téléphone et PC), dessiné au crayon d'après un dessin à la main :
une boule en métal roule sur une route pleine de loopings, de tremplins et d'aiguillages,
à travers quatre saisons. Une partie dure une dizaine de minutes.

- **Été (niveaux 1 à 4)** : les niveaux 1 et 2 forment une seule balade aux crayons de couleur
  (`js/balade.js`), sans raccord : chaque plan est une bande continue sous les deux niveaux (ciel
  en dégradé (texture fournie, aussi sur le niveau 3), bleu foncé en haut et presque blanc en bas, soleil qui brille, petits et gros nuages
  — jamais deux pareils côte à côte —, montagnes, une seule bande de champs,
  terre en texture sous la route, herbe au vent au premier plan). Plus un plan est loin, moins il
  glisse quand la caméra avance.
  - Niveau 1 : la butte et son looping (route relevée sur le dessin : `tools/route-niveau1.py`),
    la charrette et ses pailles qui s'envolent, le moulin aux ailes qui tournent.
  - Niveau 2 : tremplin au-dessus d'une fosse et looping, devant la ferme et ses trois cochons.
  - Niveaux 3 et 4, encore au crayon : deux loopings à la suite ; aiguillage entre un souterrain
    (grand looping) et une grande bosse (butte de terre pleine, galerie dessous).
  Images : `images/niveau0/` (dessins du niveau 1) et `images/balade/` (`tools/decouper-balade.py` :
  terre, ciel, montagnes et champs du niveau 1 ; ferme, cochon, nuages).
- **Terre de tous les niveaux** : la même texture de terre aux crayons de couleur, posée selon la
  position dans le paysage (aucun raccord entre deux niveaux), et la même route, un trait brun
  foncé tracé d'un seul tenant. Les saisons ajoutent par-dessus leur décor (neige, glace sur la
  route, flaques, arbres).
- **Automne (5 à 8)** : feuilles mortes qui volent, vent en rafales qui gêne l'avancée.
- **Hiver (9 à 12)** : neige, route glacée : la boule glisse, va plus vite, répond moins aux
  gestes, et revenir en arrière est difficile.
- **Pluie (13 à 16)** : pluie, flaques qui freinent, fosses pleines d'eau.
- **Arrivée** : arc-en-ciel, banderole, temps total du parcours.

**Le but** : trois étoiles par niveau (dans les loopings, au-dessus des obstacles, sur les chemins
risqués), une médaille de temps (or, argent, bronze), et des points multipliés quand on enchaîne
looping, saut, obstacle franchi, bonus, étoile ou atterrissage parfait (×2, ×3…). Un petit bilan
s'affiche à chaque niveau ; la boule grise est ton meilleur passage. Les étoiles débloquent des
boules : verre (légère), pétanque (lourde, traverse les tas), balle rebondissante, crayons de couleur.

**Obstacles** : rochers et troncs bas, gros tas de feuilles (automne) ou de neige (hiver),
escaliers de deux marches, plateformes au-dessus d'une fosse, grandes flaques. Un saut les passe
toujours ; avec assez d'élan, la boule passe aussi d'elle-même ; les tas freinent sans arrêter.
Une nouveauté à la fois : automne 5 = le vent, 6 = rocher et tronc (avec l'astuce « touche pour
sauter »), 7 = tas de feuilles et aiguillage, 8 = escalier ; hiver et pluie de même.
↺ ramène juste avant le passage difficile raté.

**Passages de saison en fondu** : herbe, neige, ciel, météo, vent et glace changent peu à peu.

**Bonus** (petites boules de couleur dessinées au crayon) :
rouge = élan · bleue = la boule colle à la route 6 s (elle ne tombe plus des loopings) ·
verte = bond · jaune = plume (gravité réduite 6 s).

**Aiguillages** (un par saison) : à l'approche, le temps ralentit fortement (la boule avance encore
un peu), l'écran bleuit, le son s'étouffe ; deux boutons posés au début de chaque chemin permettent
de choisir. Sur téléphone, le jeu se joue à l'horizontale.

**Menu** : continuer la partie sauvegardée, nouvelle partie, comment jouer, scores, options
(volumes, vibrations, plein écran, vue de départ, noms des bonus), crédits. À l'arrivée, le temps
est inscrit dans un tableau des 10 meilleurs scores, gardé dans le navigateur.

Musique douce et mélancolique, roulement métallique, vent, pluie, éclaboussures, tintements :
tout est fabriqué dans le navigateur (Web Audio), sans fichier son, donc sans droits.

## Jouer
- **Glisser puis lâcher** : lance la boule. Plus le doigt va vite, plus elle part vite.
- **Toucher bref** (n'importe où) : la boule saute (tolérant : un peu avant de toucher la route ou juste après l'avoir quittée).
- **Doigt posé** : la boule roule doucement vers le doigt.
- **Loupe** (en bas à droite) : passe de la vue d'ensemble (tout le parcours) au zoom sur la boule.
  En paysage, la vue d'ensemble est le réglage de départ ; en portrait, c'est le zoom.
- **↺** : recommencer le niveau en cours ; appui long : retour au niveau 1.
- **Plein écran** (en haut à droite) : automatique au premier toucher sur Android ; sur iPhone,
  ajouter le jeu à l'écran d'accueil (Partager → « Sur l'écran d'accueil »), il s'ouvre alors en plein écran.
- **Note de musique** (en haut à droite) : couper ou remettre la musique.
- **Aiguillage** : toucher le bouton posé au début du chemin voulu (en haut ou en bas).
- **☰** : menu et pause.
- **PC** : glisser à la souris, flèches ← → pour pousser, Espace pour lancer, R pour recommencer, ↑ pour sauter, Z pour zoomer, M pour la musique, A pour l'aiguillage, Échap pour le menu, F pour le compteur d'images par seconde.

## Technique
HTML + Canvas 2D + JavaScript en modules natifs, sans dépendance ni outil de construction.

- `js/levels.js` : niveaux 1 à 4 faits à la main, recettes des niveaux 5 à 16 et de l'arrivée.
- `js/builder.js` : les pièces (looping, tremplin, demi-tube, flaque, bonus, aiguillage…).
- `js/biomes.js` : les saisons (couleurs, glace, vent, pluie).
- `js/track.js` : géométrie (spline), chemin du centre de la boule, raccords des tronçons, sol.
- `js/physics.js` : bille d'acier pleine (5/7·g), chute en haut du looping si elle est trop lente, rebonds.
- `js/input.js` : glissé, doigt posé, clavier.
- `js/scenery.js` (papier, soleil, panneaux), `js/clouds.js`, `js/pencil.js`, `js/ballArt.js`, `js/effects.js` : dessin au crayon, soleil, nuages, oiseaux, effets.
- `js/game.js` : étoiles, enchaînements, médailles, bilan, fantôme, boules à débloquer.
- `js/obstacles.js` : obstacles à sauter (contacts et dessin).
- `js/bonus.js` et `images/boule-*.png` : les boules bonus (la rouge vient du dessin, les autres sont recolorées).
- `js/earth.js`, `images/sol1.webp` et `images/terre-*.webp` : le premier plan (terre du dessin), peint dans chaque feuille ; `tools/decouper-sol1.py` et `tools/decouper-terre.py` le refont à partir du dessin.
- `js/ink.js` : le dessin fixe de chaque feuille, préparé petit à petit pendant le jeu.
- `js/weather.js` : feuilles mortes, neige, pluie.
- `js/audio.js` : musique composée hors temps réel par morceaux puis rejouée en boucle, roulement, vent, tintements (Web Audio).
- `js/camera.js` : vue d'ensemble ou suivi de la boule.
- `js/fullscreen.js` : plein écran, astuce iPhone ; `manifest.webmanifest` et `icones/` pour l'écran d'accueil.
- `js/menu.js` et `js/save.js` : menu, options, scores, sauvegarde (localStorage).
- `js/main.js` : boucle de jeu.

En local : servir le dossier avec n'importe quel serveur statique (les modules ne marchent pas en `file://`),
par exemple `npx serve .` ou `python3 -m http.server`.

## Mise en ligne (GitHub Pages)
Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.

## Vérifier les niveaux
`node tools/verifier-niveaux.mjs` : contrôle la géométrie (place dans chaque feuille, hauteur,
virages, étoiles à portée de saut) et fait jouer chaque niveau, et chaque chemin des aiguillages,
par un petit robot. `SANS_SAUT=1 node tools/verifier-niveaux.mjs` : le même robot sans jamais sauter.

## Mesurer la fluidité
Ajouter `#fps` à l'adresse (ou touche F) : images par seconde, pire image, feuilles en mémoire.

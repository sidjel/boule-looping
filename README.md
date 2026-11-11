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
  - Niveau 3 : deux loopings devant la bande du lac et du château (`images/niveau3/`, raccordée à la
    ferme par `tools/decouper-niveau3.py`), telle que dessinée, sans animation (`js/chateau.js`).
  - Niveaux 3 et 4, encore au crayon : deux loopings à la suite ; aiguillage entre un souterrain
    (grand looping) et une grande bosse (butte de terre pleine, galerie dessous).
  Images : `images/niveau0/` (dessins du niveau 1) et `images/balade/` (`tools/decouper-balade.py` :
  terre, ciel, montagnes et champs du niveau 1 ; ferme, cochon, nuages).
- **Terre de tous les niveaux** : la même texture de terre aux crayons de couleur, posée selon la
  position dans le paysage (aucun raccord entre deux niveaux), et la même route, un trait brun
  foncé tracé d'un seul tenant. Les saisons ajoutent par-dessus leur décor (neige, glace sur la
  route, flaques, arbres).
- **Ciel de tous les niveaux** (`js/ciel.js`, `images/ciel/`, préparé par `tools/ciel-saisons.py`) :
  la texture de ciel au crayon, en dégradé ; bleu franc l'été, doré en bas en automne, pâle en
  hiver, gris sous la pluie, coucher de soleil à l'arrivée ; la couleur passe d'une saison à
  l'autre en fondu pendant qu'on avance, sans jonction.
- **Montagnes de tous les niveaux** (`js/montagnes.js`, `images/montagnes/`, préparées par
  `tools/decouper-montagnes.py`) : la bande de montagnes fournie, qui se raccorde sur elle-même,
  loin derrière la route ; ensoleillées l'été, rousses en automne, enneigées l'hiver, grises sous la
  pluie, roses à l'arrivée ; la couleur change peu à peu le long de la chaîne, sans jonction ; le pied
  s'efface dans la brume de l'horizon.
- **Soleil sur tout le parcours** (`js/soleil.js`) : il raconte la journée, de midi au coucher. Fixe à
  l'écran pendant qu'on roule, il ne bouge qu'avec l'avancée de la balade : en haut vers le quart
  gauche de l'écran au niveau 1, il glisse vers la droite et descend (lentement, puis de plus en plus
  vite) jusqu'à se coucher sur les montagnes, vers les trois quarts droits, à l'arrivée ; jaune vif l'été, doré en automne, pâle en hiver, voilé sous la pluie,
  rouge-orangé au coucher.
- **Nuages de tous les niveaux** (`js/nuages.js`, `images/nuages/`, préparés par
  `tools/decouper-nuages.py`) : deux rangs qui dérivent (petits au loin, gros devant), jamais deux
  pareils côte à côte ; blancs l'été, dorés en automne, blanc froid en hiver, gris sous la pluie,
  rosés à l'arrivée, avec un passage en douceur d'une saison à l'autre.
- **Herbe du premier plan, sur tout le parcours** (`js/herbe.js`, `images/herbe/`, découpée par
  `tools/decouper-herbe.py`) : la bande d'herbe fleurie, raccordée sur elle-même sans miroir, qui
  ondule au vent ; en fleurs l'été, fanée en automne, givrée et enneigée en hiver, mouillée sous la
  pluie ; elle change peu à peu d'une saison à l'autre, sans jonction.
- **Après le niveau 3** (`js/suite.js`, `images/automne/`, `tools/decouper-automne.py`) : le lac et les
  champs de foin prennent la suite de la bande du château (couture qui suit le dessin), puis les
  champs se répètent (raccordés sur eux-mêmes) jusqu'à l'hiver, roux et dorés en automne.
- **Paysage d'hiver** (`images/hiver/`, `tools/decouper-hiver-pluie.py`) : pendant tout l'hiver, à la
  place des champs, au pied des montagnes : sapins, collines enneigées, barrière, bonhomme de neige et
  igloo. Il commence par une couture qui suit le dessin (champs déjà enneigés, même neige bleutée) et
  se répète en partie (sans le bonhomme ni l'igloo).
- **Paysage de pluie** (`images/pluie/`, même outil) : forêt et lac. Au passage à la pluie, la jonction
  se cache derrière un groupe de grands sapins enneigés ; au sol, la neige s'arrête en bord irrégulier
  sur l'herbe, comme une neige qui fond. Le paysage se répète ensuite (raccordé sur lui-même, lac contre
  lac) jusqu'au bout du parcours, aux couleurs grises de la pluie, puis du soir à l'arrivée.
- **Automne (5 à 8)** : feuilles mortes qui volent, vent en rafales qui gêne l'avancée ; poussière et
  fins brins de foin emportés par le vent au-dessus des champs et tout près (`js/foin.js`).
- **Hiver (9 à 12)** : neige, route glacée : la boule glisse, va plus vite, répond moins aux
  gestes, et revenir en arrière est difficile.
- **Pluie (13 à 16)** : flaques qui freinent, fosses pleines d'eau ; il pleut aux niveaux 13 et 14, la pluie
  cesse peu à peu au début du niveau 15 : aux niveaux 15 et 16, le soleil se couche (`js/biomes.js` : `rainAt`).
- **Arrivée** : arc-en-ciel, banderole, temps total du parcours.

**Le but** : trois étoiles par niveau (dans les loopings, au-dessus des obstacles, sur les chemins
risqués), une médaille de temps (or, argent, bronze), et des points multipliés quand on enchaîne
looping, saut, obstacle franchi, bonus, étoile ou atterrissage parfait (×2, ×3…). Un petit bilan
s'affiche à chaque niveau ; la boule grise est ton meilleur passage. Les étoiles débloquent des
boules : verre (légère), pétanque (lourde, traverse les tas), balle rebondissante, crayons de couleur.

**Obstacles** (peu nombreux, pour que la balade reste fluide) : un gros tas de feuilles (automne)
et un de neige (hiver), des plateformes au-dessus d'une fosse, une grande flaque. Un saut les passe
toujours ; avec assez d'élan, la boule passe aussi d'elle-même ; les tas freinent sans arrêter.
Une nouveauté à la fois : automne 5 = le vent, 6 = des bosses, 7 = tas de feuilles (avec l'astuce
« touche pour sauter ») et aiguillage, 8 = deux loopings ; hiver et pluie de même.
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
- **↺** : recommencer le niveau en cours ; appui long : retour au niveau 1, en fondu (pas de voyage
  de la caméra à travers le parcours ; de même pour « Nouvelle partie » et « Continuer »).
- **Plein écran** (en haut à droite, visible dès le menu) : au lancement, une fenêtre demande
  « Jouer en plein écran ? » (Oui / Non merci ; option « Proposer le plein écran au lancement ») ; sur iPhone,
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
Physique (js/physics.js) : dans un looping, la boule reste plaquée à la paroi (sans assez d'élan, elle
redescend en marche arrière, elle ne décroche plus) ; vitesse plafonnée à 1 696 px/s le long de la route
(SPEED.cap), jusqu'à 1 950 px/s pendant l'effet de la boule rouge, retour au plafond en douceur.
`node tools/verifier-niveaux.mjs` : contrôle la géométrie (place dans chaque feuille, hauteur,
virages, étoiles à portée de saut) et fait jouer chaque niveau, et chaque chemin des aiguillages,
par un petit robot. `SANS_SAUT=1 node tools/verifier-niveaux.mjs` : le même robot sans jamais sauter.

## Mesurer la fluidité
- **Diagnostic automatique** (`js/diagnostic.js`) : pendant toute la partie, le jeu note l'intervalle
  réel entre deux images et, à part, le temps de calcul JavaScript de chaque étape, les appels
  drawImage par étape, la position de la boule et de la caméra, les particules, le contexte (looping,
  passage de saison, passage de niveau, vue d'ensemble). Historique circulaire de 10 s ; images
  longues classées (> 20, 25, 33, 50 ms), regroupées en événements ; les 5 plus importants sont gardés
  avec 1 s avant et 0,5 s après. Journal : chargements et décodages d'images, canevas créés ou
  agrandis, préparations à l'avance et des feuilles, changements de résolution. Options → « Exporter
  le diagnostic » (partage ou téléchargement d'un fichier JSON), « Copier », « Afficher » (zone de
  texte, si le reste est bloqué), « Remettre à zéro ». Un résumé est gardé en quittant la page
  (« Exporter la session précédente »). Coût mesuré : environ 0,002 ms par image.
- **Dans le jeu** : Options → « Afficher le compteur d'images par seconde », ou `#fps` à la fin de
  l'adresse, ou touche F. En bas de l'écran : images par seconde, pire image, temps de calcul d'une
  image et les trois étapes les plus coûteuses (`js/profil.js` mesure chaque étape : ciel, montagnes,
  champs et paysages, feuilles, herbe, météo…).
- **Sur tout le parcours** (Playwright) : `node tools/mesurer-fps.mjs` pose la boule tous les 250 px
  et donne les points les plus lents avec leurs causes et un résumé par niveau ;
  `node tools/mesurer-fps.mjs --partie --dpr 1` joue une partie entière (aiguillages et bonus choisis
  tout seuls) et note chaque saccade avec l'endroit et l'étape fautive. Options : `--pc`, `--pas`,
  `--de`/`--a`, `--json`, `--sans-gpu` (tout en logiciel), `--rapide`. Le navigateur de test n'a pas de
  vraie carte graphique : il est bien plus lent qu'un téléphone, mais il montre où et pourquoi ça coince.
- **Images selon l'endroit** (`js/ressources.js`) : chaque image du décor dit où elle sert (sa saison,
  ou une zone du parcours) ; elle est chargée et décodée hors du jeu quand la caméra en approche
  (3 600 px), deux à la fois au plus pendant la partie (douze décodées ensemble faisaient sauter des
  images à chaque passage de saison), gardée jusqu'à 6 500 px, puis libérée, et les copies préparées à partir d'elle sont
  oubliées avec elle. Les niveaux eux-mêmes (route, bonus, obstacles) restent tous en mémoire.
  Mémoire des images : 41 à 74 Mo selon l'endroit, au lieu de 130 Mo (affichée dans le compteur).
  Le fondu attend (1,5 s au plus) que les images du nouvel endroit soient prêtes.
- **Qualité d'image** (Options) : automatique, haute (résolution 2), moyenne (1,5), économique (1).
  En automatique, si le jeu reste sous 50 images par seconde pendant trois mesures de 2 s d'affilée,
  la résolution baisse d'un cran, et ce choix est gardé pour la fois suivante. Seuls les pixels du
  canevas changent : cadrage, physique et gestes sont les mêmes.
- **Règles qui évitent les saccades** :
  - les particules nombreuses (foin, feuilles mortes, flocons) sont de petites images dessinées une
    fois (`js/sprites.js`) puis posées, jamais des centaines de traits par image ; la pluie est un seul
    tracé ;
  - les feuilles (terre, route) sont dessinées sur la carte graphique, par morceaux (la route morceau
    par morceau, la terre et le grain du papier en 4 bandes). L'ordre suit ce que la caméra montre et
    va montrer dans le sens de la marche (1,6 s de route à la vitesse de la boule, au moins 900 px), au
    plus 5 feuilles en mémoire. L'effort suit l'urgence : au calme, un morceau par image et rien après
    une image longue ; pressé, plusieurs morceaux (2 ms au plus), même après une image longue ; un pixel de la feuille finie, invisible, est posé sur l'écran pour que la carte
    graphique la dessine avant son entrée à l'écran (un seul : un pixel après chaque morceau coûtait
    6 à 60 ms par image au téléphone) ; les obstacles d'une feuille reçoivent leur image juste après elle ; les
    canevas des feuilles sont créés menu ouvert puis réutilisés : aucun n'est créé en pleine partie ;
    traits au crayon allégés (un point tous les 5 px) ; menu ouvert, les premières sont préparées ; une petite tuile dont on lit les pixels (grain du papier, soleil) est en
    mémoire (`willReadFrequently`), jamais lue depuis la carte graphique ;
  - menu ouvert, un tour d'essai dessine les trois premiers niveaux hors de l'écran (moulin, ferme,
    château déjà prêts) ;
  - les morceaux de paysage aux couleurs mêlées (passages de saison) sont préparés à l'avance, un par
    image au plus (`js/avance.js`), par deux dégradés (`js/melange.js` : 4 dessins au lieu d'un par
    colonne), puis passent tout de suite par la carte graphique ; chaque mélange (montagnes, herbe,
    champs, pluie) se fait en trois étapes sur trois images, une fois ses deux images passées par la
    carte graphique, un seul à la fois, sur des canevas réutilisés ; les montagnes sont chargées
    d'après leur propre plan (elles annoncent la saison bien avant le sol) ; les canevas qui ne
    servent plus sont rendus tout de suite à la carte graphique ; étoiles, lueurs et mots des bonus
    sont de petites images dessinées une fois ; le ciel d'un passage est un seul ciel
    déjà mélangé ;
  - les images d'une saison se chargent quand elle approche du bord de l'écran (pas du centre) ;
  - le canevas du jeu est opaque (`alpha: false`) : chaque image le recouvre en entier (ciel, ou papier
    hors du ciel), le navigateur n'a ni à dessiner le fond de la page dessous ni à mélanger les deux ;
  - l'écran d'arrivée met le jeu en pause ; en pause, une image identique n'est pas redessinée ;
  - les sauvegardes (et les fantômes) sont écrites au moment calme du navigateur, pas pendant le
    passage d'un niveau à l'autre ; le papier n'est pas dessiné sous le ciel ; l'herbe n'est dessinée
    qu'à l'écran ;
  - l'herbe ondule en environ 9 rangées inclinées (chacune penchée de son haut à son bas, à 0,3 px de
    la courbe du vent) au lieu de 50 à 80 fines rangées décalées en escalier : 16 à 32 dessins par
    image au lieu de 68 à 204, et des brins sans crans (au téléphone : environ 100 dessins de moins par
    image en automne).
- Le compteur affiche aussi le nombre de dessins par image et les étapes qui dessinent le plus
  (sur téléphone, c'est souvent ce nombre qui ralentit, pas le calcul).

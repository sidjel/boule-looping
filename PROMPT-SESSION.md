# Mission : jeu « La boule et le looping » — évaluer 5 techniques d'optimisation

Tu reprends un projet en cours. Lis tout ce message avant d'agir. Réponds en français, phrases simples, à la première personne, sans formules creuses.

## 1. Le jeu

- Jeu de navigateur pour téléphone, jouable à l'horizontale : une boule d'acier roule sur une route dessinée au crayon, avec des loopings, des sauts, des aiguillages, des bonus et des étoiles.
- 16 niveaux puis une arrivée, sur un monde d'environ 32 000 px de large. Les niveaux traversent 5 saisons (été, automne, hiver, pluie, arrivée au soir), qui se mélangent aux passages de saison.
- Technique : Canvas 2D, modules ES natifs, aucune dépendance ni outil de construction, 36 modules (environ 7 100 lignes).
- Mis en ligne comme artefact claude.ai public :
  - slug `b5c2df05-17a4-4b14-a21f-6dda0f983b96` ;
  - titre « La boule et le looping » ;
  - adresse https://claude.ai/artifact/PSnoWUKdKMQvegtqWBTtYM ;
  - publication avec `mcp__claude-artifacts__publish_files` en mode patch, avec `base_version` (version en ligne, lue avec `get_artifact` ou `list_files`), `shared_live: "public"` et `artifact_title`.
- **Le code source** est sur GitHub : https://github.com/sidjel/boule-looping, branche `main`, avec tout l'historique (80 enregistrements), les outils de test (`tools/verifier-niveaux.mjs`, `tools/mesurer-fps.mjs`) et les scripts de découpage des images. Clone-le en premier. C'est la référence : la page publiée doit toujours correspondre à `main`.
- **Commits.** Un commit par correctif, messages en français. Pousse sur `main` de ce dépôt (il est dédié au jeu), ou sur une branche si l'auteur le demande.
- Lis d'abord `README.md` : il décrit l'architecture et toutes les règles anti-saccades déjà en place.

## 2. L'appareil de référence

- Téléphone Android 10, 8 cœurs, 8 Go, Chrome 154, densité d'écran 3.
- Le jeu y tourne en résolution 2 : canevas de 1600×720 en plein écran.
- Le but de l'auteur : **60 images par seconde stables sur ce téléphone, sans perte de qualité visible.**

## 3. Contraintes absolues (fixées par l'auteur)

1. **Intacts à 100 %** : la physique (`js/physics.js`), la vitesse de la boule, le maintien dans les loopings, la parallaxe des plans, les animations et la qualité visuelle en résolution 2. Aucun effet supprimé, aucune particule retirée artificiellement.
2. Ne jamais charger les images des 16 niveaux d'un coup : elles sont chargées selon l'endroit (`js/ressources.js`).
3. Une optimisation à la fois, isolée et vérifiable. Après chacune : `node tools/verifier-niveaux.mjs` doit répondre « Tout est jouable ».
4. **Travailler en deux étapes.** Étape 1 : analyse sans modifier aucun fichier. Étape 2 : application, seulement après la validation de l'auteur.
5. **Preuves exigées.** Pour chaque affirmation, cite le fichier, la fonction, les lignes et le mécanisme exact. Aucune supposition générique. Si tu ne peux pas prouver quelque chose, dis-le.
6. Aucun identifiant de modèle dans le code, les commits ou les pages publiées. Ne jamais pousser sur la branche `main` du dépôt `maxi-gouffre` : il n'a aucun rapport avec ce jeu.

## 4. Ce qui est déjà fait (ne pas le refaire)

- **Feuilles (terre et route)** : dessinées à l'avance, morceau par morceau (`js/ink.js` : `inkSteps`), sur des canevas réutilisés, 5 au plus en mémoire. Un seul pixel « d'envoi » est posé une fois la feuille finie. Un pixel après chaque morceau coûtait 6 à 60 ms par image : il a été retiré.
- **Mélanges de saisons** (montagnes, herbe, champs, pluie) : deux dégradés au lieu d'un dessin par colonne (`js/melange.js`). Ils sont préparés en trois étapes sur trois images, un seul à la fois, sur des canevas réutilisés, une fois les images passées par la carte graphique. Le résultat est identique au pixel près.
- **Images du décor** : chargées deux à la fois en jeu, à 3 600 px de la caméra, puis « chauffées » par un pixel invisible avant leur premier affichage.
- **Petits éléments** : étoiles, lueurs et mots des bonus, foin, feuilles mortes et flocons sont de petites images dessinées une fois (`js/sprites.js`). La pluie est un seul tracé.
- **Ciel** : un seul ciel déjà mélangé par passage de saison.
- **Résolution** : une option Qualité existe déjà (automatique, haute 2, moyenne 1,5, économique 1). En automatique, la résolution baisse d'un cran après trois mesures de 2 s sous 50 images par seconde (`js/main.js` : `dprCap`, `resize`, `autoQuality`).
- **Son** : roulement, vent et pluie coupés quand le jeu est en pause (menu, fenêtres, plein écran, arrivée).
- **Diagnostic** : intégré au jeu (`js/diagnostic.js`, `js/profil.js`). Le joueur copie un résumé court depuis Options → Diagnostic de fluidité (« Copier le résumé », environ 4 000 caractères). Demande ce résumé à l'auteur après chaque test : le rapport complet est trop long à coller.

## 5. Dernière mesure sur le téléphone (après toutes ces améliorations)

- 59 images par seconde en moyenne, 6,6 ms de calcul JavaScript par image.
- Images longues : 69 au-dessus de 25 ms, 14 au-dessus de 33 ms, 1 au-dessus de 50 ms. Aucune seconde sous 50 images par seconde.
- Ce qui reste :
  - (a) certains morceaux de feuille prennent 13 à 21 ms d'un coup (niveaux 1, 2 et 10 ; le découpage est dans `ink.js`, que l'auteur n'a pas encore autorisé à modifier) ;
  - (b) en hiver (niveaux 10 et 11), des images sautées alors que le calcul ne prend que 3 à 5 ms : l'attente est côté carte graphique ou navigateur, sans cause prouvée ;
  - (c) le foin prend 2 à 3 ms par image en automne.

## 6. Ta mission : évaluer sérieusement ces 5 techniques

L'auteur a trouvé cette liste ailleurs. Pour chacune, vérifie dans le code si elle s'applique vraiment à ce jeu. Dis si elle est déjà en place, ce qu'elle rapporterait (mesuré si possible), ce qu'elle risque de casser, et si elle respecte les contraintes de la section 3.

1. **`alpha: false` sur le canevas principal** (`canvas.getContext('2d', { alpha: false })`).
   À vérifier :
   - le canevas `#jeu` est créé dans `js/main.js` (vers la ligne 38, `screenCtx`) ;
   - le fond est-il entièrement opaque à chaque image, dans toutes les vues (vue d'ensemble, bas du monde, écran d'arrivée) ?
   - des éléments HTML transparents ou à flou (`backdrop-filter` sur #menu, #fin, #demande-plein) sont-ils au-dessus ? le canevas sert-il sous ces éléments ?
   - le tour d'essai (`warmUp`) dessine-t-il dans ce même contexte ?
2. **Pré-dessiner l'herbe et les aiguillages dans des caches.**
   - Attention : l'herbe (`js/herbe.js`, `Grass.draw`) est déjà faite de bandes préparées une fois. Les 50 à 130 `drawImage` par image viennent du découpage en fines bandes horizontales qui fait onduler l'herbe au vent. Un cache figé supprimerait l'animation : c'est interdit. Cherche si on peut garder l'ondulation avec moins de bandes, sans différence visible.
   - Les aiguillages (`js/scenery.js` : `drawForks`, vers la ligne 163) sont des tracés vectoriels, avec une pulsation au ralenti. Évalue un cache qui garde cette pulsation.
   - L'affirmation « champs et paysages : 251 → 4 drawImage » vient d'ailleurs : vérifie-la dans le code avant de t'en servir comme modèle.
3. **Dessiner seulement la zone non transparente des couches** (`drawImage` à 9 arguments).
   - Mesure la part réellement transparente de chaque image (dans `images/`), par exemple avec Python et PIL dans un dossier à part.
   - Vérifie que le cadrage, la parallaxe et l'ondulation de l'herbe restent identiques.
4. **Arrondir les coordonnées à l'entier.**
   - Vérifie si cela crée des à-coups visibles : la parallaxe glisse lentement, et les montagnes ou les nuages avanceraient pixel par pixel.
   - Vérifie aussi l'effet sur les raccords entre bandes : plusieurs dessins utilisent `w + 0.5` ou `w + 1` pour éviter des fentes.
   - Applique-le seulement là où le gain est réel et l'image identique.
5. **Plafonner la résolution à 1,5 sur téléphone.**
   - L'option existe déjà. Un plafond imposé serait une perte de qualité en résolution 2 : c'est contraire à la contrainte 1, sauf accord explicite de l'auteur.
   - Explique le compromis et ce que fait déjà la qualité automatique.

Pour chaque technique, ta conclusion est l'une de ces quatre : « à faire », « déjà en place », « à faire en partie », « à écarter ». Chacune doit être justifiée par des preuves tirées du code.

## 7. Comment mesurer

- Le navigateur de test (Playwright avec Chromium, sans vraie carte graphique) **ne reflète pas** le téléphone : il est utile pour trouver les causes, pas pour chiffrer les images par seconde. Seul le résumé envoyé par l'auteur depuis son téléphone fait foi.
- Pour comparer une image avant et après une modification : captures en résolution 2, et écart au pixel près quand c'est possible.

## 8. Format de ta réponse pour l'étape 1

1. **Un tableau** : technique, déjà en place ?, gain attendu, risque, conclusion.
2. **Le détail de chaque technique**, avec fichier, fonction, lignes et mécanisme.
3. **Un plan d'application ordonné**, une technique à la fois.
4. **Ce que l'auteur doit tester ensuite sur son téléphone.**

Puis attends sa validation avant de modifier quoi que ce soit.

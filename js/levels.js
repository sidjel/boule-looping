/**
 * Les seize niveaux et l'arrivée, une feuille de 2000 × 1433 chacun.
 * - Niveaux 1 à 4 (été) : faits à la main, d'après le dessin.
 * - Niveaux 5 à 16 (automne, hiver, pluie) : assemblés par pièces (builder.js) selon une
 *   petite recette par niveau, puis vérifiés par simulation (tools/verifier-niveaux.mjs).
 * La route est faite de tronçons raccordés : « main » (niveaux 1 à 4 jusqu'au premier
 * aiguillage), les chemins de chaque aiguillage, puis les tronçons s1, s2… entre aiguillages.
 * Aux raccords, les points voisins sont alignés : pas de cassure dans la route.
 */
import { Builder } from './builder.js';

export const SHEET = 2000;
export const LEVELS = 16;
export const SHEETS = LEVELS + 1;          // + la feuille d'arrivée
export const WORLD = { w: SHEET * SHEETS, h: 1433 };

/** Niveau 1 : relevé sur le dessin. */
const LEVEL1 = [
  [-14, 500], [25, 498], [60, 497], [88, 498], [108, 520], [130, 590], [158, 680],
  [190, 772], [228, 858], [268, 937], [306, 1010], [355, 1070], [410, 1115], [470, 1148],
  [540, 1163], [610, 1161], [665, 1149], [705, 1132], [762, 1104], [832, 1058], [893, 1003],
  [932, 940], [950, 870], [943, 800], [916, 742], [870, 703], [810, 686], [750, 690],
  [690, 712], [636, 755], [603, 820], [594, 890], [604, 960], [628, 1030], [665, 1090],
  [710, 1135], [762, 1157], [822, 1163], [892, 1155], [962, 1134], [1040, 1104], [1112, 1064],
  [1180, 1010], [1242, 958], [1300, 921], [1350, 908], [1400, 917], [1452, 945], [1512, 995],
  [1572, 1040], [1642, 1066], [1712, 1071], [1782, 1054], [1852, 1014], [1922, 960], [1976, 905],
];

const X1 = [705, 1132];
const at = (X, s, p) => [X[0] + (p[0] - X1[0]) * s, X[1] + (p[1] - X1[1]) * s];

/** Le looping du dessin, à l'échelle s, posé au croisement X : approche, boucle, sortie. */
function loop(X, s) {
  const a = LEVEL1.findIndex(([x, y]) => x === 705 && y === 1132);
  const b = LEVEL1.findIndex(([x, y]) => x === 710 && y === 1135);
  return [
    at(X, s, [610, 1161]), at(X, s, [665, 1149]),
    ...LEVEL1.slice(a, b + 1).map((p) => at(X, s, p)),
    at(X, s, [762, 1157]), at(X, s, [822, 1163]),
  ];
}

/** Niveau 2 : crête, grande descente, tremplin au-dessus d'une fosse, second looping. */
const LEVEL2 = [
  [2030, 852], [2085, 808], [2140, 782], [2195, 775], [2250, 790], [2310, 830], [2380, 900],
  [2450, 985], [2520, 1060], [2590, 1115], [2660, 1140], [2730, 1135], [2790, 1110],
  [2850, 1065], [2900, 1016], [2940, 978], [2965, 960],
  [2988, 968], [3004, 1012], [3018, 1100], [3038, 1198], [3072, 1266], [3120, 1288],
  [3170, 1274], [3205, 1220], [3226, 1150], [3241, 1082], [3256, 1032],
  [3278, 1006], [3312, 1000], [3362, 1014], [3420, 1048], [3490, 1098], [3560, 1132],
  ...loop([3722, 1140], 0.86).slice(1),
  [3890, 1158], [3950, 1126], [4010, 1068], [4070, 1012],
];

/** Niveau 3 : petite crête, puis deux loopings à la suite, une bosse, l'arrivée au niveau 4. */
const LEVEL3 = [
  [4130, 968], [4190, 948], [4250, 957], [4320, 995], [4400, 1060], [4460, 1118],
  ...loop([4620, 1140], 0.8),
  [4790, 1185], [4845, 1212],
  ...loop([4950, 1212], 0.66),
  [5160, 1215], [5210, 1195], [5250, 1150], [5340, 1092], [5420, 1042], [5480, 1026], [5560, 1046],
  [5680, 1100], [5820, 1125], [5950, 1128], [6060, 1124], [6150, 1122],
];

/** Niveau 4 : aiguillage en F, deux chemins faits à la main, réunion en EM. */
const F0 = [6220, 1122], F = [6270, 1122];
const EM = [8000, 1150], E1 = [8040, 1150];
const BIG = [7400, 1170], BIG_S = 1.05;

const HAND = {
  main: { pts: [...LEVEL1, ...LEVEL2, ...LEVEL3, F0, F], next: [6310, 1122] },
  under: {
    prev: F0,
    pts: [
      F, [6300, 1122], [6345, 1136], [6400, 1172], [6460, 1230], [6530, 1290], [6620, 1338],
      [6740, 1360], [6870, 1362], [6990, 1348], [7090, 1310], [7170, 1262], [7240, 1222],
      ...loop(BIG, BIG_S), [7620, 1200], [7740, 1186], [7840, 1165], [7905, 1152], [7950, 1150], EM,
    ],
    next: E1,
  },
  hill: {
    prev: F0,
    pts: [
      F, [6330, 1122], [6385, 1100], [6440, 1060], [6500, 1000], [6560, 925], [6620, 842],
      [6680, 762], [6740, 692], [6800, 632], [6860, 582], [6920, 522], [6980, 465], [7030, 430],
      [7080, 418], [7125, 432], [7165, 470], [7200, 515], [7240, 538], [7320, 546], [7450, 548],
      [7580, 546], [7660, 552], [7720, 600], [7770, 690], [7815, 800], [7855, 920], [7890, 1030],
      [7920, 1105], [7950, 1142], [7975, 1150], EM,
    ],
    next: E1,
  },
};

/* ---------- niveaux 5 à 16 : recettes ---------- */

const b = new Builder('s1', [EM, E1], [7960, 1150]);
const start = (k) => b.to(k * SHEET + 20, 1100).checkpoint(k).flat(110);
/** Place restante à la fin de chaque niveau (négative : le niveau déborde sur la feuille suivante). */
export const LEVEL_ROOM = [];
const end = (k) => {
  LEVEL_ROOM[k] = (k + 1) * SHEET - 20 - b.x;
  b.to((k + 1) * SHEET - 20, 1100);
};

// Chaque niveau : trois étoiles, et une seule nouveauté à la fois. Aux aiguillages, un chemin
// facile (une étoile) et un chemin risqué (deux étoiles).

// Automne : 5 = le vent seul ; 6 = premiers obstacles (rocher bas, tronc) ; 7 = tas de feuilles
// et aiguillage ; 8 = escalier.
start(4); b.valley(380, 150).hill(360, 150, true).bonus('red', 40).slope(160, 50).loop(0.82, true).flat(40).hill(300, 110, true); end(4);
start(5); b.slope(100, 30).obstacle('rock', true).flat(60).obstacle('trunk', true).bonus('green', 10).hill(330, 130, true); end(5);
start(6); b.obstacle('leaves', true);
b.fork(1200,
  (l) => l.slope(140, 80).bonus('red').slope(100, 10).loop(0.7, true).flat(30).slope(140, -90),
  (h) => h.slope(260, -400).bonus('yellow').flat(50).star(0, 160).flat(120).star(0, 150).flat(50).slope(260, 400),
  ['↘ En bas : looping', '↗ En haut : le pont']);
end(6);
start(7); b.slope(120, 40).stairs(2, 180, 45, true).bonus('red').loop(0.8, true).slope(60, 25).loop(0.7, true); end(7);

// Hiver : 9 = la glace seule ; 10 = tas de neige ; 11 = aiguillage ; 12 = trois loopings.
start(8); b.slope(180, 150).hill(360, 150, true).hill(340, 140, true).slope(80, 30).loop(0.85, true); end(8);
start(9); b.halfpipe(390, 200).star(0, 160).bonus('blue', 30).flat(20).loop(0.88, true).obstacle('snow', true); end(9);
start(10); b.hill(280, 90, true);
b.fork(1180,
  (l) => l.slope(140, 60).loop(0.7, true).flat(20).loop(0.64, true).slope(140, -60),
  (h) => h.slope(340, -440).bonus('green', 40).flat(150).star(0, 170).slope(340, 440),
  ['↘ En bas : deux loopings', '↗ En haut : le pont']);
end(10);
start(11); b.slope(160, 80).bonus('red').loop(0.76, true).slope(50, 22).loop(0.7, true).slope(50, 22).loop(0.62, true).flat(30).valley(300, 100); end(11);

// Pluie : 13 = flaques ; 14 = grande flaque et rocher ; 15 = aiguillage ; 16 = plateformes.
start(12); b.slope(220, 120).puddle(160).slope(200, -120).hill(300, 110, true).bonus('red').slope(80, 20).loop(0.78, true).puddle(180).hill(260, 85, true); end(12);
start(13); b.slope(100, 30).bigPuddle(300, true).obstacle('rock', true).hill(300, 110, true); end(13);
start(14); b.hill(300, 110, true);
b.fork(1250,
  (l) => l.slope(160, 90).puddle(150).bonus('red').loop(0.74, true).slope(140, -90),
  (h) => h.slope(320, -440).bonus('yellow').star(40, 170).puddle(200).star(0, 170).slope(320, 440),
  ['↘ En bas : flaque et looping', '↗ En haut : pont et flaque']);
end(14);
start(15); b.bonus('blue', 60).flat(40).platforms(3, 150, 100, true).flat(40).bonus('red').loop(0.8, true).slope(60, 25).loop(0.7, true); end(15);

// Arrivée : replat, ligne d'arrivée, arc-en-ciel ; un butoir au bout.
start(16); b.flat(400);
export const FINISH = { x: 16 * SHEET + 900 };
b.to(17 * SHEET - 120, 1100).slope(70, -60).slope(40, -90);

const GEN = b.meta;
export const PIECES = { ...HAND };
for (const pc of GEN.pieces) PIECES[pc.name] = { pts: pc.pts, prev: pc.prev, next: pc.next, platform: !!pc.platform };

/** Sommets des loopings (tronçon, plage de x) : pour le petit effet de réussite. */
export const LOOP_ZONES = [
  ['main', 560, 980], ['main', 3540, 3900], ['main', 4500, 4860], ['main', 4880, 5200], ['under', 7270, 7680],
  ...GEN.loops,
];
/** Tremplins : lèvre (seul endroit d'une bosse où l'on décolle) et fosse. */
export const JUMPS = [
  { x0: 2925, x1: 3010, yMax: 1010, pitEnd: 3290, pit: [2988, 3256], bottom: 1288 },
  ...GEN.jumps,
];
export const PUDDLES = GEN.puddles;
export const OBSTACLES = GEN.obstacles;
/** Points de reprise juste avant les passages difficiles. */
export const RETRIES = GEN.retries;
/** Étoiles : trois par niveau (niveaux 1 à 4 placées à la main, au-dessus de la route ou dans les loopings). */
export const STARS = [
  { x: 60, y: 330 }, { x: 810, y: 731 }, { x: 1350, y: 722 },
  { x: 2195, y: 590 }, { x: 3120, y: 880 }, { x: 3812, y: 801 },
  { x: 4704, y: 828 }, { x: 5019, y: 963 }, { x: 5480, y: 852 },
  { x: 7510, y: 747 }, { x: 7080, y: 300 }, { x: 7450, y: 470 },
  ...GEN.stars,
];
export const BONUSES = [{ piece: 'main', x: 4475, color: 'red' }, ...GEN.bonuses];
/** Aiguillages : le tronçon d'avant, les deux chemins (a = bas, b = haut), le tronçon d'après. */
export const FORKS = [
  { x: F[0], y: F[1], seg: 'main', a: 'under', b: 'hill', after: 's1', labels: ['↘ Chemin : souterrain', '↗ Chemin : grande bosse'] },
  ...GEN.forks,
];
/** Chemins du haut à dessiner en pont (le niveau 4 a son propre pont). */
export const BRIDGES = GEN.bridges;
/** Points de reprise : début de chaque niveau. */
export const CHECKPOINTS = [
  { piece: 'main', x: 58 }, { piece: 'main', x: 2195 }, { piece: 'main', x: 4190 }, { piece: 'main', x: 6150 },
  ...GEN.checkpoints.slice(4),
];
export const HILL = { x0: F[0], x1: 7175, flank: 7235 }; // la colline de la grande bosse, et son flanc
export const BRIDGE = { x0: 7240, x1: 7660, pillars: [7660, 7815] };

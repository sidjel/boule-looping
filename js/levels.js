/**
 * Les quatre niveaux, une feuille de 2000 × 1433 chacun, en points de passage de la route.
 * La route est faite de tronçons :
 * - « main » : niveaux 1 à 3, puis le début du niveau 4 jusqu'à l'aiguillage ;
 * - « under » : chemin du souterrain, qui ressort sur un grand looping ;
 * - « hill » : chemin qui monte vers la grande bosse, puis passe sur un pont ;
 * - « end » : les deux chemins se rejoignent et sortent à droite.
 * Aux raccords, les points voisins sont alignés : pas de cassure dans la route.
 */
export const SHEET = 2000;
export const LEVELS = 4;
export const WORLD = { w: SHEET * LEVELS, h: 1433 };

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

/** Niveau 4 : aiguillage en F, deux chemins, réunion en E. */
const F0 = [6220, 1122], F = [6270, 1122];
const EM = [8000, 1150], E1 = [8040, 1150];
const BIG = [7400, 1170], BIG_S = 1.05;

export const PIECES = {
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
  end: { prev: [7960, 1150], pts: [EM, E1, [8090, 1125], [8150, 1070], [8210, 1000]] },
};

/** Sommets des loopings (tronçon, plage de x) : pour le petit effet de réussite. */
export const LOOP_ZONES = [
  ['main', 560, 980], ['main', 3540, 3900], ['main', 4500, 4860], ['main', 4880, 5200], ['under', 7270, 7680],
];
export const JUMP = { x0: 2925, x1: 3010 };   // seule la lèvre du tremplin laisse décoller sur une bosse
export const PIT = { x0: 2965, x1: 3290 };
export const HILL = { x0: F[0], x1: 7175, flank: 7235 }; // la colline de la grande bosse, et son flanc
export const BRIDGE = { x0: 7240, x1: 7660, pillars: [7660, 7815] };
export const FORK = { x: F[0], y: F[1] };

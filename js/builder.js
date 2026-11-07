/**
 * Constructeur de niveaux par pièces. Chaque pièce ajoute des points de passage à partir
 * du curseur (fin de la route déjà posée) et note ce qu'il faut savoir pour le jeu :
 * zones de looping, tremplins et fosses, flaques, bonus, ponts, aiguillages.
 * Les pièces viennent du dessin d'origine (looping, tremplin), mises à l'échelle.
 */

const X1 = [705, 1132];
// Looping du dessin : approche, boucle, sortie (repère du dessin d'origine).
const LOOP_SHAPE = [
  [610, 1161], [665, 1149], [705, 1132], [762, 1104], [832, 1058], [893, 1003], [932, 940], [950, 870],
  [943, 800], [916, 742], [870, 703], [810, 686], [750, 690], [690, 712], [636, 755], [603, 820],
  [594, 890], [604, 960], [628, 1030], [665, 1090], [710, 1135], [762, 1157], [822, 1163],
];
// Tremplin et fosse du niveau 2 (repère : début de la rampe).
const JUMP_SHAPE = [
  [0, 0], [60, -25], [120, -70], [170, -119], [210, -157], [235, -175], [258, -167], [274, -123],
  [288, -35], [308, 63], [342, 131], [390, 153], [440, 139], [475, 85], [496, 15], [511, -53],
  [526, -103], [548, -129], [582, -135], [632, -121], [690, -87], [760, -37], [830, -3],
];

export class Builder {
  /** @param {number[][]} start points déjà posés (le dernier est le curseur) */
  constructor(name, start, prev) {
    this.meta = { pieces: [], loops: [], jumps: [], puddles: [], bonuses: [], bridges: [], forks: [], checkpoints: [], obstacles: [], stars: [] };
    this.platformCount = 0;
    this.forkCount = 0;
    this.open(name, start, prev);
  }

  open(name, start, prev) {
    this.cur = { name, pts: [...start], prev };
    this.meta.pieces.push(this.cur);
  }

  get x() { return this.cur.pts[this.cur.pts.length - 1][0]; }
  get y() { return this.cur.pts[this.cur.pts.length - 1][1]; }
  add(x, y) { this.cur.pts.push([x, y]); return this; }

  /** Courbe douce (cosinus) jusqu'à (x + w, y + dy). */
  slope(w, dy = 0) {
    // virages assez larges pour la boule (rayon de la route ≥ 40 px), sinon on allonge la pente
    w = Math.max(w, Math.sqrt(Math.abs(dy) * 205));
    const x0 = this.x, y0 = this.y, n = Math.max(2, Math.round(w / 55));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.add(x0 + w * t, y0 + dy * (1 - Math.cos(Math.PI * t)) / 2);
    }
    return this;
  }

  flat(w) { return this.slope(w, 0); }

  /** Bosse (h > 0) ou creux (h < 0) qui revient à la même hauteur ; étoile au-dessus de la crête (saut). */
  hill(w, h, star = false) {
    // pied et sommet assez larges pour la boule (rayon de la route ≥ 40 px)
    h = Math.sign(h) * Math.min(Math.abs(h), (w * w) / 800);
    const x0 = this.x, y0 = this.y, n = Math.max(4, Math.round(w / 50));
    if (star) this.meta.stars.push({ x: x0 + w / 2, y: y0 - h - 170 });
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.add(x0 + w * t, y0 - h * (1 - Math.cos(2 * Math.PI * t)) / 2);
    }
    return this;
  }

  valley(w, d) { return this.hill(w, -d); }

  /** Demi-tube : parois raides, fond rond ; on y prend de l'élan en allant et venant. */
  halfpipe(w, d) {
    const x0 = this.x, y0 = this.y;
    for (const [t, k] of [[0.08, 0.12], [0.16, 0.45], [0.25, 0.78], [0.36, 0.95], [0.5, 1], [0.64, 0.95], [0.75, 0.78], [0.84, 0.45], [0.92, 0.12], [1, 0]]) {
      this.add(x0 + w * t, y0 + d * k);
    }
    return this.flat(60);
  }

  /** Looping à l'échelle s (le dessin d'origine = 1) ; étoile au sommet, à l'intérieur. */
  loop(s = 1, star = false) {
    const cx = this.x, cy = this.y, X = [cx + 95 * s, cy - 29 * s];
    if (star) this.meta.stars.push({ x: X[0] + 105 * s, y: X[1] - 446 * s + 48 });
    for (const p of LOOP_SHAPE.slice(1)) this.add(X[0] + (p[0] - X1[0]) * s, X[1] + (p[1] - X1[1]) * s);
    this.meta.loops.push([this.cur.name, X[0] - 125 * s, X[0] + 260 * s]);
    return this.flat(40);
  }

  /** Tremplin au-dessus d'une fosse (comme au niveau 2) ; étoile sur la trajectoire du saut. */
  jump(s = 1, star = false) {
    const x0 = this.x, y0 = this.y;
    if (star) this.meta.stars.push({ x: x0 + 400 * s, y: y0 - 250 * s });
    for (const p of JUMP_SHAPE.slice(1)) this.add(x0 + p[0] * s, y0 + p[1] * s);
    const lip = [x0 + 235 * s, y0 - 175 * s];
    this.meta.jumps.push({ piece: this.cur.name, x0: lip[0] - 40 * s, x1: lip[0] + 45 * s, yMax: lip[1] + 50 * s, pitEnd: x0 + 560 * s, pit: [x0 + 258 * s, x0 + 526 * s], bottom: y0 + 153 * s });
    return this.flat(50);
  }

  /** Flaque sur un replat : freine la boule (biome pluie). */
  puddle(w) {
    const x0 = this.x;
    this.flat(w);
    this.meta.puddles.push({ piece: this.cur.name, x0: x0 + 25, x1: x0 + w - 25, y: this.y });
    return this;
  }

  /** Grande flaque : trop large et trop freinante pour la traverser en roulant, il faut sauter. */
  bigPuddle(w, star = true) {
    const x0 = this.x;
    this.flat(w);
    this.meta.puddles.push({ piece: this.cur.name, x0: x0 + 25, x1: x0 + w - 25, y: this.y, big: true });
    if (star) this.meta.stars.push({ x: x0 + w / 2, y: this.y - 165 });
    return this;
  }

  /**
   * Obstacle posé sur un replat, qu'on ne passe qu'en sautant : rocher, tronc couché,
   * gros tas de feuilles (automne), gros tas de neige (hiver). Étoile au-dessus.
   */
  obstacle(kind, star = true) {
    const size = { rock: [96, 84], trunk: [150, 66], leaves: [230, 92], snow: [230, 98] }[kind];
    this.flat(140);
    const x = this.x + size[0] / 2;
    this.meta.obstacles.push({ kind, piece: this.cur.name, x, y: this.y, w: size[0], h: size[1] });
    if (star) this.meta.stars.push({ x, y: this.y - Math.min(185, size[1] + 95) });
    return this.flat(size[0] + 150);
  }

  /** Escalier de n marches : chaque marche est un petit plateau ; on monte en sautant. Étoile en haut. */
  stairs(n = 3, stepW = 150, stepH = 72, star = true) {
    this.flat(120);
    const x0 = this.x, y0 = this.y;
    for (let k = 1; k <= n; k++) {
      const a = x0 + (k - 1) * stepW, b = x0 + k * stepW + (k === n ? 70 : 0), top = y0 - stepH * k;
      this.platform(a, b, top, { wall: true, ground: y0 });
    }
    if (star) this.meta.stars.push({ x: x0 + n * stepW - 20, y: y0 - stepH * n - 120 });
    return this.flat(n * stepW + 260);
  }

  /** Plateformes au-dessus d'une fosse : on saute de l'une à l'autre (ou on file assez vite pour enchaîner). */
  platforms(n = 3, w = 150, gap = 120, star = true) {
    const x0 = this.x, y0 = this.y, total = n * w + (n + 1) * gap;
    this.slope(160, 170).flat(total - 320).slope(160, -170);
    for (let k = 0; k < n; k++) {
      const a = x0 + gap + k * (w + gap);
      this.platform(a, a + w, y0, { wall: false });
    }
    if (star) this.meta.stars.push({ x: x0 + gap + Math.floor(n / 2) * (w + gap) + w / 2, y: y0 - 150 });
    return this;
  }

  /** Plateau indépendant de la route (une marche, une plateforme). */
  platform(a, b, top, { wall, ground } = {}) {
    const name = `p${this.platformCount++}`;
    this.meta.pieces.push({ name, pts: [[a, top], [(a + b) / 2, top], [b, top]], prev: [a - 40, top], next: [b + 40, top], platform: true });
    if (wall) this.meta.obstacles.push({ kind: 'step', piece: null, x: (a + b) / 2, y: ground, w: b - a, h: ground - top, top });
  }

  /** Étoile libre (dx, dy par rapport à la route au curseur). */
  star(dx = 0, dy = 170) {
    this.meta.stars.push({ x: this.x + dx, y: this.y - dy });
    return this;
  }

  bonus(color, dx = 0) {
    this.meta.bonuses.push({ piece: this.cur.name, x: this.x + dx, color });
    return this;
  }

  /** Va en douceur jusqu'au point (x, y). */
  to(x, y) {
    // jamais de mur : au moins 2,4 px de long par px de dénivelé (quitte à déborder un peu)
    const w = Math.max(x - this.x, Math.abs(y - this.y) * 2.4);
    if (w < 30) return this;
    return this.slope(w, y - this.y);
  }

  checkpoint(level) {
    this.meta.checkpoints[level] = { piece: this.cur.name, x: this.x + 30 };
    return this;
  }

  /**
   * Aiguillage sur une largeur w : deux chemins qui partent à plat et se rejoignent à plat.
   * low(b) / high(b) posent le contenu de chaque chemin. Le chemin du haut est un pont.
   */
  fork(w, low, high, labels) {
    this.flat(90);
    const F = [this.x, this.y], F0 = this.cur.pts[this.cur.pts.length - 2], i = this.forkCount++;
    const seg = this.cur.name, em = [F[0] + w, F[1]];
    this.cur.next = [F[0] + 40, F[1]];
    const branch = (name, lead, fill, tail) => {
      this.open(name, [F, [F[0] + lead, F[1]]], F0);
      fill(this);
      if (this.x > em[0] - tail - 70) throw new Error(`aiguillage ${i} : le chemin ${name} est trop long de ${Math.round(this.x - (em[0] - tail - 70))} px`);
      this.to(em[0] - tail - 60, F[1]);
      this.add(em[0] - tail, F[1]).add(em[0], em[1]);
      this.cur.next = [em[0] + 40, em[1]];
    };
    branch(`f${i}a`, 30, low, 45);
    branch(`f${i}b`, 60, high, 22);
    this.meta.bridges.push(`f${i}b`);
    const after = `s${i + 2}`;
    this.meta.forks.push({ x: F[0], y: F[1], seg, a: `f${i}a`, b: `f${i}b`, after, labels: labels || ['↘ Chemin du bas', '↗ Chemin du haut'] });
    this.open(after, [em, [em[0] + 40, em[1]]], [em[0] - 40, em[1]]);
    return this;
  }
}

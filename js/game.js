/**
 * Règles qui donnent un but au parcours :
 * - trois étoiles au crayon par niveau (dans les loopings, au-dessus des obstacles, sur les
 *   chemins risqués) ;
 * - enchaînements : looping, saut réussi, obstacle franchi, bonus, étoile, atterrissage parfait,
 *   à moins de 3 s d'écart, multiplient les points (×2, ×3…) ;
 * - médaille de temps par niveau (or, argent, bronze) et petit bilan en passant au niveau suivant ;
 * - fantôme : la boule grise de ton meilleur passage dans chaque niveau ;
 * - boules à débloquer avec les étoiles, chacune avec sa physique.
 */
import { SHEET, SHEETS, STARS, BALL_R } from './track.js';
import { biomeOfSheet } from './biomes.js';
import { save } from './save.js';
import { twoAtlases, drawSprite } from './sprites.js';

const R = BALL_R;
const COMBO_WINDOW = 3;     // s
export const POINTS = { loop: 100, jump: 150, over: 60, bonus: 50, star: 200, perfect: 80 };
const WORDS = { loop: 'looping', jump: 'saut', over: 'obstacle', bonus: 'bonus', star: 'étoile', perfect: 'parfait' };

/** Temps des médailles par niveau (s) : plus large en hiver et aux aiguillages. */
export function medalTimes(level) {
  const b = biomeOfSheet(level), fork = [3, 6, 10, 14].includes(level);
  const base = 16 + (b.snow ? 6 : 0) + (fork ? 6 : 0);
  return { or: base, argent: base * 1.7, bronze: base * 3 };
}

export function medalOf(level, t) {
  const m = medalTimes(level);
  return t <= m.or ? 'or' : t <= m.argent ? 'argent' : t <= m.bronze ? 'bronze' : null;
}

/** Les boules : acier (de départ), puis débloquées par le total d'étoiles. */
export const SKINS = [
  { id: 'acier', name: 'Bille d’acier', stars: 0, text: 'La boule du dessin.', phys: {} },
  { id: 'verre', name: 'Bille de verre', stars: 8, text: 'Légère : saute plus haut, sent davantage le vent.', phys: { hop: 1200, wind: 1.5, rollRes: 0.8 } },
  { id: 'petanque', name: 'Boule de pétanque', stars: 18, text: 'Lourde : traverse les tas de feuilles et de neige, peu gênée par le vent et l’eau.', phys: { hop: 980, wind: 0.4, puddle: 0.6, crush: true } },
  { id: 'rebond', name: 'Balle rebondissante', stars: 28, text: 'Rebondit sur tout, et saute très haut.', phys: { hop: 1350, restitution: 0.75, bounceMin: 150 } },
  { id: 'couleurs', name: 'Boule aux crayons de couleur', stars: 40, text: 'Pour la beauté du geste : elle change de couleur en roulant.', phys: {} },
];

const BASE_PHYS = { hop: 1050, restitution: 0.32, bounceMin: 380, rollRes: 1, wind: 1, puddle: 1, crush: false };
export const skinPhys = (id) => ({ ...BASE_PHYS, ...(SKINS.find((s) => s.id === id) || SKINS[0]).phys });

export function totalStars() {
  return Object.values(save.levels).reduce((n, l) => n + (l.stars || 0), 0);
}

export class Game {
  constructor() {
    this.stars = STARS.map((s) => ({ ...s, level: Math.floor(s.x / SHEET), got: false, t: 0 }));
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.bestCombo = 0;
    this.levelBestCombo = 0;
    this.level = 0;
    this.levelTime = 0;
    this.ghostRec = [];
    this.ghostClock = 0;
    for (const s of this.stars) s.got = false;
    this.loadGhost(0);
  }

  /** Repart au début d'un niveau (reprise) : ses étoiles redeviennent à prendre. */
  enterLevel(k, fresh = true) {
    this.level = k;
    this.levelTime = 0;
    this.levelBestCombo = 0;
    this.ghostRec = [];
    this.ghostClock = 0;
    if (fresh) for (const s of this.stars) if (s.level === k) s.got = false;
    this.loadGhost(k);
  }

  starsIn(k) {
    return this.stars.filter((s) => s.level === k && s.got).length;
  }

  /** Un exploit : points × multiplicateur d'enchaînement. Renvoie le multiplicateur. */
  feat(kind) {
    this.combo = this.comboTime > 0 ? this.combo + 1 : 1;
    this.comboTime = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.levelBestCombo = Math.max(this.levelBestCombo, this.combo);
    this.score += POINTS[kind] * this.combo;
    this.lastFeat = WORDS[kind];
    return this.combo;
  }

  /** À chaque image : temps du niveau, fin d'enchaînement, étoiles touchées, fantôme. */
  update(dt, ball) {
    this.levelTime += dt;
    if (this.comboTime > 0) {
      this.comboTime -= dt;
      if (this.comboTime <= 0 || (ball.onTrack && Math.abs(ball.v) < 40)) { this.comboTime = 0; this.combo = 0; }
    }
    let got = null;
    for (const s of this.stars) {
      s.t += dt;
      if (!s.got && Math.abs(ball.x - s.x) < 80 && Math.hypot(ball.x - s.x, ball.y - s.y) < R + 34) {
        s.got = true;
        got = s;
      }
    }
    this.ghostClock += dt;
    if (this.ghostRec.length < 4000 && this.ghostClock >= this.ghostRec.length / 20) this.ghostRec.push(Math.round(ball.x), Math.round(ball.y));
    return got;
  }

  /** Fin d'un niveau : médaille, records, fantôme du meilleur passage. Renvoie le bilan. */
  finishLevel(k) {
    const time = this.levelTime, stars = this.starsIn(k), medal = medalOf(k, time);
    const rec = save.levels[k] || {};
    const best = { stars: Math.max(rec.stars || 0, stars), time: Math.min(rec.time ?? Infinity, time) };
    const rank = { or: 3, argent: 2, bronze: 1 };
    best.medal = (rank[medal] || 0) > (rank[rec.medal] || 0) ? medal : rec.medal || null;
    const newRecord = time < (rec.time ?? Infinity);
    save.setLevel(k, best, newRecord ? this.ghostRec.slice() : null);
    return { level: k, time, stars, medal, combo: this.levelBestCombo, newRecord };
  }

  loadGhost(k) {
    this.ghost = save.ghost(k);
  }

  /** Position du fantôme au temps du niveau, ou null. */
  ghostAt() {
    const g = this.ghost;
    if (!g || g.length < 4) return null;
    const f = this.levelTime * 20, i = Math.min(g.length / 2 - 2, Math.floor(f)), u = Math.min(1, f - i);
    if (i < 0) return null;
    return [g[i * 2] + (g[i * 2 + 2] - g[i * 2]) * u, g[i * 2 + 1] + (g[i * 2 + 3] - g[i * 2 + 1]) * u];
  }

  /**
   * Étoiles au crayon : qui tournent doucement, scintillent, et s'envolent quand on les prend.
   * L'étoile (lueur, corps, reflet) est dessinée une fois (starAtlas), puis posée tournée et agrandie :
   * une image par étoile au lieu d'un dégradé, d'un remplissage et de deux traits à chaque image.
   */
  drawStars(ctx, x0, x1, t) {
    let M = null, A = null;
    for (const s of this.stars) {
      if (s.x < x0 - 60 || s.x > x1 + 60) continue;
      if (s.got && s.t > 0.8) continue;
      if (!M) { ctx.save(); M = ctx.getTransform(); A = starAtlas(Math.hypot(M.a, M.b)); }
      const k = 1 + 0.08 * Math.sin(t * 4 + s.x);
      ctx.globalAlpha = s.got ? Math.max(0, 1 - s.t / 0.8) : 1;
      drawSprite(ctx, M, A, 0, s.x, s.y - (s.got ? s.t * 120 : 0), Math.sin(t * 1.3 + s.x) * 0.25 + (s.got ? s.t * 6 : 0), k, k);
    }
    if (M) ctx.restore();
  }

  /** Fantôme : boule grise translucide de ton meilleur passage. */
  drawGhost(ctx) {
    const p = this.ghostAt();
    if (!p) return;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#9ea3ab';
    ctx.strokeStyle = '#5b5f66';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(p[0], p[1], R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** L'étoile, dessinée une fois, centrée : lueur, corps doré, petit reflet. */
const starAtlas = twoAtlases(() => [{
  w: 92, h: 92,
  draw(g) {
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, 'rgba(255,220,90,0.45)');
    glow.addColorStop(1, 'rgba(255,220,90,0)');
    g.fillStyle = glow;
    g.fillRect(-46, -46, 92, 92);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 11 : 26;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = 'rgba(245,200,60,0.92)';
    g.fill();
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.strokeStyle = '#b8862b';
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-6, -12);
    g.lineTo(-2, -18);
    g.stroke();
  },
}]);

export const LEVEL_COUNT = SHEETS - 1;

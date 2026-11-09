/**
 * La balade aux crayons de couleur (niveaux 1 à 3) : un seul paysage continu,
 * sans raccord d'un niveau à l'autre. Chaque plan est une bande unique qui court sous tous les
 * niveaux en couleurs ; plus un plan est loin, plus il suit la caméra (q : part du mouvement de la
 * caméra qu'il suit), donc moins il glisse à l'écran.
 *   5. le ciel (texture fournie : bleu foncé en haut, presque blanc en bas ; bande qui se raccorde
 *      sur elle-même, sans miroir), sur les trois premiers niveaux ; le soleil qui brille, de petits nuages ;
 *   4. les nuages : nuages.js, sur tout le parcours ;
 *   3. les montagnes : montagnes.js, sur tout le parcours ;
 *   3. une seule bande de champs : ceux du niveau 1 (charrette, pailles, moulin aux ailes qui
 *      tournent), puis la ferme du niveau 2 et ses cochons, puis la bande du niveau 3 (ferme, lac,
 *      château), raccordée à la ferme par une couture qui suit le dessin (tools/decouper-niveau3.py) ;
 *   2. la terre (texture) et la route, peintes dans les feuilles (ink.js : paintBalade) ;
 *   1. l'herbe du premier plan : herbe.js, sur tout le parcours.
 * Images : images/niveau0/ (niveau 1) et images/balade/ (tools/decouper-balade.py).
 */
import { SHEET, WORLD } from './track.js';
import { DESSIN1 } from './niveau1-route.js';

/** Feuilles de la balade en couleurs. */
export const STYLE_SHEETS = new Set([0, 1, 2]);
const Z1 = 3 * SHEET; // fin de la balade en couleurs (niveaux 1 à 3)
const K = DESSIN1.K, OY = DESSIN1.offY;

const img = {};
function load(key, src) {
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
  img[key] = i;
}
for (const n of ['terre', 'champs', 'ferme', 'cochon']) load(n, `images/balade/${n}.webp`);
load('bande3', 'images/niveau3/bande.webp');
for (const n of ['soleil', 'tour', 'ailes']) load(n, `images/niveau0/${n}.webp`);
const ok = (i) => i && i.complete && i.naturalWidth > 0;
let geo = null, meta = null, n3 = null;
fetch('images/niveau3/niveau3.json').then((r) => r.json()).then((g) => (n3 = g)).catch(() => {});
fetch('images/niveau0/geo.json').then((r) => r.json()).then((g) => (geo = g)).catch(() => {});
fetch('images/balade/balade.json').then((r) => r.json()).then((g) => (meta = g)).catch(() => {});
/** Résolu quand la texture de terre est chargée (les feuilles sont alors redessinées avec elle). */
export const baladeLoaded = new Promise((done) => {
  const i = img.terre;
  if (i.complete) done();
  else i.onload = i.onerror = () => done();
});

/** Part de la balade en couleurs à l'abscisse x (pour les décors au crayon : feuilles, coutures). */
export function colourWeight(x) {
  return x >= 0 && x < 3 * SHEET ? 1 : 0; // le ciel couvre les trois premiers niveaux : pas de bord de feuille
}

/* ---------- outils ---------- */

const mirrors = new Map();
function mirror(i) {
  if (!mirrors.has(i)) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext('2d');
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(i, 0, 0);
    mirrors.set(i, c);
  }
  return mirrors.get(i);
}
/** Tuile 2 × 2 en miroir : se répète sans aucun raccord. */
const tiles = new Map();
function tile2(i) {
  if (!tiles.has(i)) {
    const w = i.naturalWidth, h = i.naturalHeight, c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const t = c.getContext('2d');
    for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      t.save();
      t.translate(fx < 0 ? w * 2 : 0, fy < 0 ? h * 2 : 0);
      t.scale(fx, fy);
      t.drawImage(i, 0, 0);
      t.restore();
    }
    tiles.set(i, c);
  }
  return tiles.get(i);
}
/** Copie dont le bord gauche (part de la largeur) s'efface : pour raccorder deux dessins d'un même plan. */
const softs = new Map();
function softLeft(i, part) {
  if (!softs.has(i)) {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth || i.width; c.height = i.naturalHeight || i.height;
    const g = c.getContext('2d');
    g.drawImage(i, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createLinearGradient(0, 0, c.width * part, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    softs.set(i, c);
  }
  return softs.get(i);
}
/** Une bande répétée à l'endroit puis en miroir, de x0 à x1 (largeur w, hauteur h, en haut à y). */
function band(g, i, ox, y, w, h, x0, x1) {
  for (let k = Math.floor((x0 - ox) / w) - 1; ox + k * w < x1; k++) g.drawImage(k % 2 ? mirror(i) : i, ox + k * w, y, w + 1, h);
}

/* ---------- la terre : texture de la balade, avec la route (appelé par ink.js pour chaque feuille) ---------- */

/** Motif de la texture de terre, en coordonnées du monde (continu d'une feuille à l'autre). */
export function earthPattern(g) {
  if (!ok(img.terre)) return null;
  const p = g.createPattern(img.terre, 'repeat');
  p.setTransform(new DOMMatrix([0.7, 0, 0, 0.7, 0, 0]));
  return p;
}

/* ---------- les cochons (position dans le dessin de la ferme : u en largeur, v en hauteur) ---------- */

const PIGS = [
  { u: 0.3, v: 0.56, w: 95, min: 0.18, max: 0.46, speed: 0.012, dir: 1, wait: 0 },
  { u: 0.55, v: 0.66, w: 115, min: 0.47, max: 0.7, speed: 0.009, dir: -1, wait: 1.5 },
  { u: 0.64, v: 0.47, w: 62, min: 0.58, max: 0.7, speed: 0.006, dir: 1, wait: 3 },
];
function stepPigs(dt) {
  for (const p of PIGS) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    p.u += p.dir * dt * p.speed;
    if (p.u > p.max || p.u < p.min) { p.dir *= -1; p.u = Math.max(p.min, Math.min(p.max, p.u)); p.wait = 2 + Math.random() * 4; }
  }
}

/* ---------- les pailles qui s'envolent de la charrette (repère du dessin du moulin) ---------- */

const straws = [];
let spawn = 0;
const rand = (a, b) => a + Math.random() * (b - a);
function stepStraws(dt, t) {
  spawn -= dt;
  if (spawn <= 0 && straws.length < 16) {
    spawn = rand(0.2, 0.7);
    straws.push({ x: rand(420, 720), y: rand(820, 870), vx: rand(30, 80), vy: rand(-55, -20), a: rand(0, Math.PI), va: rand(-2.5, 2.5),
      len: rand(16, 30), life: 0, max: rand(4, 7), ph: rand(0, 6.3), col: Math.random() < 0.5 ? '#e3b544' : '#c99232' });
  }
  for (let i = straws.length - 1; i >= 0; i--) {
    const p = straws[i];
    p.life += dt;
    if (p.life > p.max) { straws.splice(i, 1); continue; }
    p.vx += (10 + 16 * Math.sin(t * 0.9 + p.ph)) * dt;
    p.vy += (-5 + 26 * Math.sin(t * 1.7 + p.ph * 2)) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
  }
}

/* ---------- placement des plans ---------- */

// Les dessins du niveau 1 : repère du moulin (orig. 2752 px de large, image à 0,75) → monde
const P3 = { k: 2000 / 2682, top: 0 };
const p3y = () => (1440 + 80 - 1536 * (2932 / 2682)) * K + OY; // haut du dessin du moulin
const PX = 2000 / 2012; // un pixel des images du moulin (champs, montagnes) → monde
// la ferme : son horizon (haies, 322 px du haut) sur celui des champs du niveau 1 ; elle prend la suite
const FARM = { f: 1.05, horizon: 322, x: 1500, blend: 260 }; // les champs du niveau 1 s'arrêtent sous la fin du raccord
// parallaxe : part du mouvement de la caméra suivie, et ancre (x où le plan est à sa place)
const Q = { ciel: 0.9, soleil: 0.92, petits: 0.85, nuages: 0.75, montagnes: 0.3, champs: 0.12, herbe: -0.3 };
const ANCHOR = 1200;

/** Le ciel va jusqu'au bout du niveau 3, puis laisse place au papier du niveau 4. */
const SKY_END = 3 * SHEET;
const skyAlpha = (cx) => 1 - Math.max(0, Math.min(1, (cx - SKY_END - 50) / 500));

export class Balade {
  constructor() { this.t = 0; }

  update(dt, cam) {
    this.t += dt;
    if (skyAlpha(cam.x + cam.viewW / 2) <= 0) return;
    stepPigs(dt);
    stepStraws(dt, this.t);
  }

  /** Plans 5, 4 et 3 : derrière la terre et la route. */
  drawFar(ctx, cam) {
    const t = this.t, cx = cam.x + cam.viewW / 2, cy = cam.y + cam.viewH / 2, A = 1, AS = skyAlpha(cx);
    const sx = (q) => q * (cx - ANCHOR), sy = (q) => q * 0.5 * (cy - 716);
    const x0 = cam.x - 4, x1 = cam.x + cam.viewW + 4;
    // le plan des champs s'arrête au bout de la bande du niveau 3 (cachée par la grande bosse du niveau 4)
    const fieldsEnd = sx(Q.champs) + (n3 ? n3.fin : 6600);
    if (AS <= 0.002 && x0 > fieldsEnd) return;
    ctx.save();
    ctx.globalAlpha = AS;
    const g = ctx;
    // (5 · le ciel, commun à tous les niveaux : ciel.js)
    // soleil qui brille (jusqu'au niveau 3)
    if (ok(img.soleil) && AS > 0.002) {
      const i = img.soleil, x = 900 + sx(Q.soleil), y = 330 + sy(Q.soleil), R = 125;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      const halo = g.createRadialGradient(x, y, R * 0.9, x, y, R * (1.7 + 0.2 * pulse));
      halo.addColorStop(0, `rgba(255,214,90,${0.16 + 0.1 * pulse})`);
      halo.addColorStop(1, 'rgba(255,214,90,0)');
      g.fillStyle = halo;
      g.fillRect(x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4);
      const z = (1 + 0.035 * pulse) * 1.36, w = i.naturalWidth * z, h = i.naturalHeight * z;
      g.drawImage(i, x - w / 2, y - h / 2, w, h);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = AS * (0.12 + 0.12 * Math.max(0, Math.sin(t * 2.3)));
      g.drawImage(i, x - w / 2, y - h / 2, w, h);
      g.restore();
    }
    ctx.globalAlpha = 1;
    // petits nuages au loin, puis 4 · les gros nuages devant ; ils dérivent lentement
    // (les nuages, communs à tous les niveaux : nuages.js)
    // (3 · les montagnes, communes à tous les niveaux : montagnes.js)
    // 3 · les champs : niveau 1 (avec charrette et moulin), puis la ferme du niveau 2
    if (meta && ok(img.champs)) {
      const i = img.champs, ox = sx(Q.champs), y0 = p3y() + sy(Q.champs);
      const yc = y0 + meta.champs.top * PX, w = i.naturalWidth * PX, h = i.naturalHeight * PX;
      // à gauche du niveau 1 : son reflet (sans charrette : seulement la moitié de droite)
      g.save();
      g.beginPath(); g.rect(ox - w * 0.55, yc - 400, w * 0.55, h + 800); g.clip();
      g.drawImage(mirror(i), ox - w, yc, w + 1, h);
      g.restore();
      g.save();
      g.beginPath(); g.rect(ox - 2, yc - 400, FARM.x + FARM.blend + 2, h + 800); g.clip();
      g.drawImage(i, ox, yc, w + 1, h);
      g.restore();
      // la ferme prend la suite des champs : son horizon sur celui des champs, raccord progressif
      const f = img.ferme;
      if (ok(f)) {
        const fw = f.naturalWidth * FARM.f, fh = f.naturalHeight * FARM.f;
        const fx = ox + FARM.x, fy = yc + (meta.ligne_haies - meta.champs.top) * PX - FARM.horizon * FARM.f;
        if (fx < x1 && fieldsEnd > x0) {
          g.drawImage(softLeft(f, FARM.blend / fw), fx, fy, fw, fh);
          // niveau 3 : la bande (ferme, lac, château) prend la suite, raccordée au bord droit de la ferme
          // par une couture qui suit le dessin (tools/decouper-niveau3.py) ; même plan que les champs
          if (n3 && ok(img.bande3)) g.drawImage(img.bande3, ox + n3.u0, y0 - p3y() + n3.y0, n3.w, n3.h);
          if (ok(img.cochon)) {
            const pig = img.cochon;
            for (const p of PIGS) {
              const pw = p.w, ph = (pig.naturalHeight * pw) / pig.naturalWidth;
              const px = fx + fw * p.u, py = fy + fh * p.v - ph - (p.wait > 0 ? 0 : Math.abs(Math.sin(t * 6 + p.w)) * 3);
              g.save();
              g.translate(px, py);
              if (p.dir < 0) { g.translate(pw, 0); g.scale(-1, 1); }
              g.rotate(p.wait > 0 ? 0 : Math.sin(t * 6 + p.w) * 0.03);
              g.drawImage(pig, 0, 0, pw, ph);
              g.restore();
            }
          }
        }
      }
      // le moulin (devant la ferme qui commence derrière lui) : la tour, puis les ailes qui tournent ; et les pailles de la charrette
      if (geo && geo.moulin2) {
        const m2 = geo.moulin2;
        g.save();
        g.transform(P3.k, 0, 0, P3.k, ox, y0);
        if (ok(img.tour)) g.drawImage(img.tour, m2.tour[0], m2.tour[1], m2.tour[2], m2.tour[3]);
        if (ok(img.ailes)) {
          g.save();
          g.translate(m2.moyeu[0], m2.moyeu[1]);
          g.rotate(t * 0.55);
          g.drawImage(img.ailes, -m2.ailes / 2, -m2.ailes / 2, m2.ailes, m2.ailes);
          g.restore();
        }
        g.lineCap = 'round';
        for (const p of straws) {
          const a = Math.min(1, p.life / 0.6, (p.max - p.life) / 1.2), dx = (Math.cos(p.a) * p.len) / 2, dy = (Math.sin(p.a) * p.len) / 2;
          g.globalAlpha = A * 0.95 * a;
          g.strokeStyle = p.col;
          g.lineWidth = 3.2;
          g.beginPath();
          g.moveTo(p.x - dx, p.y - dy);
          g.quadraticCurveTo(p.x + dy * 0.25, p.y - dx * 0.25, p.x + dx, p.y + dy);
          g.stroke();
        }
        g.globalAlpha = A;
        g.restore();
      }
    }
    ctx.restore();
  }
}

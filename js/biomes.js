/**
 * Saisons (biomes), quatre niveaux chacune, puis l'arrivée :
 * - été (1-4) : soleil, herbe verte, buissons, arbres, fleurs ;
 * - automne (5-8) : feuilles mortes, vent en rafales qui gêne l'avancée ;
 * - hiver (9-12) : neige, route glacée : la boule glisse, va plus vite, se contrôle moins bien,
 *   et revenir en arrière est difficile ;
 * - pluie (13-16) : pluie, flaques qui freinent, fosses pleines d'eau ;
 * - arrivée (17) : fin du parcours au soleil couchant, arc-en-ciel.
 */
import { SHEET, SHEETS } from './levels.js';

export const BIOMES = {
  ete: {
    name: 'Été', grass: ['#7fb346', '#8a8a8e'], road: null, sky: null, clouds: 'white',
    roll: 5 / 7, rollRes: 0.018, control: 1, backControl: 1, spin: 1,
  },
  automne: {
    name: 'Automne', grass: ['#c98a35', '#b5562d', '#8a8a8e', '#9b7a3a'], road: null, sky: 'rgba(235,170,90,0.10)', clouds: 'white',
    roll: 5 / 7, rollRes: 0.018, control: 1, backControl: 1, spin: 1, wind: true,
  },
  hiver: {
    name: 'Hiver', grass: ['#a9bccf', '#c6d3df'], road: '#9cc3e0', sky: 'rgba(175,205,235,0.16)', clouds: 'white', snow: true,
    // glisse plus qu'elle ne roule : accélère comme un patin (g·sinθ), presque sans frottement
    roll: 0.92, rollRes: 0.0035, control: 0.6, backControl: 0.3, spin: 0.25,
  },
  pluie: {
    name: 'Pluie', grass: ['#5e8a4a', '#7d8c9a', '#6f7f6a'], road: null, sky: 'rgba(95,105,120,0.17)', clouds: 'grey', rain: true,
    roll: 5 / 7, rollRes: 0.02, control: 1, backControl: 1, spin: 1,
  },
  arrivee: {
    name: 'Arrivée', grass: ['#7fb346', '#8a8a8e'], road: null, sky: 'rgba(250,185,120,0.12)', clouds: 'white',
    roll: 5 / 7, rollRes: 0.018, control: 1, backControl: 1, spin: 1,
  },
};

const ORDER = ['ete', 'automne', 'hiver', 'pluie'];

export function biomeOfSheet(k) {
  if (k >= SHEETS - 1) return BIOMES.arrivee;
  return BIOMES[ORDER[Math.max(0, Math.min(3, Math.floor(k / 4)))]];
}

export function biomeAt(x) {
  return biomeOfSheet(Math.floor(x / SHEET));
}

/**
 * Vent d'automne (px/s², vers la droite si positif) : plutôt de face, en rafales douces,
 * avec des accalmies où il pousse dans le dos ; au plus un cinquième de la gravité.
 */
export function windAt(t) {
  const w = -160 + 230 * Math.sin(t * 0.37) + 110 * Math.sin(t * 1.13 + 2) + 40 * Math.sin(t * 3.1);
  return Math.max(-480, Math.min(260, w)); // rafales plafonnées
}

/* ---------- passages de saison en fondu ---------- */

const BLEND = 450; // px de part et d'autre de la jonction entre deux saisons

/** Deux saisons et la part t de la seconde, en x (t = 0 loin des jonctions). */
export function biomeMix(x) {
  const k = Math.floor(x / SHEET), a = biomeOfSheet(k), local = x - k * SHEET;
  if (local < BLEND && k > 0) {
    const prev = biomeOfSheet(k - 1);
    if (prev !== a) return { a: prev, b: a, t: 0.5 + (0.5 * local) / BLEND };
  }
  if (local > SHEET - BLEND && k < SHEETS - 1) {
    const next = biomeOfSheet(k + 1);
    if (next !== a) return { a, b: next, t: (0.5 * (local - (SHEET - BLEND))) / BLEND };
  }
  return { a, b: a, t: 0 };
}

const lerp = (u, v, t) => u + (v - u) * t;

/** Réglages physiques de la saison en x, mélangés près des jonctions (glace, vent, pluie progressifs). */
export function biomeParams(x) {
  const { a, b, t } = biomeMix(x);
  const out = {};
  for (const key of ['roll', 'rollRes', 'control', 'backControl', 'spin']) out[key] = lerp(a[key], b[key], t);
  out.wind = lerp(a.wind ? 1 : 0, b.wind ? 1 : 0, t);
  out.snow = lerp(a.snow ? 1 : 0, b.snow ? 1 : 0, t);
  out.rain = lerp(a.rain ? 1 : 0, b.rain ? 1 : 0, t);
  return out;
}

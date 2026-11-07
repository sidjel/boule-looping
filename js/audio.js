/**
 * Sons du jeu, tous fabriqués dans le navigateur (Web Audio) : aucun fichier, aucun droit.
 *
 * Pour rester fluide sur téléphone :
 * - la musique est composée UNE fois, hors temps réel (OfflineAudioContext), en morceaux
 *   qui sont ensuite rejoués en boucle : plus aucun oscillateur ni réverbération en direct ;
 * - le contexte audio demande de grands tampons (latencyHint « playback ») ;
 * - le roulement et le vent ne sont réglés que 20 fois par seconde ;
 * - l'écho des clochettes est un simple retard, pas une réverbération.
 *
 * Musique : petite pièce douce et mélancolique en la mineur (piano feutré, nappe, basse),
 * trois tours de huit mesures avec une mélodie qui varie, environ 1 min 30 avant de boucler.
 */
import { rng } from './pencil.js';

const BPM = 66, BEAT = 60 / BPM, BAR = BEAT * 4;
// la mineur : Am – F – C – G – Am – F – Em – Am (basse, voicing)
const CHORDS = [
  [45, [57, 60, 64, 71]], [41, [53, 57, 60, 64]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]],
  [45, [57, 60, 64, 69]], [41, [53, 57, 60, 65]], [40, [55, 59, 64, 67]], [45, [57, 60, 64, 71]],
];
const SCALE = [69, 72, 74, 76, 79, 81, 84]; // la pentatonique mineure, aigu
const CYCLES = 3, CHUNK_BARS = 4, MUSIC_RATE = 22050, TAIL = 3, MUSIC_LEVEL = 0.8;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Sound {
  constructor() {
    this.ac = null;
    this.musicOn = true;
    this.lastUpdate = 0;
    this.musicLevel = MUSIC_LEVEL;
    this.sfxLevel = 1;
    try { this.musicOn = localStorage.getItem('boule-musique') !== 'non'; } catch { /* pas de stockage */ }
  }

  unlock() {
    if (this.ac) return void (this.ac.state === 'suspended' && this.ac.resume());
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ac;
    try { ac = new AC({ latencyHint: 'playback' }); } catch { ac = new AC(); }
    this.ac = ac;
    ac.resume?.();
    // un son vide joué pendant le geste déverrouille l'audio sur les anciens iPhone
    const silent = ac.createBufferSource();
    silent.buffer = ac.createBuffer(1, 1, 22050);
    silent.connect(ac.destination);
    silent.start(0);
    setTimeout(() => this.build(), 0);
  }

  build() {
    const ac = this.ac;
    // sortie générale ← bruitages (master) + musique (musicBus) : deux volumes réglables
    this.out = ac.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(ac.destination);
    this.master = ac.createGain();
    this.master.gain.value = this.sfxLevel;
    this.master.connect(this.out);
    // écho léger pour les clochettes
    this.echo = ac.createDelay(1);
    this.echo.delayTime.value = 0.23;
    const fb = ac.createGain(), tone = ac.createBiquadFilter();
    fb.gain.value = 0.32;
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    this.echo.connect(tone).connect(fb).connect(this.echo);
    tone.connect(this.master);
    this.musicBus = ac.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.out);
    this.noise = noiseBuffer(ac);
    this.buildRoll();
    this.renderMusic();
  }

  /**
   * Compose la musique hors temps réel, par morceaux de quatre mesures (avec leur queue de
   * réverbération). Le premier morceau joue dès qu'il est prêt ; les suivants se préparent
   * pendant ce temps, puis la suite complète tourne en boucle, calée à l'échantillon près.
   */
  async renderMusic() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    const total = CHORDS.length * CYCLES, count = total / CHUNK_BARS;
    this.chunks = new Array(count);
    this.chunkLen = CHUNK_BARS * BAR;
    this.nextChunk = 0;
    this.nextTime = 0;
    this.musicTimer = setInterval(() => this.feed(), 500);
    for (let c = 0; c < count; c++) {
      const off = new OAC(1, Math.ceil((this.chunkLen + TAIL) * MUSIC_RATE), MUSIC_RATE);
      const bus = off.createGain(), reverb = off.createConvolver(), wet = off.createGain();
      reverb.buffer = impulse(off, 2.2);
      wet.gain.value = 0.45;
      bus.connect(off.destination);
      bus.connect(reverb).connect(wet).connect(off.destination);
      for (let k = 0; k < CHUNK_BARS; k++) playBar(off, bus, c * CHUNK_BARS + k, k * BAR);
      this.chunks[c] = await new Promise((resolve) => {
        off.oncomplete = (e) => resolve(e.renderedBuffer);
        const p = off.startRendering();
        if (p && p.then) p.then(resolve);
      });
      if (c === 0) {
        this.nextTime = this.ac.currentTime + 0.1;
        this.musicReady = true;
        if (this.musicOn) this.musicBus.gain.setTargetAtTime(this.musicLevel, this.ac.currentTime, 0.8);
        this.feed();
      }
    }
  }

  /** Programme les morceaux à jouer dans les prochaines secondes (marge large : pas d'à-coups). */
  feed() {
    if (!this.musicReady) return;
    const count = this.chunks.length;
    if (this.nextTime < this.ac.currentTime) this.nextTime = this.ac.currentTime + 0.05;
    while (this.nextTime < this.ac.currentTime + 6) {
      const buf = this.chunks[this.nextChunk % count];
      if (!buf) return; // pas encore composé : on réessaie au prochain passage
      const src = this.ac.createBufferSource();
      src.buffer = buf;
      src.connect(this.musicBus);
      src.start(this.nextTime);
      this.nextTime += this.chunkLen;
      this.nextChunk++;
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    try { localStorage.setItem('boule-musique', this.musicOn ? 'oui' : 'non'); } catch { /* rien */ }
    if (this.musicBus && this.musicReady) this.musicBus.gain.setTargetAtTime(this.musicOn ? this.musicLevel : 0, this.ac.currentTime, 0.4);
    return this.musicOn;
  }

  /** Volumes (0 à 1) de la musique et des bruitages, depuis les options. */
  setVolumes(music, sfx) {
    this.musicLevel = MUSIC_LEVEL * music / 0.8;
    this.sfxLevel = sfx;
    if (!this.ac || !this.master) return;
    const t = this.ac.currentTime;
    this.master.gain.setTargetAtTime(sfx, t, 0.1);
    if (this.musicReady) this.musicBus.gain.setTargetAtTime(this.musicOn ? this.musicLevel : 0, t, 0.2);
  }

  /** Chaîne du roulement et du vent, réglée par update(). */
  buildRoll() {
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    const ring = ac.createBiquadFilter();
    ring.type = 'peaking';
    ring.frequency.value = 3300;
    ring.Q.value = 6;
    ring.gain.value = 6;
    const rumble = ac.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 260;
    this.rollGain = ac.createGain();
    this.rollGain.gain.value = 0;
    this.rumbleGain = ac.createGain();
    this.rumbleGain.gain.value = 0;
    const wobble = ac.createGain();
    wobble.gain.value = 0.75;
    this.wobbleOsc = ac.createOscillator();
    const depth = ac.createGain();
    depth.gain.value = 0.25;
    this.wobbleOsc.connect(depth).connect(wobble.gain);
    src.connect(band).connect(ring).connect(this.rollGain).connect(wobble).connect(this.master);
    src.connect(rumble).connect(this.rumbleGain).connect(wobble);
    this.band = band;
    const wind = ac.createBiquadFilter();
    wind.type = 'bandpass';
    wind.Q.value = 0.6;
    this.windGain = ac.createGain();
    this.windGain.gain.value = 0;
    src.connect(wind).connect(this.windGain).connect(this.master);
    this.wind = wind;
    // pluie : souffle aigu continu
    const rainHP = ac.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 1800;
    this.rainGain = ac.createGain();
    this.rainGain.gain.value = 0;
    src.connect(rainHP).connect(this.rainGain).connect(this.master);
    src.start();
    this.wobbleOsc.start();
  }

  /**
   * @param {number} speed px/s @param {boolean} rolling boule sur la route
   * @param {{ice?:boolean, rain?:boolean, gust?:number}} env saison sous la boule
   */
  update(speed, rolling, env = {}) {
    if (!this.rollGain) return;
    const now = performance.now();
    if (now - this.lastUpdate < 50) return;
    this.lastUpdate = now;
    const t = this.ac.currentTime, k = Math.min(1, speed / 1600);
    const roll = rolling && speed > 15 ? 0.09 * k ** 0.8 : 0;
    // sur la glace : glissement plus clair, presque pas de grondement
    this.rollGain.gain.setTargetAtTime(roll * (env.ice ? 0.8 : 1), t, 0.06);
    this.rumbleGain.gain.setTargetAtTime(roll * (env.ice ? 0.3 : 1.6), t, 0.06);
    this.band.frequency.setTargetAtTime((env.ice ? 2600 : 1400) + 2600 * k, t, 0.1);
    this.rainGain.gain.setTargetAtTime(env.rain ? 0.045 : 0, t, 0.8);
    this.wobbleOsc.frequency.setTargetAtTime(Math.max(0.5, speed / 188), t, 0.1);
    const w = Math.max(0, Math.min(1, (speed - 1100) / 1800));
    const gust = Math.min(1, Math.abs(env.gust || 0) / 800);
    this.windGain.gain.setTargetAtTime(0.11 * w * w + 0.07 * gust * gust, t, 0.15);
    this.wind.frequency.setTargetAtTime(500 + 1500 * w, t, 0.15);
  }

  /** Choc acier sur la route. */
  clink(power) {
    if (!this.master) return;
    const now = performance.now();
    if (now - (this.lastClink || 0) < 80) return;
    this.lastClink = now;
    this.bell([2950, 4410], [0.14, 0.08], Math.min(0.18, power / 6000), 0, false);
  }

  /** Looping : deux notes de clochette dans la tonalité de la musique, très douces. */
  loop() {
    if (!this.master) return;
    this.bell([hz(81), hz(81) * 2.76], [1.2, 0.5], 0.07, 0, true);
    this.bell([hz(88), hz(88) * 2.76], [1.5, 0.6], 0.06, 0.16, true);
  }

  /** Boost : souffle qui monte, note qui glisse vers l'aigu, petit scintillement. */
  boost() {
    if (!this.master) return;
    const ac = this.ac, t = ac.currentTime;
    const src = ac.createBufferSource(), band = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noise;
    band.type = 'bandpass';
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(350, t);
    band.frequency.exponentialRampToValueAtTime(3200, t + 0.45);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(band).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.65);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz(57), t);
    o.frequency.exponentialRampToValueAtTime(hz(81), t + 0.35);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.06, t + 0.04);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(og).connect(this.master);
    og.connect(this.echo);
    o.start(t);
    o.stop(t + 0.6);
    this.bell([hz(93), hz(93) * 2.76], [0.6, 0.3], 0.035, 0.3, true);
  }

  /** Son de chaque bonus. */
  bonus(kind) {
    if (!this.master) return;
    if (kind === 'red') return this.boost();
    const ac = this.ac, t = ac.currentTime;
    if (kind === 'blue') {
      // gel : trois clochettes cristallines qui descendent
      [93, 88, 84].forEach((m, i) => this.bell([hz(m), hz(m) * 2.76], [0.7, 0.3], 0.05, i * 0.07, true));
    } else if (kind === 'green') {
      // bond : « boïng » qui monte puis retombe
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(640, t + 0.13);
      o.frequency.exponentialRampToValueAtTime(330, t + 0.38);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.5);
    } else if (kind === 'yellow') {
      // plume : petit arpège aérien
      [76, 81, 88, 93].forEach((m, i) => this.bell([hz(m)], [0.9], 0.045, i * 0.09, true));
    }
  }

  /** Éclaboussure dans une flaque ou dans l'eau. */
  splash(power) {
    if (!this.master) return;
    const ac = this.ac, t = ac.currentTime;
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noise;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.35);
    g.gain.setValueAtTime(Math.min(0.22, power / 5000), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.45);
  }

  jump() {
    if (!this.master) return;
    this.bell([hz(76), hz(76) * 2.76], [1.1, 0.45], 0.06, 0, true);
    this.bell([hz(83), hz(83) * 2.76], [1.4, 0.5], 0.06, 0.12, true);
  }

  bell(freqs, lens, vol, delay, wet) {
    const ac = this.ac, t = ac.currentTime + delay;
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f * (0.995 + Math.random() * 0.01);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol / (i + 1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + lens[i]);
      o.connect(g).connect(this.master);
      if (wet) g.connect(this.echo);
      o.start(t);
      o.stop(t + lens[i] + 0.05);
    });
  }
}

/* ---------- composition (jouée dans le contexte hors temps réel) ---------- */

function playBar(ctx, out, n, t) {
  const [bass, voicing] = CHORDS[n % CHORDS.length], cycle = Math.floor(n / CHORDS.length);
  pad(ctx, out, voicing, t, BAR);
  piano(ctx, out, bass, t, 0.16, 3.5);
  [0, 1.5, 2, 3].forEach((b, i) => piano(ctx, out, voicing[i % voicing.length], t + b * BEAT, 0.09 + (i === 0 ? 0.03 : 0), 2.6));
  // mélodie : rare au premier tour, puis une petite phrase par mesure, différente à chaque tour
  if (cycle === 0 && n % 2 === 0) return;
  const r = rng(1000 + (n % CHORDS.length) + cycle * 17);
  let idx = Math.floor(r() * 4) + 1;
  for (const b of [0.5, 2.5, 3.25]) {
    if (r() < 0.45) continue;
    idx = Math.max(0, Math.min(SCALE.length - 1, idx + Math.round((r() - 0.5) * 3)));
    piano(ctx, out, SCALE[idx], t + b * BEAT + r() * 0.03, 0.11, 3);
  }
}

function piano(ctx, out, midi, t, vel, len) {
  const f = hz(midi), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(10000, 1800 + f);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.012);
  g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  lp.connect(g).connect(out);
  for (const [mul, amp, type] of [[1, 1, 'triangle'], [2, 0.25, 'sine'], [3.01, 0.08, 'sine']]) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type;
    o.frequency.value = f * mul;
    o.detune.value = (Math.random() - 0.5) * 6;
    og.gain.value = amp;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + len + 0.1);
  }
}

function pad(ctx, out, notes, t, len) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.012, t + 1.2);
  g.gain.setValueAtTime(0.012, t + len - 0.6);
  g.gain.linearRampToValueAtTime(0, t + len + 0.8);
  lp.connect(g).connect(out);
  for (const m of notes.slice(0, 3)) {
    for (const d of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = d;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 1);
    }
  }
}

function noiseBuffer(ac) {
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function impulse(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  return b;
}

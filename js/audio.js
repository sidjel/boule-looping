/**
 * Sons du jeu, tous fabriqués dans le navigateur (Web Audio) : aucun fichier, aucun droit.
 * - Musique : petite pièce douce et mélancolique en la mineur, composée ici (piano feutré,
 *   nappe, basse, réverbération), avec une mélodie qui varie d'un tour à l'autre.
 * - Roulement : souffle métallique léger qui suit la vitesse et tremble au rythme de la rotation.
 * - Vent : souffle aigu quand la boule va vite. Tintements : chocs, looping, saut.
 * Le navigateur n'autorise le son qu'après un geste : unlock() est appelé au premier toucher.
 */
import { rng } from './pencil.js';

const BPM = 66, BEAT = 60 / BPM, BAR = BEAT * 4;
// la mineur : Am – F – C – G – Am – F – Em – Am (basse, voicing)
const CHORDS = [
  [45, [57, 60, 64, 71]], [41, [53, 57, 60, 64]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]],
  [45, [57, 60, 64, 69]], [41, [53, 57, 60, 65]], [40, [55, 59, 64, 67]], [45, [57, 60, 64, 71]],
];
const SCALE = [69, 72, 74, 76, 79, 81, 84]; // la pentatonique mineure, aigu
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Sound {
  constructor() {
    this.ac = null;
    this.musicOn = true;
    try { this.musicOn = localStorage.getItem('boule-musique') !== 'non'; } catch { /* pas de stockage */ }
  }

  unlock() {
    if (this.ac) return void (this.ac.state === 'suspended' && this.ac.resume());
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = (this.ac = new AC());
    ac.resume?.();
    // un son vide joué pendant le geste déverrouille l'audio sur les anciens iPhone
    const silent = ac.createBufferSource();
    silent.buffer = ac.createBuffer(1, 1, 22050);
    silent.connect(ac.destination);
    silent.start(0);
    // le reste (tampons de bruit, réverbération) est préparé juste après, hors du geste
    setTimeout(() => this.build(), 0);
  }

  build() {
    const ac = this.ac;
    this.master = ac.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ac.destination);
    this.reverb = ac.createConvolver();
    this.reverb.buffer = impulse(ac, 3.2);
    const wet = ac.createGain();
    wet.gain.value = 0.45;
    this.reverb.connect(wet).connect(this.master);
    this.musicBus = ac.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.8 : 0;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);
    this.noise = noiseBuffer(ac);
    this.buildRoll();
    this.bar = 0;
    this.nextBar = ac.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 200);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    try { localStorage.setItem('boule-musique', this.musicOn ? 'oui' : 'non'); } catch { /* rien */ }
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.8 : 0, this.ac.currentTime, 0.4);
    return this.musicOn;
  }

  /** Programme les mesures à venir (fenêtre de 1,5 s). */
  schedule() {
    const ac = this.ac;
    while (this.nextBar < ac.currentTime + 1.5) {
      this.playBar(this.bar, this.nextBar);
      this.bar++;
      this.nextBar += BAR;
    }
  }

  playBar(n, t) {
    const [bass, voicing] = CHORDS[n % CHORDS.length], cycle = Math.floor(n / CHORDS.length);
    this.pad(voicing, t, BAR);
    this.piano(bass, t, 0.16, 3.5);
    [0, 1.5, 2, 3].forEach((b, i) => this.piano(voicing[i % voicing.length], t + b * BEAT, 0.09 + (i === 0 ? 0.03 : 0), 2.6));
    // mélodie : rare au premier tour, puis une petite phrase par mesure, qui change selon le tour
    if (cycle === 0 && n % 2 === 0) return;
    const r = rng(1000 + (n % CHORDS.length) + (cycle % 3) * 17);
    let idx = Math.floor(r() * 4) + 1;
    for (const b of [0.5, 2.5, 3.25]) {
      if (r() < 0.45) continue;
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + Math.round((r() - 0.5) * 3)));
      this.piano(SCALE[idx], t + b * BEAT + r() * 0.03, 0.11, 3);
    }
  }

  piano(midi, t, vel, len) {
    const ac = this.ac, f = hz(midi);
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800 + f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(g).connect(this.musicBus);
    for (const [mul, amp, type] of [[1, 1, 'triangle'], [2, 0.25, 'sine'], [3.01, 0.08, 'sine']]) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type;
      o.frequency.value = f * mul;
      o.detune.value = (Math.random() - 0.5) * 6;
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + len + 0.1);
    }
  }

  pad(notes, t, len) {
    const ac = this.ac, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012, t + 1.2);
    g.gain.setValueAtTime(0.012, t + len - 0.6);
    g.gain.linearRampToValueAtTime(0, t + len + 0.8);
    lp.connect(g).connect(this.musicBus);
    for (const m of notes.slice(0, 3)) {
      for (const d of [-7, 7]) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = d;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 1);
      }
    }
  }

  /** Chaîne du roulement et du vent, réglée à chaque image par update(). */
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
    ring.Q.value = 9;
    ring.gain.value = 9;
    const rumble = ac.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 260;
    this.rollGain = ac.createGain();
    this.rollGain.gain.value = 0;
    this.rumbleGain = ac.createGain();
    this.rumbleGain.gain.value = 0;
    const wobble = ac.createGain();
    this.wobbleOsc = ac.createOscillator();
    const depth = ac.createGain();
    depth.gain.value = 0.25;
    this.wobbleOsc.connect(depth).connect(wobble.gain);
    wobble.gain.value = 0.75;
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
    src.start();
    this.wobbleOsc.start();
  }

  /** @param {number} speed px/s @param {boolean} rolling boule sur la route */
  update(speed, rolling) {
    if (!this.rollGain) return;
    const t = this.ac.currentTime, k = Math.min(1, speed / 1600);
    const roll = rolling && speed > 15 ? 0.09 * k ** 0.8 : 0;
    this.rollGain.gain.setTargetAtTime(roll, t, 0.05);
    this.rumbleGain.gain.setTargetAtTime(roll * 1.6, t, 0.05);
    this.band.frequency.setTargetAtTime(1400 + 2600 * k, t, 0.08);
    this.wobbleOsc.frequency.setTargetAtTime(Math.max(0.5, speed / 188), t, 0.1);
    const w = Math.max(0, Math.min(1, (speed - 1100) / 1800));
    this.windGain.gain.setTargetAtTime(0.11 * w * w, t, 0.15);
    this.wind.frequency.setTargetAtTime(500 + 1500 * w, t, 0.15);
  }

  /** Choc acier sur la route. */
  clink(power) {
    if (!this.master) return;
    const now = performance.now();
    if (now - (this.lastClink || 0) < 60) return;
    this.lastClink = now;
    const vol = Math.min(0.2, power / 6000);
    this.bell([2950, 4410, 6230], [0.16, 0.09, 0.05], vol, 0, false);
  }

  /** Looping : deux notes de clochette dans la tonalité de la musique, très douces. */
  loop() {
    if (!this.master) return;
    this.bell([hz(81), hz(81) * 2.76], [1.4, 0.6], 0.07, 0, true);
    this.bell([hz(88), hz(88) * 2.76], [1.8, 0.7], 0.06, 0.16, true);
  }

  jump() {
    if (!this.master) return;
    this.bell([hz(76), hz(76) * 2.76], [1.2, 0.5], 0.06, 0, true);
    this.bell([hz(83), hz(83) * 2.76], [1.6, 0.6], 0.06, 0.12, true);
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
      if (wet) g.connect(this.reverb);
      o.start(t);
      o.stop(t + lens[i] + 0.05);
    });
  }
}

function noiseBuffer(ac) {
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function impulse(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds), b = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return b;
}

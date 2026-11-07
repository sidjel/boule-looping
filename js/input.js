/**
 * Entrées : doigt, souris, clavier.
 * - Glisser puis lâcher = lancer : la vitesse du doigt au moment du lâcher donne l'élan.
 * - Toucher bref = saut. Doigt posé sans bouger = pousser doucement la boule vers le doigt.
 * - Clavier : ← → pour pousser, Espace pour lancer, ↑ pour sauter, R pour recommencer.
 */
const WINDOW_MS = 90;
const HOLD_MS = 230;          // doigt posé plus longtemps : on pousse
const TAP_MS = 220;           // toucher plus bref : saut
const HOLD_SLOP = 14;

export class Input {
  constructor(el) {
    this.el = el;
    this.active = null;
    this.flicks = [];
    this.taps = [];
    this.trail = [];
    this.keys = new Set();
    this.resetAsked = false;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', () => { this.active = null; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
  }

  down(e) {
    if (this.active) return;
    e.preventDefault();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
    const p = { x: e.clientX, y: e.clientY, t: e.timeStamp || performance.now() };
    this.active = { id: e.pointerId, start: p, samples: [p], moved: 0, last: p };
    this.trail.push({ ...p, start: true });
  }

  move(e) {
    const a = this.active;
    if (!a || e.pointerId !== a.id) return;
    const list = e.getCoalescedEvents?.();
    const events = list && list.length ? list : [e];
    for (const ev of events) {
      const p = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp || e.timeStamp || performance.now() };
      a.moved = Math.max(a.moved, Math.hypot(p.x - a.start.x, p.y - a.start.y));
      a.samples.push(p);
      a.last = p;
      this.trail.push(p);
    }
    const cut = (e.timeStamp || performance.now()) - 250;
    while (a.samples.length > 2 && a.samples[0].t < cut) a.samples.shift();
  }

  up(e) {
    const a = this.active;
    if (!a || e.pointerId !== a.id) return;
    this.move(e);
    this.active = null;
    // heure de l'événement, pas du traitement : un retard du navigateur ne fausse pas la vitesse
    const now = e.timeStamp || performance.now(), recent = a.samples.filter((p) => now - p.t <= WINDOW_MS);
    if (a.moved < HOLD_SLOP && now - a.start.t < TAP_MS) this.taps.push({ x: a.start.x, y: a.start.y });
    if (recent.length < 2 || a.moved < HOLD_SLOP) return;
    const first = recent[0], last = recent[recent.length - 1];
    const dt = Math.max(16, last.t - first.t) / 1000;
    const vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt;
    if (Math.hypot(vx, vy) > 120) this.flicks.push({ vx, vy });
  }

  key(e, isDown) {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'r', 'R', 'w', 'W'].includes(k)) return;
    e.preventDefault();
    if (isDown && !e.repeat && k === ' ') this.flicks.push({ vx: 2600, vy: 0, keyboard: true });
    if (isDown && (k === 'r' || k === 'R')) this.resetAsked = true;
    if (isDown && !e.repeat && (k === 'ArrowUp' || k === 'w' || k === 'W')) this.hopAsked = true;
    if (isDown) this.keys.add(k); else this.keys.delete(k);
  }

  /** Poussée continue (px/s² monde) : doigt immobile ou flèches. */
  push(ballScreenX) {
    let dir = 0;
    if (this.keys.has('ArrowLeft')) dir -= 1;
    if (this.keys.has('ArrowRight')) dir += 1;
    const a = this.active;
    if (!dir && a && a.moved < HOLD_SLOP && performance.now() - a.start.t > HOLD_MS) {
      const dx = a.last.x - ballScreenX;
      if (Math.abs(dx) > 30) dir = Math.sign(dx);
    }
    return { x: dir * 1500, y: 0 };
  }

  holding() {
    const a = this.active;
    return !!a && a.moved < HOLD_SLOP && performance.now() - a.start.t > HOLD_MS;
  }

  takeTaps() {
    return this.taps.splice(0);
  }

  takeFlicks() {
    return this.flicks.splice(0);
  }

  /** Traînée du geste à dessiner (300 ms). */
  liveTrail() {
    const cut = performance.now() - 300;
    while (this.trail.length && this.trail[0].t < cut) this.trail.shift();
    return this.trail;
  }
}

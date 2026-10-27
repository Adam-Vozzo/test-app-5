// All sound is synthesized with WebAudio. Weapons are layered: transient click + filtered noise body
// + low thump + tail (and any extra layers the def adds). No audio files.
import type { SoundLayer, WeaponDef } from '../weapons/defs';
import { tuning } from '../tuning';

export class Synth {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  /** Separate jitter stream so audio never perturbs gameplay RNG. */
  private seed = 1;

  /** Must be called from a user gesture. */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;
      this.master = this.ctx.createGain();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 1.5);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < len; i++) {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        d[i] = (s / 4294967296) * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  private rand() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private ready() {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    this.master.gain.value = tuning.audio.master;
    return true;
  }

  /** Play one layer at time `t0`, with pitch scale and gain scale. */
  private layer(L: SoundLayer, t0: number, pitch: number, gain: number, pan = 0) {
    const ctx = this.ctx!;
    if (L.gain <= 0 || L.dur <= 0) return;
    const start = t0 + L.delay;
    const end = start + L.attack + L.dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(L.gain * gain, start + Math.max(0.0005, L.attack));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    let out: AudioNode = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(this.master);
    if (L.kind === 'osc') {
      const o = ctx.createOscillator();
      o.type = L.wave;
      o.frequency.setValueAtTime(Math.max(20, L.f0 * pitch), start);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, L.f1 * pitch), end);
      o.connect(g);
      o.start(start);
      o.stop(end + 0.02);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = L.filter;
      f.Q.value = L.q;
      f.frequency.setValueAtTime(Math.max(20, L.f0 * pitch), start);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, L.f1 * pitch), end);
      src.connect(f).connect(g);
      const offset = this.rand() * (this.noise.duration - 0.6);
      src.start(start, offset);
      src.stop(end + 0.02);
    }
  }

  playLayers(layers: Record<string, SoundLayer>, pitch = 1, gain = 1, pan = 0) {
    if (!this.ready()) return;
    const t0 = this.ctx!.currentTime + 0.001;
    for (const k in layers) this.layer(layers[k], t0, pitch, gain, pan);
  }

  shot(w: WeaponDef, pitchMul = 1) {
    const pitch = pitchMul * (1 + (this.rand() * 2 - 1) * w.pitchJitter);
    this.playLayers(w.layers, pitch, w.volume);
  }

  /** Confirmation sounds: distinct hit, crit and kill. */
  hit(kind: 'hit' | 'crit' | 'kill') {
    const a = tuning.audio;
    const p = 1 + (this.rand() - 0.5) * 0.06;
    if (kind === 'hit') this.playLayers(HIT, p, a.hitGain);
    else if (kind === 'crit') this.playLayers(CRIT, p, a.critGain);
    else {
      this.playLayers(CRIT, p * 0.8, a.critGain * 0.6);
      this.playLayers(KILL, p, a.killGain);
    }
  }

  /** Reload foley: 'out' (mag off), 'in' (mag seated), 'rack' (cock), 'pouch' (rustle). */
  reload(kind: 'out' | 'in' | 'rack' | 'pouch') {
    this.playLayers(RELOAD[kind], 1 + (this.rand() - 0.5) * 0.08, tuning.audio.reloadGain);
  }

  footstep() {
    this.playLayers(STEP, 0.85 + this.rand() * 0.3, tuning.audio.footstepGain);
  }

  dry() {
    this.playLayers(RELOAD.dry, 1, tuning.audio.reloadGain);
  }

  /** One-shot effect by name, with optional stereo pan (-1..1) and gain (distance attenuation). */
  sfx(name: SfxName, gain = 1, pan = 0, pitch = 1) {
    this.playLayers(SFX[name], pitch * (1 + (this.rand() - 0.5) * 0.06), gain * tuning.audio.sfxGain, pan);
  }
}

const L = (p: Partial<SoundLayer>): SoundLayer => ({
  kind: 'noise',
  wave: 'sine',
  filter: 'bandpass',
  f0: 1000,
  f1: 1000,
  q: 1,
  attack: 0.001,
  dur: 0.05,
  gain: 0.5,
  delay: 0,
  ...p,
});

// Hit: woody "tock". Crit: bright two-partial "ting". Kill: low crunchy snap.
const HIT = {
  tock: L({ kind: 'osc', wave: 'sine', f0: 720, f1: 420, dur: 0.06, gain: 0.5 }),
  knock: L({ kind: 'noise', filter: 'bandpass', f0: 1600, f1: 1200, q: 3, dur: 0.04, gain: 0.5 }),
};
const CRIT = {
  ting1: L({ kind: 'osc', wave: 'sine', f0: 1960, f1: 1900, dur: 0.16, gain: 0.32 }),
  ting2: L({ kind: 'osc', wave: 'triangle', f0: 2940, f1: 2900, dur: 0.11, gain: 0.16, delay: 0.004 }),
  tick: L({ kind: 'noise', filter: 'highpass', f0: 6000, f1: 6000, dur: 0.012, gain: 0.35 }),
};
const KILL = {
  crunch: L({ kind: 'noise', filter: 'bandpass', f0: 900, f1: 300, q: 0.9, dur: 0.18, gain: 0.7 }),
  drop: L({ kind: 'osc', wave: 'square', f0: 220, f1: 70, dur: 0.16, gain: 0.18 }),
  pop: L({ kind: 'osc', wave: 'sine', f0: 140, f1: 45, dur: 0.22, gain: 0.6 }),
};
const RELOAD: Record<'out' | 'in' | 'rack' | 'pouch' | 'dry', Record<string, SoundLayer>> = {
  out: {
    click: L({ kind: 'noise', filter: 'bandpass', f0: 3200, f1: 2600, q: 4, dur: 0.025, gain: 0.5 }),
    slide: L({ kind: 'noise', filter: 'bandpass', f0: 1200, f1: 1800, q: 2, dur: 0.08, gain: 0.25, delay: 0.02 }),
  },
  in: {
    seat: L({ kind: 'osc', wave: 'sine', f0: 520, f1: 300, dur: 0.05, gain: 0.45 }),
    click: L({ kind: 'noise', filter: 'bandpass', f0: 4200, f1: 3800, q: 5, dur: 0.02, gain: 0.6, delay: 0.01 }),
  },
  rack: {
    pull: L({ kind: 'noise', filter: 'bandpass', f0: 1800, f1: 3500, q: 3, dur: 0.06, gain: 0.35 }),
    snap: L({ kind: 'noise', filter: 'highpass', f0: 3000, f1: 3000, dur: 0.018, gain: 0.6, delay: 0.07 }),
    twang: L({ kind: 'osc', wave: 'triangle', f0: 620, f1: 900, dur: 0.06, gain: 0.18, delay: 0.07 }),
  },
  pouch: {
    rustle: L({ kind: 'noise', filter: 'bandpass', f0: 700, f1: 1100, q: 0.8, dur: 0.12, gain: 0.22 }),
  },
  dry: {
    click: L({ kind: 'noise', filter: 'highpass', f0: 2500, f1: 2500, dur: 0.015, gain: 0.5 }),
  },
};
const STEP = {
  tap: L({ kind: 'noise', filter: 'lowpass', f0: 900, f1: 400, dur: 0.03, gain: 0.6 }),
};

// Enemy telegraphs are pitched so each attack is identifiable by ear before it lands:
// skitterer = rising chirp, spitter = gurgling swell, brute = low growl + stomps.
const SFX = {
  alert: { chirp: L({ kind: 'osc', wave: 'triangle', f0: 900, f1: 1500, dur: 0.12, gain: 0.3 }) },
  windupSkitter: {
    chirp: L({ kind: 'osc', wave: 'square', f0: 1300, f1: 2600, dur: 0.3, gain: 0.08 }),
    click: L({ kind: 'noise', filter: 'highpass', f0: 4000, f1: 4000, dur: 0.02, gain: 0.3, delay: 0.25 }),
  },
  windupSpit: {
    gurgle: L({ kind: 'noise', filter: 'bandpass', f0: 300, f1: 1400, q: 4, dur: 0.75, gain: 0.5 }),
    swell: L({ kind: 'osc', wave: 'sine', f0: 140, f1: 420, dur: 0.75, gain: 0.25 }),
  },
  windupCharge: {
    growl: L({ kind: 'osc', wave: 'sawtooth', f0: 70, f1: 110, dur: 1.15, gain: 0.16, attack: 0.15 }),
    rumble: L({ kind: 'noise', filter: 'lowpass', f0: 300, f1: 500, dur: 1.15, gain: 0.35, attack: 0.2 }),
    stomp1: L({ kind: 'osc', wave: 'sine', f0: 90, f1: 40, dur: 0.18, gain: 0.7, delay: 0.3 }),
    stomp2: L({ kind: 'osc', wave: 'sine', f0: 90, f1: 40, dur: 0.18, gain: 0.8, delay: 0.75 }),
  },
  windupButt: {
    growl: L({ kind: 'osc', wave: 'sawtooth', f0: 95, f1: 60, dur: 0.6, gain: 0.16 }),
    huff: L({ kind: 'noise', filter: 'bandpass', f0: 600, f1: 250, q: 1, dur: 0.5, gain: 0.35 }),
  },
  spit: {
    pop: L({ kind: 'osc', wave: 'sine', f0: 500, f1: 160, dur: 0.12, gain: 0.5 }),
    splat: L({ kind: 'noise', filter: 'bandpass', f0: 1200, f1: 600, q: 1.5, dur: 0.12, gain: 0.4 }),
  },
  splash: {
    splat: L({ kind: 'noise', filter: 'lowpass', f0: 1800, f1: 300, dur: 0.3, gain: 0.7 }),
    blub: L({ kind: 'osc', wave: 'sine', f0: 260, f1: 90, dur: 0.2, gain: 0.4 }),
  },
  lunge: { hiss: L({ kind: 'noise', filter: 'highpass', f0: 2500, f1: 4000, dur: 0.18, gain: 0.35 }) },
  charge: {
    roar: L({ kind: 'osc', wave: 'sawtooth', f0: 120, f1: 70, dur: 0.7, gain: 0.2 }),
    gallop: L({ kind: 'noise', filter: 'lowpass', f0: 400, f1: 200, dur: 1.1, gain: 0.4 }),
  },
  wallhit: {
    crash: L({ kind: 'noise', filter: 'lowpass', f0: 1200, f1: 150, dur: 0.5, gain: 0.9 }),
    thud: L({ kind: 'osc', wave: 'sine', f0: 80, f1: 30, dur: 0.4, gain: 0.9 }),
    ring: L({ kind: 'osc', wave: 'triangle', f0: 1400, f1: 1300, dur: 0.6, gain: 0.08, delay: 0.05 }),
  },
  hurt: { squeak: L({ kind: 'osc', wave: 'triangle', f0: 1200, f1: 700, dur: 0.1, gain: 0.25 }) },
  die: {
    crunch: L({ kind: 'noise', filter: 'bandpass', f0: 1500, f1: 400, q: 1.2, dur: 0.25, gain: 0.6 }),
    squeal: L({ kind: 'osc', wave: 'triangle', f0: 1500, f1: 300, dur: 0.35, gain: 0.2 }),
  },
  armor: {
    tink: L({ kind: 'osc', wave: 'square', f0: 2800, f1: 2700, dur: 0.06, gain: 0.08 }),
    tick: L({ kind: 'noise', filter: 'highpass', f0: 5000, f1: 5000, dur: 0.015, gain: 0.35 }),
  },
  playerHurt: {
    thud: L({ kind: 'osc', wave: 'sine', f0: 180, f1: 60, dur: 0.18, gain: 0.8 }),
    crack: L({ kind: 'noise', filter: 'bandpass', f0: 900, f1: 400, q: 1, dur: 0.14, gain: 0.6 }),
    yelp: L({ kind: 'osc', wave: 'triangle', f0: 700, f1: 420, dur: 0.12, gain: 0.18, delay: 0.02 }),
  },
  playerDie: {
    thud: L({ kind: 'osc', wave: 'sine', f0: 140, f1: 35, dur: 0.6, gain: 0.9 }),
    fall: L({ kind: 'osc', wave: 'triangle', f0: 600, f1: 90, dur: 0.9, gain: 0.25 }),
  },
  dodge: { whoosh: L({ kind: 'noise', filter: 'bandpass', f0: 600, f1: 2400, q: 1.2, dur: 0.22, gain: 0.4 }) },
  roll: { whoosh: L({ kind: 'noise', filter: 'bandpass', f0: 500, f1: 1100, q: 0.9, dur: 0.3, gain: 0.18 }) },
  healStart: { slosh: L({ kind: 'noise', filter: 'bandpass', f0: 700, f1: 1100, q: 2, dur: 0.25, gain: 0.3 }) },
  heal: {
    gulp: L({ kind: 'osc', wave: 'sine', f0: 300, f1: 520, dur: 0.12, gain: 0.45 }),
    shimmer: L({ kind: 'osc', wave: 'sine', f0: 1320, f1: 1980, dur: 0.4, gain: 0.12, delay: 0.08 }),
  },
  pollen: {
    a: L({ kind: 'osc', wave: 'sine', f0: 1046, f1: 1046, dur: 0.12, gain: 0.25 }),
    b: L({ kind: 'osc', wave: 'sine', f0: 1568, f1: 1568, dur: 0.18, gain: 0.22, delay: 0.08 }),
  },
  exhausted: { pant: L({ kind: 'noise', filter: 'bandpass', f0: 900, f1: 500, q: 1.5, dur: 0.25, gain: 0.25 }) },
  // SwordRifle: blade swings, guards, charge economy and the rifle ⇄ sword transform.
  swing: {
    whoosh: L({ kind: 'noise', filter: 'bandpass', f0: 700, f1: 2600, q: 1.4, dur: 0.16, gain: 0.45 }),
    air: L({ kind: 'noise', filter: 'highpass', f0: 3000, f1: 5000, dur: 0.1, gain: 0.15, delay: 0.03 }),
  },
  swingHeavy: {
    whoosh: L({ kind: 'noise', filter: 'bandpass', f0: 400, f1: 1800, q: 1.1, dur: 0.26, gain: 0.6 }),
    hum: L({ kind: 'osc', wave: 'sawtooth', f0: 110, f1: 70, dur: 0.25, gain: 0.12 }),
  },
  bladeHit: {
    chop: L({ kind: 'noise', filter: 'bandpass', f0: 1100, f1: 500, q: 1.2, dur: 0.09, gain: 0.8 }),
    thud: L({ kind: 'osc', wave: 'sine', f0: 150, f1: 55, dur: 0.12, gain: 0.7 }),
  },
  block: {
    clang: L({ kind: 'osc', wave: 'square', f0: 1900, f1: 1750, dur: 0.22, gain: 0.09 }),
    ring: L({ kind: 'osc', wave: 'triangle', f0: 2850, f1: 2800, dur: 0.35, gain: 0.08, delay: 0.004 }),
    hit: L({ kind: 'noise', filter: 'highpass', f0: 2500, f1: 2500, dur: 0.04, gain: 0.6 }),
  },
  chargeGain: {
    a: L({ kind: 'osc', wave: 'sine', f0: 880, f1: 1320, dur: 0.12, gain: 0.22 }),
    b: L({ kind: 'osc', wave: 'triangle', f0: 1760, f1: 1760, dur: 0.18, gain: 0.08, delay: 0.06 }),
  },
  chargeReady: {
    hum: L({ kind: 'osc', wave: 'sine', f0: 220, f1: 440, dur: 0.3, gain: 0.25 }),
    shine: L({ kind: 'osc', wave: 'triangle', f0: 1320, f1: 1980, dur: 0.25, gain: 0.08, delay: 0.1 }),
  },
  chargeEmpty: { fizz: L({ kind: 'noise', filter: 'bandpass', f0: 900, f1: 300, q: 2, dur: 0.15, gain: 0.3 }) },
  modeSwitch: {
    clack1: L({ kind: 'noise', filter: 'bandpass', f0: 2200, f1: 1800, q: 3, dur: 0.03, gain: 0.6 }),
    slide: L({ kind: 'noise', filter: 'bandpass', f0: 600, f1: 1400, q: 1.5, dur: 0.12, gain: 0.25, delay: 0.04 }),
    clack2: L({ kind: 'noise', filter: 'bandpass', f0: 1600, f1: 1300, q: 3, dur: 0.04, gain: 0.7, delay: 0.17 }),
  },
  // Justice's enemies (V2-4): each wind-up is identifiable by ear before it lands.
  // Bailiff thrust = rising steel scrape, Gavel = deep growl and rattling chain, Blindfold = two quick shings,
  // Page = rising whistle.
  windupThrust: {
    scrape: L({ kind: 'noise', filter: 'bandpass', f0: 700, f1: 2600, q: 3, dur: 0.5, gain: 0.45 }),
    tick: L({ kind: 'osc', wave: 'square', f0: 1800, f1: 1800, dur: 0.03, gain: 0.08, delay: 0.45 }),
  },
  windupSlam: {
    growl: L({ kind: 'osc', wave: 'sawtooth', f0: 62, f1: 44, dur: 1.1, gain: 0.2, attack: 0.1 }),
    chain: L({ kind: 'noise', filter: 'highpass', f0: 3500, f1: 2500, dur: 0.9, gain: 0.16, attack: 0.2 }),
  },
  windupSlash: {
    shing1: L({ kind: 'osc', wave: 'triangle', f0: 2400, f1: 3100, dur: 0.12, gain: 0.14 }),
    shing2: L({ kind: 'osc', wave: 'triangle', f0: 2600, f1: 3400, dur: 0.12, gain: 0.14, delay: 0.18 }),
    hiss: L({ kind: 'noise', filter: 'highpass', f0: 4000, f1: 6000, dur: 0.3, gain: 0.15 }),
  },
  windupThrow: { whistle: L({ kind: 'osc', wave: 'sine', f0: 900, f1: 1900, dur: 0.6, gain: 0.18 }) },
  ambushTell: {
    draw: L({ kind: 'noise', filter: 'highpass', f0: 2800, f1: 4200, dur: 0.45, gain: 0.35 }),
    ring: L({ kind: 'osc', wave: 'triangle', f0: 1760, f1: 1700, dur: 0.6, gain: 0.12, delay: 0.1 }),
  },
  whistle: {
    up: L({ kind: 'osc', wave: 'sine', f0: 1500, f1: 2300, dur: 0.22, gain: 0.3 }),
    down: L({ kind: 'osc', wave: 'sine', f0: 2300, f1: 1500, dur: 0.3, gain: 0.28, delay: 0.25 }),
  },
  // Court cards: the King's verdict is a judge's gavel (two knocks), and a horn marks each phase.
  verdict: {
    knock1: L({ kind: 'osc', wave: 'sine', f0: 220, f1: 120, dur: 0.12, gain: 0.7 }),
    knock2: L({ kind: 'osc', wave: 'sine', f0: 220, f1: 120, dur: 0.12, gain: 0.8, delay: 0.32 }),
    wood: L({ kind: 'noise', filter: 'bandpass', f0: 900, f1: 500, q: 2, dur: 0.08, gain: 0.5, delay: 0.32 }),
  },
  courtHorn: {
    low: L({ kind: 'osc', wave: 'sawtooth', f0: 98, f1: 98, dur: 1.1, gain: 0.16, attack: 0.15 }),
    fifth: L({ kind: 'osc', wave: 'sawtooth', f0: 147, f1: 147, dur: 0.9, gain: 0.1, attack: 0.2, delay: 0.15 }),
  },
  slamImpact: {
    crash: L({ kind: 'noise', filter: 'lowpass', f0: 1600, f1: 120, dur: 0.6, gain: 0.9 }),
    thud: L({ kind: 'osc', wave: 'sine', f0: 75, f1: 30, dur: 0.5, gain: 0.9 }),
  },
  // The Devil's enemies and rule (V2-9): chains rattle before they bind, imps chitter, coins jingle, and a hoard
  // with a bell on it rings when it's touched.
  chainRattle: {
    rattle: L({ kind: 'noise', filter: 'bandpass', f0: 3200, f1: 2200, q: 4, dur: 0.8, gain: 0.32, attack: 0.05 }),
    clink: L({ kind: 'osc', wave: 'square', f0: 2600, f1: 2500, dur: 0.05, gain: 0.07, delay: 0.3 }),
    clink2: L({ kind: 'osc', wave: 'square', f0: 2900, f1: 2800, dur: 0.05, gain: 0.07, delay: 0.55 }),
  },
  chainSnap: {
    snap: L({ kind: 'noise', filter: 'highpass', f0: 2500, f1: 1800, dur: 0.12, gain: 0.8 }),
    clank: L({ kind: 'osc', wave: 'square', f0: 420, f1: 300, dur: 0.18, gain: 0.18 }),
  },
  chainBreak: {
    crack: L({ kind: 'noise', filter: 'bandpass', f0: 1800, f1: 800, q: 2, dur: 0.25, gain: 0.8 }),
    ring: L({ kind: 'osc', wave: 'triangle', f0: 1400, f1: 900, dur: 0.4, gain: 0.14 }),
  },
  bound: {
    cinch: L({ kind: 'noise', filter: 'bandpass', f0: 600, f1: 1800, q: 3, dur: 0.35, gain: 0.6 }),
    low: L({ kind: 'osc', wave: 'sawtooth', f0: 110, f1: 82, dur: 0.6, gain: 0.14 }),
  },
  impChitter: {
    a: L({ kind: 'osc', wave: 'square', f0: 1300, f1: 1700, dur: 0.06, gain: 0.08 }),
    b: L({ kind: 'osc', wave: 'square', f0: 1500, f1: 1900, dur: 0.06, gain: 0.08, delay: 0.09 }),
    c: L({ kind: 'osc', wave: 'square', f0: 1700, f1: 2300, dur: 0.08, gain: 0.08, delay: 0.18 }),
  },
  coinJingle: {
    a: L({ kind: 'osc', wave: 'triangle', f0: 3100, f1: 3000, dur: 0.08, gain: 0.08 }),
    b: L({ kind: 'osc', wave: 'triangle', f0: 3600, f1: 3500, dur: 0.08, gain: 0.07, delay: 0.07 }),
    c: L({ kind: 'osc', wave: 'triangle', f0: 2800, f1: 2700, dur: 0.1, gain: 0.07, delay: 0.15 }),
  },
  hoardBell: {
    strike: L({ kind: 'osc', wave: 'sine', f0: 660, f1: 655, dur: 1.6, gain: 0.3 }),
    over: L({ kind: 'osc', wave: 'sine', f0: 1650, f1: 1640, dur: 1.1, gain: 0.1 }),
    over2: L({ kind: 'osc', wave: 'sine', f0: 660, f1: 655, dur: 1.4, gain: 0.22, delay: 0.5 }),
  },
  rest: {
    a: L({ kind: 'osc', wave: 'sine', f0: 523, f1: 523, dur: 0.6, gain: 0.2 }),
    b: L({ kind: 'osc', wave: 'sine', f0: 659, f1: 659, dur: 0.6, gain: 0.18, delay: 0.15 }),
    c: L({ kind: 'osc', wave: 'sine', f0: 784, f1: 784, dur: 0.8, gain: 0.16, delay: 0.3 }),
  },
} satisfies Record<string, Record<string, SoundLayer>>;

export type SfxName = keyof typeof SFX;

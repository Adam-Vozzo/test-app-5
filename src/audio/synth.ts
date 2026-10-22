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

  shot(w: WeaponDef) {
    const pitch = 1 + (this.rand() * 2 - 1) * w.pitchJitter;
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

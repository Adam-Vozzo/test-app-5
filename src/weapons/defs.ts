// Weapons are data. Every number here is exposed in the tuning panel.
import { PROPS } from '../render/palette';

/** One synthesized audio layer. `osc` = pitched sweep, `noise` = filtered noise burst. */
export interface SoundLayer {
  kind: 'osc' | 'noise';
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  filter: 'lowpass' | 'highpass' | 'bandpass';
  /** Start / end frequency (osc pitch, or noise filter cutoff). */
  f0: number;
  f1: number;
  q: number;
  attack: number;
  dur: number;
  gain: number;
  delay: number;
}

export type ReloadMode = 'mag' | 'single';
export type CycleKind = 'none' | 'pump' | 'bolt';

export interface WeaponDef {
  id: string;
  name: string;
  /** Hotkey slot (1/2/3). */
  slot: number;
  // ---- damage
  damage: number;
  critMultiplier: number;
  falloffStart: number;
  falloffEnd: number;
  falloffMinMul: number;
  pellets: number;
  /** Pellet cone half-angle (degrees), on top of aim spread. Pellets use a fixed sunflower pattern + jitter. */
  pelletSpread: number;
  adsPelletMul: number;
  pelletJitter: number;
  pierce: number;
  stagger: number;
  knockback: number;
  /** Shove applied to the player opposite the aim (units/s). */
  selfKnockback: number;
  range: number;
  // ---- handling
  rpm: number;
  auto: boolean;
  magSize: number;
  reserve: number;
  /** 'mag': whole magazine in reloadTime. 'single': one round per reloadTime, interruptible by firing. */
  reloadMode: ReloadMode;
  reloadTime: number;
  /** Action cycled by the off hand after each shot. Takes `cycleTime` of the shot interval. */
  cycle: CycleKind;
  cycleTime: number;
  // ---- ballistics
  hitscan: boolean;
  projectileSpeed: number;
  projectileGravity: number;
  // ---- spread (degrees)
  hipSpread: number;
  adsSpread: number;
  moveSpreadMul: number;
  airSpreadMul: number;
  bloomPerShot: number;
  bloomMax: number;
  bloomRecovery: number;
  // ---- recoil pattern (degrees). shot i → pitch = vertical·ramp(i), yaw = horizontal·sin(i·freq) + bias, ± random
  recoilVertical: number;
  recoilHorizontal: number;
  recoilHorizontalFreq: number;
  recoilHorizontalBias: number;
  recoilRandom: number;
  recoilRampShots: number;
  recoilRamp: number;
  adsRecoilMul: number;
  /** Fraction of each kick that springs back (the rest is climb the player must pull down). */
  kickReturn: number;
  /** Visual-and-aim camera kick spring. */
  cameraKickMul: number;
  cameraKickStiffness: number;
  cameraKickDamping: number;
  /** Separate procedural weapon/arm recoil spring. */
  weaponKickBack: number;
  weaponKickPitch: number;
  weaponKickRoll: number;
  weaponKickStiffness: number;
  weaponKickDamping: number;
  fovPunch: number;
  fovPunchStiffness: number;
  fovPunchDamping: number;
  trauma: number;
  // ---- FX
  tracerColor: number;
  tracerSpeed: number;
  tracerLength: number;
  tracerWidth: number;
  flashScale: number;
  flashFrames: number;
  flashLight: number;
  flashColor: number;
  impactParticles: number;
  impactSpeed: number;
  casingSpeed: number;
  // ---- audio
  pitchJitter: number;
  volume: number;
  layers: Record<string, SoundLayer>;
  /** Pump / bolt foley, played at the start of the cycle. */
  cycleLayers: Record<string, SoundLayer>;
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

export const REPEATER: WeaponDef = {
  id: 'repeater',
  name: 'Rubber-band repeater',
  slot: 1,
  damage: 9,
  critMultiplier: 2,
  falloffStart: 18,
  falloffEnd: 45,
  falloffMinMul: 0.55,
  pellets: 1,
  pelletSpread: 0,
  adsPelletMul: 1,
  pelletJitter: 0,
  pierce: 0,
  stagger: 4,
  knockback: 0.35,
  selfKnockback: 0,
  range: 160,
  rpm: 660,
  auto: true,
  magSize: 32,
  reserve: 192,
  reloadMode: 'mag',
  reloadTime: 1.9,
  cycle: 'none',
  cycleTime: 0,
  hitscan: true,
  projectileSpeed: 0,
  projectileGravity: 0,
  hipSpread: 1.6,
  adsSpread: 0.35,
  moveSpreadMul: 1.4,
  airSpreadMul: 2,
  bloomPerShot: 0.12,
  bloomMax: 1.6,
  bloomRecovery: 6,
  recoilVertical: 0.42,
  recoilHorizontal: 0.18,
  recoilHorizontalFreq: 0.9,
  recoilHorizontalBias: 0.04,
  recoilRandom: 0.12,
  recoilRampShots: 6,
  recoilRamp: 0.5,
  adsRecoilMul: 0.75,
  kickReturn: 0.45,
  cameraKickMul: 1,
  cameraKickStiffness: 180,
  cameraKickDamping: 22,
  weaponKickBack: 0.06,
  weaponKickPitch: 6,
  weaponKickRoll: 2.5,
  weaponKickStiffness: 420,
  weaponKickDamping: 24,
  fovPunch: 0.9,
  fovPunchStiffness: 300,
  fovPunchDamping: 24,
  trauma: 0.09,
  tracerColor: PROPS.rubberBand,
  tracerSpeed: 240,
  tracerLength: 2.4,
  tracerWidth: 0.04,
  flashScale: 0.42,
  flashFrames: 2,
  flashLight: 2.5,
  flashColor: 0xfff0c8,
  impactParticles: 6,
  impactSpeed: 4,
  casingSpeed: 2.2,
  pitchJitter: 0.05,
  volume: 0.8,
  layers: {
    click: L({ kind: 'noise', filter: 'highpass', f0: 5200, f1: 5200, dur: 0.014, gain: 0.45 }),
    twang: L({ kind: 'osc', wave: 'triangle', f0: 1150, f1: 260, dur: 0.075, gain: 0.32 }),
    body: L({ kind: 'noise', filter: 'bandpass', f0: 2000, f1: 850, q: 1.3, dur: 0.06, gain: 0.55 }),
    thump: L({ kind: 'osc', wave: 'sine', f0: 170, f1: 55, dur: 0.09, gain: 0.7 }),
    tail: L({ kind: 'noise', filter: 'lowpass', f0: 1100, f1: 250, dur: 0.28, gain: 0.12, delay: 0.01 }),
  },
  cycleLayers: {},
};

/** Seed-spitter: a party-straw pump shotgun with a squeeze-bulb stock. Close-range shove and stagger. */
export const SPITTER: WeaponDef = {
  ...REPEATER,
  id: 'spitter',
  name: 'Seed-spitter',
  slot: 2,
  damage: 7,
  critMultiplier: 1.5,
  falloffStart: 4,
  falloffEnd: 14,
  falloffMinMul: 0.15,
  pellets: 9,
  pelletSpread: 5.5,
  adsPelletMul: 0.75,
  pelletJitter: 0.35,
  pierce: 0,
  stagger: 6,
  knockback: 2.2,
  selfKnockback: 3.2,
  range: 60,
  rpm: 72,
  auto: false,
  magSize: 5,
  reserve: 40,
  reloadMode: 'single',
  reloadTime: 0.48,
  cycle: 'pump',
  cycleTime: 0.55,
  hitscan: true,
  hipSpread: 0.5,
  adsSpread: 0.25,
  moveSpreadMul: 1.15,
  airSpreadMul: 1.4,
  bloomPerShot: 0,
  bloomMax: 0,
  bloomRecovery: 6,
  recoilVertical: 3.4,
  recoilHorizontal: 0.6,
  recoilHorizontalFreq: 2.1,
  recoilHorizontalBias: 0,
  recoilRandom: 0.7,
  recoilRampShots: 1,
  recoilRamp: 0,
  adsRecoilMul: 0.85,
  kickReturn: 0.85,
  cameraKickMul: 1,
  cameraKickStiffness: 90,
  cameraKickDamping: 13,
  weaponKickBack: 0.16,
  weaponKickPitch: 22,
  weaponKickRoll: 6,
  weaponKickStiffness: 220,
  weaponKickDamping: 15,
  fovPunch: 3.2,
  fovPunchStiffness: 160,
  fovPunchDamping: 16,
  trauma: 0.42,
  tracerColor: PROPS.seed,
  tracerSpeed: 160,
  tracerLength: 0.9,
  tracerWidth: 0.05,
  flashScale: 0.75,
  flashFrames: 2,
  flashLight: 3.5,
  flashColor: 0xfff4d6,
  impactParticles: 3,
  impactSpeed: 3,
  casingSpeed: 1.6,
  pitchJitter: 0.04,
  volume: 0.9,
  layers: {
    click: L({ kind: 'noise', filter: 'bandpass', f0: 2600, f1: 1800, q: 2, dur: 0.02, gain: 0.35 }),
    pop: L({ kind: 'osc', wave: 'triangle', f0: 420, f1: 85, dur: 0.09, gain: 0.45 }),
    body: L({ kind: 'noise', filter: 'lowpass', f0: 1600, f1: 280, q: 0.8, dur: 0.16, gain: 0.7 }),
    thump: L({ kind: 'osc', wave: 'sine', f0: 125, f1: 38, dur: 0.2, gain: 0.95 }),
    puff: L({ kind: 'noise', filter: 'bandpass', f0: 900, f1: 380, q: 0.7, dur: 0.24, gain: 0.32, delay: 0.015 }),
  },
  cycleLayers: {
    back: L({ kind: 'noise', filter: 'bandpass', f0: 1500, f1: 2200, q: 2.5, dur: 0.05, gain: 0.45, delay: 0.06 }),
    squeak: L({ kind: 'osc', wave: 'sine', f0: 1150, f1: 1650, dur: 0.07, gain: 0.12, delay: 0.07 }),
    fwd: L({ kind: 'noise', filter: 'bandpass', f0: 2300, f1: 1500, q: 3, dur: 0.045, gain: 0.5, delay: 0.24 }),
  },
};

/** Staple driver: a desk stapler that fires visible staples. Slow, precise, huge crits, pierces one target. */
export const STAPLER: WeaponDef = {
  ...REPEATER,
  id: 'stapler',
  name: 'Staple driver',
  slot: 3,
  damage: 55,
  critMultiplier: 2.6,
  falloffStart: 60,
  falloffEnd: 140,
  falloffMinMul: 0.8,
  pellets: 1,
  pelletSpread: 0,
  pierce: 1,
  stagger: 22,
  knockback: 1.1,
  selfKnockback: 0.8,
  range: 200,
  rpm: 46,
  auto: false,
  magSize: 5,
  reserve: 30,
  reloadMode: 'mag',
  reloadTime: 3.1,
  cycle: 'bolt',
  cycleTime: 0.8,
  hitscan: false,
  projectileSpeed: 95,
  projectileGravity: 3,
  hipSpread: 2.6,
  adsSpread: 0.04,
  moveSpreadMul: 1.6,
  airSpreadMul: 2.5,
  bloomPerShot: 0,
  bloomMax: 0,
  bloomRecovery: 6,
  recoilVertical: 2.4,
  recoilHorizontal: 0.3,
  recoilHorizontalFreq: 1.3,
  recoilHorizontalBias: 0.2,
  recoilRandom: 0.25,
  recoilRampShots: 1,
  recoilRamp: 0,
  adsRecoilMul: 0.6,
  kickReturn: 0.95,
  cameraKickMul: 1,
  cameraKickStiffness: 140,
  cameraKickDamping: 16,
  weaponKickBack: 0.11,
  weaponKickPitch: 14,
  weaponKickRoll: 1.5,
  weaponKickStiffness: 380,
  weaponKickDamping: 17,
  fovPunch: 1.8,
  fovPunchStiffness: 260,
  fovPunchDamping: 20,
  trauma: 0.28,
  tracerColor: PROPS.metal,
  tracerSpeed: 95,
  tracerLength: 1.2,
  tracerWidth: 0.025,
  flashScale: 0.3,
  flashFrames: 1,
  flashLight: 1.5,
  flashColor: 0xe8f4ff,
  impactParticles: 8,
  impactSpeed: 5,
  casingSpeed: 0,
  pitchJitter: 0.025,
  volume: 0.85,
  layers: {
    snap: L({ kind: 'noise', filter: 'highpass', f0: 6500, f1: 6500, dur: 0.01, gain: 0.6 }),
    ring1: L({ kind: 'osc', wave: 'square', f0: 2320, f1: 2240, dur: 0.13, gain: 0.08 }),
    ring2: L({ kind: 'osc', wave: 'triangle', f0: 3480, f1: 3420, dur: 0.1, gain: 0.1, delay: 0.003 }),
    thwack: L({ kind: 'noise', filter: 'bandpass', f0: 3200, f1: 1400, q: 1.6, dur: 0.045, gain: 0.75 }),
    thump: L({ kind: 'osc', wave: 'sine', f0: 230, f1: 58, dur: 0.13, gain: 0.75 }),
    tail: L({ kind: 'noise', filter: 'lowpass', f0: 2200, f1: 380, dur: 0.38, gain: 0.14, delay: 0.01 }),
  },
  cycleLayers: {
    ratchet1: L({ kind: 'noise', filter: 'highpass', f0: 3600, f1: 3600, dur: 0.012, gain: 0.45, delay: 0.12 }),
    ratchet2: L({ kind: 'noise', filter: 'highpass', f0: 3900, f1: 3900, dur: 0.012, gain: 0.45, delay: 0.17 }),
    ratchet3: L({ kind: 'noise', filter: 'highpass', f0: 4200, f1: 4200, dur: 0.012, gain: 0.45, delay: 0.22 }),
    spring: L({ kind: 'osc', wave: 'triangle', f0: 520, f1: 760, dur: 0.12, gain: 0.14, delay: 0.24 }),
    latch: L({ kind: 'noise', filter: 'bandpass', f0: 2600, f1: 2000, q: 4, dur: 0.03, gain: 0.55, delay: 0.38 }),
  },
};


export const WEAPONS: WeaponDef[] = [REPEATER, SPITTER, STAPLER];

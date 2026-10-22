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

export interface WeaponDef {
  id: string;
  name: string;
  // ---- damage
  damage: number;
  critMultiplier: number;
  falloffStart: number;
  falloffEnd: number;
  falloffMinMul: number;
  pellets: number;
  pierce: number;
  stagger: number;
  knockback: number;
  range: number;
  // ---- handling
  rpm: number;
  auto: boolean;
  magSize: number;
  reserve: number;
  reloadTime: number;
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
  damage: 9,
  critMultiplier: 2,
  falloffStart: 18,
  falloffEnd: 45,
  falloffMinMul: 0.55,
  pellets: 1,
  pierce: 0,
  stagger: 4,
  knockback: 0.35,
  range: 160,
  rpm: 660,
  auto: true,
  magSize: 32,
  reserve: 192,
  reloadTime: 1.9,
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
};

export const WEAPONS: WeaponDef[] = [REPEATER];

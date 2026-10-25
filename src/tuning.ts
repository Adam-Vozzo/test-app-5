// Every feel number in the game. Systems read from here each frame so panel edits apply live.
// Angles suffixed `Deg` are degrees; everything else is SI: metres, seconds.
// V2-1 converted v1's beetle-unit numbers to metres (× V1_TO_METRES = 1.6) instead of re-tuning them; the user's
// first v2 tuning pass then set walk/sprint, roll, camera, cloth, look and outline values by playing (PLAYTEST.md).
// `enemies` is still v1 content in v1 units until V2-4 replaces it.
import { AUTO_PISTOL } from './weapons/defs';

export const tuning = {
  player: {
    walkSpeed: 4.5,
    sprintSpeed: 7.5,
    adsSpeedMul: 0.55,
    reloadSpeedMul: 0.75,
    accel: 60.8,
    decel: 48,
    airControl: 0.25,
    gravity: 48,
    turnRate: 16,
    combatModeTime: 1.6,
    stepHeight: 0.67,
    maxSlopeDeg: 48,
    snapToGround: 0.56,
    /** Humanoid capsule (not converted: the beetle was an egg). 2·(radius + halfHeight) = 1.6 m. */
    capsuleRadius: 0.3,
    capsuleHalfHeight: 0.5,
    pushDecay: 8,
  },
  vitals: {
    maxHealth: 100,
    maxStamina: 100,
    staminaRegen: 45,
    staminaRegenDelay: 0.7,
    sprintDrain: 18,
    rollCost: 28,
    exhaustedUntil: 25,
    healCharges: 3,
    healTime: 1.2,
    healApplyAt: 0.7,
    healAmount: 45,
    healMoveMul: 0.35,
    hurtStun: 0.22,
    hurtKnockbackMul: 1,
    hurtTrauma: 0.55,
    pollenPickupRadius: 2.24,
  },
  roll: {
    speed: 8.5,
    duration: 0.5,
    recovery: 0.03,
    endSpeedMul: 1.2,
    iFrames: 0.3,
    tumbleTurns: 1,
  },
  biped: {
    stepThreshold: 0.785,
    stepDuration: 0.1116,
    stepDurationSprint: 0.1496,
    stepHeight: 0.189,
    /** Seconds of velocity the feet reach ahead. */
    velocityLead: 0.14256,
    panicFactor: 4,
    stanceWidth: 0.229,
    /** Matches BODY.hip (src/anim/body.ts). */
    hipHeight: 0.66,
    bobAmount: 0.0963,
    /** Lean (radians) per m/s and per m/s². */
    leanPerSpeed: 0.0589,
    leanAccel: 0.01167,
    leanMaxDeg: 23.872,
    headLookRate: 6,
    armSwingIdle: 0.0374,
  },
  /** Blindfold tails (verlet ribbons). */
  cloth: {
    tailLength: 0.43,
    gravity: 8.428,
    drag: 0.06,
    stiffness: 5,
    /** How far the tails lean back from straight down at rest (degrees). */
    restBackDeg: 35,
  },
  /** Atmosphere (STYLE.md → Atmospheric perspective). Fog colour comes from the area palette. */
  look: {
    /** Fog per metre. With fogPower 1.4 on flat ground: ~17% at 40 m, ~55% at 120 m, ~91% at 250 m. */
    fogDensity: 0.0075,
    /** 2 = classic exp²; lower hazes near space sooner, higher keeps the play space clear and walls off the distance. */
    fogPower: 1.4,
    /** Height fog: density falls by e every 1/heightFalloff metres above the ground. */
    heightFalloff: 0.02,
    heightMix: 1,
    skyBands: 24,
    cloudAmount: 0.35,
  },
  /** Pixel mode (src/render/pixel.ts): crisp low-res blocks with a depth outline. P toggles it. */
  pixel: {
    enabled: true,
    /** Screen pixels per block. */
    scale: 2,
    /** Outline darkness, 0 = none. */
    outline: 0.3,
    /** How sharp a depth step must be to get a line: higher draws fewer, only strong silhouettes. */
    edgeThreshold: 0.3,
    /** Line thickness in blocks. */
    edgeWidth: 1,
    /** Outlines fade out between these view distances (metres), so the distance stays soft. */
    outlineFadeStart: 30,
    outlineFadeEnd: 140,
  },
  camera: {
    height: 1.5,
    distance: 3.5,
    shoulder: 1,
    lift: 0.3,
    adsDistance: 2,
    adsShoulder: 1,
    fovDeg: 80,
    adsFovDeg: 60,
    zoomRate: 14,
    swapRate: 10,
    sensitivity: 0.0022,
    adsSensitivityMul: 0.7,
    pitchMinDeg: -70,
    pitchMaxDeg: 70,
    collisionRadius: 0.288,
    collisionRecoverRate: 6,
    followRate: 30,
  },
  feel: {
    hitstopCrit: 0,
    hitstopKill: 0,
    hitFlashTime: 0.07,
    traumaDecay: 1.7,
    shakeMaxAngleDeg: 2.6,
    shakeMaxRollDeg: 3.5,
    shakeMaxOffset: 0.096,
    shakeFreq: 24,
    hitMarkerTime: 0.18,
    hurtVignetteTime: 0.45,
    killMarkerTime: 0.42,
    crosshairBaseGap: 4,
    fireBuffer: 0.15,
  },
  reload: {
    weaponTiltDeg: 28,
    weaponDrop: 0.128,
    handReachTime: 0.18,
    magOutAt: 0.28,
    pouchAt: 0.5,
    magInAt: 0.68,
    rackAt: 0.86,
  },
  enemies: {
    skitterer: {
      health: 120,
      poise: 14,
      poiseRegen: 20,
      speed: 9,
      accel: 28,
      turnRate: 9,
      aggroRange: 22,
      hearRange: 7,
      attackRange: 2.4,
      windup: 0.38,
      active: 0.22,
      lungeSpeed: 11,
      recover: 0.75,
      cooldown: 0.6,
      damage: 25,
      knockback: 4,
      hitRadius: 0.75,
      staggerTime: 0.8,
      pollen: 4,
      separation: 1.4,
    },
    spitter: {
      health: 75,
      poise: 28,
      poiseRegen: 18,
      speed: 3.2,
      accel: 14,
      turnRate: 5,
      aggroRange: 30,
      hearRange: 8,
      preferredRange: 16,
      rangeBand: 3.5,
      attackRange: 22,
      windup: 0.85,
      active: 0.1,
      recover: 1.1,
      cooldown: 1.6,
      globFlightTime: 1,
      globGravity: 18,
      splashRadius: 1.5,
      damage: 30,
      knockback: 3,
      staggerTime: 1,
      pollen: 8,
      separation: 2,
    },
    brute: {
      health: 800,
      poise: 110,
      poiseRegen: 15,
      speed: 3.4,
      accel: 10,
      turnRate: 2.6,
      aggroRange: 22,
      hearRange: 10,
      chargeRange: 20,
      chargeWindup: 1.1,
      chargeSpeed: 14,
      chargeTime: 1.3,
      chargeDamage: 40,
      chargeKnockback: 10,
      wallStun: 2.2,
      buttRange: 3.4,
      buttWindup: 0.75,
      buttActive: 0.18,
      buttDamage: 32,
      buttKnockback: 7,
      recover: 1.4,
      cooldown: 1.2,
      staggerTime: 1.6,
      armorMul: 0.2,
      pollen: 60,
      separation: 3,
    },
    hitFlashTime: 0.08,
    corpseTime: 6,
    globDamageGrace: 0.05,
  },
  dummy: {
    health: 220,
    respawnTime: 2.2,
    flinchStiffness: 140,
    flinchDamping: 9,
    flinchPerDamage: 0.12,
    slideSpeed: 5.6,
    slideRange: 9.6,
    poise: 40,
    poiseRegenDelay: 1,
    poiseRegen: 30,
    staggerTime: 0.9,
  },
  audio: {
    master: 0.7,
    hitGain: 0.5,
    critGain: 0.6,
    killGain: 0.7,
    reloadGain: 0.5,
    footstepGain: 0.12,
    sfxGain: 0.8,
  },
  debug: {
    slowmo: false,
    slowmoScale: 0.25,
    godMode: false,
    showIK: false,
    showHitboxes: false,
    showAI: false,
    showGraph: false,
    overview: false,
    showStats: true,
  },
  swap: {
    lowerTime: 0.16,
    raiseTime: 0.2,
    dropDistance: 0.4,
    tiltDeg: 50,
  },
  weapons: {
    pistol: AUTO_PISTOL,
  },
};

export type Tuning = typeof tuning;

/** Snapshot of defaults for "reset". */
export const DEFAULT_TUNING_JSON = JSON.stringify(tuning);

/** Deep-assign `src` into `dst` in place, keeping object identity (systems hold references). */
export function deepAssign(dst: Record<string, unknown>, src: Record<string, unknown>) {
  for (const k of Object.keys(src)) {
    const sv = src[k];
    const dv = dst[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && dv && typeof dv === 'object') {
      deepAssign(dv as Record<string, unknown>, sv as Record<string, unknown>);
    } else if (k in dst && typeof dv === typeof sv) {
      dst[k] = sv;
    }
  }
}

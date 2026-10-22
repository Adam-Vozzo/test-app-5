// Every feel number in the game. Systems read from here each frame so panel edits apply live.
// Angles suffixed `Deg` are degrees; everything else is SI-ish (units, seconds).
import { REPEATER } from './weapons/defs';

export const tuning = {
  player: {
    walkSpeed: 4.2,
    sprintSpeed: 6.8,
    adsSpeedMul: 0.55,
    reloadSpeedMul: 0.75,
    accel: 38,
    decel: 30,
    airControl: 0.25,
    gravity: 30,
    turnRate: 16,
    combatModeTime: 1.6,
    stepHeight: 0.42,
    maxSlopeDeg: 48,
    snapToGround: 0.35,
    capsuleRadius: 0.28,
    capsuleHalfHeight: 0.24,
  },
  roll: {
    speed: 9.5,
    duration: 0.5,
    recovery: 0.16,
    endSpeedMul: 0.25,
    iFrames: 0.3,
    tumbleTurns: 1,
  },
  biped: {
    stepThreshold: 0.24,
    stepDuration: 0.15,
    stepDurationSprint: 0.11,
    stepHeight: 0.13,
    velocityLead: 0.11,
    panicFactor: 3,
    stanceWidth: 0.13,
    hipHeight: 0.4,
    bobAmount: 0.035,
    leanPerSpeed: 0.035,
    leanAccel: 0.012,
    leanMaxDeg: 16,
    headLookRate: 14,
    antennaSpring: 120,
    antennaDamping: 8,
    armSwingIdle: 0.02,
  },
  camera: {
    height: 1.05,
    distance: 2.7,
    shoulder: 0.62,
    lift: 0.16,
    adsDistance: 1.6,
    adsShoulder: 0.72,
    fovDeg: 70,
    adsFovDeg: 52,
    zoomRate: 14,
    swapRate: 10,
    sensitivity: 0.0022,
    adsSensitivityMul: 0.7,
    pitchMinDeg: -70,
    pitchMaxDeg: 70,
    collisionRadius: 0.18,
    collisionRecoverRate: 6,
    followRate: 30,
  },
  feel: {
    hitstopCrit: 0.05,
    hitstopKill: 0.07,
    hitFlashTime: 0.07,
    traumaDecay: 1.7,
    shakeMaxAngleDeg: 2.6,
    shakeMaxRollDeg: 3.5,
    shakeMaxOffset: 0.06,
    shakeFreq: 24,
    hitMarkerTime: 0.18,
    killMarkerTime: 0.42,
    crosshairBaseGap: 4,
    recoilRecoverDelay: 0.06,
  },
  reload: {
    weaponTiltDeg: 28,
    weaponDrop: 0.08,
    handReachTime: 0.18,
    magOutAt: 0.28,
    pouchAt: 0.5,
    magInAt: 0.68,
    rackAt: 0.86,
  },
  dummy: {
    health: 220,
    respawnTime: 2.2,
    flinchStiffness: 140,
    flinchDamping: 9,
    flinchPerDamage: 0.12,
    slideSpeed: 3.5,
    slideRange: 6,
  },
  audio: {
    master: 0.7,
    hitGain: 0.5,
    critGain: 0.6,
    killGain: 0.7,
    reloadGain: 0.5,
    footstepGain: 0.12,
  },
  debug: {
    slowmo: false,
    slowmoScale: 0.25,
    godMode: false,
    showIK: false,
    showHitboxes: false,
    showAI: false,
    showStats: true,
    pixelMode: false,
    pixelScale: 3,
  },
  weapons: {
    repeater: REPEATER,
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

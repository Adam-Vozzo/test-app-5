// The Eight of Swords' proportions, in metres (STYLE.md → Scale: stocky, ~1.6 m, about three and a half heads).
// Pure data: the rig, weapon placement and reload choreography read lengths from here, never from literals.

/** v1 measured everything in beetle heights (1 unit ≈ the beetle). v2 is metres; the player is 1.6 m. */
export const V1_TO_METRES = 1.6;

export const BODY = {
  height: 1.6,
  /** Hip joint height when standing (legs a little bent). */
  hip: 0.66,
  thigh: 0.36,
  shin: 0.36,
  /** Leg roots, either side of the hips. */
  hipX: 0.1,
  /** Chest centre above the hips (the robe and the weapon pivot hang off it). */
  chestY: 0.3,
  shoulderX: 0.2,
  shoulderY: 0.48,
  upperArm: 0.26,
  forearm: 0.26,
  neckY: 0.58,
  /** Head (hood) centre above the neck, and the hood's radius. */
  headUp: 0.14,
  headR: 0.19,
  /** Hips above the ground while curled in a roll. */
  rollHip: 0.45,
  /** Weapon pivot relative to the chest: hip-fire and aim-down-sights. */
  weapon: { hipX: 0.27, adsX: 0.19, hipY: 0.06, adsY: 0.16, z: -0.22 },
  /** Off-hand pouch on the left hip (reloads, heals). Body-local: +x right, forward is -z. */
  pouch: { x: -0.24, y: 0.03, z: -0.03 },
  /** Where the heal is drunk from, relative to the head. */
  mouth: { forward: 0.2, up: -0.06 },
  /** Closest the aim point may come before the weapon stops tracking it (folding guns against walls). */
  minAimDistance: 4,
} as const;

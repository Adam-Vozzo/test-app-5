// Pure decision logic for v2 humanoid enemies (no Three/DOM): attack timelines with mirrored combos, attack
// choice by range and weight, attack arcs, hearing, and the fair-distance rule for ranged throws.
// The Foe class (foe.ts) drives bodies and physics from these answers; tests/foe-ai.test.ts covers them.

export type FoeId = 'bailiff' | 'gavel' | 'blindfold' | 'page';

/** One attack's feel numbers (tuning.foes.<id>.attacks.<name>). */
export interface AttackTune {
  range: number;
  windup: number;
  active: number;
  recover: number;
  cooldown: number;
  damage: number;
  knockback: number;
  /** Width of the struck arc in front (360 = all around). */
  arcDeg: number;
  /** Step forward during the active window (m). */
  lunge: number;
  weight: number;
  /** Swings in the combo; every second one is mirrored. */
  hits?: number;
  /** Wind-up before each follow-up swing. */
  comboWindup?: number;
  /** Ground-ring radius (slams) and how far ahead it lands. */
  radius?: number;
  reach?: number;
  /** Projectile speed (throws). */
  speed?: number;
}

export type AttackPhase = 'windup' | 'active' | 'recover' | 'done';

export interface TimelinePoint {
  phase: AttackPhase;
  /** Which swing of the combo (0-based). */
  hit: number;
  /** Progress through the current phase, 0..1. */
  k: number;
  /** Follow-up swings come from the other side. */
  mirrored: boolean;
}

/** Total length of an attack, wind-up to the end of recovery. */
export function attackDuration(a: AttackTune): number {
  const hits = Math.max(1, a.hits ?? 1);
  const follow = a.comboWindup ?? a.windup;
  return a.windup + a.active + (hits - 1) * (follow + a.active) + a.recover;
}

/** Where in its attack an enemy is, `t` seconds after the wind-up began. */
export function attackTimeline(a: AttackTune, t: number): TimelinePoint {
  const hits = Math.max(1, a.hits ?? 1);
  const follow = a.comboWindup ?? a.windup;
  let at = 0;
  for (let hit = 0; hit < hits; hit++) {
    const w = hit === 0 ? a.windup : follow;
    if (t < at + w) return { phase: 'windup', hit, k: (t - at) / Math.max(1e-6, w), mirrored: hit % 2 === 1 };
    at += w;
    if (t < at + a.active) return { phase: 'active', hit, k: (t - at) / Math.max(1e-6, a.active), mirrored: hit % 2 === 1 };
    at += a.active;
  }
  if (t < at + a.recover) return { phase: 'recover', hit: hits - 1, k: (t - at) / Math.max(1e-6, a.recover), mirrored: (hits - 1) % 2 === 1 };
  return { phase: 'done', hit: hits - 1, k: 1, mirrored: (hits - 1) % 2 === 1 };
}

/**
 * Choose an attack that reaches `dist` and is off cooldown, by weight. `roll` is a seeded number in [0, 1).
 * Ranged attacks (with a projectile speed) aren't used point-blank. Returns null if nothing fits.
 */
export function pickAttack(attacks: Record<string, AttackTune>, dist: number, cooldowns: Record<string, number>, roll: number): string | null {
  const fits = Object.entries(attacks).filter(([name, a]) => dist <= a.range && (cooldowns[name] ?? 0) <= 0 && !(a.speed && dist < 4));
  if (!fits.length) return null;
  // Prefer the tightest attack that reaches: a shield bash up close, the thrust a step out.
  const total = fits.reduce((s, [, a]) => s + a.weight / a.range, 0);
  let r = roll * total;
  for (const [name, a] of fits) {
    r -= a.weight / a.range;
    if (r < 0) return name;
  }
  return fits[fits.length - 1][0];
}

/** Is a target in direction (dx, dz) inside the arc in front of a body facing `yaw` (0 faces -Z)? */
export function inArc(yaw: number, dx: number, dz: number, arcDeg: number): boolean {
  if (arcDeg >= 360) return true;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return true;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const cos = (dx * fx + dz * fz) / len;
  return cos >= Math.cos(((arcDeg / 2) * Math.PI) / 180);
}

/** Does a guard facing `yaw` turn a blow travelling along (dirX, dirZ) (attacker → target)? */
export function guards(yaw: number, dirX: number, dirZ: number, coneDeg: number): boolean {
  // The blow comes from -dir; it's blocked when that source lies within the cone in front.
  return inArc(yaw, -dirX, -dirZ, coneDeg);
}

export interface Noise {
  x: number;
  y: number;
  z: number;
  /** How far it carries (m). */
  r: number;
}

/** Does a listener at (x, y, z) hear this noise? Height difference counts a little less than distance. */
export function hears(x: number, y: number, z: number, n: Noise): boolean {
  return Math.hypot(n.x - x, (n.y - y) * 0.5, n.z - z) <= n.r;
}

/** The loudest noise heard this frame, if any (the one whose reach exceeds its distance by most). */
export function loudest(x: number, y: number, z: number, noises: readonly Noise[]): Noise | null {
  let best: Noise | null = null;
  let margin = 0;
  for (const n of noises) {
    const m = n.r - Math.hypot(n.x - x, (n.y - y) * 0.5, n.z - z);
    if (m >= 0 && (!best || m > margin)) {
      best = n;
      margin = m;
    }
  }
  return best;
}

/**
 * LEVELS.md → Combat spaces: a ranged enemy stands at least (telegraph × projectile speed) + one roll from the
 * player's way in, so every throw can be read and dodged.
 */
export function rangedMinDistance(a: AttackTune, roll: { speed: number; duration: number }): number {
  return a.windup * (a.speed ?? 0) + roll.speed * roll.duration;
}

/** Where a slam lands: `reach` ahead of a body at (x, z) facing `yaw`. */
export function slamCentre(x: number, z: number, yaw: number, reach: number): [number, number] {
  return [x - Math.sin(yaw) * reach, z - Math.cos(yaw) * reach];
}

/** Has the fight drifted too far from home? Enemies then give up and walk back (and heal). */
export function leashBroken(homeX: number, homeZ: number, x: number, z: number, leash: number): boolean {
  return Math.hypot(x - homeX, z - homeZ) > leash;
}

/** Wrap an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

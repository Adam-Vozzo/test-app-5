// Pure decision logic for v2 humanoid enemies (no Three/DOM): attack timelines with mirrored combos, attack
// choice by range and weight, attack arcs, hearing, and the fair-distance rule for ranged throws.
// The Foe class (foe.ts) drives bodies and physics from these answers; tests/foe-ai.test.ts covers them.

export type FoeId = 'bailiff' | 'gavel' | 'blindfold' | 'page' | 'miser' | 'imp' | 'pagePentacles' | 'thrall' | 'firebrand' | 'faller' | 'builder' | 'pageWands' | 'cat' | 'dog' | 'wolf' | 'crayfish' | 'phantom' | 'pageCups' | 'fish';
/** Court-card minibosses (rank is the verb, suit is the flavour). */
export type CourtRank = 'knight' | 'queen' | 'king';

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
  /** Never chosen closer than this (the Knight of Cups sets his cup down only with room between you). */
  minRange?: number;
  /** Projectile speed (throws, volleys) or dash speed (charges). */
  speed?: number;
  /** A rank verb with its own code (charge, volley, verdict, summon); plain attacks leave it out. */
  kind?: 'charge' | 'volley' | 'verdict' | 'bind' | 'sow' | 'shackle' | 'barricade' | 'signal' | 'spawn' | 'howl' | 'offer' | 'mirror' | 'wave';
  /** A charge that binds what it hits instead of striking it (the Knight of Pentacles): held for `delay`, then struck. */
  binds?: boolean;
  /** Sown seeds: what sprouts from one that ripens untrampled (the Queen of Pentacles). */
  spawn?: string;
  /** The Tower: ground strikes (slams, verdicts, lobs, a charge's trail) set the timber within this radius alight. */
  ignite?: number;
  /** A lobbed throw (a Firebrand's fire pot): its flight time (s). The landing spot shows a ring that fills. */
  lob?: number;
  /** Verdicts that leave coin where they strike (the King of Pentacles' coin rain): piles per zone. */
  coins?: number;
  /** Only from this phase on (court cards escalate at health thresholds). */
  minPhase?: number;
  /** Volleys: how many blade lanes, and how far apart (m). */
  lanes?: number;
  spacing?: number;
  /** Verdicts: how long a marked zone waits before it strikes (s), and how many it marks. Binds: how long the
   * binding holds before its blow lands (`delay`), and how close to the chain counts as caught (`radius`). */
  delay?: number;
  count?: number;
}

/** Feel numbers shared by every archetype (each also has `attacks` and its own extras). */
export interface FoeTune {
  health: number;
  poise: number;
  poiseRegen: number;
  speed: number;
  runSpeed: number;
  accel: number;
  turnRate: number;
  leash: number;
  staggerTime: number;
  separation: number;
  reward: number;
  sightRange?: number;
  guardConeDeg?: number;
  senseRange?: number;
  searchTime?: number;
  holdRange?: number;
  alertRadius?: number;
  /** Court cards: health fractions where the next phase begins (descending). */
  phases?: number[];
  /** The Devil: how long he holds out his pact (s). */
  pactTime?: number;
  /** Fallers: how close (m, from the perch) before one drops, and how long the drop takes (its shadow grows). */
  triggerRadius?: number;
  fallTime?: number;
  /** Builders: how long a barricade stands (s). */
  barricadeTime?: number;
  /** Dog and Wolf: how long a howl maddens the other (s). */
  rageTime?: number;
  /** The Shadow: how often it rolls out of your line of fire (s), and how fast. */
  dodgeCooldown?: number;
  dodgeSpeed?: number;
  /** Court cards: how long the Knight falls back after striking (s); how many the King summons per phase. */
  retreatTime?: number;
  squad?: number;
  /** Thralls: the chain between a pair, its health, the freed fighter's speed-up and how long the other flees. */
  chainLength?: number;
  chainHealth?: number;
  rage?: number;
  fleeTime?: number;
  attacks: Record<string, AttackTune>;
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
export function pickAttack(attacks: Record<string, AttackTune>, dist: number, cooldowns: Record<string, number>, roll: number, phase = 0): string | null {
  const fits = Object.entries(attacks).filter(
    ([name, a]) => dist <= a.range && dist >= (a.minRange ?? 0) && (cooldowns[name] ?? 0) <= 0 && !(a.speed && a.kind !== 'charge' && dist < 4) && !(a.lob && dist < 4) && !(a.kind === 'charge' && dist < 5) && (a.minPhase ?? 0) <= phase,
  );
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

/** Which phase a court card is in: one more for every health threshold (fractions, descending) it has fallen past. */
export function phaseOf(healthFrac: number, thresholds: readonly number[]): number {
  return thresholds.filter((t) => healthFrac <= t).length;
}

/**
 * A blade volley's lane offsets across the throw (m, left negative). One lane is left empty: the gap you step into.
 * The mirrored volley leaves the mirrored gap, so reading the first teaches the second.
 */
export function volleyOffsets(lanes: number, spacing: number, gap: number, mirrored: boolean): number[] {
  const g = mirrored ? lanes - 1 - gap : gap;
  const out: number[] = [];
  for (let i = 0; i < lanes; i++) if (i !== g) out.push((i - (lanes - 1) / 2) * spacing);
  return out;
}

/** Reflect (x, z) across the line through (cx, cz) heading along `yaw` (0 = -Z): the arena's mirror axis. */
export function mirrorAcross(x: number, z: number, cx: number, cz: number, yaw: number): [number, number] {
  const ux = -Math.sin(yaw);
  const uz = -Math.cos(yaw);
  const rx = x - cx;
  const rz = z - cz;
  const along = rx * ux + rz * uz;
  return [cx + 2 * along * ux - rx, cz + 2 * along * uz - rz];
}

/** Distance in the ground plane from (px, pz) to the segment (ax, az)–(bx, bz). */
export function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * Where a chained pair runs to bind you: either side of you along their chain's current axis, `half` metres out,
 * so the chain snaps tight across you. Returns [leadX, leadZ, partnerX, partnerZ].
 */
export function flankPoints(px: number, pz: number, leadX: number, leadZ: number, partnerX: number, partnerZ: number, half: number): [number, number, number, number] {
  let nx = leadX - partnerX;
  let nz = leadZ - partnerZ;
  const n = Math.hypot(nx, nz);
  if (n < 1e-6) {
    nx = 1;
    nz = 0;
  } else {
    nx /= n;
    nz /= n;
  }
  return [px + nx * half, pz + nz * half, px - nx * half, pz - nz * half];
}

/**
 * A fleeing enemy's heading: away from the player, bent sideways (`sign` picks the side) as it nears the edge of its
 * leash so it circles its room instead of leaving it. Returns a unit vector [x, z].
 */
export function fleeHeading(x: number, z: number, px: number, pz: number, homeX: number, homeZ: number, leash: number, sign: 1 | -1): [number, number] {
  let ax = x - px;
  let az = z - pz;
  const a = Math.hypot(ax, az) || 1;
  ax /= a;
  az /= a;
  const hx = homeX - x;
  const hz = homeZ - z;
  const fromHome = Math.hypot(hx, hz);
  // 0 near home, 1 at the leash: blend from straight away to along the edge (and back toward home a little).
  const edge = Math.max(0, Math.min(1, (fromHome / Math.max(1, leash) - 0.45) / 0.4));
  const tx = -az * sign;
  const tz = ax * sign;
  let ox = ax * (1 - edge) + tx * edge + (fromHome > 1e-6 ? (hx / fromHome) * edge * 0.6 : 0);
  let oz = az * (1 - edge) + tz * edge + (fromHome > 1e-6 ? (hz / fromHome) * edge * 0.6 : 0);
  const o = Math.hypot(ox, oz) || 1;
  ox /= o;
  oz /= o;
  return [ox, oz];
}

/** Do segments p0–p1 and a–b cross (or come within `margin`) in the ground plane? A swept check for fast movers. */
export function sweepCrosses(p0x: number, p0z: number, p1x: number, p1z: number, ax: number, az: number, bx: number, bz: number, margin = 0): boolean {
  const cross = (ox: number, oz: number, ux: number, uz: number, vx: number, vz: number) => (ux - ox) * (vz - oz) - (uz - oz) * (vx - ox);
  const d1 = cross(ax, az, bx, bz, p0x, p0z);
  const d2 = cross(ax, az, bx, bz, p1x, p1z);
  const d3 = cross(p0x, p0z, p1x, p1z, ax, az);
  const d4 = cross(p0x, p0z, p1x, p1z, bx, bz);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return margin > 0 && (segmentDistance(p1x, p1z, ax, az, bx, bz) <= margin || segmentDistance(p0x, p0z, ax, az, bx, bz) <= margin);
}

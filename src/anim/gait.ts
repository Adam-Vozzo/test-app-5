// Pure gait step selection, shared by the biped and the multi-legged enemies.

export interface LegGaitState {
  /** Horizontal distance from the planted foot to where it wants to be. */
  error: number;
  /** Currently mid-step. */
  stepping: boolean;
}

export interface GaitParams {
  /** Error that triggers a step. */
  threshold: number;
  /** Error at which a leg steps regardless of group alternation (teleport/knockback recovery). */
  panicFactor: number;
  /** Fraction of threshold above which group-mates join a step their group started. */
  joinFraction: number;
}

export const TRIPOD_GROUPS: readonly (readonly number[])[] = [
  [0, 3, 4],
  [1, 2, 5],
];
export const BIPED_GROUPS: readonly (readonly number[])[] = [[0], [1]];

/**
 * Decide which legs start a step this frame.
 *
 * - Legs step in groups (tripod for six legs, alternating for two).
 * - A group may only start while no leg of any *other* group is mid-step, so groups alternate
 *   and the body is always supported.
 * - Among eligible groups the one with the largest error goes first.
 * - Group-mates over `joinFraction * threshold` join the step so the gait stays coherent.
 * - Any leg past `panicFactor * threshold` steps immediately.
 */
export function selectSteps(
  legs: readonly LegGaitState[],
  groups: readonly (readonly number[])[],
  p: GaitParams,
): number[] {
  const out: number[] = [];
  const steppingGroup = groups.map((g) => g.some((i) => legs[i].stepping));

  let best = -1;
  let bestErr = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const othersStepping = steppingGroup.some((s, j) => s && j !== gi);
    if (othersStepping) continue;
    let maxErr = 0;
    for (const i of groups[gi]) if (!legs[i].stepping) maxErr = Math.max(maxErr, legs[i].error);
    if (maxErr > p.threshold && maxErr > bestErr) {
      bestErr = maxErr;
      best = gi;
    }
  }
  if (best >= 0) {
    for (const i of groups[best]) {
      if (!legs[i].stepping && legs[i].error > p.threshold * p.joinFraction) out.push(i);
    }
  }
  for (let i = 0; i < legs.length; i++) {
    if (!legs[i].stepping && legs[i].error > p.threshold * p.panicFactor && !out.includes(i)) out.push(i);
  }
  return out;
}

/** Step arc: 0→1 progress to vertical lift (sine bump), peak = height. */
export const stepArc = (t: number, height: number) => Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)) * height;

/** Ease used for horizontal foot travel during a step. */
export const stepEase = (t: number) => {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
};

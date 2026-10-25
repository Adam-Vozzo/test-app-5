// V2-1 converted v1's beetle-unit feel numbers to metres (× V1_TO_METRES) instead of re-tuning them. The user has
// since re-tuned speed, roll and camera by playing, so those are no longer conversions. These checks hold what should
// still be true: the body and its collider agree, and the values nobody has re-tuned keep their size relative to
// the body.
import { describe, expect, it } from 'vitest';
import { BODY, V1_TO_METRES } from '../src/anim/body';
import { fogAt } from '../src/render/atmosphere';
import { tuning } from '../src/tuning';

/** v1 values at the end of v1 (commit effce00), in beetle units where 1 unit ≈ the beetle's height. */
const V1 = {
  stepThreshold: 0.49056,
  stepDuration: 0.1116,
  stepHeight: 0.11804,
  stanceWidth: 0.14306448,
  bobAmount: 0.0602,
  gravity: 30,
  iFrames: 0.3,
  collisionRadius: 0.18,
};
const H = BODY.height;
const rel = (v2: number, v1: number) => v2 / H / v1;

describe('the body', () => {
  it('is 1.6 m and the capsule matches it', () => {
    expect(V1_TO_METRES).toBe(H);
    expect(2 * (tuning.player.capsuleRadius + tuning.player.capsuleHalfHeight)).toBeCloseTo(H, 5);
    expect(tuning.biped.hipHeight).toBeCloseTo(BODY.hip, 5);
  });

  it('keeps its legs long enough to reach the ground from the hips', () => {
    expect(BODY.thigh + BODY.shin).toBeGreaterThan(BODY.hip);
  });
});

describe('values not yet re-tuned keep their v1 size relative to the body', () => {
  it('gait and gravity', () => {
    expect(rel(tuning.biped.stepThreshold, V1.stepThreshold)).toBeCloseTo(1, 2);
    expect(rel(tuning.biped.stepHeight, V1.stepHeight)).toBeCloseTo(1, 2);
    expect(rel(tuning.biped.stanceWidth, V1.stanceWidth)).toBeCloseTo(1, 2);
    expect(rel(tuning.biped.bobAmount, V1.bobAmount)).toBeCloseTo(1, 2);
    expect(rel(tuning.player.gravity, V1.gravity)).toBeCloseTo(1, 2);
    expect(rel(tuning.camera.collisionRadius, V1.collisionRadius)).toBeCloseTo(1, 2);
  });
  it('time-based values are untouched', () => {
    expect(tuning.biped.stepDuration).toBe(V1.stepDuration);
    expect(tuning.roll.iFrames).toBe(V1.iFrames);
  });
});

describe('atmosphere (STYLE.md → Atmospheric perspective)', () => {
  const at = (d: number) => fogAt(d, tuning.look.fogDensity, tuning.look.fogPower);
  it('keeps the play space clear', () => {
    expect(at(40)).toBeLessThan(0.3);
  });
  it('walls off the distance', () => {
    expect(at(250)).toBeGreaterThan(0.8);
  });
  it('rises monotonically with distance', () => {
    for (let d = 0; d < 400; d += 10) expect(at(d + 10)).toBeGreaterThanOrEqual(at(d));
  });
  it('power 2 reproduces classic exp² fog (v1 biomes)', () => {
    expect(fogAt(50, 0.02, 2)).toBeCloseTo(1 - Math.exp(-1), 6);
  });
});

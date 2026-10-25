// V2-1 converted v1's beetle-unit feel numbers to metres instead of re-tuning them (PLAN.md → V2-1). These
// checks hold the conversion honest: anything measured in seconds is unchanged, and anything measured in
// lengths is unchanged *relative to the body*.
import { describe, expect, it } from 'vitest';
import { BODY, V1_TO_METRES } from '../src/anim/body';
import { fogAt } from '../src/render/atmosphere';
import { tuning } from '../src/tuning';

/** v1 values at the end of v1 (commit effce00), in beetle units where 1 unit ≈ the beetle's height. */
const V1 = {
  walkSpeed: 3,
  sprintSpeed: 5.5,
  accel: 38,
  gravity: 30,
  rollSpeed: 8,
  rollDuration: 0.4,
  iFrames: 0.3,
  stepThreshold: 0.49056,
  stepDuration: 0.1116,
  stepHeight: 0.11804,
  stanceWidth: 0.14306448,
  hipHeight: 0.4144,
  leanPerSpeed: 0.09422,
  cameraDistance: 2.7,
  cameraHeight: 1.05,
  shoulder: 0.62,
};
const H = BODY.height;
const rel = (v2: number, v1: number) => v2 / H / v1;

describe('metre conversion preserves v1 feel (× V1_TO_METRES)', () => {
  it('the body is 1.6 m and the capsule matches it', () => {
    expect(V1_TO_METRES).toBe(H);
    expect(2 * (tuning.player.capsuleRadius + tuning.player.capsuleHalfHeight)).toBeCloseTo(H, 5);
    expect(tuning.biped.hipHeight).toBeCloseTo(BODY.hip, 5);
  });

  it('time-based feel is untouched', () => {
    expect(tuning.roll.duration).toBe(V1.rollDuration);
    expect(tuning.roll.iFrames).toBe(V1.iFrames);
    expect(tuning.biped.stepDuration).toBe(V1.stepDuration);
  });

  it('speeds, accelerations and distances keep their size relative to the body', () => {
    expect(rel(tuning.player.walkSpeed, V1.walkSpeed)).toBeCloseTo(1, 2);
    expect(rel(tuning.player.sprintSpeed, V1.sprintSpeed)).toBeCloseTo(1, 2);
    expect(rel(tuning.player.accel, V1.accel)).toBeCloseTo(1, 2);
    expect(rel(tuning.player.gravity, V1.gravity)).toBeCloseTo(1, 2);
    expect(rel(tuning.camera.distance, V1.cameraDistance)).toBeCloseTo(1, 2);
    expect(rel(tuning.camera.height, V1.cameraHeight)).toBeCloseTo(1, 2);
    expect(rel(tuning.camera.shoulder, V1.shoulder)).toBeCloseTo(1, 2);
    expect(rel(tuning.biped.stanceWidth, V1.stanceWidth)).toBeCloseTo(1, 2);
    expect(rel(tuning.biped.stepHeight, V1.stepHeight)).toBeCloseTo(1, 2);
  });

  it('a roll covers the same number of body lengths', () => {
    expect((tuning.roll.speed * tuning.roll.duration) / H).toBeCloseTo(V1.rollSpeed * V1.rollDuration, 2);
  });

  it('step cadence (seconds between steps at walking pace) is unchanged', () => {
    expect(tuning.biped.stepThreshold / tuning.player.walkSpeed).toBeCloseTo(V1.stepThreshold / V1.walkSpeed, 3);
  });

  it('she leans the same angle at walking pace', () => {
    expect(tuning.biped.leanPerSpeed * tuning.player.walkSpeed).toBeCloseTo(V1.leanPerSpeed * V1.walkSpeed, 3);
  });
});

describe('atmosphere hits STYLE.md fog targets on flat ground', () => {
  const at = (d: number) => fogAt(d, tuning.look.fogDensity, tuning.look.fogPower);
  it('the far edge of a combat space (40 m) is about 35–50% fogged', () => {
    expect(at(40)).toBeGreaterThan(0.3);
    expect(at(40)).toBeLessThan(0.5);
  });
  it('landmark range (250 m) is about 70–85% fogged', () => {
    expect(at(250)).toBeGreaterThan(0.7);
    expect(at(250)).toBeLessThan(0.86);
  });
  it('power 2 reproduces classic exp² fog (v1 biomes)', () => {
    expect(fogAt(50, 0.02, 2)).toBeCloseTo(1 - Math.exp(-1), 6);
  });
});

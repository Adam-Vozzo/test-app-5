import { describe, expect, it } from 'vitest';
import { BIPED_GROUPS, TRIPOD_GROUPS, selectSteps, stepArc, type LegGaitState } from '../src/anim/gait';

const P = { threshold: 0.3, panicFactor: 3, joinFraction: 0.3 };
const legs = (errs: number[], stepping: number[] = []): LegGaitState[] =>
  errs.map((error, i) => ({ error, stepping: stepping.includes(i) }));

describe('selectSteps', () => {
  it('does nothing under threshold', () => {
    expect(selectSteps(legs([0.1, 0.2]), BIPED_GROUPS, P)).toEqual([]);
  });

  it('biped steps the foot with the larger error', () => {
    expect(selectSteps(legs([0.4, 0.6]), BIPED_GROUPS, P)).toEqual([1]);
  });

  it('biped never lifts both feet: waits while the other foot is stepping', () => {
    expect(selectSteps(legs([0.5, 0.2], [1]), BIPED_GROUPS, P)).toEqual([]);
  });

  it('panic overrides alternation for huge errors', () => {
    expect(selectSteps(legs([2.0, 0.2], [1]), BIPED_GROUPS, P)).toEqual([0]);
  });

  it('tripod: whole group joins when one member exceeds threshold', () => {
    const s = selectSteps(legs([0.35, 0.05, 0.05, 0.2, 0.15, 0.05]), TRIPOD_GROUPS, P);
    expect(s.sort()).toEqual([0, 3, 4]);
  });

  it('tripod: group-mates with near-zero error stay planted', () => {
    const s = selectSteps(legs([0.35, 0, 0, 0.0, 0.15, 0]), TRIPOD_GROUPS, P);
    expect(s.sort()).toEqual([0, 4]);
  });

  it('tripod groups alternate', () => {
    // Group A (0,3,4) mid-step: group B must wait even though it is over threshold.
    expect(selectSteps(legs([0, 0.5, 0.5, 0, 0, 0.5], [0, 3, 4]), TRIPOD_GROUPS, P)).toEqual([]);
    // Once A lands, B goes.
    expect(selectSteps(legs([0, 0.5, 0.5, 0, 0, 0.5]), TRIPOD_GROUPS, P).sort()).toEqual([1, 2, 5]);
  });

  it('picks the group with the larger error first', () => {
    const s = selectSteps(legs([0.4, 0.9, 0.1, 0.1, 0.1, 0.1]), TRIPOD_GROUPS, P);
    expect(s).toContain(1);
    expect(s).not.toContain(0);
  });
});

describe('stepArc', () => {
  it('is zero at ends and peaks mid-step', () => {
    expect(stepArc(0, 1)).toBeCloseTo(0);
    expect(stepArc(1, 1)).toBeCloseTo(0);
    expect(stepArc(0.5, 0.2)).toBeCloseTo(0.2);
  });
});

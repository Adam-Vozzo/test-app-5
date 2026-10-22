import { describe, expect, it } from 'vitest';
import { solveTwoBone, type V3 } from '../src/anim/ik';

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('solveTwoBone', () => {
  it('reaches a target within range and preserves bone lengths', () => {
    const root = v(0, 0, 0);
    const target = v(1.2, -0.5, 0.3);
    const j = v(0, 0, 0);
    const e = v(0, 0, 0);
    const r = solveTwoBone(root, target, v(0, 0, 5), 1, 1, j, e);
    expect(r.reached).toBe(true);
    expect(dist(e, target)).toBeLessThan(1e-6);
    expect(dist(root, j)).toBeCloseTo(1, 6);
    expect(dist(j, e)).toBeCloseTo(1, 6);
  });

  it('bends toward the pole', () => {
    const j = v(0, 0, 0);
    const e = v(0, 0, 0);
    solveTwoBone(v(0, 0, 0), v(0, -1.5, 0), v(0, -0.75, 3), 1, 1, j, e);
    expect(j.z).toBeGreaterThan(0.5);
    solveTwoBone(v(0, 0, 0), v(0, -1.5, 0), v(0, -0.75, -3), 1, 1, j, e);
    expect(j.z).toBeLessThan(-0.5);
  });

  it('clamps an out-of-reach target along the root→target line', () => {
    const j = v(0, 0, 0);
    const e = v(0, 0, 0);
    const r = solveTwoBone(v(0, 0, 0), v(10, 0, 0), v(0, 1, 0), 1, 0.8, j, e);
    expect(r.reached).toBe(false);
    expect(e.x).toBeCloseTo(1.8, 3);
    expect(Math.abs(e.y) + Math.abs(e.z)).toBeLessThan(1e-9);
  });

  it('clamps a too-close target to the minimum reach', () => {
    const j = v(0, 0, 0);
    const e = v(0, 0, 0);
    const r = solveTwoBone(v(0, 0, 0), v(0.01, 0, 0), v(0, 1, 0), 1, 0.6, j, e);
    expect(r.reached).toBe(false);
    expect(r.distance).toBeCloseTo(0.4, 3);
  });

  it('survives a pole collinear with the chain', () => {
    const j = v(0, 0, 0);
    const e = v(0, 0, 0);
    solveTwoBone(v(0, 0, 0), v(0, -1, 0), v(0, -5, 0), 1, 1, j, e);
    expect(Number.isFinite(j.x + j.y + j.z)).toBe(true);
    expect(dist(v(0, 0, 0), j)).toBeCloseTo(1, 6);
  });
});

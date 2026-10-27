import { describe, expect, it } from 'vitest';
import { Ribbon, type RibbonParams } from '../src/anim/ribbon';

const ROPE: RibbonParams = { gravity: 9.8, drag: 0.02, stiffness: 0 };
const segLens = (r: Ribbon) => {
  const out: number[] = [];
  for (let i = 1; i < r.count; i++) {
    const a = (i - 1) * 3;
    const b = i * 3;
    out.push(Math.hypot(r.pos[b] - r.pos[a], r.pos[b + 1] - r.pos[a + 1], r.pos[b + 2] - r.pos[a + 2]));
  }
  return out;
};
const tip = (r: Ribbon) => [...r.pos.slice((r.count - 1) * 3)];

describe('ribbon (blindfold tails)', () => {
  it('keeps its length while swinging', () => {
    const r = new Ribbon(6, 0.1);
    r.reset([0, 1.5, 0], [1, 0, 0]);
    for (let i = 0; i < 240; i++) r.step(1 / 60, [Math.sin(i * 0.1) * 0.3, 1.5, 0], [0, -1, 0], ROPE);
    for (const l of segLens(r)) expect(l).toBeCloseTo(0.1, 2);
  });

  it('hangs below the anchor with no stiffness', () => {
    const r = new Ribbon(6, 0.1);
    r.reset([0, 1.5, 0], [1, 0, 0]);
    for (let i = 0; i < 600; i++) r.step(1 / 60, [0, 1.5, 0], [0, 0, 1], ROPE);
    const [x, y, z] = tip(r);
    expect(y).toBeLessThan(1.5 - r.length * 0.95);
    expect(Math.hypot(x, z)).toBeLessThan(0.05);
  });

  it('trails behind a moving anchor', () => {
    const r = new Ribbon(6, 0.1);
    r.reset([0, 1.5, 0], [0, -1, 0]);
    // Anchor moves along -Z at 5 m/s: the tail should stream out toward +Z.
    let z = 0;
    for (let i = 0; i < 60; i++) {
      z -= 5 / 60;
      r.step(1 / 60, [0, 1.5, z], [0, -1, 0], ROPE);
    }
    expect(tip(r)[2]).toBeGreaterThan(z + 0.05);
  });

  it('holds its rest direction when stiff', () => {
    const r = new Ribbon(6, 0.1);
    r.reset([0, 1.5, 0], [0, -1, 0]);
    const back = [0, -0.6, 0.8];
    for (let i = 0; i < 300; i++) r.step(1 / 60, [0, 1.5, 0], back, { gravity: 9.8, drag: 0.05, stiffness: 60 });
    expect(tip(r)[2]).toBeGreaterThan(0.25);
  });

  it('survives zero, negative and huge time steps', () => {
    const r = new Ribbon(5, 0.12);
    r.reset([0, 1, 0], [0, -1, 0]);
    r.step(0, [0, 1, 0], [0, -1, 0], ROPE);
    r.step(-1, [0, 1, 0], [0, -1, 0], ROPE);
    r.step(10, [5, 1, 0], [0, -1, 0], ROPE);
    r.step(Number.NaN, [5, 1, 0], [0, -1, 0], ROPE);
    expect([...r.pos].every(Number.isFinite)).toBe(true);
    expect(r.pos[0]).toBe(5);
  });
});

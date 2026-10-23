import { describe, expect, it } from 'vitest';
import { finite, safeDiv, Spring } from '../src/core/math';

describe('NaN guards (tuning sliders can hit 0)', () => {
  it('safeDiv never returns NaN or Infinity', () => {
    expect(Number.isFinite(safeDiv(0, 0))).toBe(true);
    expect(Number.isFinite(safeDiv(5, 0))).toBe(true);
    expect(safeDiv(6, 3)).toBe(2);
  });
  it('finite replaces NaN/Infinity', () => {
    expect(finite(NaN)).toBe(0);
    expect(finite(Infinity, 2)).toBe(2);
    expect(finite(1.5)).toBe(1.5);
  });
  it('a spring fed NaN recovers instead of staying NaN forever', () => {
    const s = new Spring(200, 20);
    s.impulse(NaN);
    s.step(1 / 60);
    expect(s.x).toBe(0);
    s.impulse(1);
    s.step(1 / 60);
    expect(Number.isFinite(s.x)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { readStick } from '../src/core/stick';
import { tuning } from '../src/tuning';

const T = { radius: 60, deadzone: 0.12, sprintAt: 0.92 };

describe('the touch stick (pure)', () => {
  it('a thumb barely moved reads nothing', () => {
    const s = readStick(3, -4, T);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
    expect(s.sprint).toBe(false);
  });
  it('up the screen is forward, right is right, and the push ramps to 1 at the rim', () => {
    const half = readStick(0, -33, T);
    expect(half.y).toBeGreaterThan(0.3);
    expect(half.y).toBeLessThan(0.6);
    expect(half.x).toBeCloseTo(0, 6);
    const rim = readStick(60, 0, T);
    expect(rim.x).toBeCloseTo(1, 6);
    expect(rim.y).toBeCloseTo(0, 6);
  });
  it('past the rim it stays at 1 (the knob stops at the rim) and runs', () => {
    const s = readStick(0, -200, T);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 6);
    expect(Math.hypot(s.knobX, s.knobY)).toBeCloseTo(60, 6);
    expect(s.sprint).toBe(true);
    expect(readStick(0, -40, T).sprint).toBe(false);
  });
  it('the tuning keeps a dead zone and a sprint short of the rim', () => {
    const t = tuning.touch;
    expect(t.deadzone).toBeGreaterThan(0);
    expect(t.sprintAt).toBeGreaterThan(t.deadzone);
    expect(t.sprintAt).toBeLessThanOrEqual(1);
    expect(t.stickZone).toBeGreaterThan(0.25);
    expect(t.stickZone).toBeLessThan(0.6);
  });
});

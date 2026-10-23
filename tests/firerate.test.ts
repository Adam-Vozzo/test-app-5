import { describe, expect, it } from 'vitest';
import { stepFireRate } from '../src/weapons/firerate';

const interval = 60 / 660;

describe('stepFireRate', () => {
  it('fires on the first frame of input', () => {
    const s = { cooldown: 0 };
    expect(stepFireRate(s, 1 / 60, interval, true, true, 8)).toBe(1);
  });

  it('keeps the RPM at a low frame rate', () => {
    const s = { cooldown: 0 };
    let shots = 0;
    for (let i = 0; i < 20; i++) shots += stepFireRate(s, 0.05, interval, true, true, 8); // 1s at 20fps
    expect(shots).toBeGreaterThanOrEqual(10);
    expect(shots).toBeLessThanOrEqual(12);
  });

  it('regression: holding fire through a 2s reload does not dump the mag when it ends', () => {
    const s = { cooldown: 0 };
    for (let i = 0; i < 120; i++) stepFireRate(s, 1 / 60, interval, true, false, 8); // reloading, trigger held
    const firstFrame = stepFireRate(s, 1 / 60, interval, true, true, 8);
    expect(firstFrame).toBe(1);
    let next = 0;
    for (let i = 0; i < 5; i++) next += stepFireRate(s, 1 / 60, interval, true, true, 8);
    expect(next).toBeLessThanOrEqual(1); // ~83ms later at 660rpm: at most one more shot
  });

  it('semi-auto caps at one shot per press', () => {
    const s = { cooldown: -5 };
    expect(stepFireRate(s, 0.05, 0.01, true, true, 1)).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { feetPlane } from '../src/anim/plane';

const v = (x: number, y: number, z: number) => ({ x, y, z });
// Six feet, facing -Z: left at -x, right at +x, front at -z.
const flat = [v(-1, 0, -1), v(1, 0, -1), v(-1.2, 0, 0), v(1.2, 0, 0), v(-1, 0, 1), v(1, 0, 1)];

describe('feetPlane', () => {
  it('flat ground → straight up, centroid height', () => {
    const n = v(0, 0, 0);
    const h = feetPlane(flat, n);
    expect(n.y).toBeCloseTo(1);
    expect(h).toBeCloseTo(0);
  });
  it('front feet higher → nose-up normal tilts back (+z)', () => {
    const feet = flat.map((p) => v(p.x, -p.z * 0.5, p.z)); // y = 0.5 at front (z=-1)
    const n = v(0, 0, 0);
    feetPlane(feet, n);
    expect(n.y).toBeGreaterThan(0.8);
    expect(n.z).toBeGreaterThan(0.2);
  });
  it('right feet higher → normal tilts left (-x)', () => {
    const feet = flat.map((p) => v(p.x, p.x * 0.4, p.z));
    const n = v(0, 0, 0);
    feetPlane(feet, n);
    expect(n.x).toBeLessThan(-0.2);
    expect(n.y).toBeGreaterThan(0.8);
  });
  it('always returns an upward normal', () => {
    const n = v(0, 0, 0);
    feetPlane([...flat].reverse(), n);
    expect(n.y).toBeGreaterThan(0);
  });
});

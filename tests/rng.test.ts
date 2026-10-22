import { describe, expect, it } from 'vitest';
import { makeRng, seedFromUrl } from '../src/core/rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('differs across seeds and stays in [0,1)', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const x = a();
      const y = b();
      if (x === y) same++;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(same).toBe(0);
  });
  it('forks are deterministic and independent of parent consumption', () => {
    const a = makeRng(99);
    a();
    a();
    const fa = a.fork('props');
    const fb = makeRng(99).fork('props');
    expect(fa()).toBe(fb());
  });
  it('parses seeds from the URL', () => {
    expect(seedFromUrl('?seed=42', 7)).toBe(42);
    expect(seedFromUrl('?seed=beetle', 7)).toBe(seedFromUrl('?seed=beetle', 8));
    expect(seedFromUrl('', 7)).toBe(7);
  });
});

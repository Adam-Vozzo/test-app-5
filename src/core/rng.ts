// Seeded RNG. Never use Math.random() in game code.

export type Rng = {
  (): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  signed(): number;
  fork(salt: string | number): Rng;
  readonly seed: number;
};

/** FNV-1a string hash → uint32. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix two uint32s (used to derive child seeds). */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ b;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  // mulberry32
  const next = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.range = (min, max) => min + (max - min) * next();
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  next.signed = () => next() * 2 - 1;
  next.fork = (salt) => makeRng(hash2(seed >>> 0, typeof salt === 'number' ? salt : hashString(salt)));
  Object.defineProperty(next, 'seed', { value: seed >>> 0 });
  return next;
}

/** Seed from `?seed=` (number or any string); falls back to a time-derived seed. */
export function seedFromUrl(search: string, fallback: number): number {
  const p = new URLSearchParams(search).get('seed');
  if (p === null || p === '') return fallback >>> 0;
  const n = Number(p);
  return Number.isFinite(n) ? n >>> 0 : hashString(p);
}

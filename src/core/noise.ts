// Seeded 2D value noise + fBm. Pure; used for ground height and prop scatter.
import { hash2 } from './rng';

const fade = (t: number) => t * t * (3 - 2 * t);

function lattice(seed: number, ix: number, iz: number): number {
  return (hash2(hash2(seed, ix | 0), iz | 0) / 4294967295) * 2 - 1;
}

/** Smooth value noise in [-1, 1]. */
export function noise2(seed: number, x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fz = fade(z - iz);
  const a = lattice(seed, ix, iz);
  const b = lattice(seed, ix + 1, iz);
  const c = lattice(seed, ix, iz + 1);
  const d = lattice(seed, ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal sum of octaves, roughly in [-1, 1]. */
export function fbm(seed: number, x: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(seed + o * 1013, x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

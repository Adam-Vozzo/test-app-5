// Fit a body "up" from planted feet: cross(right-span, front-span). Pure, works on {x,y,z}.
import type { V3 } from './ik';

/**
 * Legs are ordered front→back in left/right pairs: [L0, R0, L1, R1, L2, R2].
 * Writes the unit normal of the feet plane (pointing up) into `out` and returns the centroid height.
 */
export function feetPlane(feet: readonly V3[], out: V3): number {
  const n = feet.length;
  const pairs = n >> 1;
  let lx = 0, ly = 0, lz = 0, rx = 0, ry = 0, rz = 0;
  let fx = 0, fy = 0, fz = 0, bx = 0, by = 0, bz = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = feet[i];
    cy += p.y;
    if (i % 2 === 0) { lx += p.x; ly += p.y; lz += p.z; } else { rx += p.x; ry += p.y; rz += p.z; }
    const row = i >> 1;
    if (row === 0) { fx += p.x; fy += p.y; fz += p.z; }
    if (row === pairs - 1) { bx += p.x; by += p.y; bz += p.z; }
  }
  // right span (left → right) and front span (back → front)
  const ax = (rx - lx) / pairs, ay = (ry - ly) / pairs, az = (rz - lz) / pairs;
  const sx = (fx - bx) / 2, sy = (fy - by) / 2, sz = (fz - bz) / 2;
  let nx = ay * sz - az * sy;
  let ny = az * sx - ax * sz;
  let nz = ax * sy - ay * sx;
  let len = Math.hypot(nx, ny, nz);
  if (len < 1e-6 || ny < 0) {
    if (len < 1e-6) { nx = 0; ny = 1; nz = 0; len = 1; } else { nx = -nx; ny = -ny; nz = -nz; }
  }
  out.x = nx / len;
  out.y = ny / len;
  out.z = nz / len;
  return cy / n;
}

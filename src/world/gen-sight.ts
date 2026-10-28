// Level generation: sight lines (LEVELS.md → Validation). What stands in the way of the landmark, and whether it
// can be seen from a point. Pure: no Three/DOM. The dressing uses it to stand vistas where the view is; validation
// uses it to check the spawn, the vistas and (in a spiral) the rooms.
import type { Arch, Box, Column, Planted } from './gen-dress';
import { rightOf, toLocal, toWorld, type Room } from './gen-space';

export const EYE = 1.6;

/**
 * An occluder: a box standing from y0 to y1, centred on (x, z), turned `yaw` (as a furnishing box is), `hx` and `hz`
 * its half sizes along its own X and Z.
 */
export interface Occluder {
  x: number;
  z: number;
  yaw: number;
  hx: number;
  hz: number;
  y0: number;
  y1: number;
}

export interface SightParts {
  rooms: Room[];
  boxes: Box[];
  columns: Column[];
  arches: Arch[];
  towers: Arch[];
  heroSwords: Planted[];
}

export function occludersOf(p: SightParts): Occluder[] {
  const out: Occluder[] = [];
  const box = (x: number, z: number, sx: number, sz: number, y0: number, y1: number, yaw = 0) => out.push({ x, z, yaw, hx: sx / 2, hz: sz / 2, y0, y1 });
  for (const b of p.boxes) box(b.x, b.z, b.sx, b.sz, b.y, b.y + b.h, b.yaw);
  for (const c of p.columns) box(c.x, c.z, 1.3, 1.3, c.y, c.y + c.h + 0.3);
  // Room slabs (their tops) and frames: an arch's piers and lintel (the opening is clear), or a pair of towers. A
  // frame turned `yaw` faces along the way, so its piers stand to either side of it.
  for (const r of p.rooms) box(r.x, r.z, r.w, r.d, r.y - 30, r.y, r.yaw);
  for (const a of p.arches) {
    const [rx, rz] = rightOf(a.yaw);
    for (const s of [-1, 1]) box(a.x + rx * s * (a.width / 2 + 1), a.z + rz * s * (a.width / 2 + 1), 2, 2.4, a.y, a.y + a.height, a.yaw);
    box(a.x, a.z, a.width + 4.6, 2.8, a.y + a.height, a.y + a.height + 1.9, a.yaw);
  }
  for (const a of p.towers) {
    const [rx, rz] = rightOf(a.yaw);
    for (const s of [-1, 1]) box(a.x + rx * s * towerOffset(a), a.z + rz * s * towerOffset(a), TOWER.base, TOWER.base, a.y, a.y + a.height + TOWER.cap, a.yaw);
  }
  for (const h of p.heroSwords) box(h.x, h.z, h.len * 0.12, h.len * 0.12, h.y, h.y + h.len * 0.85);
  return out;
}

/** The Moon's gateway towers: their base, the cap over the shaft, and how far out from the way's middle each stands. */
export const TOWER = { base: 2.4, cap: 2.6 };
export const towerOffset = (a: { width: number }) => a.width / 2 + 1.8;

/** Slab test: does the segment from a to b pass through the axis-aligned box? */
export function segmentHitsBox(a: [number, number, number], b: [number, number, number], o: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): boolean {
  let t0 = 0;
  let t1 = 1;
  const lo = [o.minX, o.minY, o.minZ];
  const hi = [o.maxX, o.maxY, o.maxZ];
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) {
      if (a[k] < lo[k] || a[k] > hi[k]) return false;
      continue;
    }
    let ta = (lo[k] - a[k]) / d;
    let tb = (hi[k] - a[k]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Does the segment pass through a turned occluder? (Into its own frame, then the slab test.) */
export function segmentHitsOccluder(a: [number, number, number], b: [number, number, number], o: Occluder): boolean {
  const c = Math.cos(o.yaw);
  const s = Math.sin(o.yaw);
  const loc = (p: [number, number, number]): [number, number, number] => {
    const dx = p[0] - o.x;
    const dz = p[2] - o.z;
    return [dx * c - dz * s, p[1], dx * s + dz * c];
  };
  return segmentHitsBox(loc(a), loc(b), { minX: -o.hx, maxX: o.hx, minY: o.y0, maxY: o.y1, minZ: -o.hz, maxZ: o.hz });
}

/** The landmark's telling parts (Justice: beam, pans and pillar; the Devil: brazier and horns): world points. */
export function landmarkPoints(lm: { x: number; z: number; y: number; h: number }, targets: [number, number][]): [number, number, number][] {
  return targets.map(([u, v]) => [lm.x + u * lm.h, lm.y + v * lm.h, lm.z]);
}

/** Can any telling part be seen from a point on the floor at (x, y, z)? */
export function seesFrom(points: [number, number, number][], occ: Occluder[], x: number, y: number, z: number): boolean {
  const eye: [number, number, number] = [x, y + EYE, z];
  return points.some((t) => !occ.some((o) => segmentHitsOccluder(eye, t, o)));
}

/** Where she'd stand in a room to look for the landmark: its edge nearest it, a few steps in. */
export function lookout(r: Room, lx: number, lz: number): [number, number] {
  const [du, dv] = toLocal(r, lx, lz);
  const len = Math.hypot(du, dv) || 1;
  const k = Math.min((r.w / 2 - 3) / Math.max(1e-6, Math.abs(du / len)), (r.d / 2 - 3) / Math.max(1e-6, Math.abs(dv / len)));
  return toWorld(r, (du / len) * k, (dv / len) * k);
}

/** Spots in a room to look from, best first: its lookout, then along its edges and its middle. */
export function spotsIn(r: Room, lx: number, lz: number): [number, number][] {
  const out: [number, number][] = [lookout(r, lx, lz)];
  const u = r.w / 2 - 3;
  const v = r.d / 2 - 3;
  for (const [a, b] of [
    [0, v],
    [0, -v],
    [u, 0],
    [-u, 0],
    [u, v],
    [-u, v],
    [u, -v],
    [-u, -v],
    [0, 0],
  ])
    out.push(toWorld(r, a, b));
  return out;
}

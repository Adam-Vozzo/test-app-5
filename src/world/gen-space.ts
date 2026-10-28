// Level generation, layer 3 (LEVELS.md → Space): embed the mission graph. Each node becomes a room kit and each
// edge a connector kit. Pure: no Three/DOM.
//
// Rooms are rectangles at any heading: a room is entered by its back edge and leaves by its far edge or a side.
// A connector runs straight out of one doorway and into the next, square to both edges (so its parapets run on
// flush), turning at most once on a round landing between them. Each dimension lays its rooms out by its own rule
// (`DimensionDef.layout`, LEVELS.md → Space):
//   - Justice weighs: a straight axis with two mirrored wings (the pans) off the mid lantern; a key at the end of
//     each, and the axis gate opens when both are set.
//   - The Devil spirals down the walls of a pit toward the pedestal at its centre.
//   - The Tower spirals up around the tower itself (the plan never overlaps: a fall drops into the void, never onto
//     a floor below).
//   - The Moon meanders toward the Moon, swinging from side to side.
// Every layout but Justice's keeps the shortcut loop: the mid lantern exits sideways, the loop rooms circle round,
// and the gate lands just ahead of the lantern, joined to it by the barred shortcut.
import type { Rng } from '../core/rng';
import type { DimensionDef, RoomKitDef, RoomKitId } from './dimensions';
import type { MissionGraph } from './gen-graph';

/** A room's edges, in its own frame: entered by the back, the way on by the front or a side. */
export type Side = 'back' | 'front' | 'left' | 'right';
export type ConnKind = 'bridge' | 'stairs' | 'shortcut' | 'branch';

/** The unit vector a yaw faces along (yaw 0 faces -Z, as the camera and dummies use). */
export const fwdOf = (yaw: number): [number, number] => [-Math.sin(yaw), -Math.cos(yaw)];
/** The unit vector to the right of a yaw. */
export const rightOf = (yaw: number): [number, number] => [Math.cos(yaw), -Math.sin(yaw)];
/** The yaw that faces along (dx, dz). */
export const headingOf = (dx: number, dz: number) => Math.atan2(-dx, -dz);
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface Door {
  side: Side;
  /** Gap width in the room's edge. */
  width: number;
  /** World position of the door's centre (on the edge). */
  x: number;
  z: number;
  /** The heading out through it. */
  yaw: number;
  connector: number;
}

export interface Room {
  node: number;
  kit: RoomKitId;
  /** Centre. */
  x: number;
  z: number;
  /** Heading of the room's axis, from its entry (the back edge) toward its far edge. */
  yaw: number;
  /** Across and along the room's own axis. */
  w: number;
  d: number;
  /** World-axis extents of its footprint (bounds and coarse tests). */
  sx: number;
  sz: number;
  /** The side the way on leaves by (null: a dead end). */
  exit: Side | null;
  /** Floor height (m). */
  y: number;
  doors: Door[];
  /** Sides built open (parapets) whatever the kit's edge: in a spiral, the side facing the pit or the tower. */
  open?: Side[];
}

export interface Connector {
  from: number;
  to: number;
  kind: ConnKind;
  /** Start (on `from`'s edge) and end (on `to`'s edge). */
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Where it turns, if it does: the centres of round landings (at most two). */
  bends: { x: number; z: number }[];
  width: number;
  y0: number;
  y1: number;
  /** An arch frames the far end (compression before a vista or a fight). */
  arch: boolean;
  /** Tall walls along it instead of parapets (a narrow pass). */
  walled: boolean;
}

/** A straight piece of a connector. */
export interface Seg {
  ax: number;
  az: number;
  ay: number;
  bx: number;
  bz: number;
  by: number;
  len: number;
  /** Heading from a to b. */
  yaw: number;
  /**
   * The level last stretch into a landing's centre, or the first out of it (which end: 'end' or 'start'). It lies
   * on the landing's disc, so only its parapets are built (up to the landing's ring).
   */
  landing: 'start' | 'end' | null;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Space {
  rooms: Room[];
  connectors: Connector[];
  /** Index into `connectors` of the shortcut (Justice: the axis gate the two keys open). */
  shortcut: number;
  /** Where the landmark stands (Justice and the Moon: beyond the exit; the Devil and the Tower: the spiral's centre). */
  landmark: { x: number; z: number };
}

// ---------------------------------------------------------------------------------------------------------------
// Frames

/** Room-local frame: u across (right is +), v along the axis (entry edge at -d/2). */
export function toWorld(r: { x: number; z: number; yaw: number }, u: number, v: number): [number, number] {
  const [rx, rz] = rightOf(r.yaw);
  const [fx, fz] = fwdOf(r.yaw);
  return [r.x + rx * u + fx * v, r.z + rz * u + fz * v];
}

/** World → room-local [u, v]. */
export function toLocal(r: { x: number; z: number; yaw: number }, x: number, z: number): [number, number] {
  const [rx, rz] = rightOf(r.yaw);
  const [fx, fz] = fwdOf(r.yaw);
  const dx = x - r.x;
  const dz = z - r.z;
  return [dx * rx + dz * rz, dx * fx + dz * fz];
}

const SIDE: Record<Side, [number, number]> = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] };
export const SIDES: Side[] = ['back', 'front', 'left', 'right'];
export const mirrorSide = (s: Side): Side => (s === 'left' ? 'right' : s === 'right' ? 'left' : s);

/** A point on a room's edge (`t` along it from its middle) and the heading out through it. */
export function sidePoint(r: Room, side: Side, t = 0): { x: number; z: number; yaw: number; nx: number; nz: number } {
  const [nu, nv] = SIDE[side];
  const u = nu !== 0 ? (nu * r.w) / 2 : t;
  const v = nv !== 0 ? (nv * r.d) / 2 : t;
  const [x, z] = toWorld(r, u, v);
  const yaw = wrapAngle(r.yaw + (side === 'front' ? 0 : side === 'back' ? Math.PI : side === 'left' ? Math.PI / 2 : -Math.PI / 2));
  const [nx, nz] = fwdOf(yaw);
  return { x, z, yaw, nx, nz };
}

/** Recompute a room's world extents after placing or turning it. */
export function settle(r: Room) {
  const [rx, rz] = rightOf(r.yaw);
  const [fx, fz] = fwdOf(r.yaw);
  r.sx = Math.abs(rx) * r.w + Math.abs(fx) * r.d;
  r.sz = Math.abs(rz) * r.w + Math.abs(fz) * r.d;
}

/** The axis-aligned box around a room's footprint. */
export const roomRect = (r: Room, margin = 0): Rect => ({
  minX: r.x - r.sx / 2 - margin,
  maxX: r.x + r.sx / 2 + margin,
  minZ: r.z - r.sz / 2 - margin,
  maxZ: r.z + r.sz / 2 + margin,
});

export const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

/** Is a world point on a room's floor (`inset` in from its edges)? */
export function inRoom(r: Room, x: number, z: number, inset = 0) {
  const [u, v] = toLocal(r, x, z);
  return Math.abs(u) <= r.w / 2 - inset && Math.abs(v) <= r.d / 2 - inset;
}

// ---------------------------------------------------------------------------------------------------------------
// Connectors

/**
 * A landing's parapet ring. Wide enough that its two openings (one per run) stay apart at the sharpest turn the
 * layouts make (about 95°), so neither run's parapets reach across the other's way.
 */
export const landingRadius = (c: { width: number }) => c.width / 2 + 2.2;
/** A landing's disc (its rim reaches past the parapet ring): flat, so the runs climb only up to here. */
export const landingFlat = (c: { width: number }) => landingRadius(c) + 0.6;

/**
 * A connector's straight pieces: each run from door or landing to the next, split where it meets a landing's disc
 * (the stretch on the disc is level). Height rises evenly along the pieces off the discs.
 */
export function segmentsOf(c: Connector): Seg[] {
  const pts: [number, number][] = [[c.ax, c.az], ...c.bends.map((b): [number, number] => [b.x, b.z]), [c.bx, c.bz]];
  const F = landingFlat(c);
  // Runs, then pieces: [x0, z0, x1, z1, level?, landing end].
  const pieces: [number, number, number, number, boolean, 'start' | 'end' | null][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const fromBend = i > 0;
    const toBend = i + 1 < pts.length - 1;
    // A landing keeps its whole disc flat: between two landings they share a short run; from a door (kept STUB from a
    // bend) the climb takes what's left. (Halving a door's run as well cut a landing short of its disc, and the disc's
    // rim stood proud of the stairs' top: a lip she caught on.)
    const flat = fromBend && toBend ? Math.min(F, len / 2) : Math.min(F, len);
    const a = fromBend ? flat : 0;
    const b = toBend ? Math.max(a, len - flat) : len;
    if (fromBend) pieces.push([ax, az, ax + ux * a, az + uz * a, true, 'start']);
    pieces.push([ax + ux * a, az + uz * a, ax + ux * b, az + uz * b, false, null]);
    if (toBend) pieces.push([ax + ux * b, az + uz * b, bx, bz, true, 'end']);
  }
  const lens = pieces.map(([x0, z0, x1, z1]) => Math.hypot(x1 - x0, z1 - z0));
  const climb = pieces.reduce((t, p, i) => t + (p[4] ? 0 : lens[i]), 0) || 1;
  const out: Seg[] = [];
  let y = c.y0;
  pieces.forEach(([ax, az, bx, bz, level, landing], i) => {
    const by = level ? y : y + ((c.y1 - c.y0) * lens[i]) / climb;
    if (lens[i] > 1e-6) out.push({ ax, az, ay: y, bx, bz, by, len: lens[i], yaw: headingOf(bx - ax, bz - az), landing });
    y = by;
  });
  return out;
}

export const connLength = (c: Connector) => segmentsOf(c).reduce((a, s) => a + s.len, 0);
/** Heading into the far room (along the last run). */
export const connEndYaw = (c: Connector) => {
  const s = segmentsOf(c);
  return s[s.length - 1].yaw;
};
/** Heading out of the near room (along the first run). */
export const connStartYaw = (c: Connector) => segmentsOf(c)[0].yaw;
/** Each landing's height. */
export const bendYs = (c: Connector) => segmentsOf(c).filter((g) => g.landing === 'end').map((g) => g.by);

// ---------------------------------------------------------------------------------------------------------------
// Oriented boxes (separating axes) for overlap tests

export interface Obb {
  x: number;
  z: number;
  /** Unit axes and half sizes along them. */
  ux: number;
  uz: number;
  vx: number;
  vz: number;
  hu: number;
  hv: number;
}

export function roomObb(r: Room, margin = 0): Obb {
  const [ux, uz] = rightOf(r.yaw);
  const [vx, vz] = fwdOf(r.yaw);
  return { x: r.x, z: r.z, ux, uz, vx, vz, hu: r.w / 2 + margin, hv: r.d / 2 + margin };
}

/** A connector's footprint: each run as a box (its parapets included), and the landing. */
export function connObbs(c: Connector, margin = 0): Obb[] {
  const out: Obb[] = [];
  for (const s of segmentsOf(c)) {
    const [vx, vz] = fwdOf(s.yaw);
    const [ux, uz] = rightOf(s.yaw);
    out.push({ x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2, ux, uz, vx, vz, hu: c.width / 2 + 1 + margin, hv: s.len / 2 + margin });
  }
  for (const b of c.bends) {
    const R = landingRadius(c) + margin;
    out.push({ x: b.x, z: b.z, ux: 1, uz: 0, vx: 0, vz: 1, hu: R, hv: R });
  }
  return out;
}

export function obbOverlap(a: Obb, b: Obb): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const [nx, nz] of [
    [a.ux, a.uz],
    [a.vx, a.vz],
    [b.ux, b.uz],
    [b.vx, b.vz],
  ]) {
    const ra = a.hu * Math.abs(a.ux * nx + a.uz * nz) + a.hv * Math.abs(a.vx * nx + a.vz * nz);
    const rb = b.hu * Math.abs(b.ux * nx + b.uz * nz) + b.hv * Math.abs(b.vx * nx + b.vz * nz);
    if (Math.abs(dx * nx + dz * nz) >= ra + rb - 1e-9) return false;
  }
  return true;
}

export const anyOverlap = (as: Obb[], bs: Obb[]) => as.some((a) => bs.some((b) => obbOverlap(a, b)));

// ---------------------------------------------------------------------------------------------------------------
// Placement

/** Shortest straight run into or out of a landing (m): room for the landing and a step either side. */
const STUB = (dim: DimensionDef) => landingFlat(dim.connector) + 1.5;
/** A connector this nearly straight is built straight. */
const STRAIGHT = 0.1;

/**
 * Solve for a run out of door (px, pz) heading `a`, turning on a landing into a run heading `b` that ends at
 * (qx, qz): the landing is where the two lines cross. Returns the two run lengths, or null if they don't meet
 * ahead of both doors.
 */
export function solveBend(px: number, pz: number, a: number, qx: number, qz: number, b: number): { s: number; t: number } | null {
  const [ax, az] = fwdOf(a);
  const [bx, bz] = fwdOf(b);
  const wx = qx - px;
  const wz = qz - pz;
  // s·A + t·B = W
  const det = ax * bz - az * bx;
  if (Math.abs(det) < 1e-6) {
    // Parallel: only a straight run on the same line will do.
    const lateral = Math.abs(ax * wz - az * wx);
    const along = ax * wx + az * wz;
    if (lateral < 0.05 && along > 0 && ax * bx + az * bz > 0.999) return { s: along, t: 0 };
    return null;
  }
  const s = (wx * bz - wz * bx) / det;
  const t = (ax * wz - az * wx) / det;
  return { s, t };
}

function makeRoom(node: number, kit: RoomKitId, def: RoomKitDef, rng: Rng): Room {
  // Even sizes keep flagstone grids and mirrored props tidy.
  const w = 2 * Math.round(rng.range(def.w[0], def.w[1]) / 2);
  const d = 2 * Math.round(rng.range(def.d[0], def.d[1]) / 2);
  return { node, kit, x: 0, z: 0, yaw: 0, w, d, sx: w, sz: d, exit: null, y: def.floor, doors: [] };
}

/** Put a room with its back door at (x, z), facing `yaw`. */
function standAt(r: Room, x: number, z: number, yaw: number) {
  r.yaw = wrapAngle(yaw);
  const [fx, fz] = fwdOf(r.yaw);
  r.x = x + (fx * r.d) / 2;
  r.z = z + (fz * r.d) / 2;
  settle(r);
}

class Layout {
  rooms: Room[] = [];
  connectors: Connector[] = [];

  constructor(
    readonly dim: DimensionDef,
    readonly g: MissionGraph,
    readonly rng: Rng,
  ) {}

  room(node: number): Room {
    const nd = this.g.nodes[node];
    return makeRoom(node, nd.kit, this.dim.kits[nd.kit], this.rng);
  }

  /** Does a room fit among those placed (2 m apart) and clear of every connector? */
  fits(r: Room, ignore: number[] = []): boolean {
    // 2 m apart: a metre round each (the same both ways round, turned or not).
    const box = roomObb(r, 1);
    if (this.rooms.some((o) => o !== r && obbOverlap(box, roomObb(o, 1)))) return false;
    return this.connectors.every((c) => ignore.includes(c.from) || ignore.includes(c.to) || c.from === r.node || c.to === r.node || !anyOverlap([roomObb(r, 1)], connObbs(c)));
  }

  /** Does a connector between a and b clear every other room and connector? */
  connFits(c: Connector): boolean {
    const mine = connObbs(c, 1);
    if (this.rooms.some((r) => r.node !== c.from && r.node !== c.to && anyOverlap(mine, [roomObb(r)]))) return false;
    return this.connectors.every((d) => d.from === c.from || d.from === c.to || d.to === c.from || d.to === c.to || !anyOverlap(mine, connObbs(d)));
  }

  /** Join a's door on `as` to b's door on `bs` (turning at `bend` if given), and record both doors. */
  connect(a: Room, as: Side, b: Room, bs: Side, kind: ConnKind, bends: { x: number; z: number }[], arch: boolean, walled: boolean): number {
    const c = this.draft(a, as, b, bs, kind, bends, arch, walled);
    const idx = this.connectors.length;
    this.connectors.push(c);
    // The doorway is exactly the connector's width: its parapets (or walls) then run on flush from the room's, with no
    // end face standing into the opening for her to walk into at the foot of the stairs.
    const pa = sidePoint(a, as);
    const pb = sidePoint(b, bs);
    a.doors.push({ side: as, width: c.width, x: pa.x, z: pa.z, yaw: pa.yaw, connector: idx });
    b.doors.push({ side: bs, width: c.width, x: pb.x, z: pb.z, yaw: pb.yaw, connector: idx });
    return idx;
  }

  draft(a: Room, as: Side, b: Room, bs: Side, kind: ConnKind, bends: { x: number; z: number }[], arch: boolean, walled: boolean): Connector {
    const pa = sidePoint(a, as);
    const pb = sidePoint(b, bs);
    const width = kind === 'branch' ? this.dim.connector.width - 1 : this.dim.connector.width;
    const c: Connector = { from: a.node, to: b.node, kind, ax: pa.x, az: pa.z, bx: pb.x, bz: pb.z, bends, width, y0: a.y, y1: b.y, arch, walled };
    if (kind !== 'shortcut' && kind !== 'branch' && Math.abs(b.y - a.y) > 0.05) c.kind = 'stairs';
    return c;
  }

  /** Is this connector gentle enough to climb (each run no steeper than the dimension allows)? */
  climbable(c: Connector): boolean {
    return connLength(c) >= 4 && segmentsOf(c).every((g) => g.len < 1e-6 || Math.abs(g.by - g.ay) / g.len <= this.dim.connector.maxSlope + 1e-9);
  }

  /**
   * Place `b` after `a`, leaving by side `as` (heading `out`) and arriving facing `yaw`: a straight run of `len`, or
   * a run of `s`, a landing, and a run of `t`. Returns the bend (or null) — b's pose is set.
   */
  lay(a: Room, as: Side, b: Room, yaw: number, s: number, t: number): { x: number; z: number } | null {
    const p = sidePoint(a, as);
    const turn = wrapAngle(yaw - p.yaw);
    if (Math.abs(turn) < STRAIGHT || t <= 0) {
      const len = s + Math.max(0, t);
      standAt(b, p.x + p.nx * len, p.z + p.nz * len, p.yaw);
      return null;
    }
    const bx = p.x + p.nx * s;
    const bz = p.z + p.nz * s;
    const [fx, fz] = fwdOf(yaw);
    standAt(b, bx + fx * t, bz + fz * t, yaw);
    return { x: bx, z: bz };
  }

  /**
   * Steer: lay `b` after `a` leaving by one of `sides`, heading as near `want` as the bend allows, with a connector
   * from the dimension's length range (longer if the rise needs it). Tries a few times; returns the connector's
   * index, or -1.
   */
  step(a: Room, sides: Side[], b: Room, want: number, opts: { arch: boolean; walled: boolean; maxBend: number; len?: [number, number] }): number {
    const [lo, hi] = opts.len ?? this.dim.connector.length;
    const stub = STUB(this.dim);
    const order = [...sides].sort((x, y) => Math.abs(wrapAngle(want - sidePoint(a, x).yaw)) - Math.abs(wrapAngle(want - sidePoint(a, y).yaw)));
    for (let attempt = 0; attempt < 10; attempt++) {
      const as = order[Math.min(order.length - 1, attempt < 6 ? 0 : attempt - 5)];
      const out = sidePoint(a, as).yaw;
      let turn = wrapAngle(want - out) + this.rng.range(-0.08, 0.08) * (attempt > 0 ? 1 : 0);
      turn = Math.max(-opts.maxBend, Math.min(opts.maxBend, turn));
      const rise = Math.abs(b.y - a.y) / this.dim.connector.maxSlope;
      const bent = Math.abs(turn) >= STRAIGHT;
      // A landing's disc is level: a bent run climbs only off it.
      let len = Math.max(this.rng.range(lo, hi), rise + (bent ? 2 * landingFlat(this.dim.connector) : 0));
      if (bent) len = Math.max(len, stub * 2 + 0.5);
      const s = Math.abs(turn) < STRAIGHT ? len : Math.max(stub, len * this.rng.range(0.4, 0.6));
      const t = Math.abs(turn) < STRAIGHT ? 0 : Math.max(stub, len - s);
      const bend = this.lay(a, as, b, out + turn, s, t);
      // A pass is walled only where it runs straight.
      const walled = opts.walled && !bend;
      const c = this.draft(a, as, b, 'back', 'bridge', bend ? [bend] : [], opts.arch, walled);
      if (!this.fits(b) || !this.connFits(c) || !this.climbable(c)) continue;
      this.rooms.push(b);
      a.exit = as;
      return this.connect(a, as, b, 'back', 'bridge', bend ? [bend] : [], opts.arch, walled);
    }
    return -1;
  }

  /**
   * Close: join a (by one of `sides`) to b's door on `bs`, both already placed. Straight if they line up; else turning
   * once where their doors' lines cross; else twice (a stub out of each door, and a run across between them). Returns
   * the connector's index, or -1.
   */
  close(a: Room, sides: Side[], b: Room, bs: Side, kind: ConnKind, arch: boolean, maxBend: number): number {
    const stub = STUB(this.dim);
    const q = sidePoint(b, bs);
    const inYaw = wrapAngle(q.yaw + Math.PI);
    const [ix, iz] = fwdOf(inYaw);
    for (const as of sides) {
      const p = sidePoint(a, as);
      const routes: { x: number; z: number }[][] = [];
      const sol = solveBend(p.x, p.z, p.yaw, q.x, q.z, inYaw);
      if (sol && sol.t === 0 && sol.s >= 4) routes.push([]);
      else if (sol && sol.s >= stub && sol.t >= stub && Math.abs(wrapAngle(inYaw - p.yaw)) <= maxBend) routes.push([{ x: p.x + p.nx * sol.s, z: p.z + p.nz * sol.s }]);
      // Twice: out of a's door, across, and into b's.
      for (const s1 of [stub, stub + 4, stub + 9]) {
        for (const s2 of [stub, stub + 4, stub + 9]) {
          const p1 = { x: p.x + p.nx * s1, z: p.z + p.nz * s1 };
          const p2 = { x: q.x - ix * s2, z: q.z - iz * s2 };
          const mid = Math.hypot(p2.x - p1.x, p2.z - p1.z);
          if (mid < stub * 2) continue;
          const m = headingOf(p2.x - p1.x, p2.z - p1.z);
          if (Math.abs(wrapAngle(m - p.yaw)) > maxBend || Math.abs(wrapAngle(inYaw - m)) > maxBend) continue;
          routes.push([p1, p2]);
        }
      }
      for (const bends of routes) {
        const c = this.draft(a, as, b, bs, kind, bends, arch, false);
        if (!this.connFits(c) || !this.climbable(c)) continue;
        if (kind !== 'shortcut') a.exit = as;
        return this.connect(a, as, b, bs, kind, bends, arch, false);
      }
    }
    return -1;
  }

  /** Forget every room and connector placed since (and the doors they made). */
  undo(rooms: number, connectors: number) {
    for (const r of this.rooms.slice(rooms)) r.doors = [];
    this.rooms.length = rooms;
    this.connectors.length = connectors;
    for (const r of this.rooms) r.doors = r.doors.filter((d) => d.connector < connectors);
  }

  /**
   * Close a loop from both ends: lay `r` backwards from `to`'s back door (out along it, perhaps a landing, then r's
   * front door facing back the way it came), join r to `to`, then join `a` (by one of `sides`) to r. Tries a spread
   * of poses for r; true if one works.
   */
  meet(a: Room, sides: Side[], r: Room, to: Room, maxBend: number): boolean {
    const q = sidePoint(to, 'back');
    const stub = STUB(this.dim);
    const turns = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05].filter((t) => Math.abs(t) <= maxBend);
    for (let attempt = 0; attempt < 24; attempt++) {
      const turn = turns[attempt % turns.length];
      const len = this.rng.range(this.dim.connector.length[0], this.dim.connector.length[1]) + Math.floor(attempt / turns.length) * 3;
      const s = turn === 0 ? len : Math.max(stub, len / 2);
      const t = turn === 0 ? 0 : Math.max(stub, len / 2);
      // Out from the gate's door: a run of s, a turn, a run of t to r's front door, which faces back along it.
      const bx = q.x + q.nx * s;
      const bz = q.z + q.nz * s;
      const [dx, dz] = fwdOf(wrapAngle(q.yaw + turn));
      const px = bx + dx * t;
      const pz = bz + dz * t;
      r.yaw = headingOf(-dx, -dz);
      const [fx, fz] = fwdOf(r.yaw);
      r.x = px - (fx * r.d) / 2;
      r.z = pz - (fz * r.d) / 2;
      settle(r);
      if (!this.fits(r)) continue;
      const nr = this.rooms.length;
      const nc = this.connectors.length;
      this.rooms.push(r);
      const c1 = this.close(r, ['front'], to, 'back', 'bridge', true, maxBend) >= 0;
      if (c1 && this.close(a, sides, r, 'back', 'bridge', this.framing(r.node, 12).arch, maxBend) >= 0) return true;
      this.undo(nr, nc);
    }
    return false;
  }

  /** Branches: a cache room off a free side of its host, straight out, wherever it fits. */
  branch(host: Room, node: number, sides: Side[]): boolean {
    const free = sides.filter((s) => !host.doors.some((d) => d.side === s));
    for (const s of shuffle(free, this.rng)) {
      const r = this.room(node);
      r.y = host.y;
      const len = this.rng.range(this.dim.connector.branchLength[0], this.dim.connector.branchLength[1]);
      const p = sidePoint(host, s);
      standAt(r, p.x + p.nx * len, p.z + p.nz * len, p.yaw);
      const c = this.draft(host, s, r, 'back', 'branch', [], false, false);
      if (!this.fits(r) || !this.connFits(c)) continue;
      this.rooms.push(r);
      this.connect(host, s, r, 'back', 'branch', [], false, false);
      return true;
    }
    return false;
  }

  /** Compression before a release or a fight: an arch frames the next room, sometimes down a walled pass. */
  framing(node: number, len: number) {
    const nd = this.g.nodes[node];
    const arch = nd.vista || nd.template !== null || nd.kind === 'miniboss' || nd.kind === 'gate' || nd.kind === 'key';
    return { arch, walled: arch && len >= 10 && this.rng.chance(0.5) };
  }
}

/** Why the last embed gave up (for the validation report). */
export let embedFailure = '';
const fail = (why: string): null => {
  embedFailure = why;
  return null;
};

/** Layer 3. Returns null if the layout can't be closed within its limits (the caller reseeds). */
export function embed(dim: DimensionDef, g: MissionGraph, rng: Rng): Space | null {
  return g.wings ? embedWeighing(dim, g, rng) : embedPath(dim, g, rng);
}

/** Heights: each critical room past the first steps by `descent`, except inside the loop (it keeps the lantern's level). */
function heights(dim: DimensionDef, g: MissionGraph, rooms: Map<number, Room>) {
  let drop = 0;
  const firstLoop = g.loop.length ? g.nodes[g.loop[0]].index : Infinity;
  const gate = g.nodes[g.shortcut.gate].index;
  for (const id of g.critical) {
    const i = g.nodes[id].index;
    if (i > 0 && (i < firstLoop || i > gate) && !g.wings) drop += dim.descent;
    rooms.get(id)!.y -= drop;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The Devil, the Tower and the Moon: a path that steers by its dimension's rule, with the shortcut loop

function embedPath(dim: DimensionDef, g: MissionGraph, rng: Rng): Space | null {
  const L = new Layout(dim, g, rng);
  const lay = dim.layout;
  const crit = g.critical;
  const n = crit.length;
  const rooms = new Map<number, Room>();
  for (const id of crit) rooms.set(id, L.room(id));
  heights(dim, g, rooms);
  const at = (i: number) => rooms.get(crit[i])!;
  const midIdx = g.nodes[g.shortcut.lantern].index;
  const gateIdx = g.nodes[g.shortcut.gate].index;
  const loopIdx = g.loop.map((id) => g.nodes[id].index);

  const start = at(0);
  const yaw0 = rng.range(-Math.PI, Math.PI);
  standAt(start, 0, 0, yaw0);
  L.rooms.push(start);
  const [sx, sz] = toWorld(start, 0, -start.d / 2);

  // The rule's sense of direction.
  const turnSense = rng.chance(0.5) ? 1 : -1;
  const [lx, lz] = fwdOf(yaw0 + turnSense * (Math.PI / 2));
  const R0 = lay.radius?.[0] ?? 0;
  const R1 = lay.radius?.[1] ?? 0;
  const centre = { x: sx + lx * R0, z: sz + lz * R0 };
  // The Moon: swing to one side for a room or two, then the other, around the heading toward the Moon.
  const swings: number[] = [];
  let swing = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < n; i++) {
    if (i > 0 && rng.chance(0.6)) swing = -swing;
    // The first causeway runs straight at the Moon: the spawn looks down it, between the first pair of towers.
    swings.push(i <= 1 ? 0 : swing * rng.range(lay.swing?.[0] ?? 0, lay.swing?.[1] ?? 0));
  }
  const want = (a: Room, i: number, b: Room): number => {
    if (lay.kind === 'meander') return wrapAngle(yaw0 + swings[i]);
    // A spiral: aim for the next point on a circle that tightens from R0 to R1 around the centre.
    const p = sidePoint(a, 'front');
    const theta = Math.atan2(p.z - centre.z, p.x - centre.x);
    const R = R0 + (R1 - R0) * (i / (n - 1));
    const stepLen = (dim.connector.length[0] + dim.connector.length[1]) / 2 + b.d / 2;
    // Sense: the way the start heads round the centre.
    const [f0x, f0z] = fwdOf(yaw0);
    const sense = Math.sign((sx - centre.x) * f0z - (sz - centre.z) * f0x) || 1;
    const th = theta + sense * (stepLen / Math.max(R, 1));
    return headingOf(centre.x + Math.cos(th) * R - p.x, centre.z + Math.sin(th) * R - p.z);
  };
  const sidesOf = (r: Room): Side[] => (dim.kits[r.kit].turns ? ['front', 'left', 'right'] : ['front']);

  for (let i = 1; i < n; i++) {
    const a = at(i - 1);
    const b = at(i);
    if (loopIdx.includes(i) || i === gateIdx) continue;
    // After the gate, the way on leaves by the gate's far side (its other side takes the shortcut).
    const prev = i === gateIdx + 1 ? at(gateIdx) : a;
    const sides = i === gateIdx + 1 ? [prev.exit!] : sidesOf(prev);
    const f = L.framing(crit[i], dim.connector.length[1]);
    if (L.step(prev, sides, b, want(prev, i, b), { ...f, maxBend: lay.bend }) < 0) return fail("a room on the way wouldn't fit");

    if (i === midIdx) {
      // The loop: the lantern leaves sideways (outward from a spiral's centre), the gate sits just ahead of it.
      const lantern = b;
      const lf = sidePoint(lantern, 'front');
      const outward = (s: Side) => {
        const p = sidePoint(lantern, s);
        return (p.x - centre.x) * p.nx + (p.z - centre.z) * p.nz;
      };
      const S: Side = lay.kind === 'meander' ? (rng.chance(0.5) ? 'left' : 'right') : outward('left') > outward('right') ? 'left' : 'right';
      const ns = sidePoint(lantern, S);
      const gate = at(gateIdx);
      // The gate faces away from the loop side: entered from the loop, it leaves toward the lantern's heading.
      const gYaw = headingOf(-ns.nx, -ns.nz);
      const shortcut = rng.range(dim.loop.shortcut[0] + 2, Math.min(dim.loop.shortcut[1], 22));
      gate.yaw = wrapAngle(gYaw);
      gate.x = lf.x + lf.nx * (shortcut + gate.w / 2);
      gate.z = lf.z + lf.nz * (shortcut + gate.w / 2);
      settle(gate);
      // Which of the gate's sides faces on (the way on), and which faces back at the lantern (the shortcut).
      const onward: Side = sidePoint(gate, 'left').nx * lf.nx + sidePoint(gate, 'left').nz * lf.nz > 0 ? 'left' : 'right';
      gate.exit = onward;
      if (!L.fits(gate)) return fail("the gate wouldn't fit");
      L.rooms.push(gate);
      const toLantern = mirrorSide(onward);
      // The loop rooms go out on the loop side, well clear of the gate, and come back: all but the last step out
      // from the lantern (steering for points beyond where the last will stand), and the last is laid backwards from
      // the gate's back door and joined to them in the middle.
      const k = loopIdx.length;
      const fx = lf.nx;
      const fz = lf.nz;
      const span = Math.hypot(gate.x - lantern.x, gate.z - lantern.z);
      const lastRoom = at(loopIdx[k - 1]);
      const midLen = (dim.connector.length[0] + dim.connector.length[1]) / 2;
      let ok = false;
      for (let attempt = 0; attempt < 8 && !ok; attempt++) {
        const placedBefore = L.rooms.length;
        const connBefore = L.connectors.length;
        // How far out the last room's back door will be (laid straight back from the gate), and a margin past it.
        const reach = gate.d / 2 + midLen + lastRoom.d + rng.range(5, 12) + attempt * 3;
        let prev = lantern;
        let prevSides: Side[] = [S];
        let good = true;
        for (let j = 0; j < k - 1 && good; j++) {
          const r = at(loopIdx[j]);
          const along = k === 2 ? rng.range(-0.25, 0.2) * span : (j === 0 ? -0.35 : 0.5) * span;
          const out = reach + r.d / 2 + (j === 0 ? 0 : 4);
          const tx = lantern.x + fx * along + ns.nx * out;
          const tz = lantern.z + fz * along + ns.nz * out;
          const from = sidePoint(prev, prevSides[0]);
          const need = Math.max(dim.connector.length[0], Math.hypot(tx - from.x, tz - from.z) - r.d / 2);
          const f = L.framing(r.node, need);
          good = L.step(prev, prevSides, r, headingOf(tx - from.x, tz - from.z), { ...f, maxBend: lay.loopBend, len: [need - 2, need + 2] }) >= 0;
          prev = r;
          prevSides = sidesOf(r);
        }
        if (good && L.meet(prev, prevSides, lastRoom, gate, lay.loopBend)) {
          ok = true;
          break;
        }
        L.undo(placedBefore, connBefore);
      }
      if (!ok) return fail("the loop wouldn't close");
      lantern.exit = S;
      // The shortcut: the lantern's far edge straight to the gate's near side, barred until opened from the gate.
      if (L.close(lantern, ['front'], gate, toLantern, 'shortcut', true, 0) < 0) return fail("the shortcut wouldn't fit");
      gate.exit = onward;
      i = gateIdx;
    }
  }
  const last = at(n - 1);
  if (!lastExitDoor(last)) return fail("no exit");
  for (const nd of g.nodes) {
    if (nd.kind !== 'branch') continue;
    const host = L.rooms.find((r) => r.node === nd.host)!;
    if (!L.branch(host, nd.id, ['left', 'right'])) return fail("a branch wouldn't fit");
  }
  const landmark = lay.kind === 'meander' ? ahead(dim, last, sx, sz, yaw0) : spiralCentre(L.rooms.filter((r) => crit.includes(r.node)), centre);
  // A spiral's rooms are galleries round the pit (or the tower): the side facing it stands open.
  if (lay.kind === 'spiral') {
    for (const r of L.rooms) {
      const l = Math.hypot(landmark.x - r.x, landmark.z - r.z) || 1;
      r.open = (['left', 'right', 'front', 'back'] as Side[]).filter((sd) => {
        const p = sidePoint(r, sd);
        return (p.nx * (landmark.x - r.x) + p.nz * (landmark.z - r.z)) / l > 0.45;
      });
    }
  }
  return { rooms: L.rooms, connectors: L.connectors, shortcut: L.connectors.findIndex((c) => c.kind === 'shortcut'), landmark };
}

/** The way on: a gate in the exit room's far edge (no connector; the builder veils it). */
function lastExitDoor(last: Room): boolean {
  const p = sidePoint(last, 'front');
  last.doors.push({ side: 'front', width: 7, x: p.x, z: p.z, yaw: p.yaw, connector: -1 });
  last.exit = 'front';
  return true;
}

/**
 * The landmark beyond the exit, along `yaw` (the exit's heading, or the Moon's: the way the whole meander leads),
 * and far enough from the spawn to sit in the bright fog.
 */
function beyond(dim: DimensionDef, last: Room, sx: number, sz: number, yaw = last.yaw) {
  const p = sidePoint(last, 'front');
  const [nx, nz] = fwdOf(yaw);
  let k = dim.landmark.beyondExit;
  while (Math.hypot(p.x + nx * k - sx, p.z + nz * k - sz) < dim.landmark.fromStart) k += 10;
  return { x: p.x + nx * k, z: p.z + nz * k };
}

/**
 * The Moon: straight ahead of the spawn (the way the whole meander leads), past the exit and far enough to sit in
 * the bright fog. The first causeway runs at it, between the first pair of towers.
 */
function ahead(dim: DimensionDef, last: Room, sx: number, sz: number, yaw: number) {
  const [nx, nz] = fwdOf(yaw);
  const past = (last.x - sx) * nx + (last.z - sz) * nz + dim.landmark.beyondExit;
  const k = Math.max(dim.landmark.fromStart, past);
  return { x: sx + nx * k, z: sz + nz * k };
}

/**
 * The centre the spiral actually turned round (a least-squares circle through its rooms), so the pit or the tower
 * stands where the way curls about it. Falls back to the planned centre if the fit comes out near a room.
 */
function spiralCentre(rooms: Room[], planned: { x: number; z: number }) {
  const n = rooms.length;
  const mx = rooms.reduce((a, r) => a + r.x, 0) / n;
  const mz = rooms.reduce((a, r) => a + r.z, 0) / n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const r of rooms) {
    const u = r.x - mx;
    const v = r.z - mz;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return planned;
  const b1 = (suuu + suvv) / 2;
  const b2 = (svvv + svuu) / 2;
  const c = { x: mx + (b1 * svv - b2 * suv) / det, z: mz + (b2 * suu - b1 * suv) / det };
  const clear = rooms.every((r) => Math.hypot(r.x - c.x, r.z - c.z) > Math.max(r.w, r.d) / 2 + 25);
  return clear && Number.isFinite(c.x) && Number.isFinite(c.z) ? c : planned;
}

// ---------------------------------------------------------------------------------------------------------------
// Justice: the weighing

/**
 * A straight axis (start … the mid lantern, the gate … the exit) with two mirrored wings off the mid lantern's
 * sides, bending forward like the arms of the scales. Each wing ends in a key room; the axis gate between the
 * lantern and the gate room opens once both keys are set.
 */
function embedWeighing(dim: DimensionDef, g: MissionGraph, rng: Rng): Space | null {
  const L = new Layout(dim, g, rng);
  const lay = dim.layout;
  const crit = g.critical;
  const rooms = new Map<number, Room>();
  for (const id of crit) rooms.set(id, L.room(id));
  heights(dim, g, rooms);
  const [left, right] = g.wings!;
  // The right wing mirrors the left: the same sizes.
  right.forEach((id, i) => {
    const a = rooms.get(left[i])!;
    const b = rooms.get(id)!;
    b.w = a.w;
    b.d = a.d;
  });
  const hubId = g.shortcut.lantern;
  const axis = crit.filter((id) => !left.includes(id) && !right.includes(id));
  const start = rooms.get(axis[0])!;
  standAt(start, 0, 0, 0);
  L.rooms.push(start);
  for (let i = 1; i < axis.length; i++) {
    const a = rooms.get(axis[i - 1])!;
    const b = rooms.get(axis[i])!;
    if (axis[i] === g.shortcut.gate) {
      // The gate stands straight ahead of the lantern; the barred axis between them comes last.
      const p = sidePoint(a, 'front');
      const len = rng.range(dim.loop.shortcut[0] + 2, Math.min(dim.loop.shortcut[1], 22));
      standAt(b, p.x + p.nx * len, p.z + p.nz * len, 0);
      if (!L.fits(b)) return fail("the gate wouldn't fit");
      L.rooms.push(b);
      continue;
    }
    const f = L.framing(axis[i], dim.connector.length[1]);
    if (L.step(a, ['front'], b, 0, { ...f, maxBend: 0 }) < 0) return fail("a room on the axis wouldn't fit");
  }
  const hub = rooms.get(hubId)!;
  // The left wing: out of the lantern's left side, bending forward toward the scales at each room.
  let prev = hub;
  let side: Side = 'left';
  const wingStart = L.connectors.length;
  for (let i = 0; i < left.length; i++) {
    const b = rooms.get(left[i])!;
    const out = sidePoint(prev, side).yaw;
    // Bend toward the axis heading (forward), a little more at each room.
    const [b0, b1] = lay.wingBend ?? [0.35, 0.65];
    const want = out - rng.range(b0, b1);
    const f = L.framing(left[i], dim.connector.length[1]);
    if (L.step(prev, [side], b, want, { ...f, maxBend: lay.bend }) < 0) return fail("a wing room wouldn't fit");
    prev = b;
    side = 'front';
  }
  const wingEnd = L.connectors.length;
  // Mirror it about the axis for the right wing: rooms, connectors, doors.
  const ax = hub.x;
  const mx = (x: number) => 2 * ax - x;
  for (let i = 0; i < right.length; i++) {
    const a = rooms.get(left[i])!;
    const b = rooms.get(right[i])!;
    b.x = mx(a.x);
    b.z = a.z;
    b.yaw = wrapAngle(-a.yaw);
    b.y = a.y;
    b.exit = a.exit;
    settle(b);
    if (!L.fits(b)) return fail("the mirrored wing wouldn't fit");
    L.rooms.push(b);
  }
  const twinOf = (id: number) => (left.includes(id) ? right[left.indexOf(id)] : id);
  const mirrorConn = (k: number, from: number, to: number): boolean => {
    const c = L.connectors[k];
    const m: Connector = { ...c, from, to, ax: mx(c.ax), bx: mx(c.bx), bends: c.bends.map((b) => ({ x: mx(b.x), z: b.z })) };
    if (!L.connFits(m)) return false;
    const idx = L.connectors.length;
    L.connectors.push(m);
    for (const [src, dst] of [
      [c.from, from],
      [c.to, to],
    ]) {
      const d = L.rooms.find((r) => r.node === src)!.doors.find((dr) => dr.connector === k)!;
      L.rooms.find((r) => r.node === dst)!.doors.push({ side: mirrorSide(d.side), width: d.width, x: mx(d.x), z: d.z, yaw: wrapAngle(-d.yaw), connector: idx });
    }
    return true;
  };
  for (let k = wingStart; k < wingEnd; k++) if (!mirrorConn(k, twinOf(L.connectors[k].from), twinOf(L.connectors[k].to))) return fail("the mirrored wing's ways wouldn't fit");
  // The barred axis: from the lantern's far edge to the gate.
  const gate = rooms.get(g.shortcut.gate)!;
  if (L.close(hub, ['front'], gate, 'back', 'shortcut', true, 0) < 0) return fail("the axis gate wouldn't fit");
  hub.exit = 'front';
  gate.exit = 'front';
  // Branches come in mirrored pairs, off the wings' outer sides.
  const branches = g.nodes.filter((nd) => nd.kind === 'branch');
  for (const nd of branches) {
    const host = rooms.get(nd.host)!;
    if (!left.includes(nd.host)) continue;
    const twin = branches.find((o) => o.host === right[left.indexOf(nd.host)]);
    // Outward: the side whose doorway faces away from the axis's far end.
    const s: Side = sidePoint(host, 'left').nz > sidePoint(host, 'right').nz ? 'left' : 'right';
    if (!L.branch(host, nd.id, [s])) return fail("a branch wouldn't fit");
    if (!twin) continue;
    const br = L.rooms[L.rooms.length - 1];
    const k = L.connectors.length - 1;
    const tw = makeRoom(twin.id, br.kit, dim.kits[br.kit], rng);
    Object.assign(tw, { w: br.w, d: br.d, x: mx(br.x), z: br.z, yaw: wrapAngle(-br.yaw), y: br.y, doors: [] });
    settle(tw);
    if (!L.fits(tw)) return fail("the mirrored branch wouldn't fit");
    L.rooms.push(tw);
    if (!mirrorConn(k, twin.host, twin.id)) return fail("the mirrored branch's way wouldn't fit");
  }
  const last = rooms.get(axis[axis.length - 1])!;
  lastExitDoor(last);
  const [sx, sz] = toWorld(start, 0, -start.d / 2);
  return { rooms: L.rooms, connectors: L.connectors, shortcut: L.connectors.findIndex((c) => c.kind === 'shortcut'), landmark: beyond(dim, last, sx, sz) };
}

function shuffle<T>(ds: T[], rng: Rng) {
  const a = [...ds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

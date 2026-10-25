// Level generation, layers 3b–5 (LEVELS.md): what each room kit builds inside itself (edges, cover, columns,
// tiers), the encounter sockets, and the dressing (lanterns, arches, swords, grass, hero props, vista poses).
// Pure: no Three/DOM. Everything here is plain records the builder turns into meshes and colliders.
import type { Rng } from '../core/rng';
import type { DimensionDef, EncounterTemplate } from './dimensions';
import type { MissionGraph } from './gen-graph';
import { connRect, DX, DZ, overlaps, roomRect, toLocal, toWorld, yawOf, type Dir, type Room, type Space } from './gen-space';

/** Edge heights (m). Parapets stay above the player's step height; walls hide what's beyond. */
export const EDGE = { wall: 3.6, parapet: 1.1, thick: 0.6 };
export const COVER = { half: 0.95, full: 2.4 };
export const EYE = 1.6;

/** An axis-aligned box standing on `y`. */
export interface Box {
  x: number;
  z: number;
  y: number;
  /** World X and Z sizes. */
  sx: number;
  sz: number;
  h: number;
  kind: 'half' | 'full' | 'plinth' | 'divider' | 'tier' | 'edge' | 'wall';
  node: number;
}

/** A ramp inside a room (up to a tier): rises from (x0, z0) to (x1, z1). */
export interface Ramp {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  width: number;
  y0: number;
  y1: number;
}

export interface Column {
  x: number;
  z: number;
  y: number;
  h: number;
  node: number;
}

export interface Planted {
  x: number;
  z: number;
  y: number;
  len: number;
  yaw: number;
  tilt: number;
}

export interface Arch {
  x: number;
  z: number;
  y: number;
  dir: Dir;
  width: number;
  height: number;
}

export interface Pose {
  node: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
  pitch: number;
}

export interface Lantern {
  node: number;
  x: number;
  z: number;
  y: number;
  /** Where you stand up after resting or dying, and which way you face. */
  rest: Pose;
}

export type SocketKind = 'grunt' | 'guard' | 'ranged' | 'patrol' | 'signature' | 'miniboss';

export interface Socket {
  node: number;
  kind: SocketKind;
  template: EncounterTemplate | 'miniboss';
  x: number;
  z: number;
  y: number;
  /** Faces the room's entry. */
  yaw: number;
}

export interface Furnishing {
  /** Room edges (parapets and walls with door gaps) and everything solid a kit stands up. */
  boxes: Box[];
  ramps: Ramp[];
  columns: Column[];
}

// ---------------------------------------------------------------------------------------------------------------
// Kit structure

/** Each room kit builds its edges, cover, columns, tier and divider. */
export function furnish(dim: DimensionDef, space: Space, rng: Rng): Furnishing {
  const boxes: Box[] = [];
  const ramps: Ramp[] = [];
  const columns: Column[] = [];
  for (const r of space.rooms) {
    const kit = dim.kits[r.kit];
    const rr = rng.fork(`room${r.node}`);
    edgesOf(r, kit.edge === 'wall' ? EDGE.wall : EDGE.parapet, boxes);
    const local = (u: number, v: number, w: number, d: number, h: number, kind: Box['kind'], y = r.y) => {
      const [x, z] = toWorld(r, u, v);
      const ns = r.inDir % 2 === 0;
      boxes.push({ x, z, y, sx: ns ? w : d, sz: ns ? d : w, h, kind, node: r.node });
    };
    const clear = clearance(r);

    // Tier: two wings along the far edge with a gap on the axis for the way on, each reached by a ramp.
    if (kit.tier) {
      const { depth, height } = kit.tier;
      const gap = 8;
      const wingW = r.w / 2 - EDGE.thick - gap / 2;
      const v = r.d / 2 - EDGE.thick - depth / 2;
      for (const s of [-1, 1]) local(s * (gap / 2 + wingW / 2), v, wingW, depth, height, 'tier');
      const run = height / dim.connector.maxSlope;
      for (const s of [-1, 1]) {
        const u = s * (r.w / 2 - EDGE.thick - 1.8);
        const [x0, z0] = toWorld(r, u, v - depth / 2 - run);
        const [x1, z1] = toWorld(r, u, v - depth / 2);
        ramps.push({ x0, z0, x1, z1, width: 3, y0: r.y, y1: r.y + height });
        clear.block(u, v - depth / 2 - run / 2, 2.4, run / 2 + 1);
      }
      clear.block(0, v, r.w / 2, depth / 2 + 1.5);
    }
    // Divider: a full-height wall along the axis, broken in the middle, splitting the twin courts.
    if (kit.divider) {
      const len = (r.d - 12 - 4) / 2;
      for (const s of [-1, 1]) local(0, s * (2 + len / 2), 0.8, len, COVER.full, 'divider');
      clear.block(0, 0, 3, r.d / 2 - 6);
    }
    // Cover clusters, mirrored about the axis in a symmetric dimension.
    if (kit.cover) {
      const n = rr.int(kit.cover[0], kit.cover[1]);
      const placed: [number, number][] = [];
      const far = (u: number, v: number) => placed.every(([pu, pv]) => Math.hypot(pu - u, pv - v) >= 6);
      if (n % 2 === 1 && !kit.divider) {
        const v = rr.range(-r.d / 6, r.d / 6);
        if (clear.ok(0, v, 2, true)) {
          local(0, v, 2.4, 2.4, 1.0, 'plinth');
          placed.push([0, v]);
        }
      }
      const pairs = Math.floor(n / 2) + (n % 2 === 1 && kit.divider ? 1 : 0);
      for (let p = 0; p < pairs; p++) {
        for (let t = 0; t < 30; t++) {
          const u = rr.range(3.5, r.w / 2 - 3.5);
          const v = rr.range(-r.d / 2 + 7, r.d / 2 - 5);
          const mirror = dim.symmetric ? -u : -rr.range(3.5, r.w / 2 - 3.5);
          if (!clear.ok(u, v, 2.2) || !clear.ok(mirror, v, 2.2) || !far(u, v) || !far(mirror, v)) continue;
          const type = rr.int(0, 2);
          for (const uu of [u, mirror]) {
            const s = Math.sign(uu);
            if (type === 0) local(uu, v, 3.2, 0.6, COVER.half, 'half');
            else if (type === 1) {
              local(uu, v, 1.4, 1.4, COVER.full, 'full');
              local(uu - s * 1.9, v, 2.4, 0.6, COVER.half, 'half');
            } else {
              local(uu, v, 3.0, 0.6, COVER.half, 'half');
              local(uu + s * 1.2, v + 1.5, 0.6, 2.4, COVER.half, 'half');
            }
            placed.push([uu, v]);
          }
          break;
        }
      }
    }
    // Columns along the long sides of a colonnade, kept out of doorways.
    if (kit.edge === 'colonnade') {
      const h = kit.columnHeight ?? 6.5;
      const count = Math.max(2, Math.round((r.d - 5) / 6.5) + 1);
      for (const s of [-1, 1]) {
        const u = s * (r.w / 2 - 1.4);
        for (let i = 0; i < count; i++) {
          const v = -r.d / 2 + 2.5 + ((r.d - 5) * i) / (count - 1);
          if (!clear.nearDoor(u, v, 3.5)) {
            const [x, z] = toWorld(r, u, v);
            columns.push({ x, z, y: r.y, h, node: r.node });
          }
        }
      }
    }
  }
  // Connector sides: parapets, or tall walls on a walled pass. Ramps get their own colliders in the builder.
  for (const c of space.connectors) {
    if (!c.walled) continue;
    const len = Math.hypot(c.bx - c.ax, c.bz - c.az);
    const ns = c.dir % 2 === 0;
    for (const s of [-1, 1]) {
      const off = c.width / 2 + EDGE.thick / 2;
      const mx = (c.ax + c.bx) / 2 + (ns ? s * off : 0);
      const mz = (c.az + c.bz) / 2 + (ns ? 0 : s * off);
      boxes.push({ x: mx, z: mz, y: Math.min(c.y0, c.y1), sx: ns ? EDGE.thick : len, sz: ns ? len : EDGE.thick, h: EDGE.wall + Math.abs(c.y1 - c.y0), kind: 'wall', node: -1 });
    }
  }
  return { boxes, ramps, columns };
}

/** The four edges of a room as boxes, broken by its door gaps. */
function edgesOf(r: Room, h: number, out: Box[]) {
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const ns = d % 2 === 0;
    // Edge runs along X for north/south edges, along Z for east/west ones; inset by half its thickness.
    const len = ns ? r.sx : r.sz;
    const cx = r.x + (ns ? 0 : DX[d] * (r.sx / 2 - EDGE.thick / 2));
    const cz = r.z + (ns ? DZ[d] * (r.sz / 2 - EDGE.thick / 2) : 0);
    const gaps = r.doors
      .filter((dr) => dr.dir === d)
      .map((dr) => {
        const t = ns ? dr.x - r.x : dr.z - r.z;
        return [t - dr.width / 2, t + dr.width / 2] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    let t0 = -len / 2;
    const pieces: [number, number][] = [];
    for (const [a, b] of gaps) {
      if (a > t0) pieces.push([t0, a]);
      t0 = Math.max(t0, b);
    }
    if (t0 < len / 2) pieces.push([t0, len / 2]);
    for (const [a, b] of pieces) {
      const m = (a + b) / 2;
      const l = b - a;
      if (l < 0.05) continue;
      out.push({ x: ns ? r.x + m : cx, z: ns ? cz : r.z + m, y: r.y, sx: ns ? l : EDGE.thick, sz: ns ? EDGE.thick : l, h, kind: 'edge', node: r.node });
    }
  }
}

/** Keep-out bookkeeping in room-local space: doorways, the lane between doors, and blocked areas. */
function clearance(r: Room) {
  const doors = r.doors.map((d) => toLocal(r, d.x, d.z));
  const blocks: [number, number, number, number][] = [];
  const entry: [number, number] = [0, -r.d / 2];
  const exit = r.outDir === null ? null : toLocal(r, ...doorPoint(r, r.outDir));
  const nearDoor = (u: number, v: number, m: number) => doors.some(([du, dv]) => Math.hypot(du - u, dv - v) < m);
  return {
    nearDoor,
    block(u: number, v: number, hu: number, hv: number) {
      blocks.push([u, v, hu, hv]);
    },
    ok(u: number, v: number, m: number, onAxis = false) {
      if (Math.abs(u) > r.w / 2 - 1.5 || Math.abs(v) > r.d / 2 - 1.5) return false;
      if (nearDoor(u, v, 6)) return false;
      if (blocks.some(([bu, bv, hu, hv]) => Math.abs(u - bu) < hu + m / 2 && Math.abs(v - bv) < hv + m / 2)) return false;
      // The lane from the entry to the exit stays open (a plinth on a straight axis is the one allowed obstacle).
      if (exit && !onAxis && segDist(u, v, entry, exit) < m + 1) return false;
      return true;
    },
  };
}

function doorPoint(r: Room, d: Dir): [number, number] {
  const dr = r.doors.find((x) => x.dir === d);
  return dr ? [dr.x, dr.z] : [r.x, r.z];
}

function segDist(u: number, v: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(u - a[0] - dx * t, v - a[1] - dz * t);
}

// ---------------------------------------------------------------------------------------------------------------
// Encounters

/** Yaw that faces from (x, z) toward (tx, tz). */
export const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));

/** Layer 5: sockets by encounter template, never on cover, always in front of the entry (LEVELS.md). */
export function encounters(dim: DimensionDef, g: MissionGraph, space: Space, furn: Furnishing, enemies: [number, number], rng: Rng): Socket[] {
  const out: Socket[] = [];
  const n = g.critical.length;
  for (const r of space.rooms) {
    const nd = g.nodes[r.node];
    if (nd.template === null && nd.kind !== 'miniboss') continue;
    const rr = rng.fork(`enc${r.node}`);
    const kit = dim.kits[r.kit];
    // Difficulty rises with depth along the critical path; the beat sets the range.
    let count = rr.int(enemies[0], enemies[1]) + (nd.index / n > 0.6 ? 1 : 0);
    const [ex, ez] = toWorld(r, 0, -r.d / 2);
    const sockets: Socket[] = [];
    const free = (x: number, z: number, y: number) =>
      furn.boxes.every((b) => b.kind === 'edge' || b.y + b.h <= y + 0.05 || Math.abs(x - b.x) > b.sx / 2 + 0.8 || Math.abs(z - b.z) > b.sz / 2 + 0.8) &&
      sockets.every((s) => Math.hypot(s.x - x, s.z - z) >= 2.6);
    const add = (kind: SocketKind, u: number, v: number, y = r.y, force = false) => {
      const [x, z] = toWorld(r, u, v);
      if (!force && !free(x, z, y)) return false;
      sockets.push({ node: r.node, kind, template: nd.template ?? 'miniboss', x, z, y, yaw: yawTo(x, z, ex, ez) });
      return true;
    };
    /** Scatter `k` sockets over the far part of the room, mirrored in a symmetric dimension. */
    const spread = (kind: SocketKind, k: number, vMin: number) => {
      for (let t = 0; t < 80 && k > 0; t++) {
        const v = rr.range(vMin, r.d / 2 - 4);
        if (k % 2 === 1 && dim.symmetric) {
          if (add(kind, 0, v)) k--;
          continue;
        }
        const u = rr.range(2.5, r.w / 2 - 3);
        if (dim.symmetric) {
          const [x1, z1] = toWorld(r, u, v);
          const [x2, z2] = toWorld(r, -u, v);
          if (free(x1, z1, r.y) && free(x2, z2, r.y) && Math.hypot(x1 - x2, z1 - z2) >= 2.6) {
            add(kind, u, v, r.y, true);
            add(kind, -u, v, r.y, true);
            k -= 2;
          }
        } else if (add(kind, rr.chance(0.5) ? u : -u, v)) k--;
      }
    };
    switch (nd.kind === 'miniboss' ? 'miniboss' : nd.template) {
      case 'miniboss':
        add('miniboss', 0, r.d * 0.12, r.y, true);
        break;
      case 'arena':
        spread('grunt', count, -r.d / 2 + r.d * 0.45);
        break;
      case 'guarded': {
        // A tough enemy holds the way out; support stands behind it.
        const [du, dv] = toLocal(r, ...doorPointOut(r));
        const len = Math.hypot(du, dv) || 1;
        const iu = -du / len;
        const iv = -dv / len;
        for (const k of [5, 6.5, 8, 3.5]) if (add('guard', du + iu * k, dv + iv * k)) break;
        // Support behind the guard, along the exit's edge, never back toward the entry.
        const minV = -r.d / 2 + 6.5;
        for (let i = 1, t = 0; i < count && t < 12; t++) {
          const s = t % 2 === 0 ? 1 : -1;
          const k = 1 + Math.floor(t / 2);
          const u = du + iu * 2.5 - iv * s * 3.5 * k;
          const v = dv + iv * 2.5 + iu * s * 3.5 * k;
          if (v >= minV && Math.abs(u) < r.w / 2 - 2 && Math.abs(v) < r.d / 2 - 1.5 && add('ranged', u, v)) i++;
        }
        break;
      }
      case 'nest': {
        // Ranged on the tier wings, one fighter on the floor.
        const t = kit.tier!;
        const v = r.d / 2 - EDGE.thick - t.depth / 2;
        for (let i = 0; i < count - 1; i++) {
          const s = i % 2 === 0 ? 1 : -1;
          add('ranged', s * (6 + Math.floor(i / 2) * 3.5), v, r.y + t.height, true);
        }
        spread('grunt', 1, -r.d / 2 + r.d * 0.4);
        break;
      }
      case 'ambush': {
        // Behind cover, facing the entrance (the audible tell comes with V2-4's enemies).
        const cover = furn.boxes.filter((b) => b.node === r.node && (b.kind === 'half' || b.kind === 'full' || b.kind === 'plinth'));
        for (const b of cover) {
          if (count <= 0) break;
          const [u, v] = toLocal(r, b.x, b.z);
          if (add('grunt', u, v + 1.6)) count--;
        }
        spread('grunt', count, -r.d / 2 + r.d * 0.4);
        break;
      }
      case 'patrol': {
        // A line crossing the room; it slides side to side (the dummies' patrol stand-in).
        const v = rr.range(-r.d * 0.05, r.d * 0.15);
        for (let i = 0; i < count; i++) add('patrol', (i - (count - 1) / 2) * 3.2, v);
        break;
      }
      case 'signature':
        add('signature', 0, r.d / 4, r.y, true);
        break;
    }
    out.push(...sockets);
  }
  return out;
}

function doorPointOut(r: Room): [number, number] {
  return r.outDir === null ? toWorld(r, 0, r.d / 2) : doorPoint(r, r.outDir);
}

// ---------------------------------------------------------------------------------------------------------------
// Dressing

export interface Dressing {
  spawn: Pose;
  lanterns: Lantern[];
  arches: Arch[];
  swords: Planted[];
  heroSwords: Planted[];
  grass: [number, number, number][];
  caches: { node: number; x: number; z: number; y: number }[];
  vistas: Pose[];
  landmark: { x: number; z: number; y: number; h: number };
  /** The shortcut's barred door; it opens only from the `opensFrom` side. */
  door: { x: number; z: number; y: number; dir: Dir; width: number; opensFrom: Dir };
  /** The way on: a veiled gate at the exit room's far edge. */
  exit: { x: number; z: number; y: number; dir: Dir; width: number };
}

/** Layer 4: rules, not scatter. Runs after encounters so nothing lands on a socket. */
export function dress(dim: DimensionDef, g: MissionGraph, space: Space, furn: Furnishing, sockets: Socket[], rng: Rng): Dressing {
  const rooms = space.rooms;
  const byNode = (id: number) => rooms.find((r) => r.node === id)!;
  const start = byNode(g.critical[0]);
  const exitRoom = byNode(g.critical[g.critical.length - 1]);

  const [sx, sz] = toWorld(start, 0, -start.d / 2 + 3.5);
  const spawn: Pose = { node: start.node, x: sx, z: sz, y: start.y, yaw: 0, pitch: 0 };

  // The landmark: on the exit's line, beyond it, and far enough from the spawn to sit in the bright fog.
  const lm = dim.landmark;
  const landmark = { x: exitRoom.x, z: Math.min(exitRoom.z - exitRoom.sz / 2 - lm.beyondExit, sz - lm.fromStart), y: lm.baseY, h: lm.height };

  const lanterns: Lantern[] = [];
  for (const id of g.critical) {
    const nd = g.nodes[id];
    if (!nd.lantern) continue;
    const r = byNode(id);
    const [u, v] = nd.kind === 'start' ? [3.2, -r.d / 2 + 5] : [-2.6, 0];
    const [x, z] = toWorld(r, u, v);
    const [rx, rz] = toWorld(r, u + 1.6, v - 1.2);
    const face = r.outDir ?? r.inDir;
    lanterns.push({ node: id, x, z, y: r.y, rest: { node: id, x: rx, z: rz, y: r.y, yaw: yawOf(face), pitch: 0 } });
  }

  // Arches at the far end of compression connectors, and over the shortcut's door on the gate side.
  const arches: Arch[] = [];
  for (const c of space.connectors) {
    if (!c.arch) continue;
    arches.push({ x: c.bx, z: c.bz, y: c.y1, dir: c.dir, width: c.width + 1, height: c.kind === 'shortcut' ? 6 : 7 });
  }
  const sc = space.connectors[space.shortcut];
  const door = { x: sc.bx, z: sc.bz, y: sc.y1, dir: sc.dir, width: sc.width + 1, opensFrom: sc.dir };
  const [gx, gz] = toWorld(exitRoom, 0, exitRoom.d / 2);
  const exit = { x: gx, z: gz, y: exitRoom.y, dir: exitRoom.inDir, width: 7 };

  // Planted swords on the sword field: off the lanes, doors and sockets.
  const swords: Planted[] = [];
  const grass: [number, number, number][] = [];
  const caches: Dressing['caches'] = [];
  for (const r of rooms) {
    const kit = dim.kits[r.kit];
    const rr = rng.fork(`dress${r.node}`);
    const entry: [number, number] = [0, -r.d / 2];
    const out = r.outDir === null ? null : toLocal(r, ...doorPoint(r, r.outDir));
    const doors = r.doors.map((d) => toLocal(r, d.x, d.z));
    const lane = (u: number, v: number, m: number) => (out ? segDist(u, v, entry, out) < m : Math.abs(u) < m) || doors.some(([du, dv]) => Math.hypot(du - u, dv - v) < m + 2);
    const onSocket = (x: number, z: number, m: number) => sockets.some((s) => Math.hypot(s.x - x, s.z - z) < m);
    const onBox = (x: number, z: number, m: number) => furn.boxes.some((b) => b.kind !== 'edge' && Math.abs(x - b.x) < b.sx / 2 + m && Math.abs(z - b.z) < b.sz / 2 + m);
    if (kit.swords) {
      for (let t = 0; t < kit.swords * 8 && swords.filter((s) => inRoom(r, s.x, s.z)).length < kit.swords; t++) {
        const u = rr.range(-r.w / 2 + 2, r.w / 2 - 2);
        const v = rr.range(-r.d / 2 + 4, r.d / 2 - 2);
        const [x, z] = toWorld(r, u, v);
        if (lane(u, v, 2.6) || onSocket(x, z, 1.8) || onBox(x, z, 1) || swords.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
        swords.push({ x, z, y: r.y, len: rr.range(1.8, 2.6), yaw: rr.range(0, Math.PI * 2), tilt: rr.range(-0.3, 0.3) });
      }
    }
    if (kit.grass) {
      let left = kit.grass;
      for (let t = 0; t < kit.grass * 6 && left > 0; t++) {
        const u = rr.range(-r.w / 2 + 0.8, r.w / 2 - 0.8);
        const v = rr.range(-r.d / 2 + 0.8, r.d / 2 - 0.8);
        // Flagstones grow grass only at the margins; earth grows it everywhere off the lanes.
        const margin = Math.min(r.w / 2 - Math.abs(u), r.d / 2 - Math.abs(v));
        if (kit.ground === 'flag' && margin > 2) continue;
        if (lane(u, v, 1.4)) continue;
        const [x, z] = toWorld(r, u, v);
        if (onBox(x, z, 0.2)) continue;
        grass.push([x, z, r.y]);
        left--;
      }
    }
    if (g.nodes[r.node].kind === 'branch') {
      const [x, z] = toWorld(r, 0, r.d / 6);
      caches.push({ node: r.node, x, z, y: r.y });
    }
  }

  // Vista poses: on the room's north side, looking at the landmark.
  const vistas: Pose[] = [];
  for (const id of g.critical) {
    if (!g.nodes[id].vista) continue;
    const r = byNode(id);
    const x = r.x;
    const z = r.z - r.sz / 2 + 3;
    const dist = Math.hypot(landmark.x - x, landmark.z - z);
    const rise = landmark.y + landmark.h - (r.y + EYE);
    vistas.push({ node: id, x, z, y: r.y, yaw: yawTo(x, z, landmark.x, landmark.z), pitch: Math.min(0.22, Math.atan2(rise, dist) * 0.55) });
  }

  // Hero props: great swords standing out of the fog, beside (never on) the vistas' sight lines.
  const heroSwords: Planted[] = [];
  const want = rng.int(dim.heroProps[0], dim.heroProps[1]);
  const anchors = vistas.length ? vistas : [spawn];
  const solids = [...rooms.map((r) => roomRect(r, 8)), ...space.connectors.map((c) => connRect(c, 6))];
  for (let t = 0; t < 60 && heroSwords.length < want; t++) {
    const a = anchors[heroSwords.length % anchors.length];
    const fwd = rng.range(60, 150);
    const side = (rng.chance(0.5) ? 1 : -1) * rng.range(30, 55);
    // Forward along the sight line, then out to one side of it.
    const dx = -Math.sin(a.yaw);
    const dz = -Math.cos(a.yaw);
    const x = a.x + dx * fwd - dz * side;
    const z = a.z + dz * fwd + dx * side;
    const pt = { minX: x - 3, maxX: x + 3, minZ: z - 3, maxZ: z + 3 };
    if (solids.some((s) => overlaps(s, pt))) continue;
    heroSwords.push({ x, z, y: -34, len: rng.range(40, 64), yaw: rng.range(0, Math.PI * 2), tilt: rng.range(-0.22, 0.22) });
  }

  return { spawn, lanterns, arches, swords, heroSwords, grass, caches, vistas, landmark, door, exit };
}

export function inRoom(r: Room, x: number, z: number, inset = 0) {
  return Math.abs(x - r.x) <= r.sx / 2 - inset && Math.abs(z - r.z) <= r.sz / 2 - inset;
}

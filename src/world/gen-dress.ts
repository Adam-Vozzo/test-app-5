// Level generation, layers 3b–5 (LEVELS.md): what each room kit builds inside itself (edges, cover, columns,
// tiers), the encounter sockets, and the dressing (lanterns, arches, swords, grass, hero props, vista poses).
// Pure: no Three/DOM. Everything here is plain records the builder turns into meshes and colliders.
import type { Rng } from '../core/rng';
import type { DimensionDef, EncounterTemplate, HoardCost, RoomKitDef, SocketRole } from './dimensions';
import type { MissionGraph } from './gen-graph';
import { connected } from './scaffold';
import { EYE, landmarkPoints, occludersOf, seesFrom, spotsIn } from './gen-sight';
import {
  anyOverlap,
  connEndYaw,
  connObbs,
  connStartYaw,
  fwdOf,
  headingOf,
  inRoom,
  rightOf,
  roomObb,
  segmentsOf,
  sidePoint,
  SIDES,
  toLocal,
  toWorld,
  type Connector,
  type Obb,
  type Room,
  type Space,
} from './gen-space';

export { inRoom };



/** Edge heights (m). Parapets stay above the player's step height; walls hide what's beyond. */
export const EDGE = { wall: 3.6, parapet: 1.1, thick: 0.6 };
export const COVER = { half: 0.95, full: 2.4 };
export { EYE };

/**
 * A box standing on `y`, turned `yaw` about its centre (as Three turns an object: its local X runs along the room's
 * across, its local Z back along the room's axis). `sx` and `sz` are its sizes along its own X and Z.
 */
export interface Box {
  x: number;
  z: number;
  y: number;
  sx: number;
  sz: number;
  h: number;
  yaw: number;
  kind: 'half' | 'full' | 'plinth' | 'divider' | 'tier' | 'edge' | 'wall' | 'weight';
  node: number;
}

/** Is (x, z) within a box's footprint, grown by `m`? */
export function boxHas(b: { x: number; z: number; sx: number; sz: number; yaw: number }, x: number, z: number, m = 0): boolean {
  const dx = x - b.x;
  const dz = z - b.z;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return Math.abs(dx * c - dz * s) < b.sx / 2 + m && Math.abs(dx * s + dz * c) < b.sz / 2 + m;
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
  /** Which colonnade it stands in (a room's left or right side), and its place along it: neighbours carry a lintel. */
  row: number;
  seq: number;
}

export interface Planted {
  x: number;
  z: number;
  y: number;
  len: number;
  yaw: number;
  tilt: number;
}

/** A frame at a connector's far end: an arch, or (the Moon) a pair of towers either side. `yaw` faces along the way. */
export interface Arch {
  x: number;
  z: number;
  y: number;
  yaw: number;
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

export type SocketKind = SocketRole | 'miniboss';

export interface Socket {
  node: number;
  kind: SocketKind;
  template: EncounterTemplate | 'miniboss';
  x: number;
  z: number;
  y: number;
  /** Faces the room's entry. */
  yaw: number;
  /** Which enemy stands here (from the beat's roster); the miniboss's rank comes from the level script. */
  foe: string;
  /** The Moon: a reflection, not the thing itself (no shadow, no footsteps; one hit dispels it). */
  illusion?: boolean;
}

export interface Furnishing {
  /** Room edges (parapets and walls with door gaps) and everything solid a kit stands up. */
  boxes: Box[];
  ramps: Ramp[];
  columns: Column[];
}

/** Justice: where a key room's weight stands, room-local (on the far side, on the axis). */
export const weightSpot = (r: Room): [number, number] => [0, r.d / 2 - 4];

/** Justice: a pan's dish radius, and how far its footprint (dish and post) reaches from its middle. */
export const PAN = { r: 1.7, reach: 2.8 };

/**
 * Justice: where a key room's pan stands, room-local: beside the weight, on the side toward the mid lantern
 * (`toward`: +1 or -1 along the room's width), and in front of a tier if the kit has one (it stood inside the tier).
 */
export function panSpot(r: Room, kit: RoomKitDef, toward: number): [number, number] {
  // In front of a tier, and inboard of the ramps up to it (3 m wide, along the room's sides).
  const v = kit.tier ? r.d / 2 - EDGE.thick - kit.tier.depth - PAN.reach - 0.6 : r.d / 2 - 4;
  const side = kit.tier ? 3.6 : kit.edge === 'colonnade' ? 2 : 0.4;
  return [toward * (r.w / 2 - EDGE.thick - PAN.reach - side), v];
}

/** Justice: which way along a key room's width the mid lantern lies (+1 or -1). */
export const towardHub = (r: Room, hub: { x: number; z: number }) => Math.sign(toLocal(r, hub.x, hub.z)[0]) || 1;

// ---------------------------------------------------------------------------------------------------------------
// Kit structure

/** Each room kit builds its edges, cover, columns, tier and divider. */
export function furnish(dim: DimensionDef, space: Space, rng: Rng, g?: MissionGraph): Furnishing {
  const boxes: Box[] = [];
  const ramps: Ramp[] = [];
  const columns: Column[] = [];
  for (const r of space.rooms) {
    const kit = dim.kits[r.kit];
    const rr = rng.fork(`room${r.node}`);
    edgesOf(r, kit.edge === 'wall' ? EDGE.wall : EDGE.parapet, boxes, r.open ?? []);
    const local = (u: number, v: number, w: number, d: number, h: number, kind: Box['kind'], y = r.y) => {
      const [x, z] = toWorld(r, u, v);
      boxes.push({ x, z, y, sx: w, sz: d, h, yaw: r.yaw, kind, node: r.node });
    };
    const clear = clearance(r);
    // Justice's key rooms: the weight stands on the far side, on the axis, and its pan beside it toward the mid
    // lantern (both kept clear of cover, sockets and the tier).
    if (g?.nodes[r.node]?.kind === 'key') {
      const [u, v] = weightSpot(r);
      local(u, v, 1.8, 1.8, 1.0, 'weight');
      clear.block(u, v, 3, 3);
      const hub = space.rooms.find((h) => h.node === g.shortcut.lantern)!;
      const [pu, pv] = panSpot(r, kit, towardHub(r, hub));
      // Wide: a cover cluster reaches up to 3 m past the spot it's placed by.
      clear.block(pu, pv, PAN.reach + 2.6, PAN.reach + 2.6);
    }

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
            columns.push({ x, z, y: r.y, h, node: r.node, row: s, seq: i });
          }
        }
      }
    }
  }
  // Connector sides: parapets, or tall walls on a walled pass. Ramps get their own colliders in the builder.
  for (const c of space.connectors) {
    if (!c.walled) continue;
    for (const g of segmentsOf(c)) {
      const [rx, rz] = rightOf(g.yaw);
      for (const s of [-1, 1]) {
        const off = c.width / 2 + EDGE.thick / 2;
        const mx = (g.ax + g.bx) / 2 + rx * s * off;
        const mz = (g.az + g.bz) / 2 + rz * s * off;
        boxes.push({ x: mx, z: mz, y: Math.min(g.ay, g.by), sx: EDGE.thick, sz: g.len, h: EDGE.wall + Math.abs(g.by - g.ay), yaw: g.yaw, kind: 'wall', node: -1 });
      }
    }
  }
  return { boxes, ramps, columns };
}

/** The four edges of a room as boxes, broken by its door gaps. */
function edgesOf(r: Room, high: number, out: Box[], open: string[]) {
  for (const side of SIDES) {
    const h = open.includes(side) ? EDGE.parapet : high;
    // Back and front edges run across the room (along u); the sides run along it (v). Inset by half the thickness.
    const across = side === 'back' || side === 'front';
    const len = across ? r.w : r.d;
    const sgn = side === 'back' || side === 'left' ? -1 : 1;
    const gaps = r.doors
      .filter((dr) => dr.side === side)
      .map((dr) => {
        const [u, v] = toLocal(r, dr.x, dr.z);
        const t = across ? u : v;
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
      const [x, z] = across ? toWorld(r, m, sgn * (r.d / 2 - EDGE.thick / 2)) : toWorld(r, sgn * (r.w / 2 - EDGE.thick / 2), m);
      out.push({ x, z, y: r.y, sx: across ? l : EDGE.thick, sz: across ? EDGE.thick : l, h, yaw: r.yaw, kind: 'edge', node: r.node });
    }
  }
}

/** Keep-out bookkeeping in room-local space: doorways, the lane between doors, and blocked areas. */
function clearance(r: Room) {
  const doors = r.doors.map((d) => toLocal(r, d.x, d.z));
  const blocks: [number, number, number, number][] = [];
  const entry: [number, number] = [0, -r.d / 2];
  const exit = exitLocal(r);
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

/** The way on's door, room-local (or null for a dead end). */
function exitLocal(r: Room): [number, number] | null {
  const dr = r.exit ? r.doors.find((x) => x.side === r.exit) : null;
  return dr ? toLocal(r, dr.x, dr.z) : null;
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
export function encounters(dim: DimensionDef, g: MissionGraph, space: Space, furn: Furnishing, level: number, rng: Rng, rangedMin = 0): Socket[] {
  const { enemies, roster } = dim.levels[level];
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
      furn.boxes.every((b) => b.kind === 'edge' || b.y + b.h <= y + 0.05 || !boxHas(b, x, z, 0.8)) &&
      sockets.every((s) => Math.hypot(s.x - x, s.z - z) >= 2.6);
    const add = (kind: SocketKind, u: number, v: number, y = r.y, force = false) => {
      const [x, z] = toWorld(r, u, v);
      if (!force && !free(x, z, y)) return false;
      let foe = kind === 'miniboss' ? 'miniboss' : rr.pick(roster[kind]);
      // A thrower too close to the way in can't be read in time: a fighter stands there instead.
      if (dim.rangedFoes.includes(foe) && Math.hypot(x - ex, z - ez) < rangedMin) {
        const melee = roster.grunt.filter((f) => !dim.rangedFoes.includes(f));
        foe = melee.length ? rr.pick(melee) : roster.guard[0];
      }
      sockets.push({ node: r.node, kind, template: nd.template ?? 'miniboss', x, z, y, yaw: yawTo(x, z, ex, ez), foe });
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
    // The Moon: some of the room's enemies are reflections, never all of them (one at least is real).
    const ill = dim.illusion;
    if (ill && sockets.length > 1) {
      const n = Math.min(sockets.length - 1, Math.round(sockets.length * ill.share[level]));
      const order = sockets.map((_, i) => i).filter((i) => sockets[i].kind !== 'miniboss');
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rr() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const i of order.slice(0, n)) sockets[i].illusion = true;
    }
    out.push(...sockets);
  }
  return out;
}

function doorPointOut(r: Room): [number, number] {
  const dr = r.exit ? r.doors.find((x) => x.side === r.exit) : null;
  return dr ? [dr.x, dr.z] : toWorld(r, 0, r.d / 2);
}

// ---------------------------------------------------------------------------------------------------------------
// Dressing

/** A hidden stepping stone (square, top at y), turned square to its path (as a furnishing box is turned). */
export interface Stone {
  x: number;
  z: number;
  y: number;
  size: number;
  yaw: number;
}

/**
 * Stones wind across a connector (left, middle, right, middle, ...): each step overlaps the last a little, but walking
 * the drawn boardwalk's middle line meets a 2 m hole wherever the way swings out to a side (her body is 0.6 m wide,
 * and a side stone's inner edge stands 0.5 m off the middle).
 */
export const STONE = { size: 1.6, pitch: 1.8, lane: 1.3 };

export function stonesAcross(c: Connector): Stone[] {
  const len = Math.hypot(c.bx - c.ax, c.bz - c.az);
  const ux = (c.bx - c.ax) / len;
  const uz = (c.bz - c.az) / len;
  const n = Math.max(2, Math.round(len / STONE.pitch));
  const out: Stone[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const side = [-1, 0, 1, 0][i % 4];
    // Right of the heading is (-uz, ux).
    out.push({ x: c.ax + ux * len * t - uz * side * STONE.lane, z: c.az + uz * len * t + ux * side * STONE.lane, y: c.y0 + (c.y1 - c.y0) * t, size: STONE.size, yaw: headingOf(ux, uz) });
  }
  return out;
}

export interface Dressing {
  spawn: Pose;
  lanterns: Lantern[];
  arches: Arch[];
  swords: Planted[];
  heroSwords: Planted[];
  grass: [number, number, number][];
  caches: { node: number; x: number; z: number; y: number; reflection?: boolean }[];
  /** The Moon: branch connectors that are false paths (no boardwalk is really there). */
  falsePaths: number[];
  /**
   * The Moon's secret way across a false path: stepping stones nobody can see, zig-zagging under the drawn
   * boardwalk. Real things cast shadows, so their shadows on the water show the way (the rule turned around).
   */
  stones: Stone[];
  /** The Devil's temptation: hoards in plain sight, each with a cost and its tell. */
  hoards: Hoard[];
  /** The Tower's collapse: timber deck grids in scaffold rooms, some rotten. */
  scaffolds: Scaffold[];
  vistas: Pose[];
  landmark: { x: number; z: number; y: number; h: number };
  /**
   * The shortcut's barred door, facing `yaw` (the way from the lantern toward the gate). It opens from the far side
   * (`opens: 'far'`), or (Justice) once both keys are set.
   */
  door: { x: number; z: number; y: number; yaw: number; width: number; opens: 'far' | 'keys' };
  /** The way on: a veiled gate at the exit room's far edge, facing out. */
  exit: { x: number; z: number; y: number; yaw: number; width: number };
  /** The Moon: a pair of towers either side of every true way's far end (`towers`, as arches are placed). */
  towers: Arch[];
  /**
   * Justice: a weight in each key room. Set it and that pan of the scales is weighted; with both set the axis gate
   * opens. Once set, the pan beside it carries her back to the mid lantern (`ride`).
   */
  keys: Key[];
}

export interface Key {
  node: number;
  /** 0: the left pan, 1: the right. */
  wing: 0 | 1;
  x: number;
  z: number;
  y: number;
  /** Where the pan waits, and where it sets her down (the mid lantern's rest spot). */
  pan: { x: number; z: number; y: number };
  ride: Pose;
}

/**
 * A scaffold room's floor: `cols × rows` timber decks laid in the room's own frame (centred on (x, z), turned `yaw`),
 * each `tx` across by `tz` along, at height y. `rotten` lists the decks that crack underfoot (row-major indices).
 */
export interface Scaffold {
  node: number;
  x: number;
  z: number;
  yaw: number;
  y: number;
  cols: number;
  rows: number;
  tx: number;
  tz: number;
  rotten: number[];
  /** Cells with no deck (a grid laid over a round floor). */
  holes?: number[];
}

/** A deck's centre (world x, z). */
export function deckCentre(s: Scaffold, i: number): [number, number] {
  const c = i % s.cols;
  const r = Math.floor(i / s.cols);
  return toWorld(s, -(s.cols * s.tx) / 2 + (c + 0.5) * s.tx, -(s.rows * s.tz) / 2 + (r + 0.5) * s.tz);
}

/** The deck cell under a world point, or [-1, -1]. */
export function deckCell(s: Scaffold, x: number, z: number): [number, number] {
  const [u, v] = toLocal(s, x, z);
  const c = Math.floor((u + (s.cols * s.tx) / 2) / s.tx);
  const r = Math.floor((v + (s.rows * s.tz) / 2) / s.tz);
  return c >= 0 && r >= 0 && c < s.cols && r < s.rows ? [c, r] : [-1, -1];
}

/** The cells a room's doors open onto (a deck just inside each door). */
export function doorCells(s: Scaffold, r: Room): [number, number][] {
  return r.doors.map((d) => {
    const [nx, nz] = fwdOf(d.yaw);
    return deckCell(s, d.x - nx * 1.0, d.z - nz * 1.0);
  });
}

export interface Hoard {
  node: number;
  x: number;
  z: number;
  y: number;
  cost: HoardCost;
  /** A risk branch's bigger hoard. */
  branch: boolean;
}

/** Layer 4: rules, not scatter. Runs after encounters so nothing lands on a socket. */
export function dress(dim: DimensionDef, g: MissionGraph, space: Space, furn: Furnishing, sockets: Socket[], rng: Rng, level = 0): Dressing {
  const rooms = space.rooms;
  const byNode = (id: number) => rooms.find((r) => r.node === id)!;
  const start = byNode(g.critical[0]);
  const exitRoom = byNode(g.critical[g.critical.length - 1]);

  const [sx, sz] = toWorld(start, 0, -start.d / 2 + 3.5);
  const spawn: Pose = { node: start.node, x: sx, z: sz, y: start.y, yaw: start.yaw, pitch: 0 };

  // The landmark: where the layout put it (beyond the exit, or the spiral's centre).
  const lm = dim.landmark;
  const landmark = { x: space.landmark.x, z: space.landmark.z, y: lm.baseY, h: lm.height };

  const lanterns: Lantern[] = [];
  for (const id of g.critical) {
    const nd = g.nodes[id];
    if (!nd.lantern) continue;
    const r = byNode(id);
    const [u, v] = nd.kind === 'start' ? [3.2, -r.d / 2 + 5] : [-2.6, 0];
    const [x, z] = toWorld(r, u, v);
    const [rx, rz] = toWorld(r, u + 1.6, v - 1.2);
    // Stand up facing the way on.
    const out = r.exit ? r.doors.find((d) => d.side === r.exit) : null;
    const face = out && r.exit !== 'front' ? headingOf(out.x - rx, out.z - rz) : r.yaw;
    lanterns.push({ node: id, x, z, y: r.y, rest: { node: id, x: rx, z: rz, y: r.y, yaw: face, pitch: 0 } });
  }

  // Arches at the far end of compression connectors, and over the shortcut's door on the gate side. On the Moon,
  // every true way's far end stands between two towers instead, branches too; its false paths never do (chosen below,
  // before the towers go up: at a fork, the way without towers is the lie).
  const falsePaths: number[] = [];
  const stones: Stone[] = [];
  if (dim.illusion) {
    const fr = rng.fork('false-paths');
    const branchConns = space.connectors.map((c, i) => [c, i] as const).filter(([c]) => c.kind === 'branch');
    for (let i = branchConns.length - 1; i > 0; i--) {
      const j = Math.floor(fr() * (i + 1));
      [branchConns[i], branchConns[j]] = [branchConns[j], branchConns[i]];
    }
    for (const [c, i] of branchConns.slice(0, dim.illusion.falseBranches[Math.min(2, level)])) {
      falsePaths.push(i);
      stones.push(...stonesAcross(c));
    }
  }
  const arches: Arch[] = [];
  const towers: Arch[] = [];
  space.connectors.forEach((c, i) => {
    const frame = { x: c.bx, z: c.bz, y: c.y1, yaw: connEndYaw(c), width: c.width + 1, height: c.kind === 'shortcut' ? 6 : 7 };
    if (dim.gateway === 'towers') {
      if (!falsePaths.includes(i)) towers.push({ ...frame, height: c.kind === 'branch' ? 7 : 9 });
    } else if (c.arch) arches.push(frame);
  });
  const sc = space.connectors[space.shortcut];
  // The loop's shortcut is barred at the gate's end and lifted from that side; Justice's axis gate stands at the
  // lantern's end and lifts when both pans are weighted.
  const door = g.wings
    ? { x: sc.ax, z: sc.az, y: sc.y0, yaw: connStartYaw(sc), width: sc.width + 1, opens: 'keys' as const }
    : { x: sc.bx, z: sc.bz, y: sc.y1, yaw: connEndYaw(sc), width: sc.width + 1, opens: 'far' as const };
  // The axis gate stands in an arch of its own (its bars stood alone at the lantern's edge, framed by nothing).
  if (door.opens === 'keys') arches.push({ x: door.x, z: door.z, y: door.y, yaw: door.yaw, width: door.width, height: 7 });
  const ex = sidePoint(exitRoom, 'front');
  const exit = { x: ex.x, z: ex.z, y: exitRoom.y, yaw: exitRoom.yaw, width: 7 };

  // Planted swords on the sword field: off the lanes, doors and sockets.
  const swords: Planted[] = [];
  const grass: [number, number, number][] = [];
  const caches: Dressing['caches'] = [];
  const hoards: Hoard[] = [];
  for (const r of rooms) {
    const kit = dim.kits[r.kit];
    const rr = rng.fork(`dress${r.node}`);
    const entry: [number, number] = [0, -r.d / 2];
    const out = exitLocal(r);
    const doors = r.doors.map((d) => toLocal(r, d.x, d.z));
    const lane = (u: number, v: number, m: number) => (out ? segDist(u, v, entry, out) < m : Math.abs(u) < m) || doors.some(([du, dv]) => Math.hypot(du - u, dv - v) < m + 2);
    const onSocket = (x: number, z: number, m: number) => sockets.some((s) => Math.hypot(s.x - x, s.z - z) < m);
    const onBox = (x: number, z: number, m: number) => furn.boxes.some((b) => b.kind !== 'edge' && boxHas(b, x, z, m));
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
      // In a tempting dimension the branch's reward is a bigger hoard, with the harshest cost.
      if (dim.temptation) hoards.push({ node: r.node, x, z, y: r.y, cost: dim.temptation.branchCost, branch: true });
      else caches.push({ node: r.node, x, z, y: r.y });
    }
  }

  // (The Moon's false paths were chosen with the towers, above: some branches' boardwalks aren't there. The way
  // across is the stones that cast shadows; the cache beyond is real, the reward for reading the water.)

  // Scaffold rooms (the Tower): timber decks over the drop, some rotten. Door landings, cover and the decks under
  // the tiers stay sound, and the rot never cuts the doors apart (collapse closes ways behind you, not ahead).
  const scaffolds: Scaffold[] = [];
  const co = dim.collapse;
  if (co) {
    for (const r of rooms) {
      const kit = dim.kits[r.kit];
      if (!kit.scaffold) continue;
      const sr = rng.fork(`deck${r.node}`);
      const cols = Math.max(1, Math.round(r.w / co.tile));
      const rows = Math.max(1, Math.round(r.d / co.tile));
      const s: Scaffold = { node: r.node, x: r.x, z: r.z, yaw: r.yaw, y: r.y, cols, rows, tx: r.w / cols, tz: r.d / rows, rotten: [] };
      const doors = doorCells(s, r);
      const keep = (i: number) => {
        const c = i % cols;
        const rw = Math.floor(i / cols);
        if (doors.some(([dc, dr]) => Math.abs(dc - c) <= 1 && Math.abs(dr - rw) <= 1)) return true;
        const [x, z] = deckCentre(s, i);
        return furn.boxes.some((b) => b.node === r.node && b.kind !== 'edge' && boxHas(b, x, z, Math.max(s.tx, s.tz) / 2));
      };
      let share = co.rotten[level];
      for (let attempt = 0; attempt < 8; attempt++) {
        const rot: number[] = [];
        for (let i = 0; i < cols * rows; i++) if (!keep(i) && sr() < share) rot.push(i);
        if (connected(cols, rows, (i) => rot.includes(i), doors.slice(0, 1), doors)) {
          s.rotten = rot;
          break;
        }
        share *= 0.7;
      }
      scaffolds.push(s);
    }
  }

  // Hoards in plain sight: in the fights and set-pieces, off the lanes, sockets and cover, toward the far side.
  const tm = dim.temptation;
  if (tm) {
    const hr = rng.fork('hoards');
    const want = hr.int(tm.hoards[level][0], tm.hoards[level][1]);
    const rooms2 = rooms.filter((r) => {
      const nd = g.nodes[r.node];
      return nd.kind !== 'branch' && nd.kind !== 'miniboss' && (nd.template !== null || nd.kind === 'setpiece');
    });
    for (let i = rooms2.length - 1; i > 0; i--) {
      const j = Math.floor(hr() * (i + 1));
      [rooms2[i], rooms2[j]] = [rooms2[j], rooms2[i]];
    }
    for (let k = 0; k < rooms2.length * 2 && hoards.filter((h) => !h.branch).length < want; k++) {
      const r = rooms2[k % rooms2.length];
      if (hoards.some((h) => h.node === r.node && !h.branch) && k < rooms2.length) continue;
      const entry: [number, number] = [0, -r.d / 2];
      const out = exitLocal(r);
      for (let t = 0; t < 40; t++) {
        const u = hr.range(-r.w / 2 + 2.5, r.w / 2 - 2.5);
        const v = hr.range(0, r.d / 2 - 2.5);
        const [x, z] = toWorld(r, u, v);
        const onLane = (out ? segDist(u, v, entry, out) < 3 : Math.abs(u) < 3) || r.doors.some((d) => Math.hypot(d.x - x, d.z - z) < 5);
        const crowded =
          sockets.some((s) => Math.hypot(s.x - x, s.z - z) < 2.5) ||
          furn.boxes.some((b) => b.kind !== 'edge' && boxHas(b, x, z, 1.5)) ||
          swords.some((s) => Math.hypot(s.x - x, s.z - z) < 2.2) ||
          hoards.some((h) => Math.hypot(h.x - x, h.z - z) < 6);
        if (onLane || crowded) continue;
        hoards.push({ node: r.node, x, z, y: r.y, cost: hr.pick(tm.costs[level]), branch: false });
        break;
      }
    }
  }

  // Vista poses: at a spot in the room the landmark can be seen from (its edge nearest the landmark, if it can),
  // looking at it.
  const vistas: Pose[] = [];
  const sight = occludersOf({ rooms, boxes: furn.boxes, columns: furn.columns, arches, towers, heroSwords: [] });
  const marks = landmarkPoints(landmark, lm.targets);
  for (const id of g.critical) {
    if (!g.nodes[id].vista) continue;
    const r = byNode(id);
    const spots = spotsIn(r, landmark.x, landmark.z);
    const [x, z] = spots.find(([sx2, sz2]) => seesFrom(marks, sight, sx2, r.y, sz2)) ?? spots[0];
    const dist = Math.hypot(landmark.x - x, landmark.z - z);
    const rise = landmark.y + landmark.h - (r.y + EYE);
    vistas.push({ node: id, x, z, y: r.y, yaw: yawTo(x, z, landmark.x, landmark.z), pitch: Math.max(-0.3, Math.min(0.22, Math.atan2(rise, dist) * 0.55)) });
  }

  // Justice's keys: a weight on the far side of each key room, the pan that rides back beside it.
  const keys: Key[] = [];
  if (g.wings) {
    const hub = lanterns.find((l) => l.node === g.shortcut.lantern)!;
    g.wings.forEach((ids, wing) => {
      const r = byNode(ids[ids.length - 1]);
      const [u, v] = weightSpot(r);
      const [x, z] = toWorld(r, u, v);
      // The pan stands on the side toward the mid lantern, by the weight (the spot furnish kept clear for it).
      const hubRoom = byNode(g.shortcut.lantern);
      const [pu, pv] = panSpot(r, dim.kits[r.kit], towardHub(r, hubRoom));
      const [px, pz] = toWorld(r, pu, pv);
      keys.push({ node: r.node, wing: wing as 0 | 1, x, z, y: r.y, pan: { x: px, z: pz, y: r.y }, ride: hub.rest });
    });
  }

  // Hero props: great swords standing out of the fog, beside (never on) the vistas' sight lines, and clear of the
  // landmark.
  const heroSwords: Planted[] = [];
  const want = rng.int(dim.heroProps[0], dim.heroProps[1]);
  const anchors = vistas.length ? vistas : [spawn];
  const solids: Obb[] = [...rooms.map((r) => roomObb(r, 8)), ...space.connectors.flatMap((c) => connObbs(c, 6))];
  for (let t = 0; t < 60 && heroSwords.length < want; t++) {
    const a = anchors[heroSwords.length % anchors.length];
    const fwd = rng.range(60, 150);
    const side = (rng.chance(0.5) ? 1 : -1) * rng.range(30, 55);
    // Forward along the sight line, then out to one side of it.
    const dx = -Math.sin(a.yaw);
    const dz = -Math.cos(a.yaw);
    const x = a.x + dx * fwd - dz * side;
    const z = a.z + dz * fwd + dx * side;
    const pt: Obb = { x, z, ux: 1, uz: 0, vx: 0, vz: 1, hu: 3, hv: 3 };
    if (anyOverlap([pt], solids) || Math.hypot(x - landmark.x, z - landmark.z) < 40) continue;
    const hero = { x, z, y: -34, len: rng.range(40, 64), yaw: rng.range(0, Math.PI * 2), tilt: rng.range(-0.22, 0.22) };
    // Beside the sight lines, never on them: the spawn and every vista still see the landmark past it.
    const alone = occludersOf({ rooms: [], boxes: [], columns: [], arches: [], towers: [], heroSwords: [hero] });
    if ([spawn, ...vistas].some((v) => seesFrom(marks, sight, v.x, v.y, v.z) && !seesFrom(marks, [...sight, ...alone], v.x, v.y, v.z))) continue;
    heroSwords.push(hero);
  }

  return { spawn, lanterns, arches, towers, swords, heroSwords, grass, caches, hoards, scaffolds, falsePaths, stones, vistas, landmark, door, exit, keys };
}

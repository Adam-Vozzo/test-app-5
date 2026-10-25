// Level generation, layer 3 (LEVELS.md → Space): embed the mission graph. Each node becomes a room kit and each
// edge a connector kit. Pure: no Three/DOM.
//
// Justice lays out on a right-angled grid along one main axis (heading north, -Z), so rooms and connectors are
// axis-aligned rectangles. The loop bows to one side: the mid lantern exits sideways, the loop rooms run north
// and turn back, and the gate lands on the axis just north of the lantern. The shortcut is the axis between
// them. Rooms are stone platforms over a fog-filled drop; parapets and walls bound them (no invisible walls).
import type { Rng } from '../core/rng';
import type { DimensionDef, RoomKitDef, RoomKitId } from './dimensions';
import type { MissionGraph } from './gen-graph';

/** 0 north (-Z), 1 east (+X), 2 south (+Z), 3 west (-X). */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DZ = [-1, 0, 1, 0] as const;
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir;
export const rightOf = (d: Dir) => ((d + 1) % 4) as Dir;
/** Yaw that faces along `d` (0 faces -Z, as the camera and dummies use). */
export const yawOf = (d: Dir) => [0, -Math.PI / 2, Math.PI, Math.PI / 2][d];

export type ConnKind = 'bridge' | 'stairs' | 'shortcut' | 'branch';

export interface Door {
  dir: Dir;
  /** Gap width in the room's edge. */
  width: number;
  /** World position of the door's centre (on the edge). */
  x: number;
  z: number;
  connector: number;
}

export interface Room {
  node: number;
  kit: RoomKitId;
  /** Centre and world-axis sizes. */
  x: number;
  z: number;
  sx: number;
  sz: number;
  /** Across and along the room's own axis. */
  w: number;
  d: number;
  inDir: Dir;
  outDir: Dir | null;
  /** Floor height (m). */
  y: number;
  doors: Door[];
}

export interface Connector {
  from: number;
  to: number;
  kind: ConnKind;
  dir: Dir;
  /** Start (on `from`'s edge) and end (on `to`'s edge). */
  ax: number;
  az: number;
  bx: number;
  bz: number;
  width: number;
  y0: number;
  y1: number;
  /** An arch frames the far end (compression before a vista or a fight). */
  arch: boolean;
  /** Tall walls along it instead of parapets (a narrow pass). */
  walled: boolean;
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
  /** Index into `connectors` of the shortcut. */
  shortcut: number;
}

/** Room-local frame: u across (right is +), v along the axis (entry edge at -d/2). */
export function toWorld(r: Room, u: number, v: number): [number, number] {
  const f = r.inDir;
  const rt = rightOf(f);
  return [r.x + DX[rt] * u + DX[f] * v, r.z + DZ[rt] * u + DZ[f] * v];
}

/** World → room-local [u, v]. */
export function toLocal(r: Room, x: number, z: number): [number, number] {
  const f = r.inDir;
  const rt = rightOf(f);
  const dx = x - r.x;
  const dz = z - r.z;
  return [dx * DX[rt] + dz * DZ[rt], dx * DX[f] + dz * DZ[f]];
}

export const roomRect = (r: Room, margin = 0): Rect => ({
  minX: r.x - r.sx / 2 - margin,
  maxX: r.x + r.sx / 2 + margin,
  minZ: r.z - r.sz / 2 - margin,
  maxZ: r.z + r.sz / 2 + margin,
});

export function connRect(c: Connector, margin = 0): Rect {
  const hw = c.width / 2 + 1 + margin;
  return {
    minX: Math.min(c.ax, c.bx) - (c.dir % 2 === 0 ? hw : 0),
    maxX: Math.max(c.ax, c.bx) + (c.dir % 2 === 0 ? hw : 0),
    minZ: Math.min(c.az, c.bz) - (c.dir % 2 === 1 ? hw : 0),
    maxZ: Math.max(c.az, c.bz) + (c.dir % 2 === 1 ? hw : 0),
  };
}

export const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

export const connLength = (c: Connector) => Math.hypot(c.bx - c.ax, c.bz - c.az);

/** Half the room's extent along a world direction. */
const half = (r: Room, d: Dir) => (d % 2 === 0 ? r.sz : r.sx) / 2;

/** The centre of a room's edge facing `d`. */
export function edgeCentre(r: Room, d: Dir): [number, number] {
  return [r.x + DX[d] * half(r, d), r.z + DZ[d] * half(r, d)];
}

function makeRoom(node: number, kit: RoomKitId, def: RoomKitDef, rng: Rng, inDir: Dir, outDir: Dir | null): Room {
  // Even sizes keep flagstone grids and mirrored props tidy.
  const w = 2 * Math.round(rng.range(def.w[0], def.w[1]) / 2);
  const d = 2 * Math.round(rng.range(def.d[0], def.d[1]) / 2);
  const ns = inDir % 2 === 0;
  return { node, kit, x: 0, z: 0, sx: ns ? w : d, sz: ns ? d : w, w, d, inDir, outDir, y: def.floor, doors: [] };
}

/** Put `r` beyond `prev`'s edge facing `dir`, `len` metres away, centred on that edge. */
function attach(prev: Room, r: Room, dir: Dir, len: number) {
  const [ex, ez] = edgeCentre(prev, dir);
  const h = (dir % 2 === 0 ? r.sz : r.sx) / 2;
  r.x = ex + DX[dir] * (len + h);
  r.z = ez + DZ[dir] * (len + h);
}

/** Connector rise is spread over its length; lengthen it if the ramp would be too steep. */
function rampLength(dim: DimensionDef, len: number, dy: number) {
  return Math.max(len, Math.abs(dy) / dim.connector.maxSlope);
}

/** Layer 3. Returns null if the loop can't close within its limits (the caller reseeds). */
export function embed(dim: DimensionDef, g: MissionGraph, rng: Rng): Space | null {
  const N: Dir = 0;
  const S = g.side === 1 ? 1 : 3;
  const back = opposite(S as Dir);
  const crit = g.critical;
  const mid = g.shortcut.lantern;
  const gate = g.shortcut.gate;
  const firstLoop = g.loop[0];
  const lastLoop = g.loop[g.loop.length - 1];

  // Directions: everything heads north, except the turn out at the mid lantern and back through the loop.
  const inDir = (i: number): Dir => (i === firstLoop ? (S as Dir) : i === gate ? back : N);
  const outDir = (i: number): Dir | null => (i === crit.length - 1 ? null : i === mid ? (S as Dir) : i === lastLoop ? back : N);

  const rooms: Room[] = [];
  for (const id of crit) {
    const nd = g.nodes[id];
    rooms.push(makeRoom(id, nd.kit, dim.kits[nd.kit], rng, inDir(nd.index), outDir(nd.index)));
  }
  const [cMin, cMax] = dim.connector.length;
  const lens: number[] = [];
  for (let i = 1; i < rooms.length; i++) lens.push(rampLength(dim, rng.range(cMin, cMax), rooms[i].y - rooms[i - 1].y));

  // Close the loop: the gate must land back on the axis. Solve the first loop connector from the last one.
  const L = rooms[mid];
  const A = rooms[firstLoop];
  const B = rooms[lastLoop];
  const G = rooms[gate];
  const along = (r: Room, d: Dir) => (d % 2 === 0 ? r.sz : r.sx); // full extent along a world direction
  let c3 = lens[gate - 1];
  // (Lengths are horizontal, so ramps on these connectors don't disturb the solve; validation checks their slope.)
  let c1 = c3 + along(B, S as Dir) / 2 + along(G, S as Dir) / 2 - along(L, S as Dir) / 2 - along(A, S as Dir) / 2;
  if (c1 < cMin) {
    c1 = cMin;
    c3 = along(L, S as Dir) / 2 + c1 + along(A, S as Dir) / 2 - along(B, S as Dir) / 2 - along(G, S as Dir) / 2;
  }
  if (c3 > cMax * 2) return null;
  lens[firstLoop - 1] = c1;
  lens[gate - 1] = c3;

  for (let i = 1; i < rooms.length; i++) attach(rooms[i - 1], rooms[i], rooms[i - 1].outDir!, lens[i - 1]);
  // Snap away float drift on the loop's closing axis.
  if (Math.abs(G.x - L.x) > 1e-6) return null;
  G.x = L.x;

  const connectors: Connector[] = [];
  const connect = (a: Room, b: Room, dir: Dir, kind: ConnKind, arch: boolean, walled: boolean) => {
    const [ax, az] = edgeCentre(a, dir);
    const [bx, bz] = edgeCentre(b, opposite(dir));
    const width = kind === 'branch' ? dim.connector.width - 1 : dim.connector.width;
    const c: Connector = { from: a.node, to: b.node, kind, dir, ax, az, bx, bz, width, y0: a.y, y1: b.y, arch, walled };
    if (kind !== 'shortcut' && kind !== 'branch' && Math.abs(b.y - a.y) > 0.05) c.kind = 'stairs';
    const idx = connectors.length;
    connectors.push(c);
    a.doors.push({ dir, width: width + 1, x: ax, z: az, connector: idx });
    b.doors.push({ dir: opposite(dir), width: width + 1, x: bx, z: bz, connector: idx });
    return idx;
  };
  for (let i = 1; i < rooms.length; i++) {
    const nd = g.nodes[rooms[i].node];
    // Compression before a release or a fight: an arch frames the next room, sometimes down a walled pass.
    const arch = nd.vista || nd.template !== null || nd.kind === 'miniboss' || nd.kind === 'gate';
    connect(rooms[i - 1], rooms[i], rooms[i - 1].outDir!, 'bridge', arch, arch && lens[i - 1] >= 10 && rng.chance(0.5));
  }
  const shortcut = connect(L, G, N, 'shortcut', true, false);
  // The way on: a gate in the exit room's far edge (no connector; the builder veils it).
  const last = rooms[crit.length - 1];
  const [lx, lz] = edgeCentre(last, N);
  last.doors.push({ dir: N, width: 7, x: lx, z: lz, connector: -1 });

  // Branches: off a free edge of the host, away from the loop's inside, wherever they fit.
  for (const nd of g.nodes) {
    if (nd.kind !== 'branch') continue;
    const host = rooms.find((r) => r.node === nd.host)!;
    const inside = g.loop.includes(host.node) ? back : -1;
    const free = ([0, 1, 2, 3] as Dir[]).filter((d) => !host.doors.some((dr) => dr.dir === d) && d !== N && d !== inside);
    let placed = false;
    for (const d of shuffleDirs(free, rng)) {
      const r = makeRoom(nd.id, nd.kit, dim.kits[nd.kit], rng, d, null);
      r.y = host.y;
      attach(host, r, d, rng.range(dim.connector.branchLength[0], dim.connector.branchLength[1]));
      const rr = roomRect(r, 3);
      const fake: Connector = { from: host.node, to: r.node, kind: 'branch', dir: d, ...edgeAB(host, r, d), width: dim.connector.width - 1, y0: host.y, y1: r.y, arch: false, walled: false };
      if (rooms.some((o) => overlaps(rr, roomRect(o))) || connectors.some((c) => overlaps(connRect(fake), connRect(c)))) continue;
      rooms.push(r);
      connect(host, r, d, 'branch', false, false);
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  return { rooms, connectors, shortcut };
}

function edgeAB(a: Room, b: Room, d: Dir) {
  const [ax, az] = edgeCentre(a, d);
  const [bx, bz] = edgeCentre(b, opposite(d));
  return { ax, az, bx, bz };
}

function shuffleDirs(ds: Dir[], rng: Rng) {
  const a = [...ds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

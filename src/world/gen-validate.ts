// Level generation, layer 6 (LEVELS.md → Validation): a generated level must pass every check, or the caller
// re-rolls it. Pure: no Three/DOM. Each check returns the reasons it failed (empty = pass).
import type { DimensionDef } from './dimensions';
import { doorCells, EDGE, EYE, inRoom, type Dressing, type Furnishing, type Socket } from './gen-dress';
import { connected } from './scaffold';
import { isCombat, type LevelScript, type MissionGraph } from './gen-graph';
import { connLength, connRect, overlaps, roomRect, toLocal, type Space } from './gen-space';

export interface LevelParts {
  dim: DimensionDef;
  script: LevelScript;
  graph: MissionGraph;
  space: Space;
  furn: Furnishing;
  sockets: Socket[];
  dressing: Dressing;
  /** The least distance a ranged enemy may start from its room's entry (m); 0 skips the rule. */
  rangedMin?: number;
}

/** Fog makes everything beyond this invisible anyway; the props budget is what's built. */
export const BUDGET = { rooms: 14, props: 700, lanternClear: 15, entryClear: 6 };

export function validate(p: LevelParts): string[] {
  return [...checkGraph(p), ...checkSpace(p), ...checkSockets(p), ...checkHoards(p), ...checkScaffolds(p), ...checkLandmark(p), ...checkBudget(p)];
}

/** The Tower's collapse: every scaffold room's doors are joined by sound decks before anything has been stepped on. */
export function checkScaffolds({ dim, space, dressing }: LevelParts): string[] {
  const out: string[] = [];
  const want = dim.collapse ? space.rooms.filter((r) => dim.kits[r.kit].scaffold).length : 0;
  if (dressing.scaffolds.length !== want) out.push(`scaffolds: ${dressing.scaffolds.length} of ${want} rooms`);
  for (const s of dressing.scaffolds) {
    const r = space.rooms.find((x) => x.node === s.node)!;
    const doors = doorCells(s, r);
    if (doors.some(([c]) => c < 0)) out.push(`scaffolds: a door off room ${s.node}'s decks`);
    else if (!connected(s.cols, s.rows, (i) => s.rotten.includes(i), doors.slice(0, 1), doors)) out.push(`scaffolds: rot cuts room ${s.node}'s doors apart`);
  }
  return out;
}

/** The Devil's temptation: enough hoards, each inside its room, with a cost its level allows. */
export function checkHoards({ dim, script, graph, space, dressing }: LevelParts): string[] {
  const tm = dim.temptation;
  if (!tm) return dressing.hoards.length ? ['hoards: in a dimension without temptation'] : [];
  const out: string[] = [];
  const level = ['introduce', 'develop', 'twist'].indexOf(script.beat);
  const plain = dressing.hoards.filter((h) => !h.branch);
  if (plain.length < tm.hoards[level][0]) out.push(`hoards: only ${plain.length}`);
  const branches = graph.nodes.filter((nd) => nd.kind === 'branch').length;
  if (dressing.hoards.length - plain.length !== branches) out.push('hoards: a branch without its hoard');
  for (const h of dressing.hoards) {
    const r = space.rooms.find((x) => x.node === h.node);
    if (!r || !inRoom(r, h.x, h.z)) out.push(`hoards: one outside room ${h.node}`);
    if (!h.branch && !tm.costs[level].includes(h.cost)) out.push(`hoards: a ${h.cost} hoard in a level that doesn't teach it`);
  }
  return out;
}

export function checkGraph({ dim, script, graph }: LevelParts): string[] {
  const out: string[] = [];
  const crit = graph.critical.map((id) => graph.nodes[id]);
  const n = crit.length;
  if (n < dim.criticalNodes[0] || n > dim.criticalNodes[1]) out.push(`graph: ${n} critical nodes`);
  if (crit[0].kind !== 'start' || crit[n - 1].kind !== 'exit') out.push('graph: must run start → … → exit');
  const mb = crit.findIndex((nd) => nd.kind === 'miniboss');
  if (mb < 1 || crit[mb - 1].kind !== 'lantern') out.push('graph: no lantern right before the miniboss');
  if (crit.filter((nd) => nd.vista).length < 2) out.push('graph: fewer than two vistas');
  const sp = crit.findIndex((nd) => nd.kind === 'setpiece');
  if (sp < Math.floor(n / 3) || sp >= Math.ceil((2 * n) / 3)) out.push('graph: set-piece outside the middle third');
  if (!script.allowAdjacentCombats) for (let i = 1; i < n; i++) if (isCombat(crit[i]) && isCombat(crit[i - 1])) out.push(`graph: combats back to back at ${i - 1}–${i}`);
  for (const t of script.mustInclude) if (!crit.some((nd) => nd.template === t)) out.push(`graph: no ${t} encounter`);
  const branches = graph.nodes.filter((nd) => nd.kind === 'branch').length;
  if (branches < dim.branches[0] || branches > dim.branches[1]) out.push(`graph: ${branches} branches`);
  // Reachability without the shortcut, and the shortcut joins a later gate back to an earlier lantern.
  const seen = new Set([graph.critical[0]]);
  const queue = [graph.critical[0]];
  while (queue.length) {
    const a = queue.shift()!;
    for (const [x, y] of graph.edges) {
      const b = x === a ? y : y === a ? x : -1;
      if (b >= 0 && !seen.has(b)) {
        seen.add(b);
        queue.push(b);
      }
    }
  }
  if (seen.size !== graph.nodes.length) out.push('graph: unreachable nodes');
  const { gate, lantern } = graph.shortcut;
  if (!graph.nodes[lantern].lantern || graph.nodes[gate].index <= graph.nodes[lantern].index + 2) out.push('graph: shortcut must loop a later gate back to an earlier lantern');
  return out;
}

export function checkSpace({ dim, space }: LevelParts): string[] {
  const out: string[] = [];
  const { rooms, connectors } = space;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (overlaps(roomRect(rooms[i], 2), roomRect(rooms[j]))) out.push(`space: rooms ${rooms[i].node} and ${rooms[j].node} overlap`);
    }
  }
  connectors.forEach((c, i) => {
    for (const r of rooms) {
      if (r.node === c.from || r.node === c.to) continue;
      if (overlaps(connRect(c, 1), roomRect(r))) out.push(`space: connector ${c.from}→${c.to} cuts room ${r.node}`);
    }
    for (let j = i + 1; j < connectors.length; j++) {
      const d = connectors[j];
      if (d.from === c.from || d.from === c.to || d.to === c.from || d.to === c.to) continue;
      if (overlaps(connRect(c, 1), connRect(d))) out.push(`space: connectors ${c.from}→${c.to} and ${d.from}→${d.to} cross`);
    }
    const len = connLength(c);
    if (len < 4) out.push(`space: connector ${c.from}→${c.to} too short`);
    if (Math.abs(c.y1 - c.y0) / Math.max(len, 0.01) > dim.connector.maxSlope + 1e-6) out.push(`space: connector ${c.from}→${c.to} too steep`);
  });
  const sc = connLength(connectors[space.shortcut]);
  if (sc < dim.loop.shortcut[0] || sc > dim.loop.shortcut[1]) out.push(`space: shortcut ${sc.toFixed(1)} m`);
  return out;
}

export function checkSockets({ dim, graph, space, furn, sockets, dressing, rangedMin = 0 }: LevelParts): string[] {
  const out: string[] = [];
  for (const s of sockets) {
    const r = space.rooms.find((x) => x.node === s.node)!;
    // Fair range: every throw can be read and dodged from the moment you walk in.
    if (rangedMin > 0 && dim.rangedFoes.includes(s.foe)) {
      const entry = r.doors.find((d) => d.dir === (r.inDir + 2) % 4) ?? r.doors[0];
      if (Math.hypot(s.x - entry.x, s.z - entry.z) < rangedMin) out.push(`sockets: ${s.foe} within ${rangedMin.toFixed(1)} m of room ${s.node}'s entry`);
    }
    if (!inRoom(r, s.x, s.z, EDGE.thick + 0.4)) out.push(`sockets: ${s.kind} outside room ${s.node}`);
    const [, v] = toLocal(r, s.x, s.z);
    // Fair angles: nobody starts behind or beside the entrance unless it's an ambush (with its tell).
    if (v < -r.d / 2 + BUDGET.entryClear && s.template !== 'ambush') out.push(`sockets: ${s.kind} at room ${s.node}'s entry`);
    for (const l of dressing.lanterns) if (Math.hypot(l.x - s.x, l.z - s.z) < BUDGET.lanternClear) out.push(`sockets: ${s.kind} within ${BUDGET.lanternClear} m of a lantern`);
    // Verticality: at most one raised tier, ≤ 4 m.
    if (s.y - r.y > 4) out.push(`sockets: ${s.kind} too high`);
    const inside = furn.boxes.some((b) => b.kind !== 'edge' && b.y + b.h > s.y + 0.05 && Math.abs(s.x - b.x) < b.sx / 2 && Math.abs(s.z - b.z) < b.sz / 2);
    if (inside) out.push(`sockets: ${s.kind} inside cover in room ${s.node}`);
  }
  for (const nd of graph.nodes) {
    if (!isCombat(nd)) continue;
    const r = space.rooms.find((x) => x.node === nd.id)!;
    const span = Math.max(r.w, r.d);
    if (Math.min(r.w, r.d) < 18 || span > 44) out.push(`sockets: combat room ${nd.id} is ${r.w}×${r.d} m`);
    if (!sockets.some((s) => s.node === nd.id)) out.push(`sockets: combat room ${nd.id} is empty`);
  }
  return out;
}

/** An axis-aligned occluder for the landmark sight test. */
interface Occluder {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function occluders({ space, furn, dressing }: LevelParts): Occluder[] {
  const out: Occluder[] = [];
  const box = (x: number, z: number, sx: number, sz: number, y0: number, y1: number) =>
    out.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, minY: y0, maxY: y1 });
  for (const b of furn.boxes) box(b.x, b.z, b.sx, b.sz, b.y, b.y + b.h);
  for (const c of furn.columns) box(c.x, c.z, 1.3, 1.3, c.y, c.y + c.h + 0.3);
  // Room slabs (their tops) and arches (piers and lintel; the opening is clear).
  for (const r of space.rooms) box(r.x, r.z, r.sx, r.sz, r.y - 30, r.y);
  for (const a of dressing.arches) {
    const ns = a.dir % 2 === 0;
    for (const s of [-1, 1]) {
      const off = a.width / 2 + 1;
      box(a.x + (ns ? s * off : 0), a.z + (ns ? 0 : s * off), ns ? 2 : 2.4, ns ? 2.4 : 2, a.y, a.y + a.height);
    }
    box(a.x, a.z, ns ? a.width + 4.6 : 2.8, ns ? 2.8 : a.width + 4.6, a.y + a.height, a.y + a.height + 1.9);
  }
  for (const h of dressing.heroSwords) box(h.x, h.z, h.len * 0.12, h.len * 0.12, h.y, h.y + h.len * 0.85);
  return out;
}

/** Slab test: does the segment from a to b pass through the box? */
export function segmentHitsBox(a: [number, number, number], b: [number, number, number], o: Occluder): boolean {
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

/** The landmark's telling parts (Justice: beam, pans and pillar; the Devil: brazier and horns): it reads if any is in plain sight. */
export function landmarkTargets(d: Dressing, targets: [number, number][]): [number, number, number][] {
  const { x, z, y, h } = d.landmark;
  return targets.map(([u, v]) => [x + u * h, y + v * h, z]);
}

export function landmarkVisible(p: LevelParts, x: number, y: number, z: number, occ = occluders(p)): boolean {
  const eye: [number, number, number] = [x, y + EYE, z];
  return landmarkTargets(p.dressing, p.dim.landmark.targets).some((t) => !occ.some((o) => segmentHitsBox(eye, t, o)));
}

export function checkLandmark(p: LevelParts): string[] {
  const out: string[] = [];
  const occ = occluders(p);
  const s = p.dressing.spawn;
  if (!landmarkVisible(p, s.x, s.y, s.z, occ)) out.push('landmark: hidden from the spawn');
  for (const v of p.dressing.vistas) if (!landmarkVisible(p, v.x, v.y, v.z, occ)) out.push(`landmark: hidden from vista ${v.node}`);
  return out;
}

export function checkBudget({ space, furn, dressing }: LevelParts): string[] {
  const out: string[] = [];
  if (space.rooms.length > BUDGET.rooms) out.push(`budget: ${space.rooms.length} rooms`);
  const props = furn.boxes.length + furn.columns.length + dressing.swords.length + dressing.arches.length;
  if (props > BUDGET.props) out.push(`budget: ${props} props`);
  return out;
}

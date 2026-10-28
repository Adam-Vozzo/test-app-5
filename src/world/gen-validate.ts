// Level generation, layer 6 (LEVELS.md → Validation): a generated level must pass every check, or the caller
// re-rolls it. Pure: no Three/DOM. Each check returns the reasons it failed (empty = pass).
import type { DimensionDef } from './dimensions';
import { doorCells, EDGE, inRoom, PAN, type Dressing, type Furnishing, type Socket } from './gen-dress';
import { landmarkPoints, occludersOf, seesFrom, spotsIn, type Occluder } from './gen-sight';
import { connected } from './scaffold';
import { isCombat, type LevelScript, type MissionGraph } from './gen-graph';
import { anyOverlap, connLength, connObbs, obbOverlap, roomObb, segmentsOf, toLocal, wrapAngle, type Space } from './gen-space';

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
export const BUDGET = { rooms: 16, props: 760, lanternClear: 15, entryClear: 6 };

/** The Devil's pedestal stays in sight from at least this share of the critical rooms (the pit is always there). */
export const PIT_IN_SIGHT = 0.6;

export function validate(p: LevelParts): string[] {
  return [
    ...checkGraph(p),
    ...checkSpace(p),
    ...checkSockets(p),
    ...checkHoards(p),
    ...checkScaffolds(p),
    ...checkIllusions(p),
    ...checkLandmark(p),
    ...checkShape(p),
    ...checkBudget(p),
  ];
}

/** The Moon: false paths are only ever branches (never the way on), and no room is all reflections. */
export function checkIllusions({ dim, space, sockets, dressing }: LevelParts): string[] {
  const out: string[] = [];
  if (!dim.illusion) return dressing.falsePaths.length || sockets.some((s) => s.illusion) ? ['illusions: in a dimension without them'] : [];
  for (const i of dressing.falsePaths) if (space.connectors[i]?.kind !== 'branch') out.push(`illusions: connector ${i} is a false path on the way on`);
  // Each false path has its hidden way across, stone to stone within a careful step (corner to corner).
  for (const i of dressing.falsePaths) {
    const c = space.connectors[i];
    const mine = dressing.stones.filter((s) => Math.min(Math.hypot(s.x - c.ax, s.z - c.az), Math.hypot(s.x - c.bx, s.z - c.bz)) <= Math.hypot(c.bx - c.ax, c.bz - c.az));
    if (mine.length < 2) out.push(`illusions: false path ${i} has no hidden way across`);
    for (let k = 1; k < mine.length; k++) {
      const a = mine[k - 1];
      const b = mine[k];
      // In the stones' own frame (they're turned square to their path).
      const [u, v] = toLocal({ x: a.x, z: a.z, yaw: a.yaw }, b.x, b.z);
      const gap = Math.max(0, Math.abs(u) - a.size) ** 2 + Math.max(0, Math.abs(v) - a.size) ** 2;
      if (Math.sqrt(gap) > 1.0) out.push(`illusions: false path ${i}'s stones ${k - 1}-${k} are too far apart`);
    }
  }
  const rooms = new Set(sockets.map((s) => s.node));
  for (const n of rooms) {
    const here = sockets.filter((s) => s.node === n && s.kind !== 'miniboss');
    if (here.length && here.every((s) => s.illusion)) out.push(`illusions: room ${n} holds only reflections`);
  }
  if (sockets.some((s) => s.kind === 'miniboss' && s.illusion)) out.push('illusions: the court card is a reflection');
  return out;
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
  // The set-piece sits in the middle third (Justice: the reward past the axis gate, before the last fifth).
  const [lo, hi] = graph.wings ? [Math.floor(n / 3), Math.ceil(0.8 * n)] : [Math.floor(n / 3), Math.ceil((2 * n) / 3)];
  if (sp < lo || sp >= hi) out.push('graph: set-piece outside the middle third');
  // Fights never sit back to back along a way (but in the twist).
  if (!script.allowAdjacentCombats) for (const [a, b] of graph.edges) if (isCombat(graph.nodes[a]) && isCombat(graph.nodes[b])) out.push(`graph: combats back to back at ${a}–${b}`);
  for (const t of script.mustInclude) if (!graph.nodes.some((nd) => nd.template === t)) out.push(`graph: no ${t} encounter`);
  const branches = graph.nodes.filter((nd) => nd.kind === 'branch').length;
  if (branches < dim.branches[0] || branches > dim.branches[1]) out.push(`graph: ${branches} branches`);
  // Reachability (the shortcut and the axis gate included: they open in play), and the shortcut joins a later
  // gate back to an earlier lantern.
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
      if (obbOverlap(roomObb(rooms[i], 1), roomObb(rooms[j], 1))) out.push(`space: rooms ${rooms[i].node} and ${rooms[j].node} overlap`);
    }
  }
  connectors.forEach((c, i) => {
    const mine = connObbs(c, 1);
    for (const r of rooms) {
      if (r.node === c.from || r.node === c.to) continue;
      if (anyOverlap(mine, [roomObb(r)])) out.push(`space: connector ${c.from}→${c.to} cuts room ${r.node}`);
    }
    for (let j = i + 1; j < connectors.length; j++) {
      const d = connectors[j];
      if (d.from === c.from || d.from === c.to || d.to === c.from || d.to === c.to) continue;
      if (anyOverlap(mine, connObbs(d))) out.push(`space: connectors ${c.from}→${c.to} and ${d.from}→${d.to} cross`);
    }
    const len = connLength(c);
    if (len < 4) out.push(`space: connector ${c.from}→${c.to} too short`);
    for (const s of segmentsOf(c)) if (s.len > 0.01 && Math.abs(s.by - s.ay) / s.len > dim.connector.maxSlope + 1e-6) out.push(`space: connector ${c.from}→${c.to} too steep`);
    // Square to both doorways: its parapets run on flush.
    const segs = segmentsOf(c);
    const a = rooms.find((r) => r.node === c.from)?.doors.find((d) => d.connector === i);
    const b = rooms.find((r) => r.node === c.to)?.doors.find((d) => d.connector === i);
    if (a && Math.abs(wrapAngle(segs[0].yaw - a.yaw)) > 1e-3) out.push(`space: connector ${c.from}→${c.to} leaves its door askew`);
    if (b && Math.abs(wrapAngle(segs[segs.length - 1].yaw - b.yaw - Math.PI)) > 1e-3) out.push(`space: connector ${c.from}→${c.to} enters its door askew`);
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
      const entry = r.doors.find((d) => d.side === 'back') ?? r.doors[0];
      if (Math.hypot(s.x - entry.x, s.z - entry.z) < rangedMin) out.push(`sockets: ${s.foe} within ${rangedMin.toFixed(1)} m of room ${s.node}'s entry`);
    }
    if (!inRoom(r, s.x, s.z, EDGE.thick + 0.4)) out.push(`sockets: ${s.kind} outside room ${s.node}`);
    const [, v] = toLocal(r, s.x, s.z);
    // Fair angles: nobody starts behind or beside the entrance unless it's an ambush (with its tell).
    if (v < -r.d / 2 + BUDGET.entryClear && s.template !== 'ambush') out.push(`sockets: ${s.kind} at room ${s.node}'s entry`);
    for (const l of dressing.lanterns) if (Math.hypot(l.x - s.x, l.z - s.z) < BUDGET.lanternClear) out.push(`sockets: ${s.kind} within ${BUDGET.lanternClear} m of a lantern`);
    // Verticality: at most one raised tier, ≤ 4 m.
    if (s.y - r.y > 4) out.push(`sockets: ${s.kind} too high`);
    const inside = furn.boxes.some((b) => b.kind !== 'edge' && b.y + b.h > s.y + 0.05 && boxContains(b, s.x, s.z));
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

function boxContains(b: { x: number; z: number; sx: number; sz: number; yaw: number }, x: number, z: number) {
  const dx = x - b.x;
  const dz = z - b.z;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return Math.abs(dx * c - dz * s) < b.sx / 2 && Math.abs(dx * s + dz * c) < b.sz / 2;
}

export { segmentHitsBox, segmentHitsOccluder, type Occluder } from './gen-sight';

export function occluders({ space, furn, dressing }: LevelParts): Occluder[] {
  return occludersOf({ rooms: space.rooms, boxes: furn.boxes, columns: furn.columns, arches: dressing.arches, towers: dressing.towers, heroSwords: dressing.heroSwords });
}

/** The landmark's telling parts (Justice: beam, pans and pillar; the Devil: brazier and horns): it reads if any is in plain sight. */
export function landmarkTargets(d: Dressing, targets: [number, number][]): [number, number, number][] {
  return landmarkPoints(d.landmark, targets);
}

export function landmarkVisible(p: LevelParts, x: number, y: number, z: number, occ = occluders(p)): boolean {
  return seesFrom(landmarkTargets(p.dressing, p.dim.landmark.targets), occ, x, y, z);
}

/** The share of critical rooms the landmark can be seen from (from some spot in each). */
export function landmarkShare(p: LevelParts, occ = occluders(p)): number {
  const lm = p.dressing.landmark;
  const pts = landmarkTargets(p.dressing, p.dim.landmark.targets);
  const crit = p.graph.critical.map((id) => p.space.rooms.find((r) => r.node === id)!);
  const seen = crit.filter((r) => spotsIn(r, lm.x, lm.z).some(([x, z]) => seesFrom(pts, occ, x, r.y, z))).length;
  return seen / crit.length;
}

export function checkLandmark(p: LevelParts): string[] {
  const out: string[] = [];
  const occ = occluders(p);
  const s = p.dressing.spawn;
  if (!landmarkVisible(p, s.x, s.y, s.z, occ)) out.push('landmark: hidden from the spawn');
  for (const v of p.dressing.vistas) if (!landmarkVisible(p, v.x, v.y, v.z, occ)) out.push(`landmark: hidden from vista ${v.node}`);
  // The Devil's pit and the Tower's crown are always there: from most rooms (the pit), or every one (the crown).
  if (p.dim.layout.kind === 'spiral') {
    const share = landmarkShare(p, occ);
    const need = p.dim.descent > 0 ? PIT_IN_SIGHT : 1;
    if (share < need - 1e-9) out.push(`landmark: in sight from only ${Math.round(share * 100)}% of the rooms`);
  }
  return out;
}

/**
 * The card's shape (LEVELS.md → Space): the meaning, checked. Justice weighs two mirrored wings, a key at the end of
 * each, and the axis gate opens on both; the Devil only goes down and the Tower only up; the Moon's true ways (its
 * true branches too) pass between two towers and its false paths never do.
 */
export function checkShape({ dim, graph, space, furn, dressing }: LevelParts): string[] {
  const out: string[] = [];
  const byNode = (id: number) => space.rooms.find((r) => r.node === id)!;
  if (dim.layout.kind === 'weighing') {
    const w = graph.wings;
    if (!w) return ['shape: no wings to weigh'];
    if (w[0].length !== w[1].length) out.push('shape: the wings are unequal');
    for (const ids of w) if (graph.nodes[ids[ids.length - 1]].kind !== 'key') out.push('shape: a wing without its key');
    const hub = byNode(graph.shortcut.lantern);
    w[0].forEach((id, i) => {
      const a = byNode(id);
      const b = byNode(w[1][i]);
      if (Math.abs(2 * hub.x - a.x - b.x) > 1e-6 || Math.abs(a.z - b.z) > 1e-6 || Math.abs(wrapAngle(a.yaw + b.yaw)) > 1e-6 || a.w !== b.w || a.d !== b.d || a.kit !== b.kit) out.push(`shape: wing rooms ${id} and ${w[1][i]} don't mirror`);
    });
    if (dressing.keys.length !== 2 || dressing.keys[0].wing === dressing.keys[1].wing) out.push('shape: not one key in each pan');
    // Each pan stands clear: nothing solid (cover, a tier, a column, the weight) within its reach.
    for (const k of dressing.keys) {
      const buried =
        furn.boxes.some((b) => {
          if (b.kind === 'edge' || b.kind === 'wall' || Math.abs(b.y - k.pan.y) > 3) return false;
          const [u, v] = toLocal({ x: b.x, z: b.z, yaw: b.yaw }, k.pan.x, k.pan.z);
          return Math.hypot(Math.max(0, Math.abs(u) - b.sx / 2), Math.max(0, Math.abs(v) - b.sz / 2)) < PAN.reach;
        }) ||
        furn.columns.some((c) => Math.abs(c.y - k.pan.y) < 3 && Math.hypot(c.x - k.pan.x, c.z - k.pan.z) < PAN.reach + 0.65) ||
        furn.ramps.some((rp) => {
          const len = Math.hypot(rp.x1 - rp.x0, rp.z1 - rp.z0);
          const t = Math.max(0, Math.min(1, ((k.pan.x - rp.x0) * (rp.x1 - rp.x0) + (k.pan.z - rp.z0) * (rp.z1 - rp.z0)) / (len * len)));
          return Math.hypot(rp.x0 + (rp.x1 - rp.x0) * t - k.pan.x, rp.z0 + (rp.z1 - rp.z0) * t - k.pan.z) < PAN.reach + rp.width / 2;
        });
      if (buried) out.push(`shape: the ${k.wing ? 'right' : 'left'} pan is buried in the room's furniture`);
    }
    if (dressing.door.opens !== 'keys') out.push('shape: the axis gate must open on the keys');
  } else if (dressing.keys.length) out.push('shape: keys outside Justice');
  if (dim.layout.kind === 'spiral') {
    // Only down (the Devil) or only up (the Tower), outside the level loop.
    const crit = graph.critical.map((id) => graph.nodes[id]);
    const inLoop = (id: number) => graph.loop.includes(id) || id === graph.shortcut.gate;
    const datum = (id: number) => byNode(id).y - dim.kits[byNode(id).kit].floor;
    for (let i = 1; i < crit.length; i++) {
      if (inLoop(crit[i].id)) continue;
      const prev = inLoop(crit[i - 1].id) ? graph.shortcut.gate : crit[i - 1].id;
      const step = datum(crit[i].id) - datum(prev);
      if (Math.abs(step + dim.descent) > 1e-6) out.push(`shape: room ${crit[i].id} doesn't step ${dim.descent > 0 ? 'down' : 'up'}`);
    }
  }
  if (dim.gateway === 'towers') {
    // Every true way (branches too) stands between towers; a false path never does.
    const ways = space.connectors.length - dressing.falsePaths.length;
    if (dressing.towers.length !== ways) out.push(`shape: ${dressing.towers.length} of ${ways} true ways stand between towers`);
    for (const i of dressing.falsePaths) {
      const c = space.connectors[i];
      if (dressing.towers.some((t) => Math.hypot(t.x - c.bx, t.z - c.bz) < 0.5)) out.push('shape: towers at a false path (it must not have them)');
    }
  } else if (dressing.towers.length) out.push('shape: towers outside the Moon');
  return out;
}

export function checkBudget({ space, furn, dressing }: LevelParts): string[] {
  const out: string[] = [];
  if (space.rooms.length > BUDGET.rooms) out.push(`budget: ${space.rooms.length} rooms`);
  const props = furn.boxes.length + furn.columns.length + dressing.swords.length + dressing.arches.length + dressing.towers.length;
  if (props > BUDGET.props) out.push(`budget: ${props} props`);
  return out;
}

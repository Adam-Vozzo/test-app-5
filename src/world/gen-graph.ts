// Level generation, layers 1–2 (LEVELS.md): the level script and the mission graph. Pure: no Three/DOM.
//
// The critical path always has this shape:
//
//   start → P… → lantern (mid) → loop… → gate → Q… → lantern → miniboss → exit
//
// The loop rooms bow out to one side and come back, so the gate ends up on the main axis just beyond the mid
// lantern: the shortcut between them is the axis itself, barred until opened from the gate's side. The middle
// slots (P, loop, Q) hold the set-piece, the vistas, the combats and any traverse, permuted under the constraints
// below until a valid order turns up.
import type { Rng } from '../core/rng';
import type { Beat, CourtRank, DimensionDef, EncounterTemplate, RoomKitId, SetPieceDef } from './dimensions';

export type NodeKind = 'start' | 'combat' | 'traverse' | 'vista' | 'lantern' | 'branch' | 'setpiece' | 'gate' | 'miniboss' | 'exit' | 'key';

export interface LevelScript {
  level: number;
  beat: Beat;
  miniboss: CourtRank;
  minibossName: string;
  setPiece: SetPieceDef;
  /** Combat spaces on the critical path, counting a fighting set-piece and a guarded gate. */
  combats: number;
  /** The gate room holds a fight (the "guarded gate" template), which frees a slot on a tight path. */
  gateGuarded: boolean;
  traverse: number;
  branches: number;
  mustInclude: EncounterTemplate[];
  allowAdjacentCombats: boolean;
  enemies: [number, number];
}

export interface LevelNode {
  id: number;
  kind: NodeKind;
  kit: RoomKitId;
  /** Index on the critical path, or -1 for a branch. */
  index: number;
  /** Encounter template, if a fight happens here. */
  template: EncounterTemplate | null;
  /** Counts as one of the level's vistas (a vista node, or a set-piece that is a view). */
  vista: boolean;
  /** Rest point (start and lantern nodes). */
  lantern: boolean;
  /** Branch nodes: the critical node they hang off. */
  host: number;
}

export interface MissionGraph {
  nodes: LevelNode[];
  /** Node ids along the critical path, start to exit. */
  critical: number[];
  /** Critical path plus branch edges. The shortcut is separate: it only exists once opened. */
  edges: [number, number][];
  shortcut: { gate: number; lantern: number };
  /** Critical node ids strictly between the mid lantern and the gate. */
  loop: number[];
  /** Which way the loop bows: +1 east, -1 west. */
  side: 1 | -1;
  /**
   * Justice's weighing: the two wings off the mid lantern (`shortcut.lantern`), each a run of rooms ending in its key
   * room (left first, then its mirror). The axis gate (`shortcut.gate`) opens when both keys are set. No loop.
   */
  wings?: [number[], number[]];
}

/** Layer 1: the level script, chosen from the dimension script and the seed. */
export function levelScript(dim: DimensionDef, level: number, rng: Rng): LevelScript {
  const L = dim.levels[level];
  const setPiece = rng.pick(dim.setPieces);
  const [nMin, nMax] = dim.criticalNodes;
  // Fixed nodes: start, mid lantern, gate, pre-miniboss lantern, miniboss, exit.
  const freeMax = nMax - 6;
  let combats = rng.int(L.combats[0], L.combats[1]);
  // Free slots needed: the set-piece, the vistas it doesn't provide, and the plain combats.
  const free = (c: number, g: boolean) => 1 + (2 - (setPiece.vista ? 1 : 0)) + (c - (setPiece.combat ? 1 : 0) - (g ? 1 : 0));
  let gateGuarded = L.beat !== 'introduce' && rng.chance(0.35);
  if (free(combats, gateGuarded) > freeMax) gateGuarded = true;
  while (free(combats, gateGuarded) > freeMax && combats > 1) combats--;
  // A required template needs a plain combat room to live in.
  const plain = combats - (setPiece.combat ? 1 : 0) - (gateGuarded ? 1 : 0);
  if (plain < L.mustInclude.length && gateGuarded && free(combats, false) <= freeMax) gateGuarded = false;
  const used = free(combats, gateGuarded);
  const traverse = rng.int(Math.max(0, nMin - 6 - used), Math.max(0, freeMax - used));
  return {
    level,
    beat: L.beat,
    miniboss: L.miniboss,
    minibossName: L.minibossName,
    setPiece,
    combats,
    gateGuarded,
    traverse,
    branches: rng.int(dim.branches[0], dim.branches[1]),
    mustInclude: L.mustInclude,
    allowAdjacentCombats: L.allowAdjacentCombats,
    enemies: L.enemies,
  };
}

/** Does a node hold a fight? */
export const isCombat = (n: LevelNode) => n.template !== null || n.kind === 'miniboss';

type Slot = { kind: NodeKind; setPiece?: boolean };

/** Layer 2: the mission graph. Returns null if no order satisfies the constraints (the caller reseeds). */
export function missionGraph(dim: DimensionDef, script: LevelScript, rng: Rng): MissionGraph | null {
  if (dim.layout.kind === 'weighing') return weighingGraph(dim, script, rng);
  // Some scripts have no order at all under the rules (too few rooms to keep fights apart with one past the gate):
  // give them a traverse more while the level has room for it.
  for (let more = 0; 6 + loopSlots(script) + more <= dim.criticalNodes[1]; more++) {
    const g = loopGraph(dim, { ...script, traverse: script.traverse + more }, rng);
    if (g) return g;
  }
  return null;
}

/** The loop's free slots for a script: the set-piece, the vistas it doesn't give, the plain fights and the traverse. */
function loopSlots(s: LevelScript) {
  return 1 + (2 - (s.setPiece.vista ? 1 : 0)) + (s.combats - (s.setPiece.combat ? 1 : 0) - (s.gateGuarded ? 1 : 0)) + s.traverse;
}

function loopGraph(dim: DimensionDef, script: LevelScript, rng: Rng): MissionGraph | null {
  const sp = script.setPiece;
  const middle: Slot[] = [{ kind: 'setpiece', setPiece: true }];
  for (let i = 0; i < 2 - (sp.vista ? 1 : 0); i++) middle.push({ kind: 'vista' });
  for (let i = 0; i < script.combats - (sp.combat ? 1 : 0) - (script.gateGuarded ? 1 : 0); i++) middle.push({ kind: 'combat' });
  for (let i = 0; i < script.traverse; i++) middle.push({ kind: 'traverse' });
  const m = middle.length;
  const side: 1 | -1 = rng.chance(0.5) ? 1 : -1;

  for (let attempt = 0; attempt < 400; attempt++) {
    const strict = attempt < 200;
    const order = shuffle(middle, rng);
    const loopN = rng.int(dim.loop.rooms[0], Math.min(dim.loop.rooms[1], m - 1));
    const pN = rng.int(1, m - loopN);
    const P = order.slice(0, pN);
    const I = order.slice(pN, pN + loopN);
    const Q = order.slice(pN + loopN);
    const seq: Slot[] = [{ kind: 'start' }, ...P, { kind: 'lantern' }, ...I, { kind: 'gate' }, ...Q, { kind: 'lantern' }, { kind: 'miniboss' }, { kind: 'exit' }];
    const n = seq.length;
    const midLantern = 1 + pN;
    const gateIdx = midLantern + loopN + 1;
    const loopIdx = I.map((_, i) => midLantern + 1 + i);
    // Turning slots: the mid lantern, the loop's first and last rooms, and the gate.
    const turning = new Set([midLantern, loopIdx[0], loopIdx[loopIdx.length - 1], gateIdx]);

    // Kits: a long, straight set-piece can't sit in a turning slot.
    const kits: RoomKitId[] = [];
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const s = seq[i];
      const cands = kitsFor(dim, s, sp);
      const fit = cands.filter((k) => !turning.has(i) || dim.kits[k].turns);
      if (!fit.length) ok = false;
      else kits.push(rng.pick(fit));
    }
    if (!ok) continue;

    const combatAt = (i: number) => {
      const s = seq[i];
      return s.kind === 'combat' || (s.kind === 'setpiece' && sp.combat) || (s.kind === 'gate' && script.gateGuarded) || s.kind === 'miniboss';
    };
    // A long, straight set-piece stays out of the loop: it would stretch the shortcut past its limit.
    if (!dim.kits[sp.kit].turns && I.some((x) => x.kind === 'setpiece')) continue;
    // The set-piece sits in the middle third.
    const spIdx = seq.findIndex((s) => s.kind === 'setpiece');
    if (spIdx < Math.floor(n / 3) || spIdx >= Math.ceil((2 * n) / 3)) continue;
    // The gate is a late node: in the second half.
    if (gateIdx < n / 2) continue;
    // Past the gate, a fight before the next lantern: dying there sends you back to the mid lantern, and that's when
    // the shortcut pays. (With the lantern right past the gate, nobody ever used it.)
    if (!Q.some((s) => s.kind === 'combat' || (s.kind === 'setpiece' && sp.combat))) continue;
    // No two combats back to back, unless the beat is the twist.
    let adjacent = false;
    for (let i = 1; i < n; i++) if (combatAt(i) && combatAt(i - 1)) adjacent = true;
    if (adjacent && !script.allowAdjacentCombats) continue;
    // Vistas don't bunch up.
    let vistaPair = false;
    for (let i = 1; i < n; i++) if (seq[i].kind === 'vista' && seq[i - 1].kind === 'vista') vistaPair = true;
    if (vistaPair) continue;
    if (strict) {
      // Soft rules, relaxed after half the attempts: rest after a fight, and open gently in the introduce beat.
      if (!combatAt(midLantern - 1)) continue;
      if (script.beat === 'introduce' && combatAt(1)) continue;
    }

    const nodes: LevelNode[] = seq.map((s, i) => ({
      id: i,
      kind: s.kind,
      kit: kits[i],
      index: i,
      template: null,
      vista: s.kind === 'vista' || (s.kind === 'setpiece' && sp.vista),
      lantern: s.kind === 'start' || s.kind === 'lantern',
      host: -1,
    }));
    assignTemplates(dim, script, nodes, sp, rng);
    for (const nd of nodes) {
      if (nd.kind !== 'combat' || !nd.template) continue;
      const kit = dim.templateKits[nd.template];
      if (!turning.has(nd.index) || dim.kits[kit].turns) nd.kit = kit;
    }
    const critical = nodes.map((nd) => nd.id);
    const edges: [number, number][] = [];
    for (let i = 1; i < n; i++) edges.push([i - 1, i]);
    // Branches hang off combat rooms (the reward for clearing them), never the gate or the miniboss.
    const hosts = shuffle(
      nodes.filter((nd) => nd.kind === 'combat' || (nd.kind === 'setpiece' && sp.combat) || nd.kind === 'traverse').map((nd) => nd.id),
      rng,
    );
    for (let b = 0; b < script.branches && b < hosts.length; b++) {
      const id = nodes.length;
      nodes.push({ id, kind: 'branch', kit: dim.nodeKits.branch, index: -1, template: null, vista: false, lantern: false, host: hosts[b] });
      edges.push([hosts[b], id]);
    }
    return { nodes, critical, edges, shortcut: { gate: gateIdx, lantern: midLantern }, loop: loopIdx, side };
  }
  return null;
}

function kitsFor(dim: DimensionDef, s: Slot, sp: SetPieceDef): RoomKitId[] {
  const k = dim.nodeKits;
  switch (s.kind) {
    case 'start':
      return [k.start];
    case 'setpiece':
      return [sp.kit];
    case 'vista':
      return [k.vista];
    case 'traverse':
      return k.traverse;
    case 'lantern':
      return [k.lantern];
    case 'gate':
      return [k.gate];
    case 'miniboss':
      return [k.miniboss];
    case 'exit':
      return [k.exit];
    case 'key':
      return [...new Set(Object.values(dim.templateKits))];
    case 'combat':
      // The template (and so the kit) is chosen later; any combat kit that can turn keeps the slot open.
      return [...new Set(Object.values(dim.templateKits))];
    default:
      return [k.branch];
  }
}

/** Encounter templates by beat: required ones first, then weighted picks from the beat's list. */
function assignTemplates(dim: DimensionDef, script: LevelScript, nodes: LevelNode[], sp: SetPieceDef, rng: Rng) {
  const plain = nodes.filter((n) => n.kind === 'combat');
  const must = [...script.mustInclude];
  const pool = dim.levels[script.level].templates;
  for (const n of shuffle(plain, rng)) n.template = must.shift() ?? rng.pick(pool.filter((t) => t !== 'signature' || !plain.some((p) => p.template === 'signature')));
  for (const n of nodes) {
    if (n.kind === 'setpiece' && sp.combat) n.template = 'arena';
    if (n.kind === 'gate' && script.gateGuarded) n.template = 'guarded';
  }
}

/**
 * Justice's weighing (LEVELS.md → Space): start → P… → the mid lantern, where the level forks into two mirrored wings
 * (the scales' pans), each a room then a key room. The axis gate past the lantern opens when both keys are set, and
 * the way goes on: gate → Q… → lantern → miniboss → exit. Play order (`critical`) walks the left wing, then the right,
 * then the axis. The set-piece is the reward past the gate; fights never sit back to back along an edge (but the
 * twist); branches come in a mirrored pair off the wing rooms.
 */
function weighingGraph(dim: DimensionDef, script: LevelScript, rng: Rng): MissionGraph | null {
  const sp = script.setPiece;
  const L = dim.levels[script.level];
  for (let attempt = 0; attempt < 120; attempt++) {
    // What stands in each wing before its key: none (the key off the lantern), one or two rooms: a vista over the drop
    // most often, a fight in the twist. (Always one, after the first playtest: every level weighed alike.)
    const r = rng();
    const wingN = r < 0.2 ? 0 : r < 0.7 ? 1 : 2;
    const wingKinds: NodeKind[] = Array.from({ length: wingN }, (_, k): NodeKind =>
      k === 0 && rng.chance(script.allowAdjacentCombats ? 0.35 : 0) ? 'combat' : k === 0 && rng.chance(0.65) ? 'vista' : 'traverse',
    );
    const wingVistas = wingKinds.filter((k) => k === 'vista').length * 2;
    const wingCombats = wingKinds.filter((k) => k === 'combat').length * 2;
    const combats = rng.int(L.combats[0], L.combats[1]);
    // The keys are fights (2); the rest of the level's fights stand on the axis.
    // (At least one, for past the gate, unless the set-piece there is a fight.)
    const plain = Math.max(sp.combat ? 0 : 1, combats - 2 - wingCombats - (sp.combat ? 1 : 0));
    const vistas = Math.max(0, 2 - wingVistas - (sp.vista ? 1 : 0));
    const axisSlots: NodeKind[] = [];
    for (let i = 0; i < vistas; i++) axisSlots.push('vista');
    for (let i = 0; i < plain; i++) axisSlots.push('combat');
    const [nMin, nMax] = dim.criticalNodes;
    // Fixed: start, lantern, 2 × (wing rooms + key), gate, set-piece, lantern, miniboss, exit; and P (before the
    // fork) holds at least one room.
    const fixed = 9 + wingKinds.length * 2;
    if (!axisSlots.length) axisSlots.push('traverse');
    while (fixed + axisSlots.length < nMin) axisSlots.push('traverse');
    if (fixed + axisSlots.length > nMax) continue;
    const order = shuffle(axisSlots, rng);
    // P (before the fork) holds at least one room; the rest follow the set-piece past the gate.
    const pN = Math.max(1, Math.min(order.length, rng.int(1, 2)));
    const P = order.slice(0, pN);
    const Q = order.slice(pN);
    if (P.length === 0) P.push('traverse');
    // Past the gate, a fight before the next lantern (as the loop dimensions have), when there's one to place.
    if (plain > 0 && !Q.includes('combat') && !sp.combat) continue;
    const seq: { kind: NodeKind; setPiece?: boolean; wing?: 0 | 1 }[] = [{ kind: 'start' }, ...P.map((kind) => ({ kind })), { kind: 'lantern' }];
    for (const w of [0, 1] as const) {
      for (const kind of wingKinds) seq.push({ kind, wing: w });
      seq.push({ kind: 'key', wing: w });
    }
    seq.push({ kind: 'gate' }, { kind: 'setpiece', setPiece: true }, ...Q.map((kind) => ({ kind })), { kind: 'lantern' }, { kind: 'miniboss' }, { kind: 'exit' });
    const n = seq.length;
    const hub = 1 + P.length;
    const gateIdx = seq.findIndex((s) => s.kind === 'gate');

    const nodes: LevelNode[] = seq.map((s, i) => ({
      id: i,
      kind: s.kind,
      kit: '',
      index: i,
      template: null,
      vista: s.kind === 'vista' || (s.kind === 'setpiece' && sp.vista),
      lantern: s.kind === 'start' || s.kind === 'lantern',
      host: -1,
    }));
    // Edges: the axis, the fork into each wing, and the gate off the lantern.
    const edges: [number, number][] = [];
    for (let i = 1; i <= hub; i++) edges.push([i - 1, i]);
    const wings: [number[], number[]] = [[], []];
    for (const w of [0, 1] as const) {
      const ids = seq.map((s, i) => [s, i] as const).filter(([s]) => s.wing === w).map(([, i]) => i);
      wings[w] = ids;
      ids.forEach((id, k) => edges.push([k === 0 ? hub : ids[k - 1], id]));
    }
    edges.push([hub, gateIdx]);
    for (let i = gateIdx + 1; i < n; i++) edges.push([i - 1, i]);

    // Templates: the plain fights first (the beat's required one among them), then the keys (mirrored), then the
    // wing fights (mirrored).
    const plainNodes = nodes.filter((nd) => nd.kind === 'combat' && seq[nd.id].wing === undefined);
    const must = [...script.mustInclude];
    const pool = L.templates;
    for (const nd of shuffle(plainNodes, rng)) nd.template = must.shift() ?? rng.pick(pool.filter((t) => t !== 'signature'));
    const keyT = must.shift() ?? rng.pick(pool.filter((t) => t !== 'patrol'));
    const wingT = rng.pick(pool.filter((t) => t !== 'signature' && t !== 'nest'));
    for (const nd of nodes) {
      if (nd.kind === 'key') nd.template = keyT;
      if (nd.kind === 'combat' && seq[nd.id].wing !== undefined) nd.template = wingT;
      if (nd.kind === 'setpiece' && sp.combat) nd.template = 'arena';
    }
    // No fights back to back along an edge (but the twist).
    const fight = (nd: LevelNode) => isCombat(nd);
    if (!script.allowAdjacentCombats && edges.some(([a, b]) => fight(nodes[a]) && fight(nodes[b]))) continue;
    // Rest after a fight where it can: the fork's lantern doesn't follow one.
    if (attempt < 60 && fight(nodes[hub - 1]) && script.beat === 'introduce') continue;

    // Kits: mirrored wings share theirs.
    for (const nd of nodes) {
      const s = seq[nd.id];
      if (s.wing === 1) continue;
      nd.kit = nd.template && (nd.kind === 'combat' || nd.kind === 'key') ? dim.templateKits[nd.template] : rng.pick(kitsFor(dim, s, sp));
      if (s.wing === 0) nodes[wings[1][wings[0].indexOf(nd.id)]].kit = nd.kit;
    }
    // Branches: a mirrored pair off the wings' first rooms (the keys', when the keys stand off the lantern).
    const want = rng.int(dim.branches[0], dim.branches[1]);
    if (want >= 2) {
      for (const w of [0, 1] as const) {
        const id = nodes.length;
        nodes.push({ id, kind: 'branch', kit: dim.nodeKits.branch, index: -1, template: null, vista: false, lantern: false, host: wings[w][0] });
        edges.push([wings[w][0], id]);
      }
    }
    return { nodes, critical: seq.map((_, i) => i), edges, shortcut: { gate: gateIdx, lantern: hub }, loop: [], side: 1, wings };
  }
  return null;
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

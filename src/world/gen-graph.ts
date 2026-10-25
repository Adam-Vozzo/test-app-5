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

export type NodeKind = 'start' | 'combat' | 'traverse' | 'vista' | 'lantern' | 'branch' | 'setpiece' | 'gate' | 'miniboss' | 'exit';

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
  const sp = script.setPiece;
  const middle: Slot[] = [{ kind: 'setpiece', setPiece: true }];
  for (let i = 0; i < 2 - (sp.vista ? 1 : 0); i++) middle.push({ kind: 'vista' });
  for (let i = 0; i < script.combats - (sp.combat ? 1 : 0) - (script.gateGuarded ? 1 : 0); i++) middle.push({ kind: 'combat' });
  for (let i = 0; i < script.traverse; i++) middle.push({ kind: 'traverse' });
  const m = middle.length;
  const side: 1 | -1 = rng.chance(0.5) ? 1 : -1;

  for (let attempt = 0; attempt < 120; attempt++) {
    const strict = attempt < 60;
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

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

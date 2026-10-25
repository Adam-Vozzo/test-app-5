// Dimension scripts and kits as data (LEVELS.md → Dimension script, Space). The generator reads these to choose
// kits, encounter density, set-pieces and minibosses; it never decides pacing on its own. Pure: no Three/DOM.
// Adding a dimension should mean a new DimensionDef, not new generator code.

export type Beat = 'introduce' | 'develop' | 'twist';
export type CourtRank = 'knight' | 'queen' | 'king';
export type EncounterTemplate = 'arena' | 'guarded' | 'nest' | 'ambush' | 'patrol' | 'signature';

export type RoomKitId =
  | 'start'
  | 'court'
  | 'arena'
  | 'nest'
  | 'terrace'
  | 'pass'
  | 'stair'
  | 'shrine'
  | 'gatehouse'
  | 'throne'
  | 'threshold'
  | 'cache'
  | 'swordField'
  | 'twinCourts'
  | 'scalesColonnade'
  | 'windBridge';

/** How a room's edges are built: tall walls (compression), waist-high parapets (open), or parapets with columns. */
export type EdgeStyle = 'wall' | 'parapet' | 'colonnade';

/**
 * A room kit: a parametric room with guarantees the generator relies on. `w` is across the room's axis, `d` along
 * it (the axis runs from the entry to the far edge). All lengths in metres.
 */
export interface RoomKitDef {
  w: [number, number];
  d: [number, number];
  edge: EdgeStyle;
  /** Can the exit sit on a side edge (a 90° turn)? Long set-pieces can't. */
  turns: boolean;
  /** Floor raised above the plateau datum (m). */
  floor: number;
  /** Paved flagstones or wind-flattened earth. */
  ground: 'flag' | 'earth';
  /** Cover clusters (mirrored about the axis in a symmetric dimension; an odd count puts one on the axis). */
  cover?: [number, number];
  /** A raised tier along the far edge, reached by ramps at both ends (the nest's high ground, ≤ 4 m). */
  tier?: { depth: number; height: number };
  /** A central divider along the axis with gaps (the twin courts). */
  divider?: boolean;
  /** Planted swords strewn over the floor as cover (the sword-graveyard field). */
  swords?: number;
  /** Grass tufts along the edges (and everywhere off the lanes on earth). */
  grass?: number;
  /** Column height for colonnade edges (m); the colonnade under the scales stands taller. */
  columnHeight?: number;
}

export interface SetPieceDef {
  id: string;
  name: string;
  /** Room kit the set-piece node uses. */
  kit: RoomKitId;
  /** Does a fight happen in it? (It then counts as one of the level's combats.) */
  combat: boolean;
  /** Is it a framed view of the landmark? (It then counts as one of the level's vistas.) */
  vista: boolean;
}

export interface LevelBeatDef {
  beat: Beat;
  miniboss: CourtRank;
  minibossName: string;
  /** Combat spaces on the critical path (a fighting set-piece and a guarded gate count). */
  combats: [number, number];
  /** Enemy sockets per combat space, before depth scaling. */
  enemies: [number, number];
  templates: EncounterTemplate[];
  /** Templates that must appear at least once (e.g. the signature enemy in the introduce level). */
  mustInclude: EncounterTemplate[];
  /** Two combats may sit back to back (the twist level only). */
  allowAdjacentCombats: boolean;
}

export interface DimensionDef {
  id: string;
  name: string;
  arcana: string;
  suit: string;
  levels: [LevelBeatDef, LevelBeatDef, LevelBeatDef];
  setPieces: SetPieceDef[];
  /** Rooms and their enemies mirror about the room's own axis (Justice: symmetric, formal, ordered). */
  symmetric: boolean;
  kits: Record<RoomKitId, RoomKitDef>;
  /** Kits per node kind; a combat node's kit comes from its encounter template. */
  nodeKits: { start: RoomKitId; traverse: RoomKitId[]; vista: RoomKitId; lantern: RoomKitId; gate: RoomKitId; miniboss: RoomKitId; exit: RoomKitId; branch: RoomKitId };
  templateKits: Record<EncounterTemplate, RoomKitId>;
  connector: {
    /** Critical-path connector length (m). */
    length: [number, number];
    width: number;
    branchLength: [number, number];
    /** Steepest ramp a connector may have (rise over run). */
    maxSlope: number;
  };
  /** Critical-path nodes (LEVELS.md → Budgets). */
  criticalNodes: [number, number];
  /** The shortcut loop: rooms inside it, and how long the shortcut itself may be (m). */
  loop: { rooms: [number, number]; shortcut: [number, number] };
  branches: [number, number];
  /** The landmark stands on the main axis, beyond the exit and at least `fromStart` from the spawn (m). */
  landmark: { beyondExit: number; fromStart: number; height: number; baseY: number };
  /** Great swords standing out of the fog near vista sight lines (hero props). */
  heroProps: [number, number];
}

export const JUSTICE_DIMENSION: DimensionDef = {
  id: 'justice',
  name: 'Justice',
  arcana: 'Justice (XI)',
  suit: 'Swords',
  levels: [
    {
      beat: 'introduce',
      miniboss: 'knight',
      minibossName: 'Knight of Swords',
      combats: [2, 2],
      enemies: [2, 3],
      templates: ['arena', 'patrol', 'guarded', 'signature'],
      mustInclude: ['signature'],
      allowAdjacentCombats: false,
    },
    {
      beat: 'develop',
      miniboss: 'queen',
      minibossName: 'Queen of Swords',
      combats: [2, 3],
      enemies: [3, 4],
      templates: ['ambush', 'nest', 'guarded', 'arena'],
      mustInclude: ['nest'],
      allowAdjacentCombats: false,
    },
    {
      beat: 'twist',
      miniboss: 'king',
      minibossName: 'King of Swords',
      combats: [3, 3],
      enemies: [4, 5],
      templates: ['ambush', 'nest', 'arena', 'guarded'],
      mustInclude: ['ambush'],
      allowAdjacentCombats: true,
    },
  ],
  setPieces: [
    { id: 'swordField', name: 'the sword-graveyard field', kit: 'swordField', combat: true, vista: false },
    { id: 'twinCourts', name: 'the mirrored twin courts', kit: 'twinCourts', combat: true, vista: false },
    { id: 'scalesColonnade', name: 'the colonnade under the scales', kit: 'scalesColonnade', combat: false, vista: true },
    { id: 'windBridge', name: 'the wind bridge', kit: 'windBridge', combat: false, vista: true },
  ],
  symmetric: true,
  kits: {
    start: { w: [20, 24], d: [22, 26], edge: 'parapet', turns: false, floor: 0, ground: 'flag', grass: 40 },
    court: { w: [24, 30], d: [26, 32], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [3, 4] },
    arena: { w: [30, 36], d: [30, 36], edge: 'colonnade', turns: true, floor: 0, ground: 'flag', cover: [3, 4] },
    nest: { w: [26, 30], d: [28, 32], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [2, 3], tier: { depth: 6, height: 2.4 } },
    terrace: { w: [18, 22], d: [16, 20], edge: 'parapet', turns: true, floor: 2.4, ground: 'flag', grass: 60 },
    pass: { w: [8, 10], d: [18, 24], edge: 'wall', turns: false, floor: 0, ground: 'flag' },
    stair: { w: [12, 14], d: [12, 16], edge: 'parapet', turns: true, floor: 3.6, ground: 'flag', grass: 30 },
    shrine: { w: [14, 18], d: [14, 18], edge: 'colonnade', turns: true, floor: 0, ground: 'flag', grass: 30 },
    gatehouse: { w: [20, 24], d: [20, 24], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [1, 2] },
    throne: { w: [34, 40], d: [34, 40], edge: 'colonnade', turns: false, floor: 0, ground: 'flag', cover: [2, 2], columnHeight: 8 },
    threshold: { w: [12, 14], d: [12, 14], edge: 'parapet', turns: false, floor: 0, ground: 'flag', grass: 20 },
    cache: { w: [10, 12], d: [10, 12], edge: 'parapet', turns: false, floor: 0, ground: 'earth', grass: 40 },
    swordField: { w: [34, 40], d: [34, 40], edge: 'parapet', turns: true, floor: 0, ground: 'earth', swords: 46, grass: 260 },
    twinCourts: { w: [38, 40], d: [26, 30], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [2, 2], divider: true },
    scalesColonnade: { w: [14, 16], d: [50, 58], edge: 'colonnade', turns: false, floor: 0, ground: 'flag', columnHeight: 9 },
    windBridge: { w: [5, 6], d: [52, 62], edge: 'parapet', turns: false, floor: 3, ground: 'flag' },
  },
  nodeKits: { start: 'start', traverse: ['pass', 'stair'], vista: 'terrace', lantern: 'shrine', gate: 'gatehouse', miniboss: 'throne', exit: 'threshold', branch: 'cache' },
  templateKits: { arena: 'arena', guarded: 'court', nest: 'nest', ambush: 'court', patrol: 'court', signature: 'court' },
  connector: { length: [8, 14], width: 5, branchLength: [6, 10], maxSlope: 0.36 },
  criticalNodes: [9, 10],
  loop: { rooms: [2, 3], shortcut: [8, 70] },
  branches: [1, 2],
  landmark: { beyondExit: 90, fromStart: 360, height: 175, baseY: -62 },
  heroProps: [1, 3],
};

export const DIMENSIONS: Record<string, DimensionDef> = { justice: JUSTICE_DIMENSION };

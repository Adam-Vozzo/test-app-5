// Dimension scripts and kits as data (LEVELS.md → Dimension script, Space). The generator reads these to choose
// kits, encounter density, set-pieces and minibosses; it never decides pacing on its own. Pure: no Three/DOM.
// Adding a dimension should mean a new DimensionDef, not new generator code.

export type Beat = 'introduce' | 'develop' | 'twist';
export type CourtRank = 'knight' | 'queen' | 'king';
export type EncounterTemplate = 'arena' | 'guarded' | 'nest' | 'ambush' | 'patrol' | 'signature';
/** Socket roles an encounter template places (see gen-dress.ts → encounters). */
export type SocketRole = 'grunt' | 'guard' | 'ranged' | 'patrol' | 'signature';

/**
 * A room kit's id, a key into the dimension's `kits`. Shared shapes (start, court, arena, nest, terrace, pass, stair,
 * shrine, gatehouse, throne, threshold, cache) appear in every dimension, restyled; set-piece kits are the
 * dimension's own (Justice: swordField, twinCourts, scalesColonnade, windBridge).
 */
export type RoomKitId = string;

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
  /** Props strewn over the floor as cover (Justice: planted swords on the graveyard field; the Devil: coin hoards). */
  swords?: number;
  /** Grass tufts along the edges (and everywhere off the lanes on earth). */
  grass?: number;
  /** Column height for colonnade edges (m); the colonnade under the scales stands taller. */
  columnHeight?: number;
}

/**
 * The Devil's rule (temptation): what taking a hoard costs. Each cost has its own tell on the hoard, so it's learned,
 * not guessed: a bell hung over it (rings and wakes the room), chains wound round it (heavy: shorter rolls until you
 * rest), or a cracked floor around it (Imps come up through it).
 */
export type HoardCost = 'bell' | 'weight' | 'ambush';

export interface TemptationDef {
  /** Hoards in the combat and set-piece rooms of each level. */
  hoards: [[number, number], [number, number], [number, number]];
  /** The costs each level's hoards may carry (one new cost at a time, then mixed). */
  costs: [HoardCost[], HoardCost[], HoardCost[]];
  /** Risk branches hold a bigger hoard instead of the cache, with this cost. */
  branchCost: HoardCost;
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
  /** The court card's id when it isn't the Swords rank itself (the Pentacles court: 'knightPentacles', …). */
  court?: string;
  /** Combat spaces on the critical path (a fighting set-piece and a guarded gate count). */
  combats: [number, number];
  /** Enemy sockets per combat space, before depth scaling. */
  enemies: [number, number];
  templates: EncounterTemplate[];
  /** Templates that must appear at least once (e.g. the signature enemy in the introduce level). */
  mustInclude: EncounterTemplate[];
  /** Two combats may sit back to back (the twist level only). */
  allowAdjacentCombats: boolean;
  /** Which enemies fill each socket role (introduce one new enemy at a time; the twist mixes them). */
  roster: Record<SocketRole, string[]>;
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
  /**
   * Metres the critical path drops at each room (the Devil: always going down). Rooms inside the shortcut loop stay
   * on the mid lantern's level, so the shortcut runs flat; 0 keeps the dimension level (Justice).
   */
  descent: number;
  /**
   * The landmark stands on the main axis, beyond the exit and at least `fromStart` from the spawn (m). `targets` are
   * the points that must be in plain sight from the spawn and the vistas: [across, up] as fractions of its height.
   */
  landmark: { kind: 'scales' | 'pedestal'; beyondExit: number; fromStart: number; height: number; baseY: number; targets: [number, number][] };
  /** Great props standing out of the fog near vista sight lines (hero props). */
  heroProps: [number, number];
  /** How the builder draws the strewn floor props and the hero props (data for the builder; the generator only places them). */
  props: { strewn: 'sword' | 'hoard'; hero: 'sword' | 'pillar' };
  /** Enemies that throw from range (held to the fair-distance rule in validation). */
  rangedFoes: string[];
  /** The Devil's temptation: hoards in plain sight that cost something to take. */
  temptation?: TemptationDef;
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
      roster: { grunt: ['bailiff'], guard: ['bailiff'], ranged: ['bailiff'], patrol: ['bailiff'], signature: ['blindfold'] },
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
      roster: { grunt: ['bailiff', 'gavel'], guard: ['bailiff'], ranged: ['page'], patrol: ['bailiff'], signature: ['blindfold'] },
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
      roster: { grunt: ['bailiff', 'gavel', 'blindfold'], guard: ['bailiff', 'gavel'], ranged: ['page'], patrol: ['bailiff', 'gavel'], signature: ['blindfold'] },
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
  descent: 0,
  landmark: {
    kind: 'scales',
    beyondExit: 90,
    fromStart: 360,
    height: 175,
    baseY: -62,
    // The beam, the pillar and the two pans.
    targets: [[0, 1.06], [0, 0.8], [0, 0.55], [-0.35, 0.74], [0.35, 0.74]],
  },
  heroProps: [1, 3],
  props: { strewn: 'sword', hero: 'sword' },
  rangedFoes: ['page'],
};

/**
 * The Devil × Pentacles (DESIGN.md → The Devil; V2-8): descending vaults and mine galleries, always going down toward
 * the throne-pedestal glowing in the pit. Not symmetric: hoards and cover lie where greed left them. Its own
 * archetypes (V2-9) hold the rooms: Misers, Imps, chained Thralls and the Page of Pentacles; the Pentacles court
 * (V2-10) holds the throne rooms.
 */
export const DEVIL_DIMENSION: DimensionDef = {
  id: 'devil',
  name: 'The Devil',
  arcana: 'The Devil (XV)',
  suit: 'Pentacles',
  levels: [
    {
      beat: 'introduce',
      miniboss: 'knight',
      minibossName: 'Knight of Pentacles',
      court: 'knightPentacles',
      combats: [2, 2],
      enemies: [2, 3],
      templates: ['arena', 'patrol', 'guarded', 'signature'],
      mustInclude: ['signature'],
      allowAdjacentCombats: false,
      roster: { grunt: ['miser'], guard: ['miser'], ranged: ['imp'], patrol: ['imp'], signature: ['thrall'] },
    },
    {
      beat: 'develop',
      miniboss: 'queen',
      minibossName: 'Queen of Pentacles',
      court: 'queenPentacles',
      combats: [2, 3],
      enemies: [3, 4],
      templates: ['ambush', 'nest', 'guarded', 'arena'],
      mustInclude: ['nest'],
      allowAdjacentCombats: false,
      roster: { grunt: ['miser', 'imp'], guard: ['miser'], ranged: ['pagePentacles', 'imp'], patrol: ['imp'], signature: ['thrall'] },
    },
    {
      beat: 'twist',
      miniboss: 'king',
      minibossName: 'King of Pentacles',
      court: 'kingPentacles',
      combats: [3, 3],
      enemies: [4, 5],
      templates: ['ambush', 'nest', 'arena', 'guarded'],
      mustInclude: ['ambush'],
      allowAdjacentCombats: true,
      roster: { grunt: ['miser', 'imp', 'thrall'], guard: ['miser'], ranged: ['pagePentacles', 'imp'], patrol: ['imp', 'miser'], signature: ['thrall'] },
    },
  ],
  setPieces: [
    { id: 'goldVault', name: 'the gold vault', kit: 'goldVault', combat: true, vista: false },
    { id: 'gildedMarket', name: 'the gilded market', kit: 'gildedMarket', combat: true, vista: false },
    { id: 'chainShaft', name: 'the chain shaft', kit: 'chainShaft', combat: false, vista: true },
    { id: 'collapsingMine', name: 'the collapsing mine', kit: 'collapsingMine', combat: false, vista: true },
  ],
  symmetric: false,
  kits: {
    start: { w: [18, 22], d: [20, 24], edge: 'parapet', turns: false, floor: 0, ground: 'flag' },
    court: { w: [22, 28], d: [24, 30], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [4, 5] },
    arena: { w: [28, 34], d: [28, 34], edge: 'colonnade', turns: true, floor: 0, ground: 'flag', cover: [4, 5], columnHeight: 5 },
    nest: { w: [24, 28], d: [26, 30], edge: 'wall', turns: true, floor: 0, ground: 'earth', cover: [3, 4], tier: { depth: 6, height: 2.4 } },
    terrace: { w: [16, 20], d: [14, 18], edge: 'parapet', turns: true, floor: 0, ground: 'earth' },
    pass: { w: [7, 9], d: [18, 24], edge: 'wall', turns: false, floor: 0, ground: 'earth' },
    stair: { w: [12, 14], d: [12, 16], edge: 'parapet', turns: true, floor: -2.4, ground: 'flag' },
    shrine: { w: [14, 16], d: [14, 16], edge: 'colonnade', turns: true, floor: 0, ground: 'flag', columnHeight: 4.5 },
    gatehouse: { w: [18, 22], d: [18, 22], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [2, 3] },
    throne: { w: [32, 38], d: [32, 38], edge: 'colonnade', turns: false, floor: 0, ground: 'flag', cover: [2, 2], columnHeight: 6 },
    threshold: { w: [12, 14], d: [12, 14], edge: 'parapet', turns: false, floor: 0, ground: 'flag' },
    cache: { w: [10, 12], d: [10, 12], edge: 'wall', turns: false, floor: 0, ground: 'flag', swords: 3 },
    goldVault: { w: [30, 34], d: [30, 34], edge: 'wall', turns: true, floor: 0, ground: 'flag', cover: [2, 3], swords: 16 },
    gildedMarket: { w: [36, 40], d: [26, 30], edge: 'colonnade', turns: true, floor: 0, ground: 'flag', cover: [4, 4], divider: true, columnHeight: 5 },
    chainShaft: { w: [12, 14], d: [40, 46], edge: 'parapet', turns: false, floor: -4, ground: 'flag' },
    collapsingMine: { w: [8, 10], d: [44, 52], edge: 'wall', turns: false, floor: 0, ground: 'earth', swords: 8 },
  },
  nodeKits: { start: 'start', traverse: ['pass', 'stair'], vista: 'terrace', lantern: 'shrine', gate: 'gatehouse', miniboss: 'throne', exit: 'threshold', branch: 'cache' },
  templateKits: { arena: 'arena', guarded: 'court', nest: 'nest', ambush: 'court', patrol: 'court', signature: 'court' },
  connector: { length: [8, 14], width: 5, branchLength: [6, 10], maxSlope: 0.36 },
  criticalNodes: [9, 10],
  loop: { rooms: [2, 3], shortcut: [8, 70] },
  branches: [1, 2],
  descent: 3,
  landmark: {
    kind: 'pedestal',
    beyondExit: 110,
    fromStart: 380,
    height: 175,
    baseY: -150,
    // The brazier, the throne's horns and the upper drum (it rises out of the pit; its base is lost far below).
    targets: [[0, 1.08], [0, 1.0], [-0.1, 0.96], [0.1, 0.96], [0, 0.9]],
  },
  heroProps: [2, 4],
  props: { strewn: 'hoard', hero: 'pillar' },
  // The Devil's own have no thrower: the Page of Pentacles runs instead (V2-9).
  rangedFoes: [],
  temptation: {
    hoards: [[2, 2], [2, 3], [3, 4]],
    costs: [['bell'], ['bell', 'weight'], ['bell', 'weight', 'ambush']],
    branchCost: 'ambush',
  },
};

export const DIMENSIONS: Record<string, DimensionDef> = { justice: JUSTICE_DIMENSION, devil: DEVIL_DIMENSION };

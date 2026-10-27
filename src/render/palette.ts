// All colours live here. See STYLE.md. Signal colours are never used on props.

export const SIGNAL = {
  telegraph: 0xff2e9a,
  weakSpot: 0x7cffea,
  crit: 0xffe14d,
  kill: 0xff3b30,
  ui: 0xffffff,
  /** The SwordRifle's charge (cells on the weapon, HUD pips): the player's own resource, never an enemy signal. */
  charge: 0x9c7bff,
} as const;

/** The Eight of Swords (STYLE.md → Characters). Robe red is desaturated so it never reads as kill red. */
export const PLAYER = {
  robe: 0x923a33,
  robeShade: 0x7a2c26,
  cowl: 0x6e2a25,
  blindfold: 0xe8e0d0,
  limb: 0x1e1a1c,
  face: 0x120f12,
  belt: 0x3a2a24,
} as const;

/** Weapons and training props (not area surfaces, not signals). */
export const GEAR = {
  metal: 0x4a515c,
  metalDark: 0x2b3038,
  metalLight: 0x7d8691,
  grip: 0x5a4032,
  tracer: 0xf4e9cf,
  post: 0x5b4a3c,
  canvas: 0xcdbf9f,
  canvasShade: 0xa8987a,
  straw: 0xb9a46e,
  /** The Hermit's lantern (checkpoint glow): warm light marks the way. */
  lantern: 0xf0b266,
} as const;

/**
 * Justice's enemies (STYLE.md → Characters): stocky, darker than the chalk court, each read by one piece of gear
 * (the Bailiff's tower shield, the Gavel's hammer, the Blindfold's twin blades and band, the Page's cape).
 * Wind-ups glow telegraph magenta on top of these; none of them is a signal colour.
 */
export const FOES = {
  limb: 0x1d1f24,
  bailiffArmour: 0x3d4652,
  bailiffTabard: 0xc2c8cc,
  shield: 0x2d333c,
  shieldRim: 0x8e9aa6,
  gavelBody: 0x3b3735,
  gavelHide: 0x57504a,
  hammer: 0x26272b,
  blindfoldRobe: 0x414a5c,
  blindfoldBand: 0xd0d4d6,
  blade: 0xb8c2cc,
  pageCoat: 0x4a5874,
  pageCape: 0x2f3a52,
  steel: 0x9aa6b2,
} as const;

/**
 * Court cards (STYLE.md → Characters): taller than the commons, each crowned or crested with a large pale sword, so
 * the suit reads before the face. Steel and slate, never brass (brass is the scales' accent motif).
 */
export const COURT = {
  crest: 0xc9d0d6,
  knightArmour: 0x4d5d72,
  knightCape: 0x2b3346,
  queenGown: 0x56606f,
  queenVeil: 0x8e98a6,
  kingRobe: 0x34303a,
  kingMantle: 0x4b4656,
  crown: 0x8a8f99,
} as const;

/** v1 bug characters (enemies until V2-4 replaces them). */
export const CHARACTER = {
  limb: 0x1e1414,
  torsoA: 0xff6a3d,
  torsoB: 0xf2994a,
  head: 0xb89a8e,
  eye: 0x120d0c,
  enemyShellA: 0x6e5a7e,
  enemyShellB: 0x8c7a9e,
  enemyBelly: 0xd9b35c,
} as const;

export const PROPS = {
  wood: 0xd9a066,
  woodDark: 0xa86f3d,
  rubberBand: 0xe0607e,
  metal: 0xacb2a7,
  metalDark: 0x868482,
  matchHead: 0xc2463f,
  sugar: 0xf4eee2,
  sugarShade: 0xd8d0c2,
  cork: 0xc9a377,
  corkDark: 0x9a7a55,
  paper: 0xeee3cf,
  seed: 0x9a7b45,
  seedPale: 0xd8c08a,
  strawA: 0xf2ece0,
  strawB: 0x5aa6c8,
  bulb: 0x7fa65a,
  bulbDark: 0x5c7f3f,
  staplerBody: 0x3c4252,
  staplerArm: 0x4f7ca8,
} as const;

/** What the renderer and FX need from any area: light, fog, sky and impact colours. */
export interface AreaLighting {
  name: string;
  /** Fog and horizon colour. v2 fog runs toward light (STYLE.md → Atmospheric perspective). */
  fog: number;
  /** Sky colour overhead. `null` = no sky dome; the background is the flat fog colour (v1 biomes). */
  sky: number | null;
  /** Cloud band colour in the sky. */
  cloud: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  dust: number;
  decal: number;
}

/** v1 bug-scale biome (legacy URL modes only). */
export interface BiomePalette extends AreaLighting {
  groundLit: number;
  groundLight: number;
  groundShade: number;
  groundShadow: number;
  stalk: number;
  stalkStripe: number;
  collar: number;
  pebbleA: number;
  pebbleB: number;
  leafA: number;
  leafB: number;
  fogDeep: number;
}

export const GARDEN: BiomePalette = {
  name: 'Garden Bed',
  sky: null,
  cloud: 0x3f2c22,
  groundLit: 0xf9d199,
  groundLight: 0xfeeec5,
  groundShade: 0xdbb898,
  groundShadow: 0xb79978,
  stalk: 0xb2cb80,
  stalkStripe: 0x8fae63,
  collar: 0x79595a,
  pebbleA: 0x79736a,
  pebbleB: 0xa7a88b,
  leafA: 0xe59a52,
  leafB: 0xc46b3a,
  fog: 0x3f2c22,
  fogDeep: 0x120d0c,
  hemiSky: 0xfff1d6,
  hemiGround: 0x7a5a4a,
  sun: 0xffe7c2,
  dust: 0xe8cfa6,
  decal: 0x5a4030,
};

export const KITCHEN: BiomePalette = {
  name: 'Kitchen Floor',
  sky: null,
  cloud: 0x302f38,
  groundLit: 0xe6dccb,
  groundLight: 0xf0e8da,
  groundShade: 0xa9a2a0,
  groundShadow: 0x6a7f9d,
  stalk: 0xc9a377,
  stalkStripe: 0xa8834f,
  collar: 0x4f4a58,
  pebbleA: 0xb59777,
  pebbleB: 0xfcd985,
  leafA: 0xacb2a7,
  leafB: 0x868482,
  fog: 0x302f38,
  fogDeep: 0x0a0f17,
  hemiSky: 0xd7e3f4,
  hemiGround: 0x3b3a48,
  sun: 0xfff0dc,
  dust: 0xe8e2d6,
  decal: 0x4a4650,
};

/** A v2 area: 4–5 surface colours, light fog/sky and one accent motif (STYLE.md → Palettes). */
export interface AreaPalette extends AreaLighting {
  surfaces: { light: number; mid: number; dark: number; shadow: number; growth: number };
  /** The area's one accent motif colour. Used on that motif only, never on general props. */
  accent: number;
  accentShade: number;
}

/** Justice × Swords: a windswept plateau of white stone under a cold, pale sky. */
export const JUSTICE: AreaPalette = {
  name: 'Justice',
  surfaces: {
    light: 0xe4e1d8, // chalk
    mid: 0x9fb0bc, // pale steel
    dark: 0x5c6873, // slate
    shadow: 0x2f3640,
    growth: 0xa9ae95, // wind-flattened sage grass
  },
  accent: 0xb39a5e, // tarnished brass: the scales
  accentShade: 0x8a7444,
  fog: 0xe3e9ee,
  sky: 0xa9bccb,
  cloud: 0xf2f4f5,
  hemiSky: 0xeef2f6,
  hemiGround: 0x6b7480,
  sun: 0xfff1df,
  dust: 0xd9d6cc,
  decal: 0x4a525c,
};

/**
 * The Devil × Pentacles (V2-8): descending vaults and mine galleries of umber stone under smoky amber haze, always
 * going down toward the glowing pedestal. Accent motif: old gilt (the hoards, the pedestal's band): dark enough that
 * it never reads as crit gold.
 */
export const DEVIL: AreaPalette = {
  name: 'The Devil',
  surfaces: {
    light: 0xcdb99a, // dusty sandstone flags
    mid: 0x8f7660, // umber stone
    dark: 0x5a4636, // umber rock
    shadow: 0x231c18,
    growth: 0x857559, // dusty spoil on the mine floors
  },
  accent: 0x9b7232, // old gilt
  accentShade: 0x6e4f22,
  fog: 0xf0e2cb,
  sky: 0xc9ab8a,
  cloud: 0xf3e7d4,
  hemiSky: 0xf4e6d2,
  hemiGround: 0x6a5446,
  sun: 0xffe2c0,
  dust: 0xd6c3a6,
  decal: 0x4a382d,
};

/**
 * The World (XXI), the hub (DESIGN.md → The hub): warm stone inside a great laurel wreath, under a pale lilac dusk,
 * outside the four dimensions. Accent motif: the wreath's ribbons (deep blue, never a signal colour).
 */
export const WORLD: AreaPalette = {
  name: 'The World',
  surfaces: {
    light: 0xe7e0d2, // warm stone
    mid: 0xb4a996,
    dark: 0x6a6157,
    shadow: 0x3a332e,
    growth: 0x7f9466, // laurel
  },
  accent: 0x4f6b92, // the wreath's ribbons (deep blue: clear of the charge violet and the weak-spot cyan)
  accentShade: 0x3c5273,
  fog: 0xece6e2,
  sky: 0xbdb7cf,
  cloud: 0xf3eff0,
  hemiSky: 0xf1ece8,
  hemiGround: 0x766c64,
  sun: 0xffefd8,
  dust: 0xdcd5c8,
  decal: 0x564e47,
};

/** Each dimension's area palette, by dimension id (the level builder and the game read it). */
export const AREAS: Record<string, AreaPalette> = { justice: JUSTICE, devil: DEVIL };

/** The area currently loaded (FX read dust/decal colours from it). */
export let activeBiome: AreaLighting = GARDEN;
export function setActiveBiome(p: AreaLighting) {
  activeBiome = p;
}

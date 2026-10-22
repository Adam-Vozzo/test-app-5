// All colours live here. See STYLE.md. Signal colours are never used on props.

export const SIGNAL = {
  telegraph: 0xff2e9a,
  weakSpot: 0x7cffea,
  crit: 0xffe14d,
  kill: 0xff3b30,
  ui: 0xffffff,
} as const;

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
} as const;

export interface BiomePalette {
  name: string;
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
  fog: number;
  fogDeep: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  dust: number;
  decal: number;
}

export const GARDEN: BiomePalette = {
  name: 'Garden Bed',
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

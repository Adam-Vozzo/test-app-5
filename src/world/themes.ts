// Zone themes are data: palette, fog, ground, boundary walls, decor generators and enemy weights.
import { GARDEN, KITCHEN, type BiomePalette } from '../render/palette';

export type ThemeId = 'garden' | 'kitchen';
export type DecorId = 'pebble' | 'leaf' | 'grass' | 'crumb' | 'chairLeg' | 'box';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  palette: BiomePalette;
  fogDensity: number;
  ground: { kind: 'stripes' | 'tiles'; amplitude: number; scale: number; tile: number };
  /** Dense boundary props that wall off the walkable area. */
  wall: { ids: DecorId[]; spacing: number; band: number };
  /** Decor scattered inside clearings: [id, min, max] per clearing. */
  decor: [DecorId, number, number][];
  /** One big landmark per zone, placed in a mid clearing. */
  hero: 'trowel' | 'fork';
  /** The boss clearing gets a bottle-cap arena. */
  bossArena: boolean;
  /** Weights for non-elite encounter enemies. */
  enemyWeights: { skitterer: number; spitter: number };
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  garden: {
    id: 'garden',
    name: 'Garden Bed',
    palette: GARDEN,
    fogDensity: 0.02,
    ground: { kind: 'stripes', amplitude: 2.6, scale: 38, tile: 2.6 },
    wall: { ids: ['grass'], spacing: 3.4, band: 9 },
    decor: [
      ['pebble', 1, 3],
      ['leaf', 0, 1],
      ['grass', 1, 4],
    ],
    hero: 'trowel',
    bossArena: false,
    enemyWeights: { skitterer: 0.62, spitter: 0.38 },
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen Floor',
    palette: KITCHEN,
    fogDensity: 0.017,
    ground: { kind: 'tiles', amplitude: 0, scale: 40, tile: 4 },
    wall: { ids: ['box', 'chairLeg'], spacing: 5.5, band: 10 },
    decor: [
      ['crumb', 2, 5],
      ['chairLeg', 0, 1],
    ],
    hero: 'fork',
    bossArena: true,
    enemyWeights: { skitterer: 0.45, spitter: 0.55 },
  },
};

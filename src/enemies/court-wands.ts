// The Wands court and the Crowned Tower (DESIGN.md → The Tower × Wands; V2-12). Rank is the verb, suit is the
// flavour, and each escalates the Tower's rule (collapse):
//   Knight (mobility): a fiery charge that leaves the timber burning where it ran.
//   Queen (control): fire zones that set the decks alight, and her black cat at her heel each phase.
//   King (command): Firebrands at each phase, and his phases burn the floor away.
//   The Crowned Tower (the arcana): its arena is the top floor, and each phase drops a ring of it into the storm,
//   ending on a last platform under open sky.
// Feel numbers live in tuning.foes.knightWands / queenWands / kingWands / crownedTower.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import type { Physics } from '../physics/world';
import { merge, place } from '../render/geo';
import { TOWER, TOWER_FOES as T, FOES } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import { CourtCard } from './court';
import type { EnemyWorld } from './enemy';
import type { FoeTune } from './foe-ai';
import { pose, type FoePlan } from './foes';

/** The suit symbol: a pale wand in leaf, worn upright as a crest. Base at the origin, `len` tall. */
export function wandCrest(len: number) {
  const rod = facet(new THREE.BoxGeometry(len * 0.08, len, len * 0.08).translate(0, len / 2, 0), T.crest, 0.03);
  const leaves = [0.55, 0.75, 0.9].map((y, i) => place(facet(new THREE.ConeGeometry(len * 0.08, len * 0.16, 4), T.crest, 0.03), (i % 2 ? -1 : 1) * len * 0.08, len * y, 0, 0, 0, (i % 2 ? 1 : -1) * 0.7));
  return merge([rod, ...leaves]);
}

function robe(top: number, bottom: number, h: number, color: number) {
  return facet(new THREE.CylinderGeometry(top, bottom, h, 6, 2).translate(0, -h / 2 + 0.22, 0), color, 0.05);
}

function staff(len: number) {
  const rod = facet(new THREE.BoxGeometry(0.07, 0.07, len).translate(0, 0, -len / 2 + 0.1), T.wood, 0.04);
  const head = facet(new THREE.ConeGeometry(0.1, 0.24, 5).rotateX(-Math.PI / 2).translate(0, 0, -len + 0.05), T.torchHead, 0.05);
  return merge([rod, head]);
}

const tune = (id: 'knightWands' | 'queenWands' | 'kingWands' | 'crownedTower') => () => tuning.foes[id] as unknown as FoeTune;

export const WANDS_PLANS: Record<'knightWands' | 'queenWands' | 'kingWands', FoePlan> = {
  knightWands: {
    id: 'knightWands',
    rank: 'knight',
    name: 'Knight of Wands',
    height: 2.05,
    radius: 0.32,
    tune: tune('knightWands'),
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: T.knightArmour,
    torso: () => merge([robe(0.26, 0.3, 0.8, T.knightArmour), place(facet(new THREE.ConeGeometry(0.42, 1.2, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.4), T.knightCape, 0.05), 0, -0.3, 0.24, -0.25, 0, 0)]),
    head: () => merge([facet(new THREE.BoxGeometry(0.26, 0.3, 0.28), T.knightArmour, 0.05), place(wandCrest(0.62), 0, 0.12, 0.02)]),
    weapon: () => staff(1.4),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.34 },
      { part: 'body', at: [0, 0.6, 0], r: 0.3 },
      { part: 'weak', at: [0, 1.44, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.24, 0.0, -0.3], [-0.05, -0.02, -0.32], [0.9, 0.1, 0], [0, 0, 0], 0.15, 0.15),
    motions: {
      charge: {
        windup: pose([0.26, -0.1, 0.1], [0.0, -0.08, -0.15], [0.05, 0, 0], [0, 0, 0], 0.55, 0.15),
        active: pose([0.14, 0.0, -0.6], [0.0, -0.02, -0.4], [0.0, 0, 0], [0, 0, 0], 0.35, 0.5),
        sound: 'windupThrust',
      },
      recharge: {
        windup: pose([0.26, -0.1, 0.1], [0.0, -0.08, -0.15], [0.05, 0, 0], [0, 0, 0], 0.55, 0.15),
        active: pose([0.14, 0.0, -0.6], [0.0, -0.02, -0.4], [0.0, 0, 0], [0, 0, 0], 0.35, 0.5),
        sound: 'windupThrust',
      },
      slash: {
        windup: pose([0.5, 0.42, 0.1], [0.1, 0.3, -0.1], [0.9, -1.25, 0.3], [0, 0, 0], 0.35, -0.05),
        active: pose([-0.4, -0.1, -0.5], [-0.2, -0.05, -0.35], [-0.25, 1.1, -0.3], [0, 0, 0], 0.3, 0.35),
        sound: 'windupSlash',
      },
    },
  },
  queenWands: {
    id: 'queenWands',
    rank: 'queen',
    name: 'Queen of Wands',
    height: 2.2,
    radius: 0.34,
    tune: tune('queenWands'),
    squadId: 'cat',
    senses: 'sight',
    ranged: true,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: T.queenGown,
    torso: () => merge([robe(0.22, 0.5, 1.1, T.queenGown), place(facet(new THREE.BoxGeometry(0.56, 0.16, 0.36), T.queenMantle, 0.05), 0, 0.16, 0)]),
    head: () =>
      merge([
        facet(new THREE.IcosahedronGeometry(0.14, 1).scale(1, 1.15, 1), T.queenMantle, 0.04),
        place(facet(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 6), T.crown, 0.04), 0, 0.14, 0),
        place(wandCrest(0.46), 0, 0.2, 0),
      ]),
    weapon: () => staff(1.3),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.05, 0], r: 0.32 },
      { part: 'body', at: [0, 0.6, 0], r: 0.38 },
      { part: 'weak', at: [0, 1.5, 0], r: 0.14 },
    ],
    weakGlow: null,
    ready: pose([0.24, 0.1, -0.2], [-0.2, -0.05, -0.25], [1.4, 0.1, 0], [0, 0, 0], 0, -0.05),
    motions: {
      firezone: {
        windup: pose([0.2, 0.7, -0.05], [-0.2, 0.2, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.2, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'verdict',
      },
      blaze: {
        windup: pose([0.2, 0.7, -0.05], [-0.2, 0.2, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.2, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'verdict',
      },
      riposte: {
        windup: pose([0.38, 0.3, 0.05], [-0.2, -0.05, -0.25], [0.8, -1.1, 0.3], [0, 0, 0], 0.25, -0.05),
        active: pose([-0.3, -0.05, -0.5], [-0.2, -0.05, -0.25], [-0.2, 1.0, -0.3], [0, 0, 0], 0.2, 0.3),
        sound: 'windupSlash',
      },
    },
  },
  kingWands: {
    id: 'kingWands',
    rank: 'king',
    name: 'King of Wands',
    height: 2.4,
    radius: 0.44,
    tune: tune('kingWands'),
    squadId: 'firebrand',
    phaseBurn: 6,
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: T.kingMantle,
    torso: () => merge([robe(0.34, 0.46, 1.05, T.kingRobe), place(facet(new THREE.BoxGeometry(0.88, 0.22, 0.46), T.kingMantle, 0.05), 0, 0.16, 0.02)]),
    head: () =>
      merge([
        facet(new THREE.BoxGeometry(0.28, 0.28, 0.28), T.kingMantle, 0.05),
        place(facet(new THREE.CylinderGeometry(0.18, 0.16, 0.16, 6), T.crown, 0.04), 0, 0.18, 0),
        place(wandCrest(0.7), 0, 0.26, 0),
      ]),
    weapon: () => staff(1.7),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.42 },
      { part: 'body', at: [0, 0.55, 0], r: 0.38 },
      { part: 'body', at: [0, 1.32, 0], r: 0.32 },
      { part: 'weak', at: [0, 1.62, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.08, -0.05, -0.3], [-0.08, -0.05, -0.3], [-1.45, 0, 0], [0, 0, 0], 0.05, 0.05),
    motions: {
      judgement: {
        windup: pose([0.1, 0.7, 0.12], [-0.04, 0.66, 0.06], [2.6, 0, 0], [0, 0, 0], 0.15, -0.25),
        active: pose([0.1, -0.3, -0.66], [-0.04, -0.28, -0.6], [-1.0, 0, 0], [0, 0, 0], 0.5, 0.55),
        sound: 'windupSlam',
      },
      wildfire: {
        windup: pose([0.18, 0.75, -0.05], [-0.05, 0.1, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.05, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'verdict',
      },
      sweep: {
        windup: pose([0.6, 0.15, 0.12], [0.34, 0.12, 0.0], [0.15, -1.5, 0.2], [0, 0, 0], 0.4, 0.0),
        active: pose([-0.55, 0.02, -0.4], [-0.32, 0.0, -0.32], [0.1, 1.4, -0.2], [0, 0, 0], 0.35, 0.3),
        sound: 'windupSlam',
      },
    },
  },
};

/**
 * The Crowned Tower: a stone colossus built like the card's tower, its crown broken open and burning (the fire is
 * the area's motif). 7 m. It smashes with ground rings that catch the timber, calls lightning down in threes, and
 * hurls burning masonry.
 */
export const CROWNED_TOWER_PLAN: FoePlan = {
  id: 'crownedTower',
  name: 'The Crowned Tower',
  height: 7,
  radius: 0.42,
  tune: tune('crownedTower'),
  senses: 'sight',
  ranged: false,
  elite: true,
  shield: false,
  limb: T.towerDark,
  sleeve: T.towerStone,
  torso: () =>
    merge([
      // A square stone body, coursed like masonry, narrowing to the waist.
      facet(new THREE.BoxGeometry(0.62, 0.9, 0.5).translate(0, -0.2, 0), T.towerStone, 0.06),
      ...[0, 1, 2].map((i) => place(block(0.66, 0.04, 0.54, T.towerDark, 0.03), 0, -0.55 + i * 0.32, 0)),
      // A window slit, dark, where a heart would be.
      place(block(0.08, 0.22, 0.04, T.towerDark, 0.02), 0, 0.0, -0.26),
    ]),
  head: () =>
    merge([
      facet(new THREE.BoxGeometry(0.3, 0.26, 0.3), T.towerStone, 0.05),
      // The crown: a ring of battlements, two knocked askew, fire in the break.
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return place(block(0.09, 0.14, 0.07, i >= 4 ? T.towerDark : T.towerStone, 0.04, i), Math.cos(a) * 0.17, 0.2 + (i >= 4 ? 0.05 : 0), Math.sin(a) * 0.17, i >= 4 ? 0.5 : 0, -a, i >= 4 ? 0.4 : 0);
      }),
      place(facet(new THREE.ConeGeometry(0.11, 0.24, 5), TOWER.accent, 0.08), 0, 0.26, 0),
    ]),
  weapon: () => facet(new THREE.BoxGeometry(0.2, 0.2, 0.5).translate(0, 0, -0.2), T.towerStone, 0.06),
  offhand: () => facet(new THREE.BoxGeometry(0.2, 0.2, 0.5).translate(0, 0, -0.2), T.towerStone, 0.06),
  dualWield: true,
  hitboxes: [
    { part: 'body', at: [0, 1.0, 0], r: 0.38 },
    { part: 'body', at: [0, 0.55, 0], r: 0.38 },
    { part: 'body', at: [0, 1.3, 0], r: 0.32 },
    { part: 'weak', at: [0, 1.55, 0], r: 0.14 },
  ],
  weakGlow: { at: [0, 1.55, 0.05], r: 0.12 },
  ready: pose([0.32, -0.1, -0.2], [-0.32, -0.1, -0.2], [0.2, 0.2, 0], [0.2, -0.2, 0], 0.1, 0.1),
  motions: {
    smash: {
      windup: pose([0.12, 0.66, 0.12], [-0.12, 0.66, 0.12], [2.6, 0, 0], [2.6, 0, 0], 0.15, -0.25),
      active: pose([0.1, -0.32, -0.66], [-0.1, -0.32, -0.66], [-1.0, 0, 0], [-1.0, 0, 0], 0.5, 0.55),
      sound: 'windupSlam',
    },
    lightning: {
      windup: pose([0.2, 0.8, -0.05], [-0.2, 0.8, -0.05], [3.0, 0, 0], [3.0, 0, 0], 0, -0.3),
      active: pose([0.3, 0.3, -0.6], [-0.3, 0.3, -0.6], [0.3, 0, 0], [0.3, 0, 0], 0, 0.2),
      sound: 'verdict',
    },
    storm: {
      windup: pose([0.2, 0.8, -0.05], [-0.2, 0.8, -0.05], [3.0, 0, 0], [3.0, 0, 0], 0, -0.3),
      active: pose([0.3, 0.3, -0.6], [-0.3, 0.3, -0.6], [0.3, 0, 0], [0.3, 0, 0], 0, 0.2),
      sound: 'verdict',
    },
    topple: {
      windup: pose([0.3, 0.1, 0.3], [-0.3, 0.1, 0.3], [-0.6, 0, 0], [-0.6, 0, 0], 0.3, -0.15),
      active: pose([0.2, 0.55, -0.4], [-0.2, 0.55, -0.4], [1.6, 0, 0], [1.6, 0, 0], 0.1, 0.2),
      sound: 'windupThrow',
    },
    sweep: {
      windup: pose([0.6, 0.15, 0.12], [0.34, 0.12, 0.0], [0.15, -1.5, 0.2], [0.2, -0.2, 0], 0.4, 0.0),
      active: pose([-0.55, 0.02, -0.4], [-0.32, 0.0, -0.32], [0.1, 1.4, -0.2], [0.2, -0.2, 0], 0.35, 0.3),
      sound: 'windupSlam',
    },
  },
};

export class CrownedTower extends CourtCard {
  constructor(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, rng: Rng) {
    super(CROWNED_TOWER_PLAN, scene, physics, pos, yaw, rng);
  }

  /** Each phase drops a ring of the top floor into the storm. */
  protected onPhase(w: EnemyWorld) {
    w.bossPhase?.(this.phaseIdx);
  }
}

// The Pentacles court (DESIGN.md → The Devil × Pentacles → Minibosses; V2-10): the same rank verbs as Swords, in
// earth. Rank is the verb, suit is the flavour, and each escalates the Devil's rule (temptation):
//   Knight (mobility): a slow, unstoppable armoured advance; its lane charge pins you (the binding; roll).
//   Queen (control): nurtures her side; lines of thrown coin, and gilt seeds that sprout Imps unless trampled.
//   King (command): hires Misers at each phase and rains coin that lies where it falls (tempting, and heavy).
// Feel numbers live in tuning.foes.knightPentacles / queenPentacles / kingPentacles; looks and poses are data.
import * as THREE from 'three';
import { merge, place } from '../render/geo';
import { COURT_PENTACLES as C, DEVIL_FOES as D, FOES } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import type { FoeTune } from './foe-ai';
import { pose, type FoePlan } from './foes';

/** The suit symbol: a large pale disc with a five-pointed star cut in dark lines. Faces -Z, centred. */
export function pentacleCrest(d: number) {
  const disc = facet(new THREE.CylinderGeometry(d / 2, d / 2, d * 0.06, 12).rotateX(Math.PI / 2), C.crest, 0.03);
  const parts = [disc];
  // The star: five lines between alternate points, standing proud of the face.
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 5;
    pts.push([Math.cos(a) * d * 0.4, Math.sin(a) * d * 0.4]);
  }
  for (let i = 0; i < 5; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 2) % 5];
    const len = Math.hypot(x1 - x0, y1 - y0);
    parts.push(place(block(d * 0.05, len, d * 0.04, C.crestLine, 0.02), (x0 + x1) / 2, (y0 + y1) / 2 - len / 2, -d * 0.04, 0, 0, Math.atan2(-(x1 - x0), y1 - y0)));
  }
  return merge(parts);
}

function robe(top: number, bottom: number, h: number, color: number) {
  return facet(new THREE.CylinderGeometry(top, bottom, h, 6, 2).translate(0, -h / 2 + 0.22, 0), color, 0.05);
}

function maceGeo(len: number) {
  const haft = facet(new THREE.BoxGeometry(0.07, 0.07, len).translate(0, 0, -len / 2), FOES.limb, 0.04);
  const head = facet(new THREE.IcosahedronGeometry(0.17, 0).translate(0, 0, -len), D.iron, 0.06);
  return merge([haft, head]);
}

function sceptreGeo() {
  const rod = facet(new THREE.BoxGeometry(0.06, 0.06, 1.3).translate(0, 0, -0.55), C.crown, 0.04);
  return merge([rod, place(pentacleCrest(0.34), 0, 0, -1.25)]);
}

const tune = (id: 'knightPentacles' | 'queenPentacles' | 'kingPentacles') => () => tuning.foes[id] as unknown as FoeTune;

export const PENTACLES_PLANS: Record<'knightPentacles' | 'queenPentacles' | 'kingPentacles', FoePlan> = {
  knightPentacles: {
    id: 'knightPentacles',
    rank: 'knight',
    name: 'Knight of Pentacles',
    height: 2.15,
    radius: 0.42,
    tune: tune('knightPentacles'),
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: C.knightPlate,
    torso: () =>
      merge([
        robe(0.34, 0.4, 0.86, C.knightArmour),
        // Heavy pauldrons: the still, armoured rider without the horse.
        ...[-1, 1].map((s) => place(facet(new THREE.BoxGeometry(0.3, 0.2, 0.36), C.knightPlate, 0.05), s * 0.32, 0.16, 0)),
        // The pentacle held before the chest, as on the card.
        place(pentacleCrest(0.42), 0, -0.1, -0.36),
      ]),
    head: () => merge([facet(new THREE.BoxGeometry(0.3, 0.32, 0.3), C.knightPlate, 0.05), place(block(0.24, 0.04, 0.05, FOES.limb, 0.02), 0, 0.02, -0.16)]),
    weapon: () => maceGeo(0.9),
    offhand: null,
    hitboxes: [
      { part: 'armor', at: [0, 1.0, -0.12], r: 0.36 },
      { part: 'body', at: [0, 1.0, 0.12], r: 0.36 },
      { part: 'body', at: [0, 0.6, 0], r: 0.34 },
      { part: 'weak', at: [0, 1.48, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.28, -0.12, -0.24], [-0.1, -0.05, -0.36], [0.4, 0.1, 0], [0, 0, 0], 0.15, 0.1),
    motions: {
      charge: {
        windup: pose([0.3, -0.05, 0.1], [-0.1, -0.05, -0.3], [0.3, 0, 0], [0, 0, 0], 0.6, 0.3),
        active: pose([0.2, -0.05, -0.4], [-0.1, -0.05, -0.38], [0.05, 0, 0], [0, 0, 0], 0.4, 0.55),
        sound: 'chainRattle',
      },
      recharge: {
        windup: pose([0.3, -0.05, 0.1], [-0.1, -0.05, -0.3], [0.3, 0, 0], [0, 0, 0], 0.6, 0.3),
        active: pose([0.2, -0.05, -0.4], [-0.1, -0.05, -0.38], [0.05, 0, 0], [0, 0, 0], 0.4, 0.55),
        sound: 'chainRattle',
      },
      maul: {
        windup: pose([0.16, 0.66, 0.1], [-0.1, -0.05, -0.36], [2.6, 0, 0], [0, 0, 0], 0.2, -0.2),
        active: pose([0.14, -0.3, -0.62], [-0.1, -0.05, -0.36], [-1.0, 0, 0], [0, 0, 0], 0.5, 0.5),
        sound: 'windupSlam',
      },
    },
  },
  queenPentacles: {
    id: 'queenPentacles',
    rank: 'queen',
    name: 'Queen of Pentacles',
    height: 2.2,
    radius: 0.34,
    tune: tune('queenPentacles'),
    senses: 'sight',
    ranged: true,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: C.queenGown,
    torso: () =>
      merge([
        robe(0.22, 0.5, 1.1, C.queenGown),
        place(facet(new THREE.BoxGeometry(0.56, 0.16, 0.36), C.queenMantle, 0.05), 0, 0.16, 0),
      ]),
    head: () =>
      merge([
        facet(new THREE.IcosahedronGeometry(0.14, 1).scale(1, 1.15, 1), C.queenMantle, 0.04),
        place(facet(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 6), C.crown, 0.04), 0, 0.14, 0),
      ]),
    weapon: () => merge([facet(new THREE.BoxGeometry(0.05, 0.05, 0.7).translate(0, 0, -0.32), FOES.blade, 0.03)]),
    // The pentacle cradled in her lap on the card: held in the off hand.
    offhand: () => pentacleCrest(0.5),
    hitboxes: [
      { part: 'body', at: [0, 1.05, 0], r: 0.32 },
      { part: 'body', at: [0, 0.6, 0], r: 0.38 },
      { part: 'weak', at: [0, 1.5, 0], r: 0.14 },
    ],
    weakGlow: null,
    ready: pose([0.24, -0.05, -0.22], [-0.12, -0.12, -0.34], [0.8, 0.1, 0], [0.2, 0, 0], 0, 0),
    motions: {
      coins: {
        windup: pose([0.3, 0.45, 0.12], [-0.3, 0.4, 0.1], [2.0, 0, 0], [1.2, 0, 0], 0.15, -0.2),
        active: pose([0.32, 0.15, -0.55], [-0.32, 0.15, -0.55], [0.1, -0.3, 0], [0.1, 0.3, 0], 0.1, 0.25),
        sound: 'windupThrow',
      },
      // Sowing: the pentacle lifted and tipped, seeds scattered.
      sow: {
        windup: pose([0.24, -0.05, -0.22], [-0.2, 0.5, -0.3], [0.8, 0.1, 0], [1.4, 0, 0.3], 0.1, -0.15),
        active: pose([0.24, -0.05, -0.22], [-0.3, 0.2, -0.6], [0.8, 0.1, 0], [0.2, 0, -0.6], 0.2, 0.25),
        sound: 'impChitter',
      },
      harvest: {
        windup: pose([0.24, -0.05, -0.22], [-0.2, 0.5, -0.3], [0.8, 0.1, 0], [1.4, 0, 0.3], 0.1, -0.15),
        active: pose([0.24, -0.05, -0.22], [-0.3, 0.2, -0.6], [0.8, 0.1, 0], [0.2, 0, -0.6], 0.2, 0.25),
        sound: 'impChitter',
      },
      riposte: {
        windup: pose([0.38, 0.3, 0.05], [-0.12, -0.12, -0.34], [0.8, -1.1, 0.3], [0.2, 0, 0], 0.25, -0.05),
        active: pose([-0.3, -0.05, -0.5], [-0.12, -0.12, -0.34], [-0.2, 1.0, -0.3], [0.2, 0, 0], 0.2, 0.3),
        sound: 'windupSlash',
      },
    },
  },
  kingPentacles: {
    id: 'kingPentacles',
    rank: 'king',
    name: 'King of Pentacles',
    height: 2.4,
    radius: 0.44,
    tune: tune('kingPentacles'),
    squadId: 'miser',
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: C.kingMantle,
    torso: () =>
      merge([
        robe(0.34, 0.48, 1.05, C.kingRobe),
        place(facet(new THREE.BoxGeometry(0.9, 0.24, 0.48), C.kingMantle, 0.05), 0, 0.16, 0.02),
        // Grapes and vines on the card's robe: a heavy, fruited hem.
        place(facet(new THREE.CylinderGeometry(0.5, 0.52, 0.12, 6), C.kingMantle, 0.06), 0, -0.78, 0),
      ]),
    head: () =>
      merge([
        facet(new THREE.BoxGeometry(0.28, 0.28, 0.28), C.kingMantle, 0.05),
        place(facet(new THREE.CylinderGeometry(0.18, 0.16, 0.16, 6), C.crown, 0.04), 0, 0.18, 0),
        place(pentacleCrest(0.5), 0, 0.5, 0),
      ]),
    weapon: sceptreGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.42 },
      { part: 'body', at: [0, 0.55, 0], r: 0.38 },
      { part: 'body', at: [0, 1.32, 0], r: 0.32 },
      { part: 'weak', at: [0, 1.62, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.26, 0.1, -0.2], [-0.2, -0.1, -0.3], [1.3, 0, 0], [0, 0, 0], 0.05, 0.02),
    motions: {
      coinRain: {
        windup: pose([0.18, 0.75, -0.05], [-0.2, 0.1, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.2, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'coinJingle',
      },
      fortune: {
        windup: pose([0.18, 0.75, -0.05], [-0.2, 0.1, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.2, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'coinJingle',
      },
      scepter: {
        windup: pose([0.1, 0.7, 0.12], [-0.04, 0.4, 0.06], [2.6, 0, 0], [0, 0, 0], 0.15, -0.25),
        active: pose([0.1, -0.3, -0.66], [-0.04, -0.2, -0.5], [-1.0, 0, 0], [0, 0, 0], 0.5, 0.55),
        sound: 'windupSlam',
      },
      sweep: {
        windup: pose([0.6, 0.15, 0.12], [0.34, 0.12, 0.0], [0.15, -1.5, 0.2], [0, 0, 0], 0.4, 0.0),
        active: pose([-0.55, 0.02, -0.4], [-0.32, 0.0, -0.32], [0.1, 1.4, -0.2], [0, 0, 0], 0.35, 0.3),
        sound: 'windupSlam',
      },
    },
  },
};

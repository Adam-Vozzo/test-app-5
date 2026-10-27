// Justice's enemy archetypes as data (DESIGN.md → Justice × Swords): looks, gear, hitboxes, senses and the poses
// each attack moves between. Feel numbers (health, speeds, timings, damage) live in tuning.foes.
//
// Body space for poses: origin at the chest, x right, y up, forward is -Z, in metres for a 1.6 m body (scaled by
// the plan's height). Weapon geometry points along -Z from the grip; a pose's weapon angles are (pitch, yaw, roll)
// relative to the body, so +pitch raises the tip and +yaw swings it to the left.
import * as THREE from 'three';
import { merge, place } from '../render/geo';
import { FOES } from '../render/palette';
import { block, facet } from '../world/kit';
import { tuning } from '../tuning';
import type { FoeTune } from './foe-ai';

export type V3 = [number, number, number];

export interface ArmPose {
  handR: V3;
  handL: V3;
  /** Main weapon angles (pitch, yaw, roll). */
  weapon: V3;
  /** Off-hand item angles (shield or second blade). */
  off: V3;
  /** 0..1: knees bend and the body drops. */
  crouch: number;
  /** Forward lean (radians). */
  lean: number;
}

export interface AttackMotion {
  windup: ArmPose;
  active: ArmPose;
  /** Sound that announces the wind-up. */
  sound: 'windupThrust' | 'windupSlam' | 'windupSlash' | 'windupThrow' | 'verdict' | 'chainRattle' | 'impChitter' | 'coinJingle' | 'whistle' | 'howl' | 'pour' | 'ripple';
}

export interface FoePlan {
  id: string;
  name: string;
  /** Standing height (m). */
  height: number;
  /** Body capsule radius for a 1.6 m body (scaled by height). */
  radius: number;
  /** Its feel numbers (live: read every frame from the tuning object). */
  tune: () => FoeTune;
  /** How the enemy finds you: by sight (and gunfire), or by sound alone. */
  senses: 'sight' | 'sound';
  /** Holds its distance and throws. */
  ranged: boolean;
  /** Elites stay dead once slain (resting doesn't bring them back). */
  elite: boolean;
  /** Body geometry, root at the chest (body space), and the hood/helm, root at the neck. */
  torso: () => THREE.BufferGeometry;
  head: () => THREE.BufferGeometry;
  /** Weapon in the right hand, and an off-hand item (shield, second blade), grip at the origin. */
  weapon: () => THREE.BufferGeometry;
  offhand: (() => THREE.BufferGeometry) | null;
  /** The off-hand item is a shield (turns blows from the front). */
  shield: boolean;
  /** Two blades: mirrored swings change hands. */
  dualWield?: boolean;
  /** Court cards of another suit: which rank verbs they use (defaults to the id: 'knight', 'queen', 'king'). */
  rank?: 'knight' | 'queen' | 'king';
  /** The squad a court card calls at each phase (the Swords King: Bailiffs; Pentacles: hired Misers; the Queen of
   * Wands: her black cat; the King of Wands: Firebrands). */
  squadId?: string;
  /** Each phase sets this many spots of the floor around it alight (the King of Wands burns the floor away). */
  phaseBurn?: number;
  /** Whistles the room awake when it first sees you (the Page of Swords). */
  herald?: boolean;
  /** Hit and run: after each attack it falls back for `retreatTime` before closing again (the Imp). */
  hitAndRun?: boolean;
  /** Runs from you instead of fighting, keeping `holdRange` away inside its leash; cuts only when cornered (the Page of Pentacles). */
  flees?: boolean;
  /** Always a reflection, wherever it stands (the Moon's Phantoms, after the Seven of Cups). */
  phantom?: boolean;
  limb: number;
  sleeve: number;
  /** Hitboxes relative to the feet (x right, y up, z back), for a 1.6 m body. */
  hitboxes: { part: 'body' | 'weak' | 'armor'; at: V3; r: number }[];
  /** A glowing weak spot (weak-spot cyan), relative to the feet. */
  weakGlow: { at: V3; r: number } | null;
  ready: ArmPose;
  motions: Record<string, AttackMotion>;
}

export const pose = (handR: V3, handL: V3, weapon: V3, off: V3 = [0, 0, 0], crouch = 0, lean = 0): ArmPose => ({ handR, handL, weapon, off, crouch, lean });

/**
 * Mirror a pose left ↔ right (the follow-up swing of a combo). A dual-wielder swaps hands (the other blade swings);
 * everyone else keeps the weapon in the right hand and swings it back the other way.
 */
export function mirrorPose(p: ArmPose, swapHands = false): ArmPose {
  if (!swapHands) {
    return {
      handR: [-p.handR[0], p.handR[1], p.handR[2]],
      handL: [-p.handL[0], p.handL[1], p.handL[2]],
      weapon: [p.weapon[0], -p.weapon[1], -p.weapon[2]],
      off: [p.off[0], -p.off[1], -p.off[2]],
      crouch: p.crouch,
      lean: p.lean,
    };
  }
  return {
    handR: [-p.handL[0], p.handL[1], p.handL[2]],
    handL: [-p.handR[0], p.handR[1], p.handR[2]],
    weapon: [p.off[0], -p.off[1], -p.off[2]],
    off: [p.weapon[0], -p.weapon[1], -p.weapon[2]],
    crouch: p.crouch,
    lean: p.lean,
  };
}

export function lerpPose(a: ArmPose, b: ArmPose, k: number, out: ArmPose): ArmPose {
  const l = (x: V3, y: V3, o: V3) => {
    for (let i = 0; i < 3; i++) o[i] = x[i] + (y[i] - x[i]) * k;
  };
  l(a.handR, b.handR, out.handR);
  l(a.handL, b.handL, out.handL);
  l(a.weapon, b.weapon, out.weapon);
  l(a.off, b.off, out.off);
  out.crouch = a.crouch + (b.crouch - a.crouch) * k;
  out.lean = a.lean + (b.lean - a.lean) * k;
  return out;
}

export const blankPose = (): ArmPose => pose([0, 0, 0], [0, 0, 0], [0, 0, 0]);

// ---- gear geometry (faceted, grip at the origin, pointing along -Z)

export function swordGeo(len: number, w: number) {
  const blade = facet(new THREE.BoxGeometry(w, w * 0.3, len).translate(0, 0, -len / 2 - 0.08), FOES.blade, 0.03);
  const guard = block(w * 3.2, 0.04, 0.05, FOES.limb, 0.03);
  const grip = facet(new THREE.BoxGeometry(0.04, 0.04, 0.14).translate(0, 0, 0.02), FOES.limb, 0.03);
  return merge([blade, place(guard, 0, -0.02, -0.08), grip]);
}

function towerShieldGeo() {
  // Faces -Z, held at its centre.
  const face = facet(new THREE.BoxGeometry(0.62, 1.0, 0.08), FOES.shield, 0.04);
  const rim = facet(new THREE.BoxGeometry(0.68, 1.06, 0.05).translate(0, 0, 0.03), FOES.shieldRim, 0.03);
  // The sword crest, a pale silhouette on the face: the suit reads before the bearer.
  const crest = facet(new THREE.BoxGeometry(0.07, 0.62, 0.02).translate(0, 0.02, -0.05), FOES.bailiffTabard, 0.02);
  const cross = facet(new THREE.BoxGeometry(0.28, 0.06, 0.02).translate(0, 0.2, -0.05), FOES.bailiffTabard, 0.02);
  return merge([rim, face, crest, cross]);
}

function hammerGeo() {
  const haft = facet(new THREE.BoxGeometry(0.07, 0.07, 1.5).translate(0, 0, -0.55), FOES.gavelHide, 0.04);
  const head = facet(new THREE.BoxGeometry(0.52, 0.34, 0.34).translate(0, 0, -1.28), FOES.hammer, 0.05);
  const band = facet(new THREE.BoxGeometry(0.56, 0.1, 0.38).translate(0, 0, -1.28), FOES.steel, 0.03);
  return merge([haft, head, band]);
}

function knifeGeo() {
  return swordGeo(0.32, 0.05);
}

// ---- body geometry (chest-rooted, 2–4 primitives)

/** A six-sided tapered body, darker at the hem. Chest-rooted: the top sits just above the chest. */
export function hunchedTorso(top: number, bottom: number, h: number, color: number, shade: number) {
  const g = facet(new THREE.CylinderGeometry(top, bottom, h, 6, 2).translate(0, -h / 2 + 0.2, 0), color, 0.06);
  const hemY = -h + 0.28;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  const c = new THREE.Color(shade);
  for (let i = 0; i < pos.count; i += 3) {
    if ((pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 >= hemY) continue;
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, c.r, c.g, c.b);
  }
  return g;
}

export const PLANS: Record<'bailiff' | 'gavel' | 'blindfold' | 'page', FoePlan> = {
  bailiff: {
    id: 'bailiff',
    name: 'Bailiff',
    height: 1.75,
    radius: 0.3,
    tune: () => tuning.foes.bailiff as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: true,
    limb: FOES.limb,
    sleeve: FOES.bailiffArmour,
    torso: () =>
      merge([
        hunchedTorso(0.24, 0.3, 0.78, FOES.bailiffArmour, FOES.limb),
        // Pale tabard down the front: reads the body's facing at range.
        place(facet(new THREE.BoxGeometry(0.24, 0.62, 0.04), FOES.bailiffTabard, 0.03), 0, -0.2, -0.27),
        place(facet(new THREE.BoxGeometry(0.62, 0.1, 0.3), FOES.limb, 0.04), 0, 0.18, 0),
      ]),
    head: () => merge([facet(new THREE.CylinderGeometry(0.16, 0.18, 0.28, 6), FOES.bailiffArmour, 0.05), place(facet(new THREE.BoxGeometry(0.22, 0.04, 0.05), FOES.limb, 0.02), 0, 0.02, -0.17)]),
    weapon: () => swordGeo(0.62, 0.06),
    offhand: towerShieldGeo,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.32 },
      { part: 'body', at: [0, 0.6, 0], r: 0.28 },
      { part: 'weak', at: [0, 1.42, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.24, -0.08, -0.25], [-0.2, -0.02, -0.38], [0.35, 0.1, 0], [0, 0, 0], 0.15, 0.12),
    motions: {
      thrust: {
        windup: pose([0.32, 0.06, 0.18], [-0.2, 0.0, -0.4], [0.15, 0.05, 0], [0, 0, 0], 0.35, 0.05),
        active: pose([0.1, 0.02, -0.78], [-0.24, -0.02, -0.3], [0.0, 0.0, 0], [0, 0.2, 0], 0.2, 0.3),
        sound: 'windupThrust',
      },
      bash: {
        windup: pose([0.28, -0.05, 0.05], [-0.28, 0.02, 0.05], [0.4, 0.1, 0], [0, -0.4, 0], 0.4, -0.05),
        active: pose([0.26, -0.05, -0.1], [-0.08, 0.05, -0.62], [0.4, 0.1, 0], [0, 0, 0], 0.15, 0.35),
        sound: 'windupThrust',
      },
    },
  },
  gavel: {
    id: 'gavel',
    name: 'Gavel',
    height: 2.15,
    radius: 0.4,
    tune: () => tuning.foes.gavel as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    limb: FOES.limb,
    sleeve: FOES.gavelHide,
    torso: () =>
      merge([
        hunchedTorso(0.34, 0.36, 0.86, FOES.gavelBody, FOES.limb),
        // A heavy hump of hide over the shoulders: the silhouette is a stooped mass.
        place(facet(new THREE.IcosahedronGeometry(0.34, 0).scale(1.3, 0.7, 1), FOES.gavelHide, 0.06), 0, 0.2, 0.08),
      ]),
    head: () => facet(new THREE.BoxGeometry(0.26, 0.24, 0.26), FOES.gavelHide, 0.05),
    weapon: hammerGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.95, 0], r: 0.36 },
      { part: 'body', at: [0, 0.55, 0], r: 0.3 },
      { part: 'body', at: [0, 1.3, -0.05], r: 0.3 },
      { part: 'weak', at: [0, 1.36, 0.3], r: 0.17 },
    ],
    // A glowing seam across the back of the hump: get behind it.
    weakGlow: { at: [0, 1.36, 0.3], r: 0.15 },
    // The hammer drags low in front: it's heavy.
    ready: pose([0.24, -0.16, -0.24], [-0.1, -0.12, -0.3], [-0.75, 0.25, 0], [0, 0, 0], 0.25, 0.25),
    motions: {
      slam: {
        windup: pose([0.12, 0.62, 0.12], [-0.04, 0.58, 0.06], [2.6, 0, 0], [0, 0, 0], 0.15, -0.25),
        active: pose([0.1, -0.32, -0.62], [-0.04, -0.3, -0.56], [-1.0, 0, 0], [0, 0, 0], 0.55, 0.55),
        sound: 'windupSlam',
      },
      sweep: {
        windup: pose([0.55, 0.12, 0.12], [0.3, 0.1, 0.0], [0.15, -1.5, 0.2], [0, 0, 0], 0.4, 0.0),
        active: pose([-0.5, 0.02, -0.38], [-0.3, 0.0, -0.3], [0.1, 1.4, -0.2], [0, 0, 0], 0.35, 0.3),
        sound: 'windupSlam',
      },
    },
  },
  blindfold: {
    id: 'blindfold',
    name: 'Blindfold',
    height: 1.7,
    radius: 0.3,
    tune: () => tuning.foes.blindfold as unknown as FoeTune,
    senses: 'sound',
    ranged: false,
    elite: false,
    shield: false,
    limb: FOES.limb,
    sleeve: FOES.blindfoldRobe,
    torso: () => hunchedTorso(0.18, 0.32, 0.9, FOES.blindfoldRobe, FOES.limb),
    head: () =>
      merge([
        facet(new THREE.IcosahedronGeometry(0.15, 1).scale(1, 1.1, 1.05), FOES.blindfoldRobe, 0.04),
        // The band across the eyes: the Two of Swords' blindfold, worn, not pushed up.
        place(facet(new THREE.CylinderGeometry(0.158, 0.16, 0.07, 8), FOES.blindfoldBand, 0.02), 0, 0.02, 0),
      ]),
    weapon: () => swordGeo(0.86, 0.045),
    offhand: () => swordGeo(0.86, 0.045),
    dualWield: true,
    hitboxes: [
      { part: 'body', at: [0, 0.98, 0], r: 0.28 },
      { part: 'body', at: [0, 0.6, 0], r: 0.26 },
      { part: 'weak', at: [0, 1.4, 0], r: 0.15 },
    ],
    weakGlow: null,
    // Arms crossed low, blades trailing: listening.
    ready: pose([0.26, -0.18, -0.2], [-0.26, -0.18, -0.2], [-0.5, 0.5, 0], [-0.5, -0.5, 0], 0.2, 0.2),
    motions: {
      slash: {
        windup: pose([0.46, 0.34, 0.08], [-0.22, -0.12, -0.18], [0.8, -1.2, 0.3], [-0.5, -0.5, 0], 0.35, -0.05),
        active: pose([-0.34, -0.1, -0.48], [-0.24, -0.16, -0.2], [-0.25, 1.05, -0.3], [-0.5, -0.5, 0], 0.3, 0.35),
        sound: 'windupSlash',
      },
    },
  },
  page: {
    id: 'page',
    name: 'Page of Swords',
    height: 1.55,
    radius: 0.3,
    tune: () => tuning.foes.page as unknown as FoeTune,
    senses: 'sight',
    ranged: true,
    herald: true,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: FOES.pageCoat,
    torso: () =>
      merge([
        hunchedTorso(0.19, 0.25, 0.66, FOES.pageCoat, FOES.limb),
        // A short cape, snapped back by the wind: the Page's silhouette.
        place(facet(new THREE.ConeGeometry(0.34, 0.8, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.45), FOES.pageCape, 0.05), 0, -0.12, 0.2, -0.35, 0, 0),
      ]),
    head: () => merge([facet(new THREE.IcosahedronGeometry(0.14, 1), FOES.pageCoat, 0.04), place(facet(new THREE.ConeGeometry(0.1, 0.22, 4), FOES.pageCape, 0.04), 0, 0.15, 0.04, -0.4, 0, 0)]),
    weapon: knifeGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.92, 0], r: 0.26 },
      { part: 'body', at: [0, 0.56, 0], r: 0.24 },
      { part: 'weak', at: [0, 1.3, 0], r: 0.14 },
    ],
    weakGlow: null,
    ready: pose([0.22, -0.05, -0.28], [-0.2, -0.1, -0.2], [0.6, 0.1, 0], [0, 0, 0], 0.1, 0.1),
    motions: {
      throw: {
        windup: pose([0.3, 0.42, 0.26], [-0.25, 0.1, -0.3], [2.2, 0, 0], [0, 0, 0], 0.25, -0.15),
        active: pose([0.14, 0.18, -0.62], [-0.25, -0.05, 0.1], [0.2, 0, 0], [0, 0, 0], 0.1, 0.3),
        sound: 'windupThrow',
      },
      cut: {
        windup: pose([0.42, 0.3, 0.05], [-0.2, -0.1, -0.2], [0.8, -1.1, 0.3], [0, 0, 0], 0.3, -0.05),
        active: pose([-0.3, -0.08, -0.45], [-0.2, -0.12, -0.2], [-0.2, 1.0, -0.3], [0, 0, 0], 0.25, 0.3),
        sound: 'windupSlash',
      },
    },
  },
};

export const FOE_IDS = Object.keys(PLANS) as (keyof typeof PLANS)[];

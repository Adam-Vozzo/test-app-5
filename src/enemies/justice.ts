// Justice, the arcana of the first dimension (DESIGN.md → Justice × Swords → Boss). Large (6 m), built from the
// card: a crowned figure, the sword raised in her right hand, the brass scales in her left.
//   Phase 1, the sword: mirrored combos, an overhead cleave with a ground ring, lines of thrown blades.
//   Phase 2, the scales: two great pans settle into her arena, and what she throws onto one side lands on the other.
//   Her cleaves and verdicts echo across the arena's axis, and her combos grow to three swings.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import type { Physics } from '../physics/world';
import { merge, place } from '../render/geo';
import { COURT, FOES, JUSTICE } from '../render/palette';
import { tuning } from '../tuning';
import { bar, block, facet } from '../world/kit';
import { CourtCard } from './court';
import type { EnemyWorld } from './enemy';
import { mirrorAcross, slamCentre, type AttackTune, type FoeTune } from './foe-ai';
import type { ArmPose, FoePlan, V3 } from './foes';

const pose = (handR: V3, handL: V3, weapon: V3, off: V3 = [0, 0, 0], crouch = 0, lean = 0): ArmPose => ({ handR, handL, weapon, off, crouch, lean });

/** Justice's colours: slate gown and pale mantle (never the player's red), steel crown, brass scales (the motif). */
export const JUSTICE_LOOK = { gown: 0x3e4552, mantle: 0xc2c8cc, crown: COURT.crown } as const;

function greatsword() {
  const len = 1.15;
  const w = 0.085;
  const blade = facet(new THREE.BoxGeometry(w, w * 0.3, len).translate(0, 0, -len / 2 - 0.12), FOES.blade, 0.03);
  const guard = block(w * 4.5, 0.06, 0.07, FOES.limb, 0.03);
  const grip = facet(new THREE.BoxGeometry(0.05, 0.05, 0.24).translate(0, 0, 0.04), FOES.limb, 0.03);
  return merge([blade, place(guard, 0, -0.03, -0.12), grip]);
}

/** The scales in her hand: a beam, chains and two pans in brass. Held at the beam's centre; pans hang below. */
function handScales() {
  const beam = block(0.6, 0.035, 0.04, JUSTICE.accent, 0.03).translate(0, -0.0175, 0);
  const parts = [beam];
  for (const sx of [-1, 1]) {
    const x = sx * 0.27;
    for (const a of [0, 2.1, 4.2]) parts.push(bar(new THREE.Vector3(x + Math.cos(a) * 0.08, -0.3, Math.sin(a) * 0.08), new THREE.Vector3(x, 0, 0), 0.008, FOES.limb));
    parts.push(place(facet(new THREE.CylinderGeometry(0.1, 0.06, 0.03, 8), JUSTICE.accentShade, 0.03), x, -0.31, 0));
  }
  return merge(parts);
}

export const JUSTICE_PLAN: FoePlan = {
  id: 'justice',
  name: 'Justice',
  height: 6,
  radius: 0.4,
  tune: () => tuning.foes.justice as unknown as FoeTune,
  senses: 'sight',
  ranged: false,
  elite: true,
  shield: false,
  limb: FOES.limb,
  sleeve: JUSTICE_LOOK.mantle,
  torso: () =>
    merge([
      facet(new THREE.CylinderGeometry(0.22, 0.5, 1.25, 6, 2).translate(0, -1.25 / 2 + 0.22, 0), JUSTICE_LOOK.gown, 0.05),
      // The pale mantle over her shoulders and the stole down the front.
      place(facet(new THREE.BoxGeometry(0.66, 0.16, 0.38), JUSTICE_LOOK.mantle, 0.04), 0, 0.16, 0),
      place(facet(new THREE.BoxGeometry(0.16, 0.9, 0.04), JUSTICE_LOOK.mantle, 0.03), 0, -0.3, -0.25),
    ]),
  head: () =>
    merge([
      facet(new THREE.IcosahedronGeometry(0.14, 1).scale(1, 1.15, 1), JUSTICE_LOOK.mantle, 0.04),
      place(facet(new THREE.CylinderGeometry(0.15, 0.14, 0.1, 6), JUSTICE_LOOK.crown, 0.04), 0, 0.14, 0),
      // The crown's three square points.
      ...[-0.09, 0, 0.09].map((x) => place(block(0.05, x === 0 ? 0.12 : 0.08, 0.05, JUSTICE_LOOK.crown, 0.04), x, 0.18, -0.1)),
    ]),
  weapon: greatsword,
  offhand: handScales,
  hitboxes: [
    { part: 'body', at: [0, 1.0, 0], r: 0.36 },
    { part: 'body', at: [0, 0.55, 0], r: 0.38 },
    { part: 'body', at: [0, 1.32, 0], r: 0.3 },
    { part: 'weak', at: [0, 1.56, 0], r: 0.13 },
  ],
  weakGlow: null,
  // The card: sword raised upright in the right hand, scales held out in the left.
  ready: pose([0.24, 0.22, -0.2], [-0.32, 0.02, -0.28], [1.5, 0, 0], [0, 0, 0], 0, 0.02),
  motions: {
    edict: {
      windup: pose([0.48, 0.46, 0.08], [-0.32, 0.02, -0.28], [0.9, -1.25, 0.3], [0, 0, 0], 0.3, -0.05),
      active: pose([-0.4, -0.08, -0.5], [-0.3, 0.0, -0.22], [-0.25, 1.1, -0.3], [0, 0, 0], 0.3, 0.3),
      sound: 'windupSlash',
    },
    verdictOfThree: {
      windup: pose([0.48, 0.46, 0.08], [-0.32, 0.02, -0.28], [0.9, -1.25, 0.3], [0, 0, 0], 0.3, -0.05),
      active: pose([-0.4, -0.08, -0.5], [-0.3, 0.0, -0.22], [-0.25, 1.1, -0.3], [0, 0, 0], 0.3, 0.3),
      sound: 'windupSlash',
    },
    cleave: {
      windup: pose([0.12, 0.66, 0.12], [-0.32, 0.1, -0.2], [2.6, 0, 0], [0, 0, 0], 0.15, -0.25),
      active: pose([0.1, -0.32, -0.66], [-0.32, 0.0, -0.2], [-1.0, 0, 0], [0, 0, 0], 0.5, 0.55),
      sound: 'windupSlam',
    },
    weigh: {
      // The scales lifted high and tipped: the blades are thrown from the lower pan.
      windup: pose([0.3, 0.3, -0.05], [-0.25, 0.55, -0.1], [1.5, 0, 0], [0, 0, 0.5], 0.1, -0.15),
      active: pose([0.3, 0.2, -0.3], [-0.2, 0.2, -0.55], [1.2, 0, 0], [0, 0, -0.4], 0.1, 0.2),
      sound: 'windupThrow',
    },
    balance: {
      windup: pose([0.18, 0.75, -0.05], [-0.32, 0.4, -0.25], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
      active: pose([0.22, 0.25, -0.6], [-0.32, 0.1, -0.3], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
      sound: 'verdict',
    },
  },
};

export class JusticeBoss extends CourtCard {
  constructor(plan: FoePlan, scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, rng: Rng) {
    super(plan, scene, physics, pos, yaw, rng);
  }

  /** Phase 2: what she throws onto one side lands on the other (mirrored across her arena's axis). */
  protected echo(x: number, z: number): [number, number] | null {
    return this.phaseIdx >= 1 ? mirrorAcross(x, z, this.home.x, this.home.z, this.homeYaw) : null;
  }

  protected strikeStart(a: AttackTune, w: EnemyWorld) {
    super.strikeStart(a, w);
    if (!a.radius) return;
    const [x, z] = slamCentre(this.ground.x, this.ground.z, this.yaw, a.reach ?? 2);
    const e = this.echo(x, z);
    // The echo lands a beat later, so the same read (get out of the ring) saves you twice.
    if (e) w.hazards.verdict(new THREE.Vector3(e[0], this.ground.y, e[1]), a.radius, 0.45, a.damage, a.knockback);
  }

  /** The scales come down. */
  protected onPhase(w: EnemyWorld) {
    w.bossPhase?.(this.phaseIdx);
  }
}

// The Devil, the arcana of the second dimension (DESIGN.md → The Devil × Pentacles → Boss; V2-10). Large (6.5 m),
// built from the card: horned and bat-winged, the right hand raised, a torch held low in the left.
//   Phase 1: raking claws, the torch brand (a ground ring), and shackles that close where you stand (bound if
//   caught: one roll breaks it).
//   At half health he stops and offers a pact: double the damage you deal, and double what you take. Accept or let
//   it pass. Phase 2 adds coin rain (which leaves coin on the floor) and shackles in threes.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import type { DamageInfo, Physics } from '../physics/world';
import { merge, place } from '../render/geo';
import { COURT_PENTACLES as C } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import { CourtCard } from './court';
import type { EnemyWorld } from './enemy';
import type { FoeTune } from './foe-ai';
import { pose, type FoePlan } from './foes';

function wings() {
  // Two bat wings, flat and ribbed, spread behind the shoulders.
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const membrane = facet(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.95, 0.5, 0.1), new THREE.Vector3(s * 0.7, -0.55, 0.05)]), C.devilWing, 0.04);
    membrane.computeVertexNormals();
    parts.push(place(membrane, s * 0.18, 0.12, 0.26));
    const back = facet(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.7, -0.55, 0.05), new THREE.Vector3(s * 0.95, 0.5, 0.1)]), C.devilWing, 0.04);
    back.computeVertexNormals();
    parts.push(place(back, s * 0.18, 0.12, 0.26));
    parts.push(place(block(0.03, 0.03, 1.05, C.devilHorn, 0.02), s * 0.6, 0.32, 0.3, 0, s * -1.2, 0));
  }
  return merge(parts);
}

function torchGeo() {
  const rod = facet(new THREE.BoxGeometry(0.05, 0.05, 0.9).translate(0, 0, -0.4), C.torch, 0.04);
  const head = facet(new THREE.CylinderGeometry(0.08, 0.05, 0.18, 6).rotateX(Math.PI / 2).translate(0, 0, -0.9), C.torchHead, 0.05);
  return merge([rod, head]);
}

function clawHand() {
  return merge([-0.06, 0, 0.06].map((x, i) => place(facet(new THREE.BoxGeometry(0.03, 0.03, 0.26).translate(0, 0, -0.13), C.devilHorn, 0.03), x, 0, 0, 0, (i - 1) * 0.3, 0)));
}

export const DEVIL_BOSS_PLAN: FoePlan = {
  id: 'devil',
  name: 'The Devil',
  height: 6.5,
  radius: 0.42,
  tune: () => tuning.foes.devil as unknown as FoeTune,
  senses: 'sight',
  ranged: false,
  elite: true,
  shield: false,
  limb: C.devilHorn,
  sleeve: C.devilHide,
  torso: () =>
    merge([
      facet(new THREE.CylinderGeometry(0.3, 0.36, 1.0, 6, 2).translate(0, -0.3, 0), C.devilHide, 0.06),
      // Haunches like the card's goat legs: a heavy lower body.
      place(facet(new THREE.CylinderGeometry(0.38, 0.3, 0.4, 6), C.devilWing, 0.06), 0, -0.85, 0),
      wings(),
    ]),
  head: () =>
    merge([
      facet(new THREE.BoxGeometry(0.24, 0.3, 0.3).translate(0, 0.02, -0.03), C.devilHide, 0.05),
      // The horns: great curving points, the silhouette at any distance.
      ...[-1, 1].map((s) => place(facet(new THREE.ConeGeometry(0.06, 0.42, 4).translate(0, 0.21, 0), C.devilHorn, 0.04), s * 0.14, 0.12, 0, -0.2, 0, -s * 0.6)),
      place(facet(new THREE.ConeGeometry(0.04, 0.12, 4).rotateX(Math.PI), C.devilHorn, 0.03), 0, -0.16, -0.12),
    ]),
  weapon: clawHand,
  offhand: torchGeo,
  hitboxes: [
    { part: 'body', at: [0, 1.0, 0], r: 0.36 },
    { part: 'body', at: [0, 0.55, 0], r: 0.4 },
    { part: 'body', at: [0, 1.32, 0], r: 0.3 },
    { part: 'weak', at: [0, 1.56, 0], r: 0.13 },
  ],
  weakGlow: null,
  // The card: right hand raised, palm out; the torch held low in the left.
  ready: pose([0.3, 0.42, -0.12], [-0.3, -0.25, -0.2], [1.6, 0, 0], [-1.1, 0, 0], 0.05, 0.05),
  motions: {
    rake: {
      windup: pose([0.5, 0.42, 0.08], [-0.3, -0.25, -0.2], [0.9, -1.2, 0.3], [-1.1, 0, 0], 0.3, -0.05),
      active: pose([-0.4, -0.08, -0.5], [-0.3, -0.2, -0.2], [-0.25, 1.1, -0.3], [-1.1, 0, 0], 0.3, 0.3),
      sound: 'windupSlash',
    },
    // The torch raised and brought down: the floor brands where it lands.
    brand: {
      windup: pose([0.3, 0.42, -0.12], [-0.12, 0.66, 0.1], [1.6, 0, 0], [2.6, 0, 0], 0.15, -0.25),
      active: pose([0.3, 0.3, -0.2], [-0.1, -0.3, -0.62], [1.4, 0, 0], [-1.0, 0, 0], 0.5, 0.55),
      sound: 'windupSlam',
    },
    // The raised hand closes: chains come up out of the floor where you stand.
    shackles: {
      windup: pose([0.28, 0.7, -0.2], [-0.3, -0.25, -0.2], [2.2, 0, 0], [-1.1, 0, 0], 0, -0.2),
      active: pose([0.28, 0.1, -0.5], [-0.3, -0.25, -0.2], [0.3, 0, 0], [-1.1, 0, 0], 0.2, 0.2),
      sound: 'chainRattle',
    },
    chains: {
      windup: pose([0.28, 0.7, -0.2], [-0.3, -0.25, -0.2], [2.2, 0, 0], [-1.1, 0, 0], 0, -0.2),
      active: pose([0.28, 0.1, -0.5], [-0.3, -0.25, -0.2], [0.3, 0, 0], [-1.1, 0, 0], 0.2, 0.2),
      sound: 'chainRattle',
    },
    coinRain: {
      windup: pose([0.3, 0.8, -0.05], [-0.3, -0.25, -0.2], [2.9, 0, 0], [-1.1, 0, 0], 0, -0.25),
      active: pose([0.3, 0.3, -0.6], [-0.3, -0.25, -0.2], [0.25, 0, 0], [-1.1, 0, 0], 0, 0.15),
      sound: 'coinJingle',
    },
  },
};

export class DevilBoss extends CourtCard {
  /** Time left holding out the pact (he waits for an answer). */
  private offerT = 0;
  /** The pact was accepted: double the damage he takes (and the game doubles what she takes). */
  pactOn = false;

  constructor(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, rng: Rng) {
    super(DEVIL_BOSS_PLAN, scene, physics, pos, yaw, rng);
  }

  respawn() {
    super.respawn();
    this.offerT = 0;
    this.pactOn = false;
  }

  /** Half health: he stops and holds out the pact. */
  protected onPhase(w: EnemyWorld) {
    if (this.phaseIdx !== 1 || !w.offerPact) return;
    this.offerT = this.cfg.pactTime ?? 6;
    w.offerPact();
  }

  takeDamage(info: DamageInfo): boolean {
    // While he holds out the pact he won't be hurt: he's waiting for an answer.
    if (this.offerT > 0) return false;
    return super.takeDamage(this.pactOn ? { ...info, amount: info.amount * 2 } : info);
  }

  update(dt: number, w: EnemyWorld) {
    this.pactOn = w.pact === 'accepted';
    if (this.offerT > 0 && this.alive) {
      this.offerT -= dt;
      // An answer ends the wait at once.
      if (w.pact === 'accepted' || w.pact === 'refused') this.offerT = 0;
      // Hold still, facing her, the hand held out (the stagger pose, kept).
      this.state = 'stagger';
      this.stateT = 0;
    }
    super.update(dt, w);
  }

  get label() {
    return `${super.label}${this.offerT > 0 ? ' (offering the pact)' : this.pactOn ? ' (pact)' : ''}`;
  }
}

/** For tests and the HUD: the pact's terms. */
export const PACT_TERMS = 'double the damage you deal, and double what you take';

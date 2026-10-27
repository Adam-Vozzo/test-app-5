// The Cups court and the Shadow (DESIGN.md → The Moon × Cups; V2-14). Rank is the verb, suit is the flavour, and
// each escalates the Moon's rule (illusion, but fair):
//   Knight (mobility): charges, and sets down a cup between you. Drink it (walk over it) and it heals you or poisons
//     you; the tell is the draught: the true cup is full of moonlight and shines, the poisoned one is dark.
//   Queen (control): lines of thrown blades, and two copies of herself; she trades places with one. Only she casts a
//     shadow and makes footsteps.
//   King (command): throned on the water, he sends tidal waves down the room, the full width but for one gap; his
//     wolves come at each phase.
//   The Shadow (the arcana): the Moon's light casts the Eight of Swords' own shadow, and it fights with her moves (the
//     pistol's quick shots, the rifle's heavy bolt, the three-swing combo, the charged strike); it rolls out of your
//     fire. At each phase the Moon shifts and it splits into reflections.
// Feel numbers live in tuning.foes.knightCups / queenCups / kingCups / shadow.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { G, groups, type Physics } from '../physics/world';
import { merge, place } from '../render/geo';
import { FOES, MOON_FOES as M } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import { CourtCard } from './court';
import type { EnemyWorld } from './enemy';
import { Foe } from './foe';
import { volleyOffsets, type AttackTune, type FoeTune, type TimelinePoint } from './foe-ai';
import { pose, type FoePlan } from './foes';

/** The suit symbol: a pale cup, worn as a crest. Base at the origin, `len` tall. */
export function cupCrest(len: number) {
  const foot = facet(new THREE.CylinderGeometry(len * 0.12, len * 0.22, len * 0.08, 6).translate(0, len * 0.04, 0), M.crest, 0.03);
  const stem = facet(new THREE.CylinderGeometry(len * 0.05, len * 0.05, len * 0.4, 5).translate(0, len * 0.28, 0), M.crest, 0.03);
  const bowl = facet(new THREE.CylinderGeometry(len * 0.3, len * 0.1, len * 0.4, 7).translate(0, len * 0.66, 0), M.crest, 0.03);
  return merge([foot, stem, bowl]);
}

function robe(top: number, bottom: number, h: number, color: number) {
  return facet(new THREE.CylinderGeometry(top, bottom, h, 6, 2).translate(0, -h / 2 + 0.22, 0), color, 0.05);
}

function trident(len: number) {
  const rod = facet(new THREE.BoxGeometry(0.06, 0.06, len).translate(0, 0, -len / 2 + 0.1), M.crown, 0.04);
  const prongs = [-1, 0, 1].map((k) => place(facet(new THREE.ConeGeometry(0.03, 0.3, 4).rotateX(-Math.PI / 2), M.crown, 0.03), k * 0.1, 0, -len - 0.05));
  const bar = place(block(0.26, 0.04, 0.04, M.crown, 0.02), 0, 0, -len + 0.1);
  return merge([rod, bar, ...prongs]);
}

function lance(len: number) {
  const blade = facet(new THREE.BoxGeometry(0.06, 0.02, len).translate(0, 0, -len / 2 - 0.1), FOES.blade, 0.03);
  const guard = block(0.24, 0.04, 0.05, M.knightCape, 0.03);
  return merge([blade, place(guard, 0, 0, -0.1)]);
}

/** The SwordRifle as her shadow carries it: a long gun with a blade along the barrel. */
function shadowRifle() {
  const stock = facet(new THREE.BoxGeometry(0.07, 0.12, 0.34).translate(0, -0.02, 0.12), M.shadow, 0.03);
  const barrel = facet(new THREE.BoxGeometry(0.06, 0.06, 1.0).translate(0, 0.02, -0.5), M.shadowEdge, 0.03);
  const blade = facet(new THREE.BoxGeometry(0.015, 0.1, 0.9).translate(0, -0.06, -0.55), M.shadowEdge, 0.02);
  return merge([stock, barrel, blade]);
}

const tune = (id: 'knightCups' | 'queenCups' | 'kingCups' | 'shadow') => () => tuning.foes[id] as unknown as FoeTune;

export const CUPS_PLANS: Record<'knightCups' | 'queenCups' | 'kingCups', FoePlan> = {
  knightCups: {
    id: 'knightCups',
    rank: 'knight',
    name: 'Knight of Cups',
    height: 2.05,
    radius: 0.32,
    tune: tune('knightCups'),
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: M.knightArmour,
    torso: () => merge([robe(0.26, 0.3, 0.8, M.knightArmour), place(facet(new THREE.ConeGeometry(0.42, 1.2, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.4), M.knightCape, 0.05), 0, -0.3, 0.24, -0.25, 0, 0)]),
    head: () => merge([facet(new THREE.BoxGeometry(0.26, 0.3, 0.28), M.knightArmour, 0.05), place(cupCrest(0.5), 0, 0.14, 0.02)]),
    weapon: () => lance(1.1),
    offhand: () => cupCrest(0.3).rotateX(-Math.PI / 2),
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.34 },
      { part: 'body', at: [0, 0.6, 0], r: 0.3 },
      { part: 'weak', at: [0, 1.44, 0], r: 0.15 },
    ],
    weakGlow: null,
    // The cup held out in the off hand, as on the card.
    ready: pose([0.24, 0.0, -0.3], [-0.16, 0.12, -0.4], [0.9, 0.1, 0], [0, 0, 0], 0.15, 0.1),
    motions: {
      charge: {
        windup: pose([0.26, -0.1, 0.1], [-0.16, 0.0, -0.3], [0.05, 0, 0], [0, 0, 0], 0.55, 0.15),
        active: pose([0.14, 0.0, -0.6], [-0.16, 0.0, -0.3], [0.0, 0, 0], [0, 0, 0], 0.35, 0.5),
        sound: 'windupThrust',
      },
      // The offering: he kneels and sets the cup down toward you.
      offer: {
        windup: pose([0.24, 0.0, -0.2], [-0.12, 0.3, -0.5], [0.9, 0.1, 0], [0, 0, 0], 0.2, 0.0),
        active: pose([0.24, 0.0, -0.2], [-0.12, -0.3, -0.7], [0.9, 0.1, 0], [0, 0, 0], 0.7, 0.4),
        sound: 'pour',
      },
      slash: {
        windup: pose([0.5, 0.42, 0.1], [-0.16, 0.12, -0.4], [0.9, -1.25, 0.3], [0, 0, 0], 0.35, -0.05),
        active: pose([-0.4, -0.1, -0.5], [-0.16, 0.12, -0.4], [-0.25, 1.1, -0.3], [0, 0, 0], 0.3, 0.35),
        sound: 'windupSlash',
      },
    },
  },
  queenCups: {
    id: 'queenCups',
    rank: 'queen',
    name: 'Queen of Cups',
    height: 2.2,
    radius: 0.32,
    tune: tune('queenCups'),
    senses: 'sight',
    ranged: true,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: M.queenGown,
    torso: () => merge([robe(0.2, 0.46, 1.1, M.queenGown), place(facet(new THREE.BoxGeometry(0.42, 0.9, 0.04), M.queenVeil, 0.04), 0, -0.2, 0.22, -0.12, 0, 0)]),
    head: () =>
      merge([
        facet(new THREE.IcosahedronGeometry(0.14, 1).scale(1, 1.15, 1), M.queenGown, 0.04),
        place(facet(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 6), M.crown, 0.04), 0, 0.14, 0),
        place(cupCrest(0.4), 0, 0.2, 0),
      ]),
    weapon: () => lance(0.8),
    // Her covered cup, held close (the card).
    offhand: () => cupCrest(0.36).rotateX(-Math.PI / 2),
    hitboxes: [
      { part: 'body', at: [0, 1.05, 0], r: 0.32 },
      { part: 'body', at: [0, 0.6, 0], r: 0.36 },
      { part: 'weak', at: [0, 1.5, 0], r: 0.14 },
    ],
    weakGlow: null,
    ready: pose([0.24, 0.1, -0.2], [-0.14, 0.1, -0.3], [1.4, 0.1, 0], [0, 0, 0], 0, -0.05),
    motions: {
      volley: {
        windup: pose([0.3, 0.5, 0.15], [-0.3, 0.5, 0.15], [2.2, 0, 0], [2.2, 0, 0], 0.15, -0.2),
        active: pose([0.32, 0.15, -0.55], [-0.32, 0.15, -0.55], [0.1, -0.3, 0], [0.1, 0.3, 0], 0.1, 0.25),
        sound: 'windupThrow',
      },
      // The mirror: the cup raised, and she isn't only one any more.
      mirror: {
        windup: pose([0.24, 0.1, -0.2], [-0.1, 0.6, -0.2], [1.4, 0.1, 0], [1.2, 0, 0], 0, -0.2),
        active: pose([0.24, 0.1, -0.2], [-0.1, 0.7, -0.1], [1.4, 0.1, 0], [1.6, 0, 0], 0, -0.25),
        sound: 'verdict',
      },
      riposte: {
        windup: pose([0.38, 0.3, 0.05], [-0.14, 0.1, -0.3], [0.8, -1.1, 0.3], [0, 0, 0], 0.25, -0.05),
        active: pose([-0.3, -0.05, -0.5], [-0.14, 0.1, -0.3], [-0.2, 1.0, -0.3], [0, 0, 0], 0.2, 0.3),
        sound: 'windupSlash',
      },
    },
  },
  kingCups: {
    id: 'kingCups',
    rank: 'king',
    name: 'King of Cups',
    height: 2.4,
    radius: 0.44,
    tune: tune('kingCups'),
    squadId: 'wolf',
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: M.kingMantle,
    torso: () => merge([robe(0.34, 0.46, 1.05, M.kingRobe), place(facet(new THREE.BoxGeometry(0.88, 0.22, 0.46), M.kingMantle, 0.05), 0, 0.16, 0.02)]),
    head: () =>
      merge([
        facet(new THREE.BoxGeometry(0.28, 0.28, 0.28), M.kingMantle, 0.05),
        place(facet(new THREE.CylinderGeometry(0.18, 0.16, 0.16, 6), M.crown, 0.04), 0, 0.18, 0),
        place(cupCrest(0.5), 0, 0.26, 0),
      ]),
    weapon: () => trident(1.7),
    offhand: () => cupCrest(0.32).rotateX(-Math.PI / 2),
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.42 },
      { part: 'body', at: [0, 0.55, 0], r: 0.38 },
      { part: 'body', at: [0, 1.32, 0], r: 0.32 },
      { part: 'weak', at: [0, 1.62, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.2, 0.0, -0.25], [-0.16, 0.05, -0.32], [1.3, 0, 0], [0, 0, 0], 0.05, 0.05),
    motions: {
      // The wave: the trident raised, then swept down the room.
      wave: {
        windup: pose([0.2, 0.75, -0.05], [-0.16, 0.3, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.25, 0.1, -0.6], [-0.16, 0.05, -0.3], [0.1, 0, 0], [0, 0, 0], 0.2, 0.25),
        sound: 'verdict',
      },
      flood: {
        windup: pose([0.2, 0.75, -0.05], [-0.16, 0.3, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.25, 0.1, -0.6], [-0.16, 0.05, -0.3], [0.1, 0, 0], [0, 0, 0], 0.2, 0.25),
        sound: 'verdict',
      },
      trident: {
        windup: pose([0.1, 0.7, 0.12], [-0.04, 0.66, 0.06], [2.6, 0, 0], [0, 0, 0], 0.15, -0.25),
        active: pose([0.1, -0.3, -0.66], [-0.04, -0.28, -0.6], [-1.0, 0, 0], [0, 0, 0], 0.5, 0.55),
        sound: 'windupSlam',
      },
    },
  },
};

/**
 * The Shadow: the Eight of Swords' own silhouette (the hood, the blindfold's tails, the SwordRifle on her back), near
 * black, her red gone from it. It holds the pistol in the off hand and the rifle in the right.
 */
export const SHADOW_PLAN: FoePlan = {
  id: 'shadow',
  name: 'The Shadow',
  height: 1.85,
  radius: 0.3,
  tune: tune('shadow'),
  senses: 'sight',
  ranged: true,
  elite: true,
  shield: false,
  limb: M.shadow,
  sleeve: M.shadow,
  torso: () =>
    merge([
      robe(0.24, 0.36, 0.95, M.shadow),
      // The tails of the blindfold, streaming back.
      ...[-1, 1].map((k) => place(block(0.06, 0.6, 0.02, M.shadowEdge, 0.02, k + 2), k * 0.08, 0.1, 0.24, -0.5, 0, k * 0.15)),
    ]),
  head: () =>
    merge([
      facet(new THREE.ConeGeometry(0.2, 0.42, 6).translate(0, 0.08, 0.02), M.shadow, 0.05),
      // The blindfold pushed up, a darker band.
      place(facet(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8), M.shadowEdge, 0.03), 0, 0.08, 0),
    ]),
  weapon: shadowRifle,
  offhand: () => facet(new THREE.BoxGeometry(0.05, 0.1, 0.24).translate(0, 0, -0.08), M.shadowEdge, 0.03),
  hitboxes: [
    { part: 'body', at: [0, 1.0, 0], r: 0.3 },
    { part: 'body', at: [0, 0.6, 0], r: 0.28 },
    { part: 'weak', at: [0, 1.5, 0], r: 0.14 },
  ],
  weakGlow: null,
  ready: pose([0.22, -0.02, -0.3], [-0.24, 0.05, -0.34], [0.2, 0.05, 0], [0, 0, 0], 0.15, 0.1),
  motions: {
    // Her pistol: the off hand up and out, quick.
    shots: {
      windup: pose([0.22, -0.02, -0.3], [-0.1, 0.25, -0.5], [0.2, 0.05, 0], [0, 0, 0], 0.15, 0.05),
      active: pose([0.22, -0.02, -0.3], [-0.1, 0.28, -0.52], [0.2, 0.05, 0], [0.15, 0, 0], 0.15, 0.0),
      sound: 'windupThrow',
    },
    // Her rifle: shouldered, a long breath, one heavy bolt.
    rifle: {
      windup: pose([0.16, 0.2, -0.3], [-0.06, 0.2, -0.62], [0.0, 0, 0], [0, 0, 0], 0.25, 0.05),
      active: pose([0.16, 0.24, -0.2], [-0.06, 0.24, -0.55], [0.15, 0, 0], [0, 0, 0], 0.25, -0.1),
      sound: 'windupThrust',
    },
    combo: {
      windup: pose([0.5, 0.42, 0.1], [0.1, 0.3, -0.1], [0.9, -1.25, 0.3], [0, 0, 0], 0.35, -0.05),
      active: pose([-0.4, -0.1, -0.5], [-0.2, -0.05, -0.35], [-0.25, 1.1, -0.3], [0, 0, 0], 0.3, 0.35),
      sound: 'windupSlash',
    },
    // Her charged strike: the blade raised high, then brought down in a ring.
    charged: {
      windup: pose([0.12, 0.7, 0.12], [-0.04, 0.66, 0.06], [2.6, 0, 0], [0, 0, 0], 0.2, -0.25),
      active: pose([0.1, -0.3, -0.66], [-0.04, -0.28, -0.6], [-1.0, 0, 0], [0, 0, 0], 0.55, 0.55),
      sound: 'windupSlam',
    },
    split: {
      windup: pose([0.22, -0.02, -0.3], [-0.24, 0.05, -0.34], [0.2, 0.05, 0], [0, 0, 0], 0.4, -0.2),
      active: pose([0.22, -0.02, -0.3], [-0.24, 0.05, -0.34], [0.2, 0.05, 0], [0, 0, 0], 0.1, 0.1),
      sound: 'verdict',
    },
  },
};

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _dir = new THREE.Vector3();
const SOLID = groups(G.QUERY, G.WORLD);

/** The Cups court: the rank verbs of CourtCard, plus the cup, the mirror and the wave. */
export class CupsCard extends CourtCard {
  private waveKeys = Array.from({ length: 12 }, () => ({}));
  private waveGap = 0;
  /** Its reflections still standing (the Queen's copies, the Shadow's split). */
  protected copies: Foe[] = [];

  constructor(plan: FoePlan, scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, rng: Rng) {
    super(plan, scene, physics, pos, yaw, rng);
  }

  respawn() {
    super.respawn();
    // (respawn runs inside the base constructor, before this class's fields exist)
    if (this.copies) this.copies.length = 0;
    this.hideWaves();
  }

  private hideWaves() {
    if (!this.waveKeys) return;
    for (const k of this.waveKeys) this.hazards?.hideLane(k);
  }

  protected endAttack() {
    super.endAttack();
    this.hideWaves();
  }

  /**
   * `n` copies rise beside it, and it trades places with one of them: which is which is read by the shadow and the
   * footsteps alone.
   */
  protected mirror(n: number, w: EnemyWorld) {
    this.copies = this.copies.filter((c) => c.alive);
    const made: Foe[] = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const a = this.yaw + side * (Math.PI / 2) * (1 - 0.3 * Math.floor(i / 2));
      _dir.set(-Math.sin(a), 0, -Math.cos(a));
      const hit = w.physics.raycast(_p.copy(this.center), _dir, 4.5, SOLID);
      const d = Math.max(1.2, (hit ? hit.distance : 4.5) - 0.8);
      const c = w.summon(this.id, _v.copy(this.ground).addScaledVector(_dir, d), this.yaw, true);
      if (c instanceof Foe) made.push(c);
    }
    this.copies.push(...made);
    w.sound('shimmer', this.center);
    if (!made.length) return;
    const other = made[Math.floor(this.rng() * made.length)];
    const mine = _p.copy(this.ground);
    const theirs = _v.copy(other.ground);
    other.placeAt(mine);
    this.placeAt(theirs);
  }

  /** Its reflections (for tests). */
  get reflections() {
    return this.copies.filter((c) => c.alive);
  }

  protected special(name: string, a: AttackTune, tl: TimelinePoint, prev: TimelinePoint | null, dt: number, w: EnemyWorld, toYaw: number): number | null {
    const starting = prev?.phase !== tl.phase || prev.hit !== tl.hit;
    if (a.kind === 'offer') {
      this.vel.multiplyScalar(Math.exp(-10 * dt));
      if (tl.phase === 'windup') return toYaw;
      if (tl.phase === 'active' && starting) {
        // Set down between you, a few steps short of you: you have to choose to go to it.
        _v.subVectors(this.ground, w.playerPos).setY(0);
        const d = _v.length() || 1;
        const at = _p.copy(w.playerPos).addScaledVector(_v.divideScalar(d), Math.min(3.5, Math.max(2, d * 0.5)));
        at.y = this.ground.y;
        w.hazards.cup(at, this.rng() < 0.5, a.damage, a.delay ?? 8);
      }
      return null;
    }
    if (a.kind === 'mirror') {
      this.vel.multiplyScalar(Math.exp(-10 * dt));
      if (tl.phase === 'windup') return toYaw;
      if (tl.phase === 'active' && starting) this.mirror(a.count ?? 2, w);
      return null;
    }
    if (a.kind === 'wave') {
      const lanes = a.lanes ?? 9;
      const spacing = a.spacing ?? 2.2;
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      this.vel.multiplyScalar(Math.exp(-10 * dt));
      if (tl.phase === 'windup') {
        if (tl.hit === 0 && starting) this.waveGap = 1 + Math.floor(this.rng() * (lanes - 2));
        // The wave's path, drawn on the water: every lane but the gap.
        volleyOffsets(lanes, spacing, this.waveGap, tl.mirrored).forEach((o, i) => {
          _p.set(this.ground.x - fz * o, this.ground.y, this.ground.z + fx * o);
          w.hazards.lane(this.waveKeys[i], _p, this.yaw, a.range * 0.9, spacing * 0.92, tl.k);
        });
        return tl.k < 0.6 ? toYaw : null;
      }
      if (tl.phase === 'active' && starting) {
        this.hideWaves();
        const g = tl.mirrored ? lanes - 1 - this.waveGap : this.waveGap;
        const gapAt = (g - (lanes - 1) / 2) * spacing;
        _p.set(this.ground.x + fx * 1.2, this.ground.y, this.ground.z + fz * 1.2);
        w.hazards.wave(_p, this.yaw, lanes * spacing, gapAt, spacing, a.speed ?? 12, a.range, a.damage, a.knockback);
        w.sound('wave', this.center);
        w.shake(0.3, this.center);
      }
      return null;
    }
    return super.special(name, a, tl, prev, dt, w, toYaw);
  }

  dispose() {
    this.hideWaves();
    super.dispose();
  }
}

/** The Shadow: her moves, turned on her. It rolls out of her fire, and splits at each phase. */
export class ShadowBoss extends CupsCard {
  private dodgeCd = 0;
  private dodgeT = 0;
  private dodgeSign = 1;

  constructor(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, rng: Rng) {
    super(SHADOW_PLAN, scene, physics, pos, yaw, rng);
  }

  respawn() {
    super.respawn();
    this.dodgeCd = 0;
    this.dodgeT = 0;
  }

  /** Rolling out of the line of fire (for tests and the label). */
  get dodging() {
    return this.dodgeT > 0;
  }

  update(dt: number, w: EnemyWorld) {
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeT = Math.max(0, this.dodgeT - dt);
    // The split comes with the phases, never on its own.
    this.cooldowns.split = 1e9;
    super.update(dt, w);
  }

  protected approach(dt: number, w: EnemyWorld, dyaw: number, toYaw: number): number | null {
    // You fire: it rolls aside (as you would), every so often.
    if (this.dodgeT <= 0 && this.dodgeCd <= 0 && w.noises.length > 0 && this.dist > 4 && !this.illusion) {
      this.dodgeT = 0.4;
      this.dodgeCd = this.cfg.dodgeCooldown ?? 2.2;
      this.dodgeSign = this.rng() < 0.5 ? -1 : 1;
      w.sound('roll', this.center);
    }
    if (this.dodgeT > 0) {
      _v.subVectors(w.playerPos, this.ground).setY(0).normalize();
      this.vel.set(-_v.z * this.dodgeSign, 0, _v.x * this.dodgeSign).multiplyScalar(this.cfg.dodgeSpeed ?? 9);
      this.steer(this.vel.x, this.vel.z, this.cfg.dodgeSpeed ?? 9, w, dt);
      return toYaw;
    }
    return super.approach(dt, w, dyaw, toYaw);
  }

  /** The Moon shifts: the arena dims, and it splits into reflections. */
  protected onPhase(w: EnemyWorld) {
    w.bossPhase?.(this.phaseIdx);
    this.mirror(this.cfg.attacks.split?.count ?? 2, w);
  }

  get label() {
    return this.dodging ? `${super.label} · rolling` : super.label;
  }
}

// Court-card minibosses (DESIGN.md → Court cards as minibosses). Rank is the verb, suit is the flavour:
//   Knight (mobility): charges down wind lanes shown on the ground, hit and run; from phase 2 it charges back.
//   Queen (control): lines of thrown blades with one gap to step into; the follow-up leaves the mirrored gap.
//   King (command): marks verdicts where you stand that strike later, and calls Bailiffs to his side each phase.
// Each escalates Justice's rule, answer in kind: mirrored combos (Knight), mirrored volleys (Queen), mirrored
// verdicts (King). Feel numbers live in tuning.foes.knight / queen / king; looks and poses are data below.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { G, groups, type DamageInfo, type Physics } from '../physics/world';
import { merge, place } from '../render/geo';
import { COURT, FOES } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import type { EnemyWorld } from './enemy';
import { Foe } from './foe';
import { phaseOf, volleyOffsets, type AttackTune, type CourtRank, type FoeTune, type TimelinePoint } from './foe-ai';
import type { ArmPose, FoePlan, V3 } from './foes';

const pose = (handR: V3, handL: V3, weapon: V3, off: V3 = [0, 0, 0], crouch = 0, lean = 0): ArmPose => ({ handR, handL, weapon, off, crouch, lean });

/** The suit symbol: a large pale sword, point down, worn as a crest. Base at the origin, `len` tall. */
function swordCrest(len: number) {
  const blade = facet(new THREE.BoxGeometry(len * 0.1, len * 0.72, len * 0.04).translate(0, len * 0.36, 0), COURT.crest, 0.03);
  const guard = block(len * 0.42, len * 0.07, len * 0.06, COURT.crest, 0.03);
  const grip = block(len * 0.07, len * 0.16, len * 0.07, FOES.limb, 0.03);
  return merge([blade, place(guard, 0, len * 0.72, 0), place(grip, 0, len * 0.79, 0)]);
}

function longSword(len: number, w: number) {
  const blade = facet(new THREE.BoxGeometry(w, w * 0.3, len).translate(0, 0, -len / 2 - 0.1), FOES.blade, 0.03);
  const guard = block(w * 4, 0.05, 0.06, FOES.limb, 0.03);
  const grip = facet(new THREE.BoxGeometry(0.05, 0.05, 0.22).translate(0, 0, 0.04), FOES.limb, 0.03);
  return merge([blade, place(guard, 0, -0.025, -0.1), grip]);
}

function robe(top: number, bottom: number, h: number, color: number) {
  return facet(new THREE.CylinderGeometry(top, bottom, h, 6, 2).translate(0, -h / 2 + 0.22, 0), color, 0.05);
}

const tune = (rank: CourtRank) => () => tuning.foes[rank] as unknown as FoeTune;

export const COURT_PLANS: Record<CourtRank, FoePlan> = {
  knight: {
    id: 'knight',
    name: 'Knight of Swords',
    height: 2.05,
    radius: 0.32,
    tune: tune('knight'),
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: COURT.knightArmour,
    torso: () =>
      merge([
        robe(0.26, 0.3, 0.8, COURT.knightArmour),
        // A long cape streaming back: the rider without the horse.
        place(facet(new THREE.ConeGeometry(0.42, 1.2, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.4), COURT.knightCape, 0.05), 0, -0.3, 0.24, -0.25, 0, 0),
      ]),
    head: () => merge([facet(new THREE.BoxGeometry(0.26, 0.3, 0.28), COURT.knightArmour, 0.05), place(swordCrest(0.62), 0, 0.12, 0.02)]),
    weapon: () => longSword(1.0, 0.07),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.34 },
      { part: 'body', at: [0, 0.6, 0], r: 0.3 },
      { part: 'weak', at: [0, 1.44, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.24, 0.0, -0.3], [-0.05, -0.02, -0.32], [0.9, 0.1, 0], [0, 0, 0], 0.15, 0.15),
    motions: {
      // The charge: sword couched like a lance, body low.
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
  queen: {
    id: 'queen',
    name: 'Queen of Swords',
    height: 2.2,
    radius: 0.32,
    tune: tune('queen'),
    senses: 'sight',
    ranged: true,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: COURT.queenGown,
    torso: () =>
      merge([
        // A tall gown flaring to the floor, and a pale veil down the back.
        robe(0.2, 0.46, 1.1, COURT.queenGown),
        place(facet(new THREE.BoxGeometry(0.42, 0.9, 0.04), COURT.queenVeil, 0.04), 0, -0.2, 0.22, -0.12, 0, 0),
      ]),
    head: () =>
      merge([
        facet(new THREE.IcosahedronGeometry(0.14, 1).scale(1, 1.15, 1), COURT.queenGown, 0.04),
        place(facet(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 6), COURT.crown, 0.04), 0, 0.14, 0),
        place(swordCrest(0.5), 0, 0.2, 0),
      ]),
    weapon: () => longSword(0.8, 0.05),
    offhand: () => longSword(0.32, 0.05),
    hitboxes: [
      { part: 'body', at: [0, 1.05, 0], r: 0.32 },
      { part: 'body', at: [0, 0.6, 0], r: 0.36 },
      { part: 'weak', at: [0, 1.5, 0], r: 0.14 },
    ],
    weakGlow: null,
    // Upright: her sword raised beside her, the off hand holding a fan of blades.
    ready: pose([0.24, 0.1, -0.2], [-0.22, -0.05, -0.25], [1.4, 0.1, 0], [0.4, -0.4, 0], 0, -0.05),
    motions: {
      volley: {
        windup: pose([0.3, 0.5, 0.15], [-0.3, 0.5, 0.15], [2.2, 0, 0], [2.2, 0, 0], 0.15, -0.2),
        active: pose([0.32, 0.15, -0.55], [-0.32, 0.15, -0.55], [0.1, -0.3, 0], [0.1, 0.3, 0], 0.1, 0.25),
        sound: 'windupThrow',
      },
      storm: {
        windup: pose([0.3, 0.5, 0.15], [-0.3, 0.5, 0.15], [2.2, 0, 0], [2.2, 0, 0], 0.15, -0.2),
        active: pose([0.32, 0.15, -0.55], [-0.32, 0.15, -0.55], [0.1, -0.3, 0], [0.1, 0.3, 0], 0.1, 0.25),
        sound: 'windupThrow',
      },
      riposte: {
        windup: pose([0.38, 0.3, 0.05], [-0.22, -0.05, -0.25], [0.8, -1.1, 0.3], [0.4, -0.4, 0], 0.25, -0.05),
        active: pose([-0.3, -0.05, -0.5], [-0.22, -0.05, -0.25], [-0.2, 1.0, -0.3], [0.4, -0.4, 0], 0.2, 0.3),
        sound: 'windupSlash',
      },
    },
  },
  king: {
    id: 'king',
    name: 'King of Swords',
    height: 2.4,
    radius: 0.42,
    tune: tune('king'),
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    limb: FOES.limb,
    sleeve: COURT.kingMantle,
    torso: () =>
      merge([
        robe(0.32, 0.44, 1.05, COURT.kingRobe),
        // A heavy mantle squaring the shoulders: the judge's silhouette.
        place(facet(new THREE.BoxGeometry(0.86, 0.22, 0.46), COURT.kingMantle, 0.05), 0, 0.16, 0.02),
      ]),
    head: () =>
      merge([
        facet(new THREE.BoxGeometry(0.26, 0.28, 0.26), COURT.kingMantle, 0.05),
        place(facet(new THREE.CylinderGeometry(0.17, 0.15, 0.14, 6), COURT.crown, 0.04), 0, 0.17, 0),
        place(swordCrest(0.72), 0, 0.24, 0),
      ]),
    weapon: () => longSword(1.3, 0.1),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.4 },
      { part: 'body', at: [0, 0.55, 0], r: 0.36 },
      { part: 'body', at: [0, 1.32, 0], r: 0.32 },
      { part: 'weak', at: [0, 1.62, 0], r: 0.15 },
    ],
    weakGlow: null,
    // The greatsword planted before him, both hands on the pommel.
    ready: pose([0.08, -0.05, -0.3], [-0.08, -0.05, -0.3], [-1.45, 0, 0], [0, 0, 0], 0.05, 0.05),
    motions: {
      // The verdict: the sword raised to the sky, then levelled at you.
      verdict: {
        windup: pose([0.18, 0.75, -0.05], [-0.05, 0.1, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.05, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'verdict',
      },
      sentence: {
        windup: pose([0.18, 0.75, -0.05], [-0.05, 0.1, -0.2], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.22, 0.25, -0.6], [-0.05, 0.05, -0.2], [0.25, 0, 0], [0, 0, 0], 0, 0.15),
        sound: 'verdict',
      },
      judgement: {
        windup: pose([0.1, 0.7, 0.12], [-0.04, 0.66, 0.06], [2.6, 0, 0], [0, 0, 0], 0.15, -0.25),
        active: pose([0.1, -0.3, -0.66], [-0.04, -0.28, -0.6], [-1.0, 0, 0], [0, 0, 0], 0.5, 0.55),
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

export const COURT_RANKS = Object.keys(COURT_PLANS) as CourtRank[];
export const isCourtRank = (id: string): id is CourtRank => id in COURT_PLANS;

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _dir = new THREE.Vector3();
const SOLID = groups(G.QUERY, G.WORLD);

export class CourtCard extends Foe {
  /** The rank (or, for an arcana, its own id): which rank verbs apply. */
  readonly rank: string;
  /** Keys for this card's ground lanes (one per blade lane, or the charge lane). */
  private laneKeys = Array.from({ length: 12 }, () => ({}));
  private retreatT = 0;
  private gapIdx = 0;
  private roar = false;

  constructor(plan: FoePlan, scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, rng: Rng) {
    super(plan, scene, physics, pos, yaw, 'throne', rng);
    this.rank = plan.rank ?? plan.id;
  }

  /** Where a strike at (x, z) echoes, if anywhere (Justice: across her arena in phase 2). */
  protected echo(_x: number, _z: number): [number, number] | null {
    return null;
  }

  /** Called when the phase steps up (after the horn): the arena may change. */
  protected onPhase(_w: EnemyWorld) {}

  /** Court cards hold the big health bar while they fight you. */
  get bar() {
    return true;
  }

  respawn() {
    super.respawn();
    this.phaseIdx = 0;
    this.retreatT = 0;
    this.roar = false;
    this.hideLanes();
  }

  takeDamage(info: DamageInfo): boolean {
    const killed = super.takeDamage(info);
    if (killed) {
      this.hideLanes();
      return true;
    }
    // Escalate at each health threshold: a stagger and a horn call (and, for the King, his squad).
    const p = phaseOf(this.health / this.maxHealth, this.cfg.phases ?? []);
    if (p > this.phaseIdx) {
      this.phaseIdx = p;
      this.hideLanes();
      this.endAttack();
      this.set('stagger');
      this.roar = true;
    }
    return false;
  }

  update(dt: number, w: EnemyWorld) {
    this.retreatT = Math.max(0, this.retreatT - dt);
    if (this.roar && this.alive) {
      this.roar = false;
      w.sound('courtHorn', this.center);
      w.shake(0.35, this.center);
      if (this.rank === 'king') this.callSquad(w);
      this.onPhase(w);
    }
    super.update(dt, w);
  }

  /** The King calls Bailiffs to his flanks. */
  private callSquad(w: EnemyWorld) {
    const n = this.cfg.squad ?? 2;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const a = this.yaw + side * (Math.PI / 2 + 0.35 * Math.floor(i / 2));
      const at = _p.set(this.ground.x - Math.sin(a) * 5, this.ground.y, this.ground.z - Math.cos(a) * 5);
      w.summon(this.plan.squadId ?? 'bailiff', at, this.yaw);
    }
  }

  protected afterAttack(name: string) {
    // Hit and run: the Knight falls back after a cut before closing again.
    if (this.rank === 'knight' && (name === 'slash' || name === 'maul')) this.retreatT = this.cfg.retreatTime ?? 1;
  }

  protected approach(dt: number, w: EnemyWorld, dyaw: number, toYaw: number): number | null {
    if (this.retreatT > 0) {
      _v.subVectors(this.ground, w.playerPos).setY(0);
      const d = _v.length() || 1;
      this.steer(_v.x / d, _v.z / d, this.cfg.runSpeed, w, dt);
      return toYaw;
    }
    return super.approach(dt, w, dyaw, toYaw);
  }

  parried() {
    this.hideLanes();
    super.parried();
  }

  private hideLanes() {
    // (respawn runs inside the base constructor, before this class's fields exist)
    if (!this.laneKeys) return;
    for (const k of this.laneKeys) this.hazards?.hideLane(k);
  }

  protected special(_name: string, a: AttackTune, tl: TimelinePoint, prev: TimelinePoint | null, dt: number, w: EnemyWorld, toYaw: number): number | null {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const starting = prev?.phase !== tl.phase || prev.hit !== tl.hit;
    if (a.kind === 'charge') {
      if (tl.phase === 'windup') {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        // The lane shows exactly where it will run; the aim locks for the last third.
        const want = (a.speed ?? 18) * a.active;
        _dir.set(fx, 0, fz);
        const hit = w.physics.raycast(_p.copy(this.center), _dir, want, SOLID);
        w.hazards.lane(this.laneKeys[0], this.ground, this.yaw, hit ? hit.distance : want, this.radius * 2.6, tl.k);
        return tl.k < 0.7 ? toYaw : null;
      }
      if (tl.phase === 'active') {
        if (starting) {
          w.hazards.hideLane(this.laneKeys[0]);
          w.sound('charge', this.center);
        }
        this.vel.set(fx, 0, fz).multiplyScalar(a.speed ?? 18);
        _v.subVectors(w.playerPos, this.ground);
        if (!this.dealt.has(tl.hit) && Math.hypot(_v.x, _v.z) < this.radius + 0.9 && Math.abs(_v.y) < 1.6) {
          this.dealt.add(tl.hit);
          // The Knight of Pentacles' charge pins you instead (the Devil's binding: one roll breaks it).
          if (a.binds && w.bindPlayer) w.bindPlayer(a.delay ?? 1.4, a.damage, a.knockback, this.center, this);
          else w.hurtPlayer(a.damage, this.center, a.knockback, this);
          w.shake(0.4, this.center);
        }
        return null;
      }
      this.vel.multiplyScalar(Math.exp(-6 * dt));
      return null;
    }
    if (a.kind === 'volley') {
      const lanes = a.lanes ?? 7;
      if (tl.phase === 'windup') {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        if (tl.hit === 0 && starting) this.gapIdx = 1 + Math.floor(this.rng() * (lanes - 2));
        const offs = volleyOffsets(lanes, a.spacing ?? 1.7, this.gapIdx, tl.mirrored);
        offs.forEach((o, i) => {
          _p.set(this.ground.x - fz * o, this.ground.y, this.ground.z + fx * o);
          w.hazards.lane(this.laneKeys[i], _p, this.yaw, a.range * 0.8, 0.55, tl.k);
        });
        // She keeps her aim until the lines are drawn.
        return tl.k < 0.6 ? toYaw : null;
      }
      if (tl.phase === 'active' && starting) {
        this.hideLanes();
        const offs = volleyOffsets(lanes, a.spacing ?? 1.7, this.gapIdx, tl.mirrored);
        for (const o of offs) {
          _p.set(this.ground.x - fz * o, this.ground.y + 1.2, this.ground.z + fx * o);
          _dir.set(fx, 0, fz).multiplyScalar(a.speed ?? 17);
          w.hazards.knife(_p, _dir, a.damage, a.knockback);
        }
        w.sound('lunge', this.center);
      }
      this.vel.multiplyScalar(Math.exp(-8 * dt));
      return null;
    }
    if (a.kind === 'verdict') {
      if (tl.phase === 'windup') {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        return toYaw;
      }
      if (tl.phase === 'active' && starting) {
        // Where you stand, where you're heading, and the mirror of that across his line to you: answer in kind.
        const p = w.playerPos;
        const zones: [number, number][] = [[p.x, p.z]];
        if ((a.count ?? 1) > 1) {
          const lead = 0.9;
          const ax = p.x + w.playerVel.x * lead;
          const az = p.z + w.playerVel.z * lead;
          zones.push([ax, az]);
          // Mirror the lead point across the line from the King to the player.
          const lx = p.x - this.ground.x;
          const lz = p.z - this.ground.z;
          const ll = Math.hypot(lx, lz) || 1;
          const ux = lx / ll;
          const uz = lz / ll;
          const rx = ax - this.ground.x;
          const rz = az - this.ground.z;
          const along = rx * ux + rz * uz;
          zones.push([this.ground.x + 2 * along * ux - rx, this.ground.z + 2 * along * uz - rz]);
          // A still target gets a spread instead of three stacked rings.
          if (Math.hypot(w.playerVel.x, w.playerVel.z) < 0.5) {
            zones[1] = [p.x - uz * 3.2, p.z + ux * 3.2];
            zones[2] = [p.x + uz * 3.2, p.z - ux * 3.2];
          }
        }
        // A coin rain leaves coin where it falls: tempting, and heavy.
        const coins = a.coins ?? 0;
        const opts = coins > 0 && w.dropCoins ? { onDone: (_caught: boolean, at: THREE.Vector3) => w.dropCoins!(at, coins) } : {};
        for (const [x, z] of zones) {
          w.hazards.verdict(_p.set(x, p.y, z), a.radius ?? 2.4, a.delay ?? 1.6, a.damage, a.knockback, opts);
          const e = this.echo(x, z);
          if (e) w.hazards.verdict(_p.set(e[0], p.y, e[1]), a.radius ?? 2.4, a.delay ?? 1.6, a.damage, a.knockback, opts);
        }
      }
      return null;
    }
    if (a.kind === 'sow' || a.kind === 'shackle') {
      if (tl.phase === 'windup') {
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        return toYaw;
      }
      if (tl.phase === 'active' && starting) {
        const p = w.playerPos;
        const n = a.count ?? 1;
        // Shackles close where you stand (and, from phase 2, either side); seeds fall in a ring around you, so
        // trampling one means choosing where to go.
        for (let i = 0; i < n; i++) {
          let x = p.x;
          let z = p.z;
          if (a.kind === 'sow' || i > 0) {
            const ang = this.rng() * Math.PI * 2 * (a.kind === 'sow' ? 1 : 0) + (i / n) * Math.PI * 2;
            const r = a.kind === 'sow' ? 3.5 + this.rng() * 3 : 3.4;
            x += Math.cos(ang) * r;
            z += Math.sin(ang) * r;
          }
          if (a.kind === 'shackle') w.hazards.verdict(_p.set(x, p.y, z), a.radius ?? 2, a.delay ?? 1.4, a.damage, a.knockback, { kind: 'shackle', bindTime: 1.5 });
          else {
            const spawn = a.spawn ?? 'imp';
            const yaw = this.yaw;
            w.hazards.verdict(_p.set(x, p.y, z), a.radius ?? 1.4, a.delay ?? 2.6, 0, 0, {
              kind: 'seed',
              onDone: (crushed, at) => {
                if (!crushed && this.alive) w.summon(spawn, at, yaw);
              },
            });
          }
        }
        w.sound(a.kind === 'sow' ? 'coinJingle' : 'chainRattle', this.center);
      }
      this.vel.multiplyScalar(Math.exp(-8 * dt));
      return null;
    }
    return null;
  }

  dispose() {
    this.hideLanes();
    super.dispose();
  }
}

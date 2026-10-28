// The Tower's enemies (DESIGN.md → The Tower × Wands; V2-12). The Tower's rule is collapse, and its commons feed
// it: the Firebrand lobs fire onto the timber, the Faller drops out of the storm (its magenta shadow grows where it
// will land), the Builder throws up barricades, and the Page of Wands lights a signal fire that calls more of them
// unless you stop it first. The Queen of Wands' black cat is a common too.
//
// Poses use the body space of foes.ts (origin at the chest, x right, y up, forward -Z, metres for a 1.6 m body).
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { merge, meshOf, place, toonMat } from '../render/geo';
import { TOWER_FOES as T } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import type { EnemyWorld } from './enemy';
import { Foe, type FoeIdle } from './foe';
import type { AttackTune, FoeTune, TimelinePoint } from './foe-ai';
import { hunchedTorso, pose, type FoePlan } from './foes';
import { quadHead, quadSpec, quadTorso } from './moon-foes';

function torchGeo() {
  const haft = facet(new THREE.BoxGeometry(0.06, 0.06, 0.8).translate(0, 0, -0.34), T.wood, 0.04);
  const head = facet(new THREE.CylinderGeometry(0.09, 0.06, 0.2, 6).rotateX(Math.PI / 2).translate(0, 0, -0.78), T.torchHead, 0.05);
  return merge([haft, head]);
}

function hammerGeo() {
  const haft = facet(new THREE.BoxGeometry(0.05, 0.05, 0.6).translate(0, 0, -0.26), T.wood, 0.04);
  const head = facet(new THREE.BoxGeometry(0.22, 0.12, 0.12).translate(0, 0, -0.58), T.towerDark, 0.04);
  return merge([haft, head]);
}

function staffGeo() {
  const rod = facet(new THREE.BoxGeometry(0.05, 0.05, 1.4).translate(0, 0, -0.6), T.wood, 0.04);
  // The card's wand: a staff in leaf.
  const leaves = [0, 1, 2].map((i) => place(facet(new THREE.ConeGeometry(0.05, 0.14, 4), T.pageCap, 0.04), (i - 1) * 0.05, 0.04, -1.1 - i * 0.1, 0, 0, (i - 1) * 0.6));
  return merge([rod, ...leaves]);
}

function clawGeo() {
  return merge([-0.04, 0, 0.04].map((x, i) => place(facet(new THREE.BoxGeometry(0.02, 0.02, 0.14).translate(0, 0, -0.07), T.cat, 0.03), x, 0, 0, 0, (i - 1) * 0.3, 0)));
}

export const TOWER_PLANS: Record<'firebrand' | 'faller' | 'builder' | 'pageWands' | 'cat', FoePlan> = {
  firebrand: {
    id: 'firebrand',
    name: 'Firebrand',
    height: 1.7,
    radius: 0.3,
    tune: () => tuning.foes.firebrand as unknown as FoeTune,
    senses: 'sight',
    ranged: true,
    elite: false,
    shield: false,
    limb: T.firebrandHood,
    sleeve: T.firebrandCoat,
    torso: () => merge([hunchedTorso(0.2, 0.3, 0.84, T.firebrandCoat, T.firebrandHood), place(block(0.26, 0.22, 0.2, T.wood, 0.04), 0, -0.1, 0.24)]),
    head: () => facet(new THREE.ConeGeometry(0.18, 0.36, 5).translate(0, 0.08, 0), T.firebrandHood, 0.05),
    weapon: torchGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.98, 0], r: 0.28 },
      { part: 'body', at: [0, 0.6, 0], r: 0.26 },
      { part: 'weak', at: [0, 1.4, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.26, 0.05, -0.2], [-0.2, -0.1, -0.25], [1.1, 0, 0], [0, 0, 0], 0.1, 0.1),
    motions: {
      // The pot swung back and lobbed high.
      pot: {
        windup: pose([0.3, 0.1, 0.3], [-0.2, -0.1, -0.25], [-0.6, 0, 0], [0, 0, 0], 0.3, -0.15),
        active: pose([0.2, 0.55, -0.4], [-0.2, -0.1, -0.25], [1.6, 0, 0], [0, 0, 0], 0.1, 0.2),
        sound: 'windupThrow',
      },
      swipe: {
        windup: pose([0.44, 0.3, 0.05], [-0.2, -0.1, -0.25], [0.9, -1.2, 0.3], [0, 0, 0], 0.3, -0.05),
        active: pose([-0.3, -0.08, -0.45], [-0.2, -0.1, -0.25], [-0.2, 1.0, -0.3], [0, 0, 0], 0.25, 0.3),
        sound: 'windupSlash',
      },
    },
  },
  faller: {
    id: 'faller',
    name: 'Faller',
    height: 1.75,
    radius: 0.32,
    tune: () => tuning.foes.faller as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    limb: T.fallerSkin,
    sleeve: T.fallerRobe,
    // The card's falling figures: robes flung up, arms out.
    torso: () => merge([hunchedTorso(0.22, 0.34, 0.86, T.fallerRobe, T.fallerSkin), place(facet(new THREE.ConeGeometry(0.4, 0.5, 5, 1, true).rotateX(Math.PI), T.fallerRobe, 0.06), 0, 0.1, 0)]),
    head: () => facet(new THREE.IcosahedronGeometry(0.14, 1), T.fallerSkin, 0.04),
    weapon: () => block(0.08, 0.08, 0.3, T.fallerSkin, 0.03).translate(0, 0, -0.12),
    offhand: () => block(0.08, 0.08, 0.3, T.fallerSkin, 0.03).translate(0, 0, -0.12),
    dualWield: true,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.3 },
      { part: 'body', at: [0, 0.6, 0], r: 0.28 },
      { part: 'weak', at: [0, 1.44, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.3, 0.0, -0.2], [-0.3, 0.0, -0.2], [0.4, 0.2, 0], [0.4, -0.2, 0], 0.3, 0.2),
    motions: {
      grapple: {
        windup: pose([0.4, 0.3, 0.0], [-0.4, 0.3, 0.0], [1.2, 0.3, 0], [1.2, -0.3, 0], 0.35, -0.1),
        active: pose([0.18, 0.0, -0.5], [-0.18, 0.0, -0.5], [0.0, 0, 0], [0, 0, 0], 0.3, 0.45),
        sound: 'windupSlam',
      },
    },
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    height: 1.8,
    radius: 0.34,
    tune: () => tuning.foes.builder as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    limb: T.builderShirt,
    sleeve: T.builderShirt,
    torso: () => merge([hunchedTorso(0.26, 0.32, 0.82, T.builderShirt, T.builderApron), place(facet(new THREE.BoxGeometry(0.4, 0.62, 0.05), T.builderApron, 0.04), 0, -0.24, -0.27)]),
    head: () => merge([facet(new THREE.BoxGeometry(0.24, 0.24, 0.24), T.builderShirt, 0.05), place(block(0.34, 0.05, 0.34, T.builderApron, 0.03), 0, 0.12, 0)]),
    weapon: hammerGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.33 },
      { part: 'body', at: [0, 0.6, 0], r: 0.3 },
      { part: 'weak', at: [0, 1.46, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.26, -0.1, -0.22], [-0.2, -0.1, -0.24], [0.3, 0.1, 0], [0, 0, 0], 0.15, 0.15),
    motions: {
      // Hammering a barricade up between you: the hammer raised, then driven down.
      raise: {
        windup: pose([0.2, 0.6, -0.1], [-0.2, -0.1, -0.3], [2.2, 0, 0], [0, 0, 0], 0.3, -0.1),
        active: pose([0.2, -0.2, -0.5], [-0.2, -0.1, -0.3], [-0.6, 0, 0], [0, 0, 0], 0.6, 0.5),
        sound: 'windupThrust',
      },
      hammer: {
        windup: pose([0.3, 0.5, 0.0], [-0.2, -0.1, -0.24], [2.0, 0.1, 0], [0, 0, 0], 0.25, -0.1),
        active: pose([0.18, -0.2, -0.55], [-0.2, -0.1, -0.24], [-0.5, 0.05, 0], [0, 0, 0], 0.4, 0.4),
        sound: 'windupSlam',
      },
    },
  },
  pageWands: {
    id: 'pageWands',
    name: 'Page of Wands',
    height: 1.55,
    radius: 0.3,
    tune: () => tuning.foes.pageWands as unknown as FoeTune,
    senses: 'sight',
    ranged: true,
    elite: true,
    shield: false,
    limb: T.pageCap,
    sleeve: T.pageCoat,
    torso: () => merge([hunchedTorso(0.19, 0.26, 0.68, T.pageCoat, T.pageCap), place(facet(new THREE.ConeGeometry(0.32, 0.7, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.45), T.pageCap, 0.05), 0, -0.12, 0.2, -0.3, 0, 0)]),
    head: () => merge([facet(new THREE.IcosahedronGeometry(0.14, 1), T.pageCoat, 0.04), place(facet(new THREE.ConeGeometry(0.06, 0.3, 4), T.pageCap, 0.04), 0.06, 0.18, 0.04, -0.6, 0, -0.3)]),
    weapon: staffGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.92, 0], r: 0.26 },
      { part: 'body', at: [0, 0.56, 0], r: 0.24 },
      { part: 'weak', at: [0, 1.3, 0], r: 0.14 },
    ],
    weakGlow: null,
    // The staff held upright beside it, as on the card.
    ready: pose([0.22, 0.05, -0.2], [-0.2, -0.1, -0.2], [1.5, 0, 0], [0, 0, 0], 0, 0),
    motions: {
      // The signal: the staff raised high and lit (it takes a while: stop it).
      signal: {
        windup: pose([0.18, 0.7, -0.05], [-0.18, 0.6, -0.05], [2.9, 0, 0], [0, 0, 0], 0, -0.25),
        active: pose([0.2, 0.75, -0.1], [-0.2, 0.6, -0.1], [3.0, 0, 0], [0, 0, 0], 0, -0.25),
        sound: 'whistle',
      },
      pot: {
        windup: pose([0.3, 0.1, 0.3], [-0.2, -0.1, -0.25], [-0.6, 0, 0], [0, 0, 0], 0.3, -0.15),
        active: pose([0.2, 0.55, -0.4], [-0.2, -0.1, -0.25], [1.6, 0, 0], [0, 0, 0], 0.1, 0.2),
        sound: 'windupThrow',
      },
      jab: {
        windup: pose([0.32, 0.05, 0.15], [-0.2, -0.1, -0.2], [0.2, 0, 0], [0, 0, 0], 0.3, 0),
        active: pose([0.12, 0.0, -0.6], [-0.2, -0.1, -0.2], [0.0, 0, 0], [0, 0, 0], 0.2, 0.3),
        sound: 'windupThrust',
      },
    },
  },
  cat: {
    id: 'cat',
    name: 'Black Cat',
    height: 0.55,
    radius: 0.24,
    tune: () => tuning.foes.cat as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    hitAndRun: true,
    limb: T.cat,
    sleeve: T.cat,
    // A cat: low, long-tailed, its tail up.
    beast: { ...quadSpec(0.55, 0.18, 0.32, 0.028, T.cat, 0.6), tail: { base: [0, 0.08, 0.26], links: 5, length: 0.55, radius: 0.025, wag: 0.6, color: T.cat, lift: 1.1 } },
    torso: () => quadTorso(0.55, 0.18, T.cat, T.cat),
    head: () => quadHead(0.75, T.cat, T.cat, -0.2),
    weapon: () => clawGeo().translate(0, -0.05, -0.12),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.34, -0.05], r: 0.2 },
      { part: 'body', at: [0, 0.32, 0.18], r: 0.17 },
    ],
    weakGlow: null,
    ready: pose([0, 0.08, -0.1], [0, 0, 0], [0, 0, 0], [0, 0, 0], 0, 0),
    motions: {
      // Crouched low, then the spring: two quick strikes at the face.
      swipe: {
        windup: pose([0, 0.0, 0.02], [0, 0, 0], [0.3, 0.3, 0], [0, 0, 0], 0.6, -0.1),
        active: pose([0, 0.12, -0.32], [0, 0, 0], [-0.2, -0.3, 0], [0, 0, 0], 0, 0.45),
        sound: 'impChitter',
      },
    },
  },
};

const _v = new THREE.Vector3();
const _g = new THREE.Vector3();
const ZERO = new THREE.Vector3();

interface Barricade {
  mesh: THREE.Mesh;
  col: RAPIER.Collider;
  t: number;
}

/**
 * The Tower's commons with their own verbs: the Builder's barricade (a wall hammered up between you, for a while),
 * and the Page of Wands' signal fire (a long channel; finished, it calls more; staggered, it's stopped).
 */
export class TowerFoe extends Foe {
  private barricades: Barricade[] = [];
  private signalled = false;
  private static geo: THREE.BufferGeometry | null = null;
  private static mat = toonMat();

  constructor(plan: FoePlan, scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, idle: FoeIdle, rng: Rng) {
    super(plan, scene, physics, pos, yaw, idle, rng);
  }

  respawn() {
    super.respawn();
    // (respawn runs inside the base constructor, before this class's fields exist)
    if (!this.barricades) return;
    this.signalled = false;
    this.clearBarricades();
  }

  private clearBarricades() {
    for (const b of this.barricades) {
      this.scene.remove(b.mesh);
      this.physics.removeCollider(b.col);
    }
    this.barricades.length = 0;
  }

  protected wake(w: EnemyWorld) {
    super.wake(w);
    // The Page of Wands goes straight for its signal fire.
    const sig = this.cfg.attacks.signal;
    if (sig && !this.signalled && this.sees) {
      this.alerted = true;
      this.begin('signal', w);
    }
  }

  update(dt: number, w: EnemyWorld) {
    for (let i = this.barricades.length - 1; i >= 0; i--) {
      const b = this.barricades[i];
      b.t -= dt;
      if (b.t > 0) continue;
      this.scene.remove(b.mesh);
      this.physics.removeCollider(b.col);
      this.barricades.splice(i, 1);
    }
    // The signal fire burns once: after that, it's never chosen again.
    if (this.signalled) this.cooldowns.signal = 1e9;
    super.update(dt, w);
  }

  protected special(_name: string, a: AttackTune, tl: TimelinePoint, prev: TimelinePoint | null, dt: number, w: EnemyWorld, toYaw: number): number | null {
    const starting = prev?.phase !== tl.phase;
    this.vel.multiplyScalar(Math.exp(-10 * dt));
    if (tl.phase === 'windup') return a.kind === 'signal' ? null : toYaw;
    if (tl.phase !== 'active' || !starting) return null;
    if (a.kind === 'barricade') {
      // A wall between you, a few metres in front of it, across the line to you.
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const d = Math.min(3.5, Math.max(2, this.dist * 0.4));
      const x = this.ground.x + fx * d;
      const z = this.ground.z + fz * d;
      const w2 = a.radius ?? 3;
      const h = 1.7;
      if (!TowerFoe.geo) TowerFoe.geo = merge([block(1, 1, 0.3, T.wood, 0.06), place(block(1.05, 0.12, 0.34, T.towerDark, 0.04), 0, 0.85, 0), place(block(1.05, 0.12, 0.34, T.towerDark, 0.04), 0, 0.25, 0)]);
      const mesh = meshOf(TowerFoe.geo, TowerFoe.mat);
      mesh.position.set(x, this.ground.y, z);
      mesh.rotation.y = this.yaw;
      mesh.scale.set(w2, h, 1);
      this.scene.add(mesh);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const col = this.physics.addStatic(RAPIER.ColliderDesc.cuboid(w2 / 2, h / 2, 0.15).setTranslation(x, this.ground.y + h / 2, z).setRotation(q));
      this.barricades.push({ mesh, col, t: this.cfg.barricadeTime ?? 9 });
      if (this.barricades.length > 2) {
        const old = this.barricades.shift()!;
        this.scene.remove(old.mesh);
        this.physics.removeCollider(old.col);
      }
      w.sound('slamImpact', _v.set(x, this.ground.y, z));
    } else if (a.kind === 'signal') {
      // Lit: the call goes out, and more of them come.
      this.signalled = true;
      this.cooldowns.signal = 1e9;
      w.sound('courtHorn', this.center);
      w.alertNear(this.center, this.cfg.alertRadius ?? 30, w.playerPos, this);
      const n = a.count ?? 2;
      for (let i = 0; i < n; i++) {
        const ang = this.yaw + Math.PI + (i - (n - 1) / 2) * 0.9;
        w.summon(a.spawn ?? 'firebrand', _v.set(this.ground.x - Math.sin(ang) * 3, this.ground.y, this.ground.z - Math.cos(ang) * 3), this.yaw);
      }
    }
    return null;
  }

  /** Has the Page of Wands lit its fire? (tests) */
  get signalLit() {
    return this.signalled;
  }

  get barricadeCount() {
    return this.barricades.length;
  }

  dispose() {
    this.clearBarricades();
    super.dispose();
  }
}

/**
 * A Faller: perched out of sight in the storm until you come near, then it drops where you stand. Its magenta
 * shadow grows on the ground through the fall (the telegraph); it lands hard there, and then fights.
 */
export class Faller extends Foe {
  private perch: 'perched' | 'falling' | 'down' = 'perched';
  private fallT = 0;
  private readonly landing = new THREE.Vector3();
  private readonly perchAt = new THREE.Vector3();

  constructor(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, idle: FoeIdle, rng: Rng) {
    super(TOWER_PLANS.faller, scene, physics, pos, yaw, idle, rng);
    this.perchAt.copy(pos);
    this.respawn();
  }

  respawn() {
    // (respawn runs inside the base constructor, before this class's fields exist)
    if (this.perchAt) this.home.copy(this.perchAt);
    super.respawn();
    if (!this.perchAt) return;
    this.perch = 'perched';
    this.fallT = 0;
    this.hide();
  }

  private hide() {
    this.collider.setEnabled(false);
    for (const h of this.hitboxes) h.col.setEnabled(false);
    this.rig.group.visible = false;
  }

  /** Perched or mid-fall: not there to be hit (for tests and the AI label). */
  get falling() {
    return this.perch !== 'down';
  }

  update(dt: number, w: EnemyWorld) {
    const c = this.cfg;
    if (this.perch === 'perched') {
      this.hide();
      const near = Math.hypot(w.playerPos.x - this.perchAt.x, w.playerPos.z - this.perchAt.z);
      if (this.alive && w.playerAlive && near < (c.triggerRadius ?? 8) && Math.abs(w.playerPos.y - this.perchAt.y) < 6) {
        this.perch = 'falling';
        this.fallT = 0;
        this.landing.copy(w.playerPos);
        w.sound('windupSlam', this.landing);
      }
      return;
    }
    if (this.perch === 'falling') {
      const T = c.fallTime ?? 1.3;
      const r = c.attacks.grapple?.radius ?? 1.8;
      this.fallT += dt;
      const k = Math.min(1, this.fallT / T);
      // The shadow grows where it will land.
      w.hazards.ring(this, this.landing, r, k);
      // Seen in the last half of the fall, plummeting.
      if (k > 0.5) {
        this.rig.group.visible = true;
        _g.copy(this.landing).setY(this.landing.y + 18 * (1 - k) * (1 - k));
        this.rig.update(dt, _g, this.yaw, ZERO, this.pose, false);
      }
      if (k < 1) return;
      // Down: it lands hard, and the fight starts.
      w.hazards.hideRing(this);
      w.hazards.burst(this.landing, r);
      this.perch = 'down';
      this.home.copy(this.landing);
      this.center.set(this.landing.x, this.landing.y + this.radius + this.halfH, this.landing.z);
      this.body.setTranslation(this.center, true);
      this.body.setNextKinematicTranslation(this.center);
      this.ground.copy(this.landing);
      this.collider.setEnabled(true);
      for (const h of this.hitboxes) h.col.setEnabled(true);
      this.rig.reset(this.ground, this.yaw);
      w.sound('slamImpact', this.landing);
      w.shake(0.5, this.landing);
      const a = c.attacks.grapple;
      if (Math.hypot(w.playerPos.x - this.landing.x, w.playerPos.z - this.landing.z) <= r && Math.abs(w.playerPos.y - this.landing.y) < 1.6) w.hurtPlayer(a?.damage ?? 30, this.landing, a?.knockback ?? 8);
      w.ignite?.(this.landing, a?.ignite ?? 0);
      this.provoked = true;
      this.set('alert');
      return;
    }
    super.update(dt, w);
  }

  get label() {
    return this.perch === 'down' ? super.label : `Faller · ${this.perch}`;
  }
}

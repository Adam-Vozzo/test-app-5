// The Devil's enemies (DESIGN.md → The Devil × Pentacles; V2-9). The Miser, the Imp and the Page of Pentacles are
// the shared archetype verbs re-skinned as data (guard, hit-and-run harasser, elite herald). The Thralls carry the
// rule: a chained pair whose chain is the hazard, whose binding looks fatal but always breaks to one roll, and who
// are both freed if you shoot the chain (one flees, one fights).
//
// Poses use the same body space as foes.ts (origin at the chest, x right, y up, forward -Z, metres for a 1.6 m body).
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER, type DamageInfo, type Damageable } from '../physics/world';
import { merge, paint, place, toonMat } from '../render/geo';
import { DEVIL_FOES as D, SIGNAL } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import type { EnemyWorld } from './enemy';
import { Foe, type FoeIdle } from './foe';
import { flankPoints, segmentDistance, type AttackTune, type FoeTune, type TimelinePoint } from './foe-ai';
import { hunchedTorso, pose, swordGeo, type FoePlan } from './foes';

// ---- gear (grip at the origin, pointing along -Z)

function cudgelGeo() {
  const haft = facet(new THREE.BoxGeometry(0.06, 0.06, 0.7).translate(0, 0, -0.3), D.chestWood, 0.04);
  const head = facet(new THREE.BoxGeometry(0.14, 0.14, 0.26).translate(0, 0, -0.68), D.chestBand, 0.05);
  return merge([haft, head]);
}

/** The Miser's strongbox, hugged in front (faces -Z, held at its centre): the shield verb, re-skinned. */
function chestGeo() {
  const box = facet(new THREE.BoxGeometry(0.66, 0.5, 0.42), D.chestWood, 0.05);
  const lid = place(facet(new THREE.BoxGeometry(0.7, 0.12, 0.46), D.chestWood, 0.04), 0, 0.27, 0);
  const bands = [-0.22, 0.22].map((x) => place(block(0.06, 0.62, 0.48, D.chestBand, 0.03), x, -0.25, 0));
  const lock = place(block(0.12, 0.12, 0.04, D.chestBand, 0.03), 0, 0.12, -0.23);
  // Coins heaped over the lid: what it hugs.
  const heap = place(facet(new THREE.ConeGeometry(0.26, 0.16, 6), D.coin, 0.1), 0, 0.41, 0);
  return merge([box, lid, ...bands, lock, heap]);
}

/** Three hooked claws, fanned (the Imp's hands). */
function clawGeo() {
  return merge([-0.05, 0, 0.05].map((x, i) => place(facet(new THREE.BoxGeometry(0.025, 0.025, 0.2).translate(0, 0, -0.1), D.impHorn, 0.03), x, 0, 0, 0, (i - 1) * 0.25, 0)));
}

function purseGeo() {
  const sack = facet(new THREE.IcosahedronGeometry(0.14, 0).scale(1, 1.15, 1), D.purse, 0.06);
  const tie = place(block(0.08, 0.05, 0.08, D.pageCap, 0.03), 0, 0.15, 0);
  return merge([sack, tie]);
}

/** A manacle trailing a length of chain and an iron weight (the Thrall's flail). */
function flailGeo() {
  const cuff = facet(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 6).rotateX(Math.PI / 2), D.iron, 0.03);
  const links = [0, 1, 2, 3].map((i) => place(block(0.05, 0.05, 0.12, D.iron, 0.03), 0, 0, -0.12 - i * 0.12, 0, 0, i % 2 ? Math.PI / 2 : 0));
  const ball = place(facet(new THREE.IcosahedronGeometry(0.11, 0), D.iron, 0.05), 0, 0, -0.62);
  return merge([cuff, ...links, ball]);
}

const horns = (color: number, size: number, y: number) =>
  [-1, 1].map((s) => place(facet(new THREE.ConeGeometry(size * 0.35, size, 4).translate(0, size / 2, 0), color, 0.04), s * 0.08, y, -0.02, 0, 0, -s * 0.5));

export const DEVIL_PLANS: Record<'miser' | 'imp' | 'pagePentacles' | 'thrall', FoePlan> = {
  miser: {
    id: 'miser',
    name: 'Miser',
    height: 1.85,
    radius: 0.36,
    tune: () => tuning.foes.miser as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: true,
    limb: D.chestWood,
    sleeve: D.miserCoat,
    torso: () =>
      merge([
        hunchedTorso(0.28, 0.4, 0.82, D.miserCoat, D.chestWood),
        // A fur collar hunched up around the neck: it guards even its breath.
        place(facet(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 6), D.miserFur, 0.06), 0, 0.16, 0.02),
        // A coin bag on its back: the weak spot (get round the chest).
        place(facet(new THREE.IcosahedronGeometry(0.2, 0).scale(1, 0.9, 0.8), D.purse, 0.06), 0, -0.12, 0.3),
      ]),
    head: () =>
      merge([
        facet(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 6), D.miserFur, 0.05),
        place(facet(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 6), D.chestWood, 0.04), 0, 0.12, 0),
      ]),
    weapon: cudgelGeo,
    offhand: chestGeo,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.36 },
      { part: 'body', at: [0, 0.6, 0], r: 0.3 },
      { part: 'weak', at: [0, 1.1, 0.34], r: 0.17 },
    ],
    weakGlow: { at: [0, 1.1, 0.36], r: 0.13 },
    ready: pose([0.26, -0.12, -0.2], [-0.06, -0.1, -0.4], [0.2, 0.1, 0], [0, 0, 0], 0.25, 0.2),
    motions: {
      club: {
        windup: pose([0.3, 0.45, 0.05], [-0.06, -0.08, -0.4], [2.3, 0.1, 0], [0, 0, 0], 0.3, -0.1),
        active: pose([0.18, -0.2, -0.55], [-0.06, -0.1, -0.38], [-0.6, 0.05, 0], [0, 0, 0], 0.45, 0.4),
        sound: 'windupSlam',
      },
      shove: {
        windup: pose([0.26, -0.1, 0.02], [-0.04, -0.06, 0.02], [0.2, 0.1, 0], [0, 0, 0], 0.45, -0.1),
        active: pose([0.24, -0.1, -0.2], [-0.02, -0.02, -0.66], [0.2, 0.1, 0], [0, 0, 0], 0.2, 0.4),
        sound: 'windupThrust',
      },
    },
  },
  imp: {
    id: 'imp',
    name: 'Imp',
    height: 1.15,
    radius: 0.26,
    tune: () => tuning.foes.imp as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    hitAndRun: true,
    dualWield: true,
    limb: D.impHorn,
    sleeve: D.impSkin,
    torso: () =>
      merge([
        hunchedTorso(0.18, 0.2, 0.52, D.impSkin, D.impHorn),
        // A thin tail, up and curling: the card's figures have tails.
        place(facet(new THREE.ConeGeometry(0.04, 0.6, 4).rotateX(-1.0), D.impHorn, 0.04), 0, -0.42, 0.28),
      ]),
    head: () => merge([facet(new THREE.IcosahedronGeometry(0.15, 0).scale(1.1, 0.9, 1), D.impSkin, 0.05), ...horns(D.impHorn, 0.16, 0.08)]),
    weapon: clawGeo,
    offhand: clawGeo,
    hitboxes: [
      { part: 'body', at: [0, 0.95, 0], r: 0.3 },
      { part: 'weak', at: [0, 1.38, 0], r: 0.17 },
    ],
    weakGlow: null,
    // Crouched low, claws out: always about to dart.
    ready: pose([0.24, -0.12, -0.26], [-0.24, -0.12, -0.26], [0.2, 0.3, 0], [0.2, -0.3, 0], 0.55, 0.45),
    motions: {
      rake: {
        windup: pose([0.4, 0.22, 0.05], [-0.22, -0.1, -0.2], [0.6, -1.0, 0.3], [0.2, -0.3, 0], 0.6, 0.1),
        active: pose([-0.3, -0.1, -0.42], [-0.22, -0.12, -0.2], [-0.2, 0.9, -0.3], [0.2, -0.3, 0], 0.45, 0.5),
        sound: 'impChitter',
      },
      pounce: {
        windup: pose([0.22, 0.1, 0.1], [-0.22, 0.1, 0.1], [0.8, 0.2, 0], [0.8, -0.2, 0], 0.85, 0.2),
        active: pose([0.18, 0.0, -0.5], [-0.18, 0.0, -0.5], [-0.1, 0.1, 0], [-0.1, -0.1, 0], 0.2, 0.7),
        sound: 'impChitter',
      },
    },
  },
  pagePentacles: {
    id: 'pagePentacles',
    name: 'Page of Pentacles',
    height: 1.55,
    radius: 0.3,
    tune: () => tuning.foes.pagePentacles as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: true,
    shield: false,
    flees: true,
    limb: D.pageCap,
    sleeve: D.pageCoat,
    torso: () =>
      merge([
        hunchedTorso(0.19, 0.26, 0.68, D.pageCoat, D.pageCap),
        // A belt of small purses: it's carrying everything.
        place(block(0.44, 0.08, 0.44, D.purse, 0.04), 0, -0.36, 0),
      ]),
    head: () => merge([facet(new THREE.IcosahedronGeometry(0.14, 1), D.pageCoat, 0.04), place(facet(new THREE.CylinderGeometry(0.17, 0.12, 0.12, 6), D.pageCap, 0.04), 0, 0.12, 0, -0.2, 0, 0)]),
    weapon: () => swordGeo(0.3, 0.05),
    offhand: purseGeo,
    hitboxes: [
      { part: 'body', at: [0, 0.92, 0], r: 0.26 },
      { part: 'body', at: [0, 0.56, 0], r: 0.24 },
      { part: 'weak', at: [0, 1.3, 0], r: 0.14 },
    ],
    weakGlow: null,
    // The purse held up to its chest like the card's pentacle: it shows you what you're chasing.
    ready: pose([0.22, -0.08, -0.26], [-0.1, 0.06, -0.3], [0.5, 0.1, 0], [0, 0, 0], 0.1, 0.1),
    motions: {
      cut: {
        windup: pose([0.42, 0.3, 0.05], [-0.1, 0.06, -0.28], [0.8, -1.1, 0.3], [0, 0, 0], 0.3, -0.05),
        active: pose([-0.3, -0.08, -0.45], [-0.1, 0.06, -0.28], [-0.2, 1.0, -0.3], [0, 0, 0], 0.25, 0.3),
        sound: 'windupSlash',
      },
    },
  },
  thrall: {
    id: 'thrall',
    name: 'Thrall',
    height: 1.7,
    radius: 0.3,
    tune: () => tuning.foes.thrall as unknown as FoeTune,
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    limb: D.thrallSkin,
    sleeve: D.thrallSkin,
    torso: () =>
      merge([
        hunchedTorso(0.22, 0.28, 0.82, D.thrallRag, D.thrallSkin),
        // The iron collar the chain runs from.
        place(facet(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 8), D.iron, 0.03), 0, 0.24, 0),
      ]),
    head: () => merge([facet(new THREE.IcosahedronGeometry(0.14, 1), D.thrallSkin, 0.04), ...horns(D.thrallSkin, 0.1, 0.1)]),
    weapon: flailGeo,
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.98, 0], r: 0.3 },
      { part: 'body', at: [0, 0.6, 0], r: 0.26 },
      { part: 'weak', at: [0, 1.42, 0], r: 0.15 },
    ],
    weakGlow: null,
    ready: pose([0.26, -0.18, -0.2], [-0.24, -0.1, -0.2], [-0.8, 0.2, 0], [0, 0, 0], 0.2, 0.25),
    motions: {
      flail: {
        windup: pose([0.5, 0.3, 0.1], [-0.2, -0.05, -0.2], [0.4, -1.4, 0.3], [0, 0, 0], 0.35, -0.05),
        active: pose([-0.4, -0.05, -0.4], [-0.22, -0.1, -0.2], [0.0, 1.3, -0.3], [0, 0, 0], 0.3, 0.35),
        sound: 'chainRattle',
      },
      // Both hands on the chain at the collar, then hauled back hard: the binding.
      bind: {
        windup: pose([0.16, 0.1, -0.32], [-0.16, 0.1, -0.32], [0.3, 0, 0], [0, 0, 0], 0.45, 0.3),
        active: pose([0.2, 0.0, 0.1], [-0.2, 0.0, 0.1], [-0.4, 0, 0], [0, 0, 0], 0.6, -0.35),
        sound: 'chainRattle',
      },
    },
  },
};

const LINKS = 12;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const _tele = new THREE.Color(SIGNAL.telegraph);
const BLACK = new THREE.Color(0, 0, 0);

/**
 * The chain between a pair of Thralls: drawn link by link from collar to collar (sagging when slack, straight when
 * hauled tight), glowing magenta while they wind up a binding, and shootable along its length.
 */
export class ThrallChain implements Damageable {
  readonly group = new THREE.Group();
  /** Every link in one instanced draw. */
  private links: THREE.InstancedMesh;
  private mat = toonMat();
  private boxes: RAPIER.Collider[] = [];
  health = 0;
  intact = true;
  /** Set when shot through this frame (the lead Thrall handles the consequences in its update). */
  broke = false;
  /** 0..1: magenta during a binding's wind-up (the telegraph). */
  glow = 0;
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private physics: Physics,
  ) {
    this.links = new THREE.InstancedMesh(paint(new THREE.BoxGeometry(0.07, 0.07, 1), D.iron), this.mat, LINKS);
    this.links.castShadow = true;
    this.links.frustumCulled = false;
    this.group.add(this.links);
    scene.add(this.group);
    for (let i = 0; i < 4; i++) this.boxes.push(physics.addHitbox(RAPIER.ColliderDesc.ball(0.3), { part: 'body', owner: this }));
    this.restore();
  }

  get alive() {
    return this.intact;
  }

  restore() {
    this.health = (tuning.foes.thrall as unknown as FoeTune).chainHealth ?? 40;
    this.intact = true;
    this.broke = false;
    this.glow = 0;
    this.group.visible = true;
    for (const c of this.boxes) c.setEnabled(true);
  }

  drop() {
    this.intact = false;
    this.group.visible = false;
    for (const c of this.boxes) c.setEnabled(false);
  }

  takeDamage(info: DamageInfo): boolean {
    if (!this.intact) return false;
    this.health -= info.amount;
    if (this.health > 0) return false;
    this.drop();
    this.broke = true;
    return true;
  }

  /** Lay the links from `a` to `b`, sagging by `slack` metres at the middle. */
  update(a: THREE.Vector3, b: THREE.Vector3, slack: number) {
    this.a.copy(a);
    this.b.copy(b);
    if (!this.intact) return;
    // (a and b may be the caller's scratch vectors: read the copies.)
    const A = this.a;
    const B = this.b;
    const pt = (t: number, out: THREE.Vector3) => out.lerpVectors(A, B, t).setY(A.y + (B.y - A.y) * t - slack * 4 * t * (1 - t));
    for (let i = 0; i < LINKS; i++) {
      pt(i / LINKS, _a);
      pt((i + 1) / LINKS, _b);
      _p.subVectors(_b, _a);
      const len = _p.length();
      _q.setFromUnitVectors(_z, _p.divideScalar(Math.max(1e-4, len)));
      // Alternate links turn a quarter about the chain's line.
      if (i % 2) _q.multiply(_qz);
      _m.compose(_c.lerpVectors(_a, _b, 0.5), _q, _s.set(1, 1, len * 1.15));
      this.links.setMatrixAt(i, _m);
    }
    this.links.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.boxes.length; i++) this.boxes[i].setTranslation(pt((i + 0.5) / this.boxes.length, _a));
    this.mat.emissive.copy(BLACK).lerp(_tele, this.glow);
  }

  dispose() {
    this.scene.remove(this.group);
    this.mat.dispose();
    this.links.geometry.dispose();
    this.links.dispose();
    for (const c of this.boxes) this.physics.removeCollider(c);
  }
}

export type ThrallRole = 'chained' | 'fight' | 'flee';

/**
 * One of a chained pair. The lead owns the chain and decides the binding; both run to either side of you and haul
 * it tight. Shoot the chain and both go free: the nearer turns on you, faster; the other runs and is gone. Kill one
 * and the other drags the chain on alone.
 */
export class Thrall extends Foe {
  partner: Thrall | null = null;
  chain: ThrallChain | null = null;
  role: ThrallRole = 'chained';
  private fleeT = 0;
  private gone = false;
  private bindReady = 0;
  private boosted: FoeTune | null = null;

  constructor(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, idle: FoeIdle, rng: Rng) {
    super(DEVIL_PLANS.thrall, scene, physics, pos, yaw, idle, rng);
  }

  /** Make `a` (the lead, owning the chain) and `b` a chained pair. */
  static link(a: Thrall, b: Thrall, scene: THREE.Scene, physics: Physics) {
    a.partner = b;
    b.partner = a;
    a.chain = new ThrallChain(scene, physics);
  }

  get lead() {
    return !!this.chain;
  }

  /** The chain as seen from either end (the lead holds it). */
  private get link(): ThrallChain | null {
    return this.chain ?? this.partner?.chain ?? null;
  }

  get chained() {
    return this.role === 'chained' && !!this.link?.intact && !!this.partner?.alive;
  }

  get cfg(): FoeTune {
    const base = super.cfg;
    if (this.role !== 'fight') return base;
    const k = base.rage ?? 1.3;
    if (!this.boosted || this.boosted.health !== base.health) this.boosted = { ...base, speed: base.speed * k, runSpeed: base.runSpeed * k, accel: base.accel * k };
    return this.boosted;
  }

  /** A freed Thrall that ran is gone for good this life (no reward: it simply walked away). */
  get alive() {
    return super.alive && !this.gone;
  }

  respawn() {
    // (respawn runs inside the base constructor, before this class's fields exist)
    this.role = 'chained';
    this.fleeT = 0;
    this.gone = false;
    this.bindReady = 1.5;
    this.boosted = null;
    super.respawn();
    this.chain?.restore();
  }

  despawn() {
    super.despawn();
    this.chain?.drop();
  }

  protected die() {
    super.die();
    // The survivor drags the chain on alone.
    this.link?.drop();
  }

  update(dt: number, w: EnemyWorld) {
    // The binding is a pair's verb, started below, never picked on its own.
    this.cooldowns.bind = 99;
    this.bindReady = Math.max(0, this.bindReady - dt);
    const chain = this.chain;
    if (chain?.broke) {
      chain.broke = false;
      this.free(w);
    }
    if (this.gone) return;
    if (this.role === 'flee' && this.alive) {
      this.fleeT += dt;
      if (this.fleeT > (super.cfg.fleeTime ?? 3)) {
        // It ran into the fog: gone (no reward; resting brings the pair back).
        this.gone = true;
        this.state = 'dead';
        this.collider.setEnabled(false);
        for (const h of this.hitboxes) h.col.setEnabled(false);
        this.rig.group.visible = false;
        return;
      }
    }
    // The chain can't stretch: a pair that strays too far apart is dragged back together.
    const p = this.partner;
    if (this.chained && p) {
      const L = this.cfg.chainLength ?? 6;
      _a.subVectors(p.ground, this.ground).setY(0);
      const d = _a.length();
      if (d > L) this.push.addScaledVector(_a.divideScalar(d), (d - L) * 6 * dt * 10);
    }
    super.update(dt, w);
    if (chain && p) {
      const L = this.cfg.chainLength ?? 6;
      const d = Math.hypot(p.ground.x - this.ground.x, p.ground.z - this.ground.z);
      const taut = this.state === 'attack' && this.attack === 'bind' && this.tl?.phase !== 'windup';
      chain.glow = this.state === 'attack' && this.attack === 'bind' && this.tl?.phase === 'windup' ? Math.max(0.35, this.glow) : Math.max(0, chain.glow - dt * 4);
      chain.update(_a.copy(this.rig.chest).setY(this.rig.chest.y + 0.22 * this.rig.s), _b.copy(p.rig.chest).setY(p.rig.chest.y + 0.22 * p.rig.s), taut ? 0 : Math.max(0.05, (L - d) * 0.35));
    }
  }

  /** Shot through: both are free. The nearer turns on you, faster; the other runs. */
  private free(w: EnemyWorld) {
    const p = this.partner;
    w.sound('chainBreak', this.link?.a.lerp(this.link.b, 0.5) ?? this.center);
    const mine = this.alive ? this.dist : Infinity;
    const theirs = p?.alive ? Math.hypot(w.playerPos.x - p.ground.x, w.playerPos.z - p.ground.z) : Infinity;
    const fighter = mine <= theirs ? this : p;
    for (const t of [this, p]) {
      if (!t || !t.alive) continue;
      t.endAttack();
      t.role = t === fighter ? 'fight' : 'flee';
      t.boosted = null;
      t.lastKnown.copy(w.playerPos);
      t.set('approach');
    }
  }

  protected approach(dt: number, w: EnemyWorld, dyaw: number, toYaw: number): number | null {
    if (this.role === 'flee') {
      _a.subVectors(this.ground, w.playerPos).setY(0);
      const d = _a.length() || 1;
      this.steer(_a.x / d, _a.z / d, this.cfg.runSpeed * 1.1, w, dt);
      return Math.atan2(-_a.x, -_a.z);
    }
    const p = this.partner;
    const bind = this.cfg.attacks.bind;
    if (this.lead && this.chained && p && bind && this.bindReady <= 0 && this.gap <= 0 && this.sees && this.dist <= bind.range && this.dist > 2.5 && p.state === 'approach') {
      this.bindReady = bind.cooldown;
      this.begin('bind', w);
      p.begin('bind', w);
      return toYaw;
    }
    return super.approach(dt, w, dyaw, toYaw);
  }

  protected special(name: string, a: AttackTune, tl: TimelinePoint, prev: TimelinePoint | null, dt: number, w: EnemyWorld, toYaw: number): number | null {
    if (name !== 'bind' || a.kind !== 'bind') return null;
    const p = this.partner;
    // A partner lost mid-binding (killed, or the chain shot through) ends it.
    if (!p || !this.chained) {
      this.endAttack();
      this.set('approach');
      return null;
    }
    const lead = this.lead ? this : p;
    const other = lead === this ? p : this;
    if (tl.phase === 'windup') {
      // Run to either side of you along the chain's axis, so it will snap tight across you.
      const half = (this.cfg.chainLength ?? 6) * 0.45;
      const f = flankPoints(w.playerPos.x, w.playerPos.z, lead.ground.x, lead.ground.z, other.ground.x, other.ground.z, half);
      const tx = this === lead ? f[0] : f[2];
      const tz = this === lead ? f[1] : f[3];
      _p.set(tx - this.ground.x, 0, tz - this.ground.z);
      const d = _p.length();
      // Aim locks for the last fifth: the chain comes where you were.
      const speed = tl.k < 0.8 && d > 0.3 ? this.cfg.runSpeed * 1.6 : 0;
      if (d > 1e-3) this.vel.set((_p.x / d) * speed, 0, (_p.z / d) * speed);
      return toYaw;
    }
    if (tl.phase === 'active') {
      this.vel.multiplyScalar(Math.exp(-12 * dt));
      // The lead checks the haul once: the player caught across the chain is bound.
      if (this === lead && prev?.phase === 'windup') {
        const ch = this.link!;
        w.sound('chainSnap', _p.copy(ch.a).lerp(ch.b, 0.5));
        const across = segmentDistance(w.playerPos.x, w.playerPos.z, lead.ground.x, lead.ground.z, other.ground.x, other.ground.z);
        const dy = Math.abs(w.playerPos.y - this.ground.y);
        if (across <= (a.radius ?? 0.9) && dy < 1.6) w.bindPlayer?.(a.delay ?? 1.5, a.damage, a.knockback, _p, this);
      }
      return null;
    }
    this.vel.multiplyScalar(Math.exp(-8 * dt));
    return null;
  }

  dispose() {
    super.dispose();
    this.chain?.dispose();
  }

  get label() {
    return `${super.label}${this.role !== 'chained' ? ` [${this.role}]` : this.lead ? ' [lead]' : ''}`;
  }
}

/** The pair a single 'thrall' socket becomes: two Thralls either side of it, chained. */
export function spawnThrallPair(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, idle: FoeIdle, rng: Rng): [Thrall, Thrall] {
  const half = ((tuning.foes.thrall as unknown as FoeTune).chainLength ?? 6) * 0.3;
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const a = new Thrall(scene, physics, new THREE.Vector3(pos.x + rx * half, pos.y, pos.z + rz * half), yaw, idle, rng.fork('a'));
  const b = new Thrall(scene, physics, new THREE.Vector3(pos.x - rx * half, pos.y, pos.z - rz * half), yaw, idle, rng.fork('b'));
  Thrall.link(a, b, scene, physics);
  return [a, b];
}

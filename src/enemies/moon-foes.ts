// The Moon's enemies (DESIGN.md → The Moon × Cups; V2-14). The rule is illusion, but fair, and its commons test
// reading: the Dog and the Wolf come as a pair, and when one stops to howl (a long, loud wind-up) the other is
// maddened; the Crayfish waits under the water and its ripples spread where you stand before it surges out; Phantoms
// are only ever reflections (no shadow, no footsteps); the Page of Cups pours fish from its cup, again and again,
// until you stop it.
//
// Poses use the body space of foes.ts (origin at the chest, x right, y up, forward -Z, metres for a 1.6 m body). The
// Dog and the Wolf are built like the Tower's black cat: the humanoid rig crouched low on all fours.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import type { Physics } from '../physics/world';
import { merge, place } from '../render/geo';
import { MOON, MOON_FOES as M } from '../render/palette';
import { tuning } from '../tuning';
import { block, facet } from '../world/kit';
import type { EnemyWorld, Hostile } from './enemy';
import { Foe, type FoeIdle } from './foe';
import type { AttackTune, FoeTune, TimelinePoint } from './foe-ai';
import { hunchedTorso, pose, type FoePlan } from './foes';

type MoonId = 'dog' | 'wolf' | 'crayfish' | 'phantom' | 'pageCups' | 'fish';
const tune = (id: MoonId) => () => tuning.foes[id] as unknown as FoeTune;

/** A beast's long body and tail, hung back from the chest (the rig crouches it onto all fours). */
function beastTorso(len: number, w: number, fur: number, shade: number) {
  return merge([
    facet(new THREE.BoxGeometry(w, w * 0.9, len).translate(0, -w * 0.45, len * 0.4), fur, 0.06),
    place(facet(new THREE.ConeGeometry(w * 0.16, len * 0.7, 4).rotateX(-1.1), shade, 0.04), 0, -w * 0.2, len * 0.95),
  ]);
}

/** A muzzle, ears up: the dog's pricked, the wolf's laid back. */
function beastHead(s: number, fur: number, shade: number, lay: number) {
  return merge([
    facet(new THREE.BoxGeometry(0.22 * s, 0.2 * s, 0.24 * s), fur, 0.05),
    place(facet(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.18 * s), shade, 0.04), 0, -0.04 * s, -0.18 * s),
    ...[-1, 1].map((k) => place(facet(new THREE.ConeGeometry(0.05 * s, 0.12 * s, 4), fur, 0.03), k * 0.07 * s, 0.13 * s, 0.02 * s, lay, 0, 0)),
  ]);
}

function fangGeo(c: number) {
  return merge([-0.04, 0.04].map((x) => place(facet(new THREE.ConeGeometry(0.025, 0.12, 4).rotateX(-Math.PI / 2), c, 0.02), x, 0, -0.06)));
}

/** The Page's cup: a pale chalice, a fish's head looking out of it (the card). */
function cupGeo() {
  const stem = facet(new THREE.CylinderGeometry(0.03, 0.06, 0.18, 6).translate(0, -0.09, 0), M.cup, 0.03);
  const bowl = facet(new THREE.CylinderGeometry(0.11, 0.05, 0.16, 7, 1, true).translate(0, 0.07, 0), M.cup, 0.03);
  const fish = place(facet(new THREE.ConeGeometry(0.04, 0.14, 4), M.fish, 0.03), 0.02, 0.16, 0, 0, 0, -0.4);
  return merge([stem, bowl, fish]).rotateX(-Math.PI / 2);
}

function pincerGeo() {
  return merge([
    facet(new THREE.BoxGeometry(0.1, 0.08, 0.3).translate(0, 0, -0.14), M.crayClaw, 0.04),
    place(facet(new THREE.BoxGeometry(0.04, 0.05, 0.2).translate(0, 0, -0.1), M.crayClaw, 0.03), 0.05, 0, -0.28, 0, 0.35, 0),
    place(facet(new THREE.BoxGeometry(0.04, 0.05, 0.2).translate(0, 0, -0.1), M.crayClaw, 0.03), -0.05, 0, -0.28, 0, -0.35, 0),
  ]);
}

const beastReady = pose([0.18, -0.25, -0.3], [-0.18, -0.25, -0.3], [0.2, 0.3, 0], [0.2, -0.3, 0], 0.75, 0.65);
const howlWindup = pose([0.18, -0.25, -0.2], [-0.18, -0.25, -0.2], [0.8, 0.3, 0], [0.8, -0.3, 0], 0.5, -0.4);
const howlActive = pose([0.18, -0.25, -0.2], [-0.18, -0.25, -0.2], [1.0, 0.3, 0], [1.0, -0.3, 0], 0.45, -0.55);

export const MOON_PLANS: Record<MoonId, FoePlan> = {
  dog: {
    id: 'dog',
    name: 'Dog',
    height: 1.0,
    radius: 0.26,
    tune: tune('dog'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    hitAndRun: true,
    dualWield: true,
    limb: M.dogFur,
    sleeve: M.dogFur,
    torso: () => beastTorso(0.62, 0.32, M.dogFur, M.crest),
    head: () => beastHead(1, M.dogFur, M.crest, -0.1),
    weapon: () => fangGeo(M.crest),
    offhand: () => fangGeo(M.crest),
    hitboxes: [
      { part: 'body', at: [0, 0.6, 0.2], r: 0.3 },
      { part: 'weak', at: [0, 0.8, -0.3], r: 0.14 },
    ],
    weakGlow: null,
    ready: beastReady,
    motions: {
      bite: {
        windup: pose([0.18, -0.15, -0.1], [-0.18, -0.15, -0.1], [0.5, 0.2, 0], [0.5, -0.2, 0], 0.85, 0.3),
        active: pose([0.12, -0.25, -0.55], [-0.12, -0.25, -0.55], [-0.1, 0.1, 0], [-0.1, -0.1, 0], 0.55, 0.85),
        sound: 'windupThrust',
      },
      howl: { windup: howlWindup, active: howlActive, sound: 'howl' },
    },
  },
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    height: 1.25,
    radius: 0.3,
    tune: tune('wolf'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    dualWield: true,
    limb: M.wolfFur,
    sleeve: M.wolfFur,
    torso: () => beastTorso(0.7, 0.36, M.wolfFur, M.shadowEdge),
    head: () => beastHead(1.1, M.wolfFur, M.shadowEdge, 0.5),
    weapon: () => fangGeo(M.crest),
    offhand: () => fangGeo(M.crest),
    hitboxes: [
      { part: 'body', at: [0, 0.62, 0.22], r: 0.34 },
      { part: 'weak', at: [0, 0.84, -0.32], r: 0.15 },
    ],
    weakGlow: null,
    ready: beastReady,
    motions: {
      maul: {
        windup: pose([0.3, 0.1, -0.05], [-0.18, -0.2, -0.2], [0.6, -1.0, 0.3], [0.2, -0.3, 0], 0.8, 0.2),
        active: pose([-0.2, -0.25, -0.5], [-0.18, -0.25, -0.3], [-0.2, 0.9, -0.3], [0.2, -0.3, 0], 0.6, 0.8),
        sound: 'windupSlash',
      },
      howl: { windup: howlWindup, active: howlActive, sound: 'howl' },
    },
  },
  crayfish: {
    id: 'crayfish',
    name: 'Crayfish',
    height: 1.4,
    radius: 0.42,
    tune: tune('crayfish'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: true,
    dualWield: true,
    limb: M.crayClaw,
    sleeve: M.crayShell,
    torso: () =>
      merge([
        // Shell plates over a low, broad body; the tail fans out behind (its soft spot).
        ...[0, 1, 2, 3].map((i) => place(block(0.62 - i * 0.08, 0.26, 0.2, M.crayShell, 0.05, i), 0, -0.25 + i * 0.02, 0.05 + i * 0.18)),
        place(facet(new THREE.ConeGeometry(0.28, 0.3, 5).rotateX(Math.PI / 2), M.crayClaw, 0.05), 0, -0.2, 0.86),
      ]),
    head: () =>
      merge([
        facet(new THREE.BoxGeometry(0.3, 0.16, 0.26), M.crayShell, 0.05),
        ...[-1, 1].map((k) => place(facet(new THREE.CylinderGeometry(0.008, 0.012, 0.8, 3).rotateX(-1.2), M.crayClaw, 0.02), k * 0.08, 0.08, -0.4, 0, k * 0.3, 0)),
      ]),
    weapon: pincerGeo,
    offhand: pincerGeo,
    hitboxes: [
      { part: 'armor', at: [0, 0.7, -0.15], r: 0.42 },
      { part: 'body', at: [0, 0.6, 0.35], r: 0.36 },
      { part: 'weak', at: [0, 0.55, 0.85], r: 0.2 },
    ],
    weakGlow: null,
    ready: pose([0.32, -0.1, -0.35], [-0.32, -0.1, -0.35], [0.3, 0.2, 0], [0.3, -0.2, 0], 0.6, 0.5),
    motions: {
      // Out of the water: both pincers up, then down where you stood.
      surge: {
        windup: pose([0.34, 0.4, -0.2], [-0.34, 0.4, -0.2], [1.6, 0.2, 0], [1.6, -0.2, 0], 0.3, -0.2),
        active: pose([0.2, -0.3, -0.6], [-0.2, -0.3, -0.6], [-0.6, 0.2, 0], [-0.6, -0.2, 0], 0.7, 0.6),
        sound: 'ripple',
      },
      pinch: {
        windup: pose([0.45, 0.1, -0.1], [-0.32, -0.1, -0.35], [0.6, -0.8, 0], [0.3, -0.2, 0], 0.6, 0.3),
        active: pose([0.05, -0.1, -0.6], [-0.32, -0.1, -0.35], [0.0, 0.3, 0], [0.3, -0.2, 0], 0.6, 0.6),
        sound: 'windupSlash',
      },
    },
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    height: 1.75,
    radius: 0.3,
    tune: tune('phantom'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    phantom: true,
    limb: M.phantom,
    sleeve: M.phantom,
    // The Seven of Cups' veiled figure: a shroud to the ground, arms reaching.
    torso: () => merge([hunchedTorso(0.22, 0.4, 1.0, M.phantom, M.pageCap), place(facet(new THREE.ConeGeometry(0.32, 0.5, 6, 1, true), M.phantom, 0.05), 0, 0.2, 0)]),
    head: () => facet(new THREE.ConeGeometry(0.17, 0.42, 6).translate(0, 0.1, 0), M.phantom, 0.05),
    weapon: () => block(0.06, 0.06, 0.32, M.phantom, 0.03).translate(0, 0, -0.14),
    offhand: () => block(0.06, 0.06, 0.32, M.phantom, 0.03).translate(0, 0, -0.14),
    dualWield: true,
    hitboxes: [
      { part: 'body', at: [0, 1.0, 0], r: 0.32 },
      { part: 'body', at: [0, 0.6, 0], r: 0.32 },
    ],
    weakGlow: null,
    ready: pose([0.26, 0.05, -0.3], [-0.26, 0.05, -0.3], [0.3, 0.2, 0], [0.3, -0.2, 0], 0, 0.1),
    motions: {
      reach: {
        windup: pose([0.3, 0.45, -0.05], [-0.3, 0.45, -0.05], [1.4, 0.2, 0], [1.4, -0.2, 0], 0.1, -0.2),
        active: pose([0.16, 0.0, -0.6], [-0.16, 0.0, -0.6], [0.0, 0, 0], [0, 0, 0], 0.2, 0.45),
        sound: 'windupSlash',
      },
    },
  },
  pageCups: {
    id: 'pageCups',
    name: 'Page of Cups',
    height: 1.55,
    radius: 0.3,
    tune: tune('pageCups'),
    senses: 'sight',
    ranged: true,
    elite: true,
    shield: false,
    limb: M.pageCap,
    sleeve: M.pageCoat,
    torso: () => merge([hunchedTorso(0.19, 0.26, 0.68, M.pageCoat, M.pageCap), place(facet(new THREE.ConeGeometry(0.32, 0.7, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.45), M.pageCap, 0.05), 0, -0.12, 0.2, -0.3, 0, 0)]),
    head: () => merge([facet(new THREE.IcosahedronGeometry(0.14, 1), M.pageCoat, 0.04), place(facet(new THREE.CylinderGeometry(0.15, 0.17, 0.08, 6), M.pageCap, 0.04), 0, 0.13, 0)]),
    weapon: () => block(0.05, 0.05, 0.5, M.cup, 0.03).translate(0, 0, -0.22),
    offhand: cupGeo,
    hitboxes: [
      { part: 'body', at: [0, 0.92, 0], r: 0.26 },
      { part: 'body', at: [0, 0.56, 0], r: 0.24 },
      { part: 'weak', at: [0, 1.3, 0], r: 0.14 },
    ],
    weakGlow: null,
    // The cup held out before it, as on the card.
    ready: pose([0.22, -0.05, -0.25], [-0.16, 0.12, -0.36], [0.4, 0, 0], [0, 0, 0], 0.05, 0.05),
    motions: {
      // The pour: the cup raised and tipped (a channel: stagger it to stop the fish).
      pour: {
        windup: pose([0.22, -0.05, -0.25], [-0.1, 0.55, -0.3], [0.4, 0, 0], [0.4, 0, 0.3], 0, -0.15),
        active: pose([0.22, -0.05, -0.25], [-0.12, 0.35, -0.55], [0.4, 0, 0], [-1.4, 0, 0.6], 0.1, 0.2),
        sound: 'pour',
      },
      jab: {
        windup: pose([0.32, 0.05, 0.15], [-0.16, 0.12, -0.36], [0.2, 0, 0], [0, 0, 0], 0.3, 0),
        active: pose([0.12, 0.0, -0.6], [-0.16, 0.12, -0.36], [0.0, 0, 0], [0, 0, 0], 0.2, 0.3),
        sound: 'windupThrust',
      },
    },
  },
  fish: {
    id: 'fish',
    name: 'Fish',
    height: 0.6,
    radius: 0.24,
    tune: tune('fish'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    hitAndRun: true,
    limb: M.fish,
    sleeve: M.fish,
    // Out of the cup and swimming through the fog: legs are its fins.
    torso: () =>
      merge([
        facet(new THREE.OctahedronGeometry(0.3, 0).scale(0.5, 0.7, 1.2).translate(0, -0.1, 0.1), M.fish, 0.05),
        place(facet(new THREE.ConeGeometry(0.16, 0.24, 4).rotateX(Math.PI / 2), M.fish, 0.04), 0, -0.1, 0.5),
      ]),
    head: () => facet(new THREE.OctahedronGeometry(0.1, 0), MOON.surfaces.light, 0.03),
    weapon: () => block(0.04, 0.04, 0.12, M.fish, 0.02),
    offhand: null,
    hitboxes: [{ part: 'body', at: [0, 0.45, 0], r: 0.26 }],
    weakGlow: null,
    ready: pose([0.12, -0.15, -0.2], [-0.12, -0.15, -0.2], [0, 0, 0], [0, 0, 0], 0.5, 0.4),
    motions: {
      nip: {
        windup: pose([0.12, -0.1, 0.0], [-0.12, -0.1, 0.0], [0.3, 0, 0], [0, 0, 0], 0.6, 0.1),
        active: pose([0.08, -0.15, -0.4], [-0.08, -0.15, -0.4], [0, 0, 0], [0, 0, 0], 0.4, 0.7),
        sound: 'impChitter',
      },
    },
  },
};

const _v = new THREE.Vector3();
const ZERO = new THREE.Vector3();

/**
 * The Moon's commons with their own verbs: the howl (its pair is maddened for `rageTime`) and the pour (fish from
 * the cup, a few at a time, again and again; a stagger stops it).
 */
export class MoonFoe extends Foe {
  /** Seconds left maddened by its pair's howl. */
  rageT = 0;
  private boosted: FoeTune | null = null;
  private fish: Hostile[] = [];

  constructor(plan: FoePlan, scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, idle: FoeIdle, rng: Rng) {
    super(plan, scene, physics, pos, yaw, idle, rng);
  }

  get cfg(): FoeTune {
    const base = super.cfg;
    if (!(this.rageT > 0)) return base;
    const k = base.rage ?? 1.3;
    if (!this.boosted || this.boosted.health !== base.health) {
      // Maddened: faster, and quicker to strike again.
      const attacks: Record<string, AttackTune> = {};
      for (const [n, a] of Object.entries(base.attacks)) attacks[n] = a.kind === 'howl' ? a : { ...a, cooldown: a.cooldown / k, windup: a.windup / Math.sqrt(k) };
      this.boosted = { ...base, speed: base.speed * k, runSpeed: base.runSpeed * k, accel: base.accel * k, attacks };
    }
    return this.boosted;
  }

  respawn() {
    super.respawn();
    // (respawn runs inside the base constructor, before this class's fields exist)
    this.rageT = 0;
    this.boosted = null;
    if (this.fish) this.fish.length = 0;
  }

  /** Its pair howled: maddened for a while. */
  enrage(t: number) {
    if (!this.alive) return;
    this.rageT = Math.max(this.rageT, t);
    this.boosted = null;
  }

  get maddened() {
    return this.rageT > 0;
  }

  update(dt: number, w: EnemyWorld) {
    this.rageT = Math.max(0, this.rageT - dt);
    if (this.rageT <= 0) this.boosted = null;
    // Howl only with a living partner near enough to hear it.
    if (this.cfg.attacks.howl && !this.partner(w)) this.cooldowns.howl = Math.max(this.cooldowns.howl ?? 0, 0.5);
    super.update(dt, w);
  }

  /** The other of a Dog-and-Wolf pair: the nearest living Dog or Wolf in earshot. */
  private partner(w: EnemyWorld): MoonFoe | null {
    let best: MoonFoe | null = null;
    let bd = this.cfg.attacks.howl?.range ?? 30;
    for (const e of w.enemies) {
      if (e === this || !(e instanceof MoonFoe) || !e.alive || e.illusion || (e.id !== 'dog' && e.id !== 'wolf')) continue;
      const d = e.center.distanceTo(this.center);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  protected special(_name: string, a: AttackTune, tl: TimelinePoint, prev: TimelinePoint | null, dt: number, w: EnemyWorld, toYaw: number): number | null {
    const starting = prev?.phase !== tl.phase;
    this.vel.multiplyScalar(Math.exp(-10 * dt));
    if (tl.phase === 'windup') return a.kind === 'howl' ? null : toYaw;
    if (tl.phase !== 'active' || !starting) return null;
    if (a.kind === 'howl') {
      // A reflection's howl is silent to the pack (its world summons nothing and touches nothing).
      if (this.illusion) return null;
      this.partner(w)?.enrage(this.cfg.rageTime ?? 6);
      w.shake(0.15, this.center);
    } else if (a.kind === 'spawn') {
      // The pour: fish out of the cup, never more than a shoal at once.
      this.fish = this.fish.filter((f) => f.alive);
      const n = Math.min(a.count ?? 2, 4 - this.fish.length);
      for (let i = 0; i < n; i++) {
        const ang = this.yaw + (i - (n - 1) / 2) * 0.8;
        const f = w.summon(a.spawn ?? 'fish', _v.set(this.ground.x - Math.sin(ang) * 1.6, this.ground.y, this.ground.z - Math.cos(ang) * 1.6), this.yaw);
        if (f) this.fish.push(f);
      }
    }
    return null;
  }

  get label() {
    return this.maddened ? `${super.label} · maddened` : super.label;
  }
}

/**
 * The Crayfish: under the water, unseen, until you come near. Then ripples spread where you stand (the telegraph, a
 * ring that fills) and it surges up there, pincers first; after that it fights, armoured in front, soft behind.
 */
export class Lurker extends Foe {
  private lurk: 'under' | 'rising' | 'up' = 'under';
  private riseT = 0;
  private readonly at = new THREE.Vector3();
  private readonly den = new THREE.Vector3();

  constructor(scene: THREE.Scene, physics: Physics, pos: THREE.Vector3, yaw: number, idle: FoeIdle, rng: Rng) {
    super(MOON_PLANS.crayfish, scene, physics, pos, yaw, idle, rng);
    this.den.copy(pos);
    this.respawn();
  }

  respawn() {
    // (respawn runs inside the base constructor, before this class's fields exist)
    if (this.den) this.home.copy(this.den);
    super.respawn();
    if (!this.den) return;
    this.lurk = 'under';
    this.riseT = 0;
    this.hide();
  }

  private hide() {
    this.collider.setEnabled(false);
    for (const h of this.hitboxes) h.col.setEnabled(false);
    this.rig.group.visible = false;
  }

  /** Under the water or rising: not there to be hit (for tests and the AI label). */
  get lurking() {
    return this.lurk !== 'up';
  }

  update(dt: number, w: EnemyWorld) {
    this.lastWorld = w;
    const c = this.cfg;
    if (this.lurk === 'under') {
      this.hide();
      const near = Math.hypot(w.playerPos.x - this.den.x, w.playerPos.z - this.den.z);
      if (this.alive && w.playerAlive && near < (c.triggerRadius ?? 6.5) && Math.abs(w.playerPos.y - this.den.y) < 3) {
        this.lurk = 'rising';
        this.riseT = 0;
        this.at.copy(w.playerPos);
        this.at.y = this.den.y;
        w.sound('ripple', this.at);
      }
      return;
    }
    const a = c.attacks.surge;
    const r = a?.radius ?? 2;
    if (this.lurk === 'rising') {
      const T = c.fallTime ?? 1.1;
      this.riseT += dt;
      const k = Math.min(1, this.riseT / T);
      // The ripples spread where you stood (a reflection's ripples are as real to the eye, and harmless).
      w.hazards.ring(this, this.at, r, k);
      if (k > 0.6) {
        // Its back breaks the surface before it surges.
        this.rig.group.visible = true;
        _v.copy(this.at).setY(this.at.y - 1.2 * (1 - k) / 0.4);
        this.rig.update(dt, _v, this.yaw, ZERO, this.pose, false);
      }
      if (k < 1) return;
      w.hazards.hideRing(this);
      this.lurk = 'up';
      this.home.copy(this.at);
      this.yaw = Math.atan2(-(w.playerPos.x - this.at.x), -(w.playerPos.z - this.at.z));
      this.placeAt(this.at);
      this.collider.setEnabled(true);
      for (const h of this.hitboxes) h.col.setEnabled(true);
      w.sound('splash', this.at);
      w.shake(0.4, this.at);
      if (!this.illusion && Math.hypot(w.playerPos.x - this.at.x, w.playerPos.z - this.at.z) <= r && Math.abs(w.playerPos.y - this.at.y) < 1.6) w.hurtPlayer(a?.damage ?? 26, this.at, a?.knockback ?? 9);
      this.cooldowns.surge = 1e9;
      this.provoked = true;
      this.set('alert');
      return;
    }
    // Once up, the surge is spent: it pinches.
    this.cooldowns.surge = 1e9;
    super.update(dt, w);
  }

  get label() {
    return this.lurk === 'up' ? super.label : `Crayfish · ${this.lurk}`;
  }
}

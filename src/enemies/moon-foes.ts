// The Moon's enemies (DESIGN.md → The Moon × Cups; V2-14). The rule is illusion, but fair, and its commons test
// reading: the Dog and the Wolf come as a pair, and when one stops to howl (a long, loud wind-up) the other is
// maddened; the Crayfish waits under the water and its ripples spread where you stand before it surges out; Phantoms
// are only ever reflections (no shadow, no footsteps); the Page of Cups pours fish from its cup, again and again,
// until you stop it.
//
// The Phantom and the Page are people (the humanoid rig: poses in foes.ts's body space). The Dog, the Wolf, the
// Crayfish and the fish are beasts (src/enemies/beast.ts): their own bodies in metres, and their poses move the head
// (handR) or the pincers (handR, handL) from the neck, in body space (x right, y up, -Z forward).
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
import { hunchedTorso, pose, type FoePlan, type V3 } from './foes';
import type { BeastLeg, BeastSpec } from './beast';

type MoonId = 'dog' | 'wolf' | 'crayfish' | 'phantom' | 'pageCups' | 'fish';
const tune = (id: MoonId) => () => tuning.foes[id] as unknown as FoeTune;

/** A four-legged body, centred, nose toward -Z: barrel chest, narrower loins, a ruff at the shoulders. */
export function quadTorso(len: number, w: number, fur: number, shade: number) {
  return merge([
    facet(new THREE.BoxGeometry(w, w * 1.05, len * 0.55).translate(0, 0.02, -len * 0.18), fur, 0.06),
    facet(new THREE.BoxGeometry(w * 0.82, w * 0.85, len * 0.5).translate(0, 0, len * 0.22), fur, 0.06),
    place(facet(new THREE.BoxGeometry(w * 1.1, w * 0.5, len * 0.22), shade, 0.05), 0, w * 0.3, -len * 0.35),
  ]);
}

/** A head, skull at the origin, muzzle toward -Z, ears up (pricked, or laid back by `lay`). */
export function quadHead(s: number, fur: number, shade: number, lay: number) {
  return merge([
    facet(new THREE.BoxGeometry(0.2 * s, 0.18 * s, 0.2 * s), fur, 0.05),
    place(facet(new THREE.BoxGeometry(0.11 * s, 0.1 * s, 0.2 * s), shade, 0.04), 0, -0.03 * s, -0.17 * s),
    ...[-1, 1].map((k) => place(facet(new THREE.ConeGeometry(0.05 * s, 0.12 * s, 4), fur, 0.03), k * 0.06 * s, 0.13 * s, 0.03 * s, lay, 0, 0)),
  ]);
}

/** Fangs at the front of the muzzle (the head's weapon: the bite). */
function fangGeo(c: number, s: number) {
  return merge([-0.035, 0.035].map((x) => place(facet(new THREE.ConeGeometry(0.02 * s, 0.09 * s, 4).rotateX(Math.PI), c, 0.02), x * s, -0.08 * s, -0.24 * s)));
}

/** A quadruped's legs: front pair under the shoulders (elbows back), hind pair under the hips (stifles forward). */
export function quadLegs(len: number, w: number, ride: number, r: number): BeastLeg[] {
  const leg = ride * 0.62;
  const hip = (x: number, z: number): V3 => [x, -0.1 * ride, z];
  return [
    { hip: hip(-w * 0.32, -len * 0.33), rest: [-w * 0.4, 0, -len * 0.36], upper: leg, lower: leg, knee: 'back', radius: r },
    { hip: hip(w * 0.32, -len * 0.33), rest: [w * 0.4, 0, -len * 0.36], upper: leg, lower: leg, knee: 'back', radius: r },
    { hip: hip(-w * 0.3, len * 0.33), rest: [-w * 0.4, 0, len * 0.33], upper: leg, lower: leg, knee: 'forward', radius: r * 1.1 },
    { hip: hip(w * 0.3, len * 0.33), rest: [w * 0.4, 0, len * 0.33], upper: leg, lower: leg, knee: 'forward', radius: r * 1.1 },
  ];
}

/** A trotting four-legged spec: diagonal pairs step together. */
export function quadSpec(len: number, w: number, ride: number, r: number, fur: number, wag: number, lift = -0.4): BeastSpec {
  return {
    kind: 'legged',
    legs: quadLegs(len, w, ride, r),
    groups: [
      [0, 3],
      [1, 2],
    ],
    ride,
    stepHeight: ride * 0.22,
    stepTime: 0.24,
    // A long stride, landing well ahead: short ones let the waiting pair fall so far behind that all four scrambled.
    stepThreshold: len * 0.4,
    velocityLead: 0.2,
    neck: [0, w * 0.45, -len * 0.45],
    reach: len * 0.5,
    capsuleHalf: Math.max(0.12, ride * 0.35),
    tail: { base: [0, w * 0.35, len * 0.48], links: 4, length: len * 0.55, radius: r * 0.9, wag, color: fur, lift },
  };
}

/** Beast poses: the head's offset from the neck (handR), the jaw's angles (weapon), the body's lunge (lean). */
const head = (h: V3, jaw: V3 = [0, 0, 0], lean = 0, crouch = 0) => pose(h, [0, 0, 0], jaw, [0, 0, 0], crouch, lean);

/** The Page's cup: a pale chalice, a fish's head looking out of it (the card). */
function cupGeo() {
  const stem = facet(new THREE.CylinderGeometry(0.03, 0.06, 0.18, 6).translate(0, -0.09, 0), M.cup, 0.03);
  const bowl = facet(new THREE.CylinderGeometry(0.11, 0.05, 0.16, 7, 1, true).translate(0, 0.07, 0), M.cup, 0.03);
  const fish = place(facet(new THREE.ConeGeometry(0.04, 0.14, 4), M.fish, 0.03), 0.02, 0.16, 0, 0, 0, -0.4);
  return merge([stem, bowl, fish]).rotateX(-Math.PI / 2);
}

function pincerGeo() {
  // A heavy claw, grip at the origin, pointing -Z (big: it's half the animal).
  return merge([
    facet(new THREE.BoxGeometry(0.18, 0.13, 0.5).translate(0, 0, -0.22), M.crayClaw, 0.04),
    place(facet(new THREE.BoxGeometry(0.07, 0.08, 0.34).translate(0, 0, -0.17), M.crayClaw, 0.03), 0.08, 0, -0.44, 0, 0.35, 0),
    place(facet(new THREE.BoxGeometry(0.07, 0.08, 0.34).translate(0, 0, -0.17), M.crayClaw, 0.03), -0.08, 0, -0.44, 0, -0.35, 0),
  ]);
}

/** The Crayfish's eight walking legs, four a side, knees up and out like a crab's. */
function crayLegs(): BeastLeg[] {
  const out: BeastLeg[] = [];
  for (const side of [-1, 1]) for (const z of [-0.3, -0.08, 0.14, 0.36]) out.push({ hip: [side * 0.32, -0.08, z], rest: [side * 0.95, 0, z * 1.25], upper: 0.42, lower: 0.5, knee: 'out', radius: 0.035 });
  return out;
}

export const MOON_PLANS: Record<MoonId, FoePlan> = {
  dog: {
    id: 'dog',
    name: 'Dog',
    height: 0.9,
    radius: 0.32,
    tune: tune('dog'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    hitAndRun: true,
    limb: M.dogFur,
    sleeve: M.dogFur,
    beast: quadSpec(0.85, 0.3, 0.52, 0.045, M.dogFur, 0.5),
    torso: () => quadTorso(0.85, 0.3, M.dogFur, M.crest),
    head: () => quadHead(1, M.dogFur, M.crest, -0.15),
    weapon: () => fangGeo(M.crest, 1),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.55, -0.15], r: 0.26 },
      { part: 'body', at: [0, 0.52, 0.25], r: 0.24 },
      { part: 'weak', at: [0, 0.72, -0.62], r: 0.13 },
    ],
    weakGlow: null,
    ready: head([0, 0.1, -0.14]),
    motions: {
      // Head drawn back and down, then snapped forward: the bite.
      bite: { windup: head([0, 0.02, 0.02], [0.3, 0, 0], -0.1, 0.4), active: head([0, -0.04, -0.42], [-0.3, 0, 0], 0.5), sound: 'windupThrust' },
      // Nose to the Moon.
      howl: { windup: head([0, 0.3, -0.04], [0.9, 0, 0], -0.3, 0.3), active: head([0, 0.36, -0.02], [1.1, 0, 0], -0.4, 0.4), sound: 'howl' },
    },
  },
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    height: 1.1,
    radius: 0.38,
    tune: tune('wolf'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    limb: M.wolfFur,
    sleeve: M.wolfFur,
    beast: quadSpec(1.1, 0.38, 0.66, 0.055, M.wolfFur, 0.25, -0.9),
    torso: () => quadTorso(1.1, 0.38, M.wolfFur, M.shadowEdge),
    head: () => quadHead(1.25, M.wolfFur, M.shadowEdge, 0.5),
    weapon: () => fangGeo(M.crest, 1.25),
    offhand: null,
    hitboxes: [
      { part: 'body', at: [0, 0.7, -0.2], r: 0.32 },
      { part: 'body', at: [0, 0.66, 0.3], r: 0.3 },
      { part: 'weak', at: [0, 0.9, -0.8], r: 0.15 },
    ],
    weakGlow: null,
    ready: head([0, 0.06, -0.18]),
    motions: {
      // A low lunge, the head swinging across: two bites.
      maul: { windup: head([0.12, 0.04, 0.0], [0.25, 0.4, 0], -0.15, 0.5), active: head([-0.08, -0.06, -0.5], [-0.3, -0.3, 0], 0.55), sound: 'windupSlash' },
      howl: { windup: head([0, 0.34, -0.04], [0.9, 0, 0], -0.3, 0.3), active: head([0, 0.42, -0.02], [1.1, 0, 0], -0.4, 0.4), sound: 'howl' },
    },
  },
  crayfish: {
    id: 'crayfish',
    name: 'Crayfish',
    height: 1.2,
    radius: 0.62,
    tune: tune('crayfish'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: true,
    limb: M.crayClaw,
    sleeve: M.crayShell,
    beast: {
      kind: 'legged',
      legs: crayLegs(),
      // Alternating tetrapods: front and third legs of one side step with the second and fourth of the other.
      groups: [
        [0, 2, 5, 7],
        [1, 3, 4, 6],
      ],
      ride: 0.5,
      stepHeight: 0.16,
      stepTime: 0.22,
      stepThreshold: 0.3,
      velocityLead: 0.1,
      neck: [0, 0.05, -0.55],
      reach: 1.05,
      capsuleHalf: 0.22,
      tail: { base: [0, 0.02, 0.5], links: 5, length: 1.3, radius: 0.17, wag: 0.12, color: M.crayShell, lift: 0.05 },
      arms: { shoulder: [0.28, 0.05, -0.45], upper: 0.55, fore: 0.55, radius: 0.06 },
    },
    torso: () =>
      merge([
        // The carapace: plates over a broad low body, the front armoured (the guard), a spike between the eyes.
        ...[0, 1, 2].map((i) => place(block(0.78 - i * 0.08, 0.34, 0.36, M.crayShell, 0.05, i), 0, 0.02 + i * 0.02, -0.32 + i * 0.32)),
        place(facet(new THREE.ConeGeometry(0.06, 0.3, 4).rotateX(-Math.PI / 2), M.crayClaw, 0.03), 0, 0.1, -0.62),
      ]),
    head: () =>
      merge([
        facet(new THREE.BoxGeometry(0.34, 0.16, 0.22), M.crayShell, 0.05),
        // Long feelers sweeping back over it.
        ...[-1, 1].map((k) => place(facet(new THREE.CylinderGeometry(0.008, 0.014, 1.3, 3).rotateX(-1.25), M.crayClaw, 0.02), k * 0.1, 0.12, -0.45, 0, k * 0.35, 0)),
      ]),
    weapon: pincerGeo,
    offhand: pincerGeo,
    hitboxes: [
      { part: 'armor', at: [0, 0.55, -0.45], r: 0.55 },
      { part: 'body', at: [0, 0.5, 0.15], r: 0.48 },
      // The soft tail (behind it): the weak spot.
      { part: 'weak', at: [0, 0.4, 1.0], r: 0.32 },
    ],
    weakGlow: null,
    // Pincers held out ahead (offsets from the neck): right, then left.
    ready: pose([0.38, 0.0, -0.4], [-0.38, 0.0, -0.4], [0.2, 0.15, 0], [0.2, -0.15, 0], 0, 0),
    motions: {
      // Out of the water: both pincers up, then down where you stood.
      surge: {
        windup: pose([0.45, 0.65, -0.15], [-0.45, 0.65, -0.15], [1.3, 0.2, 0], [1.3, -0.2, 0], 0.2, -0.25),
        active: pose([0.28, -0.3, -0.85], [-0.28, -0.3, -0.85], [-0.5, 0.1, 0], [-0.5, -0.1, 0], 0, 0.45),
        sound: 'ripple',
      },
      // The right claw thrown wide, then snapped shut across.
      pinch: {
        windup: pose([0.8, 0.15, -0.2], [-0.38, 0.0, -0.4], [0.3, -0.9, 0], [0.2, -0.15, 0], 0.1, 0),
        active: pose([0.05, 0.0, -0.95], [-0.38, 0.0, -0.4], [0.0, 0.4, 0], [0.2, -0.15, 0], 0, 0.35),
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
    height: 0.45,
    radius: 0.2,
    tune: tune('fish'),
    senses: 'sight',
    ranged: false,
    elite: false,
    shield: false,
    hitAndRun: true,
    limb: M.fish,
    sleeve: M.fish,
    // Out of the cup and swimming through the fog: no legs, a body that waves head to tail.
    beast: {
      kind: 'swim',
      legs: [],
      groups: [],
      ride: 0.75,
      stepHeight: 0,
      stepTime: 0.3,
      stepThreshold: 1,
      velocityLead: 0,
      neck: [0, 0, -0.18],
      reach: 0.3,
      capsuleHalf: 0.12,
      tail: { base: [0, 0, 0.22], links: 3, length: 0.4, radius: 0.07, wag: 0.55, color: M.fish, lift: 0 },
      swim: { amp: 0.5, hz: 1.8 },
    },
    torso: () =>
      merge([
        facet(new THREE.OctahedronGeometry(0.22, 0).scale(0.6, 0.85, 1.4), M.fish, 0.05),
        // Fins: one on the back, one either side.
        place(facet(new THREE.ConeGeometry(0.05, 0.16, 3), M.fish, 0.04), 0, 0.2, 0.02),
        ...[-1, 1].map((k) => place(facet(new THREE.ConeGeometry(0.04, 0.14, 3).rotateZ(k * 1.4), M.fish, 0.04), k * 0.13, -0.04, -0.04)),
      ]),
    head: () => merge([facet(new THREE.OctahedronGeometry(0.1, 0).scale(0.8, 0.8, 1.1), MOON.surfaces.light, 0.03), place(facet(new THREE.BoxGeometry(0.06, 0.03, 0.05), M.crest, 0.02), 0, -0.03, -0.09)]),
    weapon: () => facet(new THREE.BoxGeometry(0.05, 0.02, 0.04), M.crest, 0.02).translate(0, -0.04, -0.1),
    offhand: null,
    hitboxes: [{ part: 'body', at: [0, 0.75, 0], r: 0.24 }],
    weakGlow: null,
    ready: head([0, 0, -0.06]),
    motions: {
      nip: { windup: head([0, 0.04, 0.06], [0.3, 0, 0], -0.2), active: head([0, -0.02, -0.3], [-0.2, 0, 0], 0.4), sound: 'impChitter' },
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
      w.hazards.burst(this.at, r);
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

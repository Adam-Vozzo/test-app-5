// Procedural bodies for the enemies that aren't people (playtest: crouched humanoids didn't read as animals).
//   Legged (the Dog, the Wolf, the Tower's cat, the Crayfish): feet planted by raycast and stepped in gait groups
//     (a diagonal trot for four legs, alternating tetrapods for eight), two-bone IK legs with the knee bending the way
//     the animal's does, a body that rides and pitches with its feet, a head on a neck, a lagging tail.
//   Swimming (the fish poured from the Page's cup): no legs; it holds a height and its body undulates head to tail.
// Attack motions stay data: for a beast, a pose's handR is where the head (or right pincer) goes and handL the left
// pincer, in body space; lean pitches the body nose-down into a lunge and crouch lowers it.
import * as THREE from 'three';
import { selectSteps, stepArc, stepEase, type LegGaitState } from '../anim/gait';
import { solveTwoBone } from '../anim/ik';
import { clamp, damp } from '../core/math';
import type { Physics } from '../physics/world';
import { meshOf, toonMat } from '../render/geo';
import type { LimbRenderer } from '../render/limbs';
import { SIGNAL } from '../render/palette';
import type { ArmPose, FoePlan, V3 } from './foes';

/** What the Foe state machine needs from any body (the humanoid rig and the beast rig both provide it). */
export interface FoeRig {
  readonly group: THREE.Group;
  /** Size relative to a 1.6 m body (capsule and hitboxes scale by it). */
  readonly s: number;
  /** The movement capsule's half height (m). */
  readonly capsuleHalf: number;
  readonly yawQuat: THREE.Quaternion;
  /** Where its blows start from (the chest, or the neck of a beast). */
  readonly chest: THREE.Vector3;
  /** Its throwing hand, or its mouth. */
  readonly handR: THREE.Vector3;
  /** How far a blow can reach from `chest` (m). */
  readonly reach: number;
  onFootstep: (p: THREE.Vector3) => void;
  reset(root: THREE.Vector3, yaw: number): void;
  update(dt: number, root: THREE.Vector3, yaw: number, vel: THREE.Vector3, p: ArmPose, dead: boolean): void;
  setGlow(glow: number, flash: boolean): void;
  setFallDir(dir: THREE.Vector3): void;
  draw(limbs: LimbRenderer): void;
  dispose(scene: THREE.Scene): void;
}

export interface BeastLeg {
  /** Hip in body space (x right, y up, z back), m. */
  hip: V3;
  /** Resting foot, body-yaw space relative to the ground under the body, m. */
  rest: V3;
  upper: number;
  lower: number;
  /** Which way the knee bends: back (a dog's elbow and hock), forward, or up-and-out (a crustacean's). */
  knee: 'back' | 'forward' | 'out';
  radius: number;
}

export interface BeastSpec {
  kind: 'legged' | 'swim';
  legs: BeastLeg[];
  /** Legs that step together (a trot: diagonal pairs). */
  groups: number[][];
  /** Body centre above the feet (m), or above the ground for a swimmer. */
  ride: number;
  stepHeight: number;
  /** Seconds per step at a walk; quicker as it runs. */
  stepTime: number;
  stepThreshold: number;
  velocityLead: number;
  /** The neck base (body space): head offsets (a pose's handR) start here, and blows reach from it. */
  neck: V3;
  /** How far its mouth (or claw) reaches from the neck (m). */
  reach: number;
  /** The movement capsule's half height (m). */
  capsuleHalf: number;
  /** `lift`: how the tail is carried (+ up, as a cat's; - low, as a wolf's). */
  tail?: { base: V3; links: number; length: number; radius: number; wag: number; color: number; lift?: number };
  /** Pincer arms (mirrored on x): shoulder in body space, two bones (m). */
  arms?: { shoulder: V3; upper: number; fore: number; radius: number };
  /** A swimmer's body waves this much (rad) and this fast (Hz). */
  swim?: { amp: number; hz: number };
}

interface Foot {
  planted: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  pos: THREE.Vector3;
  desired: THREE.Vector3;
  stepping: boolean;
  t: number;
}

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _end = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _white = new THREE.Color(1, 1, 1);
const _black = new THREE.Color(0, 0, 0);
const _tele = new THREE.Color(SIGNAL.telegraph);

export class BeastRig implements FoeRig {
  readonly group = new THREE.Group();
  readonly s: number;
  readonly capsuleHalf: number;
  readonly reach: number;
  readonly yawQuat = new THREE.Quaternion();
  readonly bodyQuat = new THREE.Quaternion();
  /** Body centre. */
  readonly body = new THREE.Vector3();
  readonly chest = new THREE.Vector3();
  readonly handR = new THREE.Vector3();
  readonly handL = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private weapon: THREE.Mesh;
  private offhand: THREE.Mesh | null;
  private bodyMat: THREE.MeshToonMaterial;
  private gearMat: THREE.MeshToonMaterial;
  private feet: Foot[];
  private gait: LegGaitState[];
  private tail: THREE.Vector3[] = [];
  private placed = false;
  private height = 0;
  private pitch = 0;
  private time = 0;
  private deadT = 0;
  private readonly fallDir = new THREE.Vector3();
  private shoulderR = new THREE.Vector3();
  private shoulderL = new THREE.Vector3();
  private elbowR = new THREE.Vector3();
  private elbowL = new THREE.Vector3();
  onFootstep: (p: THREE.Vector3) => void = () => {};

  constructor(
    scene: THREE.Scene,
    private physics: Physics,
    readonly plan: FoePlan,
    readonly spec: BeastSpec,
  ) {
    this.s = 1;
    this.capsuleHalf = spec.capsuleHalf;
    this.reach = spec.reach;
    this.bodyMat = toonMat({ emissive: 0x000000 });
    this.gearMat = toonMat({ emissive: 0x000000 });
    this.torso = meshOf(plan.torso(), this.bodyMat);
    this.head = meshOf(plan.head(), this.bodyMat);
    this.weapon = meshOf(plan.weapon(), this.gearMat);
    this.offhand = plan.offhand ? meshOf(plan.offhand(), this.gearMat) : null;
    this.group.add(this.torso, this.head, this.weapon);
    if (this.offhand) this.group.add(this.offhand);
    scene.add(this.group);
    this.feet = spec.legs.map(() => ({ planted: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), pos: new THREE.Vector3(), desired: new THREE.Vector3(), stepping: false, t: 0 }));
    this.gait = spec.legs.map(() => ({ error: 0, stepping: false }));
    if (spec.tail) for (let i = 0; i <= spec.tail.links; i++) this.tail.push(new THREE.Vector3());
  }

  setFallDir(dir: THREE.Vector3) {
    this.fallDir.set(dir.x, 0, dir.z);
    if (this.fallDir.lengthSq() > 1e-6) this.fallDir.normalize();
  }

  reset(root: THREE.Vector3, yaw: number) {
    this.placed = false;
    this.deadT = 0;
    this.fallDir.set(0, 0, 0);
    this.group.visible = true;
    this.yawQuat.setFromAxisAngle(_up, yaw);
    for (let i = 0; i < this.feet.length; i++) {
      const f = this.feet[i];
      const r = this.spec.legs[i].rest;
      f.planted.set(r[0], 0, r[2]).applyQuaternion(this.yawQuat).add(root);
      f.planted.y = this.groundAt(f.planted.x, f.planted.z, root.y);
      f.pos.copy(f.planted);
      f.stepping = false;
    }
    this.height = root.y;
    this.pitch = 0;
    this.tail.forEach((t) => t.copy(root));
  }

  setGlow(glow: number, flash: boolean) {
    for (const m of [this.bodyMat, this.gearMat]) {
      if (flash) m.emissive.copy(_white);
      else m.emissive.copy(_black).lerp(_tele, clamp(glow, 0, 1) * (m === this.gearMat ? 1 : 0.4));
    }
  }

  private groundAt(x: number, z: number, y: number) {
    const g = this.physics.groundY(x, z, y + 1.2, 3);
    return g ? g.y : y;
  }

  /** Body space (x right, y up, z back) to world. */
  private local(p: V3 | THREE.Vector3, out: THREE.Vector3) {
    const [x, y, z] = Array.isArray(p) ? p : [p.x, p.y, p.z];
    return out.set(x, y, z).applyQuaternion(this.bodyQuat).add(this.body);
  }

  update(dt: number, root: THREE.Vector3, yaw: number, vel: THREE.Vector3, p: ArmPose, dead: boolean) {
    const sp = this.spec;
    this.time += dt;
    this.yawQuat.setFromAxisAngle(_up, yaw);
    this.forward.set(0, 0, -1).applyQuaternion(this.yawQuat);
    this.right.set(1, 0, 0).applyQuaternion(this.yawQuat);
    if (!this.placed) {
      this.reset(root, yaw);
      this.placed = true;
    }
    const speed = Math.hypot(vel.x, vel.z);

    if (!dead) {
      this.deadT = 0;
      if (sp.kind === 'legged') this.stepFeet(dt, root, vel, speed);
      // Ride over the feet: height from where they're planted, pitch from front feet against back.
      let front = 0;
      let back = 0;
      let nf = 0;
      let nb = 0;
      let sum = 0;
      for (let i = 0; i < this.feet.length; i++) {
        const y = this.feet[i].planted.y;
        sum += y;
        if (sp.legs[i].hip[2] < 0) {
          front += y;
          nf++;
        } else {
          back += y;
          nb++;
        }
      }
      const base = this.feet.length ? sum / this.feet.length : root.y;
      this.height = damp(this.height, base, 14, dt);
      const span = Math.abs((sp.legs[0]?.hip[2] ?? 0) - (sp.legs[sp.legs.length - 1]?.hip[2] ?? 0)) || 1;
      const slope = nf && nb ? Math.atan2(front / nf - back / nb, span) : 0;
      this.pitch = damp(this.pitch, slope, 10, dt);
      // A swimmer holds its height above the ground and bobs.
      const bob = sp.kind === 'swim' ? Math.sin(this.time * 2.1) * 0.05 : 0;
      const ride = sp.ride * (1 - 0.4 * clamp(p.crouch, 0, 1)) + bob;
      this.body.copy(root).setY((sp.kind === 'swim' ? root.y : this.height) + ride);
      // Lean: nose down into a lunge (and forward with it).
      this.body.addScaledVector(this.forward, Math.max(0, p.lean) * 0.25);
      _e.set(this.pitch - p.lean * 0.5, 0, 0, 'YXZ');
      this.bodyQuat.copy(this.yawQuat).multiply(_q.setFromEuler(_e));
      // A swimmer's body waves side to side (the head leads, the tail follows below).
      if (sp.swim) this.bodyQuat.multiply(_q.setFromAxisAngle(_up, Math.sin(this.time * Math.PI * 2 * sp.swim.hz) * sp.swim.amp * 0.4));
    } else {
      // On its side, legs splayed, sliding a little away from the blow.
      if (this.deadT === 0 && this.fallDir.lengthSq() < 1e-6) this.fallDir.copy(this.right);
      this.deadT += dt;
      const k = stepEase(Math.min(1, this.deadT / 0.4));
      const side = Math.sign(this.fallDir.dot(this.right)) || 1;
      this.body.copy(root).setY(root.y + THREE.MathUtils.lerp(sp.ride, sp.ride * 0.45, k)).addScaledVector(this.fallDir, 0.25 * k);
      _e.set(0, 0, -side * (Math.PI / 2) * 0.9 * k, 'YXZ');
      this.bodyQuat.copy(this.yawQuat).multiply(_q.setFromEuler(_e));
      for (let i = 0; i < this.feet.length; i++) {
        const leg = sp.legs[i];
        // Feet drawn out stiff from the hips, and still.
        this.local([leg.hip[0] * 1.6, leg.hip[1] - (leg.upper + leg.lower) * 0.7, leg.hip[2] * 1.1], this.feet[i].pos);
        this.feet[i].planted.copy(this.feet[i].pos);
      }
    }

    this.local(sp.neck, this.chest);
    this.torso.position.copy(this.body);
    this.torso.quaternion.copy(this.bodyQuat);
    // The head (or right pincer) goes where the pose puts it; the jaw angle rides on the weapon pitch.
    this.local([sp.neck[0] + p.handR[0], sp.neck[1] + p.handR[1], sp.neck[2] + p.handR[2]], this.handR);
    this.local([sp.neck[0] + p.handL[0], sp.neck[1] + p.handL[1], sp.neck[2] + p.handL[2]], this.handL);
    _e.set(p.weapon[0], p.weapon[1], p.weapon[2], 'YXZ');
    if (sp.arms) {
      // Pincers: the head stays at the neck, the claws ride the arms.
      this.local(sp.neck, this.head.position);
      this.head.quaternion.copy(this.bodyQuat);
      this.local([sp.arms.shoulder[0], sp.arms.shoulder[1], sp.arms.shoulder[2]], this.shoulderR);
      this.local([-sp.arms.shoulder[0], sp.arms.shoulder[1], sp.arms.shoulder[2]], this.shoulderL);
      for (const [sh, el, h, side] of [
        [this.shoulderR, this.elbowR, this.handR, 1],
        [this.shoulderL, this.elbowL, this.handL, -1],
      ] as const) {
        _pole.copy(sh).addScaledVector(_up, 0.6).addScaledVector(this.right, side * 0.6);
        solveTwoBone(sh, h, _pole, sp.arms.upper, sp.arms.fore, el, h);
      }
      this.weapon.position.copy(this.handR);
      this.weapon.quaternion.copy(this.bodyQuat).multiply(_q.setFromEuler(_e));
      if (this.offhand) {
        this.offhand.position.copy(this.handL);
        _e.set(p.off[0], p.off[1], p.off[2], 'YXZ');
        this.offhand.quaternion.copy(this.bodyQuat).multiply(_q2.setFromEuler(_e));
      }
    } else {
      this.head.position.copy(this.handR);
      this.head.quaternion.copy(this.bodyQuat).multiply(_q.setFromEuler(_e));
      // The jaw (or fangs) rides the head.
      this.weapon.position.copy(this.handR);
      this.weapon.quaternion.copy(this.head.quaternion);
      if (this.offhand) {
        this.offhand.position.copy(this.handR);
        this.offhand.quaternion.copy(this.head.quaternion);
      }
    }
    this.updateTail(dt, speed, dead);
  }

  private stepFeet(dt: number, root: THREE.Vector3, vel: THREE.Vector3, speed: number) {
    const sp = this.spec;
    const stepDur = clamp(sp.stepTime / Math.max(0.8, speed / 2), 0.1, sp.stepTime);
    for (let i = 0; i < this.feet.length; i++) {
      const f = this.feet[i];
      const r = sp.legs[i].rest;
      f.desired.set(r[0], 0, r[2]).applyQuaternion(this.yawQuat).add(root).addScaledVector(vel, sp.velocityLead);
      f.desired.y = this.groundAt(f.desired.x, f.desired.z, root.y);
      this.gait[i].error = Math.hypot(f.planted.x - f.desired.x, f.planted.z - f.desired.z);
      this.gait[i].stepping = f.stepping;
    }
    const starts = selectSteps(this.gait, sp.groups, { threshold: speed < 0.2 ? sp.stepThreshold * 0.4 : sp.stepThreshold, panicFactor: 3, joinFraction: 0.3 });
    for (const i of starts) {
      const f = this.feet[i];
      f.stepping = true;
      f.t = 0;
      f.from.copy(f.planted);
      f.to.copy(f.desired).addScaledVector(vel, stepDur * 0.5);
      f.to.y = this.groundAt(f.to.x, f.to.z, root.y);
    }
    let landed = false;
    for (const f of this.feet) {
      if (!f.stepping) {
        f.pos.copy(f.planted);
        continue;
      }
      f.t += dt / stepDur;
      f.pos.lerpVectors(f.from, f.to, stepEase(f.t));
      f.pos.y += stepArc(f.t, sp.stepHeight);
      if (f.t >= 1) {
        f.stepping = false;
        f.planted.copy(f.to);
        f.pos.copy(f.to);
        landed = true;
      }
    }
    // One footfall per group landing (four or eight thuds a stride is noise).
    if (landed) this.onFootstep(this.body);
  }

  /** The tail: each link chases a point trailing behind the one before, wagging with speed (limp when dead). */
  private updateTail(dt: number, speed: number, dead: boolean) {
    const t = this.spec.tail;
    if (!t) return;
    const seg = t.length / t.links;
    this.local(t.base, this.tail[0]);
    const wag = dead ? 0 : Math.sin(this.time * (6 + speed * 2)) * t.wag;
    for (let i = 1; i <= t.links; i++) {
      // Back from the previous link along the body's tail direction, swinging with the wag.
      _v.set(Math.sin(wag * i), dead ? -0.85 : (t.lift ?? -0.25) * (1 + i * 0.15), 1).normalize().applyQuaternion(this.bodyQuat);
      _v2.copy(this.tail[i - 1]).addScaledVector(_v, seg);
      this.tail[i].lerp(_v2, 1 - Math.exp(-18 * dt));
      // Keep the chain at its length.
      _v.subVectors(this.tail[i], this.tail[i - 1]);
      const d = _v.length() || 1;
      this.tail[i].copy(this.tail[i - 1]).addScaledVector(_v, seg / d);
    }
  }

  draw(limbs: LimbRenderer) {
    if (!this.group.visible) return;
    const sp = this.spec;
    const color = this.plan.limb;
    const bodyUp = _v2.set(0, 1, 0).applyQuaternion(this.bodyQuat);
    for (let i = 0; i < this.feet.length; i++) {
      const leg = sp.legs[i];
      const hip = this.local(leg.hip, _v);
      const f = this.feet[i].pos;
      if (leg.knee === 'out') _pole.copy(hip).addScaledVector(bodyUp, 1.2).addScaledVector(this.right, Math.sign(leg.hip[0]) * 0.8);
      else _pole.copy(hip).addScaledVector(this.forward, leg.knee === 'forward' ? 1 : -1).addScaledVector(bodyUp, -0.2);
      solveTwoBone(hip, f, _pole, leg.upper, leg.lower, _knee, _end);
      limbs.seg(hip, _knee, leg.radius, color);
      limbs.seg(_knee, _end, leg.radius * 0.75, color);
      limbs.knob(_end, leg.radius * 0.9, color);
    }
    if (sp.arms) {
      for (const [sh, el, h] of [
        [this.shoulderR, this.elbowR, this.handR],
        [this.shoulderL, this.elbowL, this.handL],
      ]) {
        limbs.seg(sh, el, sp.arms.radius, this.plan.sleeve);
        limbs.seg(el, h, sp.arms.radius * 0.8, this.plan.sleeve);
        limbs.knob(el, sp.arms.radius * 1.1, this.plan.sleeve);
      }
    } else if (sp.kind === 'legged') {
      // The neck, from the shoulders to the head.
      limbs.seg(this.chest, this.handR, (sp.legs[0]?.radius ?? 0.05) * 1.6, this.plan.sleeve);
    }
    const t = sp.tail;
    if (t) for (let i = 1; i < this.tail.length; i++) limbs.seg(this.tail[i - 1], this.tail[i], t.radius * (1 - (i / this.tail.length) * 0.6), t.color);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}

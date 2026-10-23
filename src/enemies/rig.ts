// Multi-legged procedural rig: feet raycast to the ground and step in tripod groups with arcs, the body
// rides the plane of the feet, hit reactions are spring impulses, and on death it flips and curls its legs.
import * as THREE from 'three';
import { clamp, damp, finite, Spring3 } from '../core/math';
import { selectSteps, stepArc, stepEase, TRIPOD_GROUPS, type LegGaitState } from '../anim/gait';
import { solveTwoBone } from '../anim/ik';
import { feetPlane } from '../anim/plane';
import type { Physics } from '../physics/world';
import type { LimbRenderer } from '../render/limbs';
import { tuning } from '../tuning';

export interface LegSpec {
  /** Hip in body space (x right, y up, z back). */
  hip: [number, number, number];
  /** Resting foot in body-yaw space, relative to the ground point under the body. */
  rest: [number, number, number];
  femur: number;
  tibia: number;
}

export interface RigSpec {
  legs: LegSpec[];
  /** Body centre height above the feet plane. */
  ride: number;
  stepThreshold: number;
  stepHeight: number;
  /** Seconds per step at speed ≈ 1; scaled down as speed rises. */
  stepTime: number;
  velocityLead: number;
  limbRadius: number;
  limbColor: number;
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

export interface RigPose {
  /** Lean back / rear up (radians, nose up positive). */
  rear: number;
  /** Lower the body (0..1 of ride). */
  crouch: number;
  dead: boolean;
}

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _n = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _end = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _e = new THREE.Euler();

export class MultiLegRig {
  /** Body centre and orientation (what the body mesh and hitboxes follow). */
  readonly pos = new THREE.Vector3();
  readonly quat = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private height = 0;
  private feet: Foot[];
  private gait: LegGaitState[];
  /** Hit reactions: positional and rotational springs. */
  readonly kickPos = new Spring3(120, 9);
  readonly kickRot = new Spring3(90, 7);
  private flip = 0;
  private time = 0;
  private initialized = false;
  scale = 1;
  onStep: (p: THREE.Vector3) => void = () => {};

  constructor(
    readonly spec: RigSpec,
    private physics: Physics,
  ) {
    this.feet = spec.legs.map(() => ({
      planted: new THREE.Vector3(),
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      stepping: false,
      t: 0,
    }));
    this.gait = spec.legs.map(() => ({ error: 0, stepping: false }));
  }

  /** Teleport: replant every foot under the body. */
  reset(ground: THREE.Vector3, yaw: number) {
    this.initialized = false;
    this.flip = 0;
    this.kickPos.reset();
    this.kickRot.reset();
    this.update(0, ground, yaw, new THREE.Vector3(), { rear: 0, crouch: 0, dead: false });
  }

  get footPositions() {
    return this.feet.map((f) => f.pos);
  }

  private ground(x: number, z: number, y: number) {
    const g = this.physics.groundY(x, z, y + 1.5 * this.scale, 4 * this.scale);
    return g ? g.y : y;
  }

  /**
   * @param ground point on the ground under the body (from the mover)
   * @param vel horizontal velocity (for foot lead and step rate)
   */
  update(dt: number, ground: THREE.Vector3, yaw: number, vel: THREE.Vector3, pose: RigPose) {
    const s = this.spec;
    const k = this.scale;
    this.time += dt;
    _qYaw.setFromAxisAngle(_up, yaw);
    _fwd.set(0, 0, -1).applyQuaternion(_qYaw);
    _right.set(1, 0, 0).applyQuaternion(_qYaw);

    if (!this.initialized) {
      this.initialized = true;
      this.feet.forEach((f, i) => {
        const r = s.legs[i].rest;
        f.planted.set(r[0] * k, 0, r[2] * k).applyQuaternion(_qYaw).add(ground);
        f.planted.y = this.ground(f.planted.x, f.planted.z, ground.y);
        f.pos.copy(f.planted);
        f.stepping = false;
      });
      this.height = ground.y;
      this.up.set(0, 1, 0);
    }

    const speed = Math.hypot(vel.x, vel.z);
    if (pose.dead) {
      this.flip = Math.min(1, this.flip + dt / 0.45);
    } else {
      this.flip = 0;
      // ---- feet: tripod gait
      const stepDur = clamp(s.stepTime / Math.max(0.6, speed / k), 0.07, 0.4);
      this.feet.forEach((f, i) => {
        const r = s.legs[i].rest;
        f.desired.set(r[0] * k, 0, r[2] * k).applyQuaternion(_qYaw).add(ground).addScaledVector(vel, s.velocityLead);
        f.desired.y = this.ground(f.desired.x, f.desired.z, ground.y);
        this.gait[i].error = Math.hypot(f.planted.x - f.desired.x, f.planted.z - f.desired.z) / k;
        this.gait[i].stepping = f.stepping;
      });
      const still = speed < 0.2;
      const starts = selectSteps(this.gait, TRIPOD_GROUPS, {
        threshold: still ? s.stepThreshold * 0.4 : s.stepThreshold,
        panicFactor: 4,
        joinFraction: 0.25,
      });
      for (const i of starts) {
        const f = this.feet[i];
        f.stepping = true;
        f.t = 0;
        f.from.copy(f.planted);
        f.to.copy(f.desired).addScaledVector(vel, stepDur * 0.5);
        f.to.y = this.ground(f.to.x, f.to.z, ground.y);
      }
      for (const f of this.feet) {
        if (f.stepping) {
          f.t += dt / stepDur;
          f.pos.lerpVectors(f.from, f.to, stepEase(f.t));
          f.pos.y += stepArc(f.t, s.stepHeight * k);
          if (f.t >= 1) {
            f.stepping = false;
            f.planted.copy(f.to);
            f.pos.copy(f.to);
            this.onStep(f.pos);
          }
        } else f.pos.copy(f.planted);
      }
    }

    // ---- body follows the feet plane
    if (!pose.dead) {
      const h = feetPlane(this.feet.map((f) => f.planted), _n);
      this.height = finite(damp(this.height, h, 12, dt), ground.y);
      this.up.lerp(_n, 1 - Math.exp(-8 * dt)).normalize();
      if (!Number.isFinite(this.up.x)) this.up.set(0, 1, 0);
    }
    this.kickPos.step(dt);
    this.kickRot.step(dt);

    // Orientation: yaw forward projected onto the plane, then rear/crouch, flip and hit springs.
    const upv = _v.copy(this.up);
    const f = _v2.copy(_fwd).addScaledVector(upv, -_fwd.dot(upv)).normalize();
    const r = new THREE.Vector3().crossVectors(f, upv).normalize();
    _m.makeBasis(r, upv, f.negate());
    this.quat.setFromRotationMatrix(_m);
    const flipEase = stepEase(this.flip);
    _e.set(pose.rear + this.kickRot.x.x, this.kickRot.y.x, flipEase * Math.PI + this.kickRot.z.x, 'XYZ');
    _q.setFromEuler(_e);
    this.quat.multiply(_q);

    const ride = s.ride * k * (1 - 0.45 * clamp(pose.crouch, 0, 1));
    const hop = Math.sin(Math.PI * this.flip) * 0.6 * k;
    this.pos.copy(ground);
    this.pos.y = (pose.dead ? ground.y + 0.2 * k * flipEase + hop : this.height + ride);
    this.pos.add(_v.set(this.kickPos.x.x, this.kickPos.y.x, this.kickPos.z.x));

    if (pose.dead) {
      // Legs curl in toward the belly (now facing up) and twitch.
      const fade = Math.max(0, 1 - this.flip * 0.2);
      this.feet.forEach((ft, i) => {
        const leg = s.legs[i];
        const side = Math.sign(leg.hip[0]) || 1;
        const tw = Math.sin(this.time * 18 + i * 1.7) * 0.05 * k * fade;
        ft.pos.set(leg.hip[0] * k * 0.6 + side * 0.06 * k, -(leg.femur * 0.55) * k + tw, leg.hip[2] * k * 0.8).applyQuaternion(this.quat).add(this.pos);
      });
    }
  }

  draw(limbs: LimbRenderer) {
    const s = this.spec;
    const k = this.scale;
    const bodyUp = _v2.set(0, 1, 0).applyQuaternion(this.quat);
    this.feet.forEach((f, i) => {
      const leg = s.legs[i];
      const hip = _v.set(leg.hip[0] * k, leg.hip[1] * k, leg.hip[2] * k).applyQuaternion(this.quat).add(this.pos);
      // Insect knees: up and out.
      _pole.copy(hip).addScaledVector(bodyUp, 1.2 * k).add(_end.subVectors(hip, this.pos).setY(0).normalize().multiplyScalar(0.6 * k));
      solveTwoBone(hip, f.pos, _pole, leg.femur * k, leg.tibia * k, _knee, _end);
      limbs.seg(hip, _knee, s.limbRadius * k, s.limbColor);
      limbs.seg(_knee, _end, s.limbRadius * 0.8 * k, s.limbColor);
      limbs.knob(_knee, s.limbRadius * 1.25 * k, s.limbColor);
      limbs.knob(_end, s.limbRadius * 1.1 * k, s.limbColor);
      if (tuning.debug.showIK) {
        limbs.knob(f.planted, 0.05 * k, 0x33ff66);
        limbs.knob(f.desired, 0.04 * k, 0xffee33);
      }
    });
  }
}

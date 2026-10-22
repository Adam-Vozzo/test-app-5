// Procedural biped beetle: planted feet with arcing steps, hip bob/lean, two-bone IK arms and legs,
// head + antennae that look at the aim point. No keyframes.
import * as THREE from 'three';
import { clamp, damp, DEG, Spring3 } from '../core/math';
import { Physics } from '../physics/world';
import { merge, meshOf, paint, place, stripe, toonMat } from '../render/geo';
import { LimbRenderer } from '../render/limbs';
import { CHARACTER } from '../render/palette';
import { tuning } from '../tuning';
import { BIPED_GROUPS, selectSteps, stepArc, stepEase, type LegGaitState } from './gait';
import { solveTwoBone } from './ik';

export interface BipedInput {
  root: THREE.Vector3;
  yaw: number;
  vel: THREE.Vector3;
  accel: THREE.Vector3;
  grounded: boolean;
  rolling: boolean;
  rollT: number;
  aimPoint: THREE.Vector3;
  sprinting: boolean;
}

interface Foot {
  planted: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  pos: THREE.Vector3;
  desired: THREE.Vector3;
  stepping: boolean;
  t: number;
  side: number;
}

const THIGH = 0.23;
const SHIN = 0.24;
const UPPER_ARM = 0.2;
const FOREARM = 0.21;
const ANT1 = 0.13;
const ANT2 = 0.14;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _up = new THREE.Vector3(0, 1, 0);
const _pole = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _end = new THREE.Vector3();
const _gait: LegGaitState[] = [
  { error: 0, stepping: false },
  { error: 0, stepping: false },
];

export class Biped {
  readonly group = new THREE.Group();
  readonly torso: THREE.Mesh;
  readonly head: THREE.Mesh;
  /** World-space body frame (yaw · lean · tumble). */
  readonly bodyQuat = new THREE.Quaternion();
  readonly yawQuat = new THREE.Quaternion();
  readonly hips = new THREE.Vector3();
  readonly chest = new THREE.Vector3();
  readonly shoulderR = new THREE.Vector3();
  readonly shoulderL = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  readonly handR = new THREE.Vector3();
  readonly handL = new THREE.Vector3();
  private elbowR = new THREE.Vector3();
  private elbowL = new THREE.Vector3();
  private feet: Foot[];
  private leanPitch = 0;
  private leanRoll = 0;
  private bob = 0;
  private headYaw = 0;
  private headPitch = 0;
  private antTips = [new Spring3(120, 8), new Spring3(120, 8)];
  private antPrev = [new THREE.Vector3(), new THREE.Vector3()];
  private antPrevVel = [new THREE.Vector3(), new THREE.Vector3()];
  private wasRolling = false;
  private wasGrounded = true;
  private initialized = false;
  onFootstep: (p: THREE.Vector3) => void = () => {};
  /** Debug: targets drawn when tuning.debug.showIK. */
  readonly debugHandTargets = [new THREE.Vector3(), new THREE.Vector3()];

  constructor(
    scene: THREE.Scene,
    private physics: Physics,
  ) {
    const mat = toonMat();
    // Egg-shaped striped shell with a dark elytra seam down the back.
    const shell = stripe(new THREE.SphereGeometry(1, 18, 24).scale(0.18, 0.24, 0.16), CHARACTER.torsoA, CHARACTER.torsoB, 0.075, {
      wobble: 0.04,
      freq: 2,
    });
    const seam = paint(new THREE.BoxGeometry(0.016, 0.36, 0.02), CHARACTER.limb);
    const collar = paint(new THREE.CylinderGeometry(0.07, 0.1, 0.06, 10), CHARACTER.limb);
    this.torso = meshOf(merge([shell, place(seam, 0, 0.0, 0.155, -0.1, 0, 0), place(collar, 0, 0.23, 0)]), mat);
    const skull = paint(new THREE.SphereGeometry(0.15, 14, 10), CHARACTER.head);
    const eyeL = paint(new THREE.SphereGeometry(0.035, 8, 6), CHARACTER.eye);
    const mand = paint(new THREE.ConeGeometry(0.022, 0.07, 5), CHARACTER.limb);
    this.head = meshOf(
      merge([
        skull,
        place(eyeL, -0.07, 0.03, -0.12),
        place(eyeL.clone(), 0.07, 0.03, -0.12),
        place(mand, -0.04, -0.08, -0.12, -1.9, 0, 0.3),
        place(mand.clone(), 0.04, -0.08, -0.12, -1.9, 0, -0.3),
      ]),
      mat,
    );
    this.group.add(this.torso, this.head);
    scene.add(this.group);
    this.feet = [-1, 1].map((side) => ({
      planted: new THREE.Vector3(),
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      stepping: false,
      t: 0,
      side,
    }));
  }

  /** Planted foot positions (debug + tests). */
  get footPositions() {
    return this.feet.map((f) => f.pos);
  }

  private groundAt(x: number, z: number, fromY: number, fallbackY: number) {
    const g = this.physics.groundY(x, z, fromY + 0.9, 2.2);
    return g ? g.y : fallbackY;
  }

  /** Phase 1: body, feet and head. Call before placing the weapon. */
  updateBody(inp: BipedInput, dt: number) {
    const b = tuning.biped;
    _qYaw.setFromAxisAngle(_up, inp.yaw);
    this.yawQuat.copy(_qYaw);
    this.forward.set(0, 0, -1).applyQuaternion(_qYaw);
    this.right.set(1, 0, 0).applyQuaternion(_qYaw);

    if (!this.initialized) {
      this.initialized = true;
      for (const f of this.feet) {
        f.planted.copy(inp.root).addScaledVector(this.right, f.side * b.stanceWidth);
        f.pos.copy(f.planted);
      }
    }

    // ---- feet
    const hspeed = Math.hypot(inp.vel.x, inp.vel.z);
    const stepDur = THREE.MathUtils.lerp(b.stepDuration, b.stepDurationSprint, clamp((hspeed - tuning.player.walkSpeed) / 2.5, 0, 1));
    if (inp.rolling) {
      for (const f of this.feet) f.stepping = false;
    } else if (!inp.grounded) {
      for (const f of this.feet) {
        f.stepping = false;
        f.pos.copy(inp.root).addScaledVector(this.right, f.side * b.stanceWidth * 0.8).addScaledVector(this.forward, 0.05);
        f.pos.y += 0.06;
        f.planted.copy(f.pos);
      }
    } else {
      if (this.wasRolling || !this.wasGrounded) {
        // Re-plant after a roll or landing.
        for (const f of this.feet) {
          f.planted.copy(inp.root).addScaledVector(this.right, f.side * b.stanceWidth);
          f.planted.y = this.groundAt(f.planted.x, f.planted.z, inp.root.y, inp.root.y);
          f.pos.copy(f.planted);
          f.stepping = false;
        }
        this.onFootstep(inp.root);
      }
      const still = hspeed < 0.15;
      for (let i = 0; i < 2; i++) {
        const f = this.feet[i];
        f.desired
          .copy(inp.root)
          .addScaledVector(this.right, f.side * b.stanceWidth)
          .addScaledVector(inp.vel, b.velocityLead);
        f.desired.y = this.groundAt(f.desired.x, f.desired.z, inp.root.y, inp.root.y);
        _gait[i].error = Math.hypot(f.planted.x - f.desired.x, f.planted.z - f.desired.z) + Math.abs(f.planted.y - f.desired.y) * 0.5;
        _gait[i].stepping = f.stepping;
      }
      const starts = selectSteps(_gait, BIPED_GROUPS, {
        threshold: still ? b.stepThreshold * 0.35 : b.stepThreshold,
        panicFactor: b.panicFactor,
        joinFraction: 0.3,
      });
      for (const i of starts) {
        const f = this.feet[i];
        f.stepping = true;
        f.t = 0;
        f.from.copy(f.planted);
        // Land a little ahead so the next step isn't immediate.
        f.to.copy(f.desired).addScaledVector(inp.vel, stepDur * 0.5);
        f.to.y = this.groundAt(f.to.x, f.to.z, inp.root.y, f.desired.y);
      }
      for (const f of this.feet) {
        if (f.stepping) {
          f.t += dt / stepDur;
          const k = stepEase(f.t);
          f.pos.lerpVectors(f.from, f.to, k);
          f.pos.y += stepArc(f.t, b.stepHeight * clamp(0.5 + hspeed / 6, 0.5, 1.2));
          if (f.t >= 1) {
            f.stepping = false;
            f.planted.copy(f.to);
            f.pos.copy(f.to);
            this.onFootstep(f.pos);
          }
        } else {
          f.pos.copy(f.planted);
        }
      }
    }
    this.wasRolling = inp.rolling;
    this.wasGrounded = inp.grounded;

    // ---- hips: bob with step lift, drop toward the lower foot on uneven ground
    let lift = 0;
    for (const f of this.feet) if (f.stepping) lift = Math.max(lift, Math.sin(Math.PI * clamp(f.t, 0, 1)));
    const moving = clamp(hspeed / tuning.player.walkSpeed, 0, 1.4);
    this.bob = damp(this.bob, (lift - 0.5) * b.bobAmount * moving, 25, dt);
    const lowFoot = Math.min(this.feet[0].pos.y, this.feet[1].pos.y);
    const drop = inp.grounded && !inp.rolling ? clamp(lowFoot - inp.root.y, -0.25, 0) : 0;

    // ---- lean into velocity and acceleration (body-local)
    const fwdVel = inp.vel.dot(this.forward);
    const sideVel = inp.vel.dot(this.right);
    const fwdAcc = inp.accel.dot(this.forward);
    const sideAcc = inp.accel.dot(this.right);
    const maxLean = b.leanMaxDeg * DEG;
    const wantPitch = clamp(-(fwdVel * b.leanPerSpeed + fwdAcc * b.leanAccel), -maxLean, maxLean);
    const wantRoll = clamp(-(sideVel * b.leanPerSpeed + sideAcc * b.leanAccel), -maxLean, maxLean);
    this.leanPitch = damp(this.leanPitch, inp.rolling ? 0 : wantPitch, 10, dt);
    this.leanRoll = damp(this.leanRoll, inp.rolling ? 0 : wantRoll, 10, dt);

    // Tumble for the dodge roll: curl into a ball and flip forward.
    const tumble = inp.rolling ? -Math.PI * 2 * tuning.roll.tumbleTurns * stepEase(inp.rollT) : 0;
    _e.set(this.leanPitch + tumble, 0, this.leanRoll, 'YXZ');
    _q.setFromEuler(_e);
    this.bodyQuat.copy(_qYaw).multiply(_q);

    if (inp.rolling) {
      this.hips.copy(inp.root).addScaledVector(_up, 0.3);
    } else {
      this.hips.copy(inp.root).addScaledVector(_up, b.hipHeight + this.bob + drop);
    }
    const local = (x: number, y: number, z: number, out: THREE.Vector3) =>
      out.set(x, y, z).applyQuaternion(this.bodyQuat).add(this.hips);

    // Rolling: centre the curled body on the hips.
    const torsoY = inp.rolling ? 0.02 : 0.2;
    local(0, torsoY, 0, this.chest);
    this.torso.position.copy(this.chest);
    this.torso.quaternion.copy(this.bodyQuat);
    local(0.15, torsoY + 0.13, -0.02, this.shoulderR);
    local(-0.15, torsoY + 0.13, -0.02, this.shoulderL);

    if (inp.rolling) {
      for (const f of this.feet) local(f.side * 0.08, -0.14, -0.1, f.pos);
    }

    // ---- head looks at the aim point (clamped relative to the body)
    const neck = local(0, torsoY + 0.32, -0.02, _v);
    this.head.position.copy(neck).addScaledVector(_up, inp.rolling ? 0 : 0.06);
    if (inp.rolling) {
      this.head.quaternion.copy(this.bodyQuat);
      this.headYaw = 0;
      this.headPitch = 0;
    } else {
      _v2.subVectors(inp.aimPoint, this.head.position);
      const dYaw = Math.atan2(-_v2.x, -_v2.z) - inp.yaw;
      const relYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      const pitch = Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
      this.headYaw = damp(this.headYaw, clamp(relYaw, -75 * DEG, 75 * DEG), b.headLookRate, dt);
      this.headPitch = damp(this.headPitch, clamp(pitch, -50 * DEG, 50 * DEG), b.headLookRate, dt);
      _e.set(this.headPitch, inp.yaw + this.headYaw, 0, 'YXZ');
      this.head.quaternion.setFromEuler(_e);
    }
  }

  /** Phase 2: arm IK to the given hand targets. */
  solveArms(rightTarget: THREE.Vector3, leftTarget: THREE.Vector3) {
    this.debugHandTargets[0].copy(rightTarget);
    this.debugHandTargets[1].copy(leftTarget);
    _pole.copy(this.shoulderR).addScaledVector(this.right, 0.35).addScaledVector(_up, -0.35).addScaledVector(this.forward, -0.15);
    solveTwoBone(this.shoulderR, rightTarget, _pole, UPPER_ARM, FOREARM, this.elbowR, this.handR);
    _pole.copy(this.shoulderL).addScaledVector(this.right, -0.35).addScaledVector(_up, -0.35).addScaledVector(this.forward, -0.15);
    solveTwoBone(this.shoulderL, leftTarget, _pole, UPPER_ARM, FOREARM, this.elbowL, this.handL);
  }

  /** Phase 3: legs, antennae, and push every limb into the instanced renderer. */
  draw(limbs: LimbRenderer, dt: number) {
    const L = CHARACTER.limb;
    const b = tuning.biped;
    // Legs
    for (const f of this.feet) {
      const hip = _v.set(f.side * 0.08, -0.02, 0).applyQuaternion(this.bodyQuat).add(this.hips);
      _pole.copy(hip).addScaledVector(this.forward, 0.5).addScaledVector(this.right, f.side * 0.18);
      _v2.copy(f.pos).addScaledVector(_up, 0.03);
      solveTwoBone(hip, _v2, _pole, THIGH, SHIN, _knee, _end);
      limbs.seg(hip, _knee, 0.034, L);
      limbs.seg(_knee, _end, 0.028, L);
      limbs.knob(_knee, 0.04, L);
      _q.copy(this.yawQuat);
      limbs.knob(_end, 0.05, L, 1, 0.55, 1.5, _q);
    }
    // Arms
    limbs.seg(this.shoulderR, this.elbowR, 0.03, L);
    limbs.seg(this.elbowR, this.handR, 0.026, L);
    limbs.knob(this.elbowR, 0.036, L);
    limbs.knob(this.handR, 0.042, L);
    limbs.seg(this.shoulderL, this.elbowL, 0.03, L);
    limbs.seg(this.elbowL, this.handL, 0.026, L);
    limbs.knob(this.elbowL, 0.036, L);
    limbs.knob(this.handL, 0.042, L);
    limbs.knob(this.shoulderR, 0.04, L);
    limbs.knob(this.shoulderL, 0.04, L);

    // Antennae: base on the head, springy tips that lag head motion.
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const spring = this.antTips[i];
      spring.set(b.antennaSpring, b.antennaDamping);
      const base = _v.set(side * 0.055, 0.12, -0.05).applyQuaternion(this.head.quaternion).add(this.head.position);
      const restDir = _v2.set(side * 0.45, 1, 0.25).normalize().applyQuaternion(this.head.quaternion);
      const restTip = base.clone().addScaledVector(restDir, ANT1 + ANT2);
      if (dt > 0) {
        const vel = restTip.clone().sub(this.antPrev[i]).divideScalar(dt);
        const acc = vel.clone().sub(this.antPrevVel[i]);
        // Inertia: tip lags behind the head's acceleration.
        spring.impulse(-acc.x * 0.6, -acc.y * 0.6, -acc.z * 0.6);
        spring.step(dt);
        this.antPrevVel[i].copy(vel);
      }
      this.antPrev[i].copy(restTip);
      const off = _end.set(spring.x.x, spring.y.x, spring.z.x).clampLength(0, 0.12);
      const tip = restTip.add(off);
      const mid = base.clone().lerp(tip, 0.45).addScaledVector(restDir, 0.03).addScaledVector(this.head.getWorldDirection(_knee), 0.03);
      limbs.seg(base, mid, 0.012, L);
      limbs.seg(mid, tip, 0.01, L);
      limbs.knob(tip, 0.022, L);
    }

    if (tuning.debug.showIK) {
      for (const f of this.feet) {
        limbs.knob(f.planted, 0.05, 0x33ff66);
        limbs.knob(f.desired, 0.04, 0xffee33);
      }
      limbs.knob(this.debugHandTargets[0], 0.035, 0x33ccff);
      limbs.knob(this.debugHandTargets[1], 0.035, 0x3366ff);
    }
  }
}

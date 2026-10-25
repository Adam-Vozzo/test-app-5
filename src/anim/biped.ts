// Procedural biped: the Eight of Swords. Planted feet with arcing steps, hip bob/lean, two-bone IK arms and legs,
// a hooded head that looks at the aim point, and blindfold tails on verlet ribbons. No keyframes.
// Every length comes from BODY (src/anim/body.ts) or tuning, in metres.
import * as THREE from 'three';
import { clamp, damp, DEG, finite, safeDiv } from '../core/math';
import { Physics } from '../physics/world';
import { merge, meshOf, paint, paintBy, place, prep, toonMat } from '../render/geo';
import { LimbRenderer } from '../render/limbs';
import { PLAYER } from '../render/palette';
import { tuning } from '../tuning';
import { BODY } from './body';
import { BIPED_GROUPS, selectSteps, stepArc, stepEase, type LegGaitState } from './gait';
import { solveTwoBone } from './ik';
import { Ribbon } from './ribbon';

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
  /** Fallen onto her back. */
  dead?: boolean;
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

const B = BODY;
const TAIL_POINTS = 6;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _up = new THREE.Vector3(0, 1, 0);
const _pole = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _end = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _anchor = [0, 0, 0];
const _rest = [0, 0, 0];
const _gait: LegGaitState[] = [
  { error: 0, stepping: false },
  { error: 0, stepping: false },
];

/** Robe: a six-sided cone from the shoulders to just below the knee, darker at the hem. Chest-local. */
function robeGeo() {
  const top = B.shoulderY - B.chestY + 0.02;
  const hem = -B.chestY - 0.32;
  const h = top - hem;
  const cone = prep(new THREE.CylinderGeometry(0.17, 0.3, h, 6, 3).translate(0, hem + h / 2, 0), true);
  const robe = paintBy(cone, (p, out) => out.setHex(p.y < hem + 0.07 ? PLAYER.robeShade : PLAYER.robe));
  const cowl = paint(prep(new THREE.CylinderGeometry(0.15, 0.25, 0.13, 6).translate(0, top - 0.05, 0), true), PLAYER.cowl);
  const belt = paint(prep(new THREE.CylinderGeometry(0.235, 0.24, 0.045, 6).translate(0, -B.chestY + 0.04, 0), true), PLAYER.belt);
  const pouch = paint(new THREE.BoxGeometry(0.08, 0.1, 0.06), PLAYER.belt);
  return merge([robe, place(cowl, 0, 0, 0, 0, Math.PI / 6, 0), belt, place(pouch, B.pouch.x, -B.chestY - 0.01, B.pouch.z)]);
}

/** Hood with a dark face opening, and the blindfold pushed up onto the brow. Head-local, facing -Z. */
function hoodGeo() {
  const r = B.headR;
  const hood = paint(prep(new THREE.IcosahedronGeometry(r, 1).scale(1, 1.08, 1.12), true), PLAYER.robe);
  const peak = paint(prep(new THREE.ConeGeometry(r * 0.55, r * 1.1, 5).rotateX(-0.9), true), PLAYER.robe);
  const face = paint(new THREE.CircleGeometry(r * 0.5, 6).rotateY(Math.PI), PLAYER.face);
  const band = paint(prep(new THREE.CylinderGeometry(r * 1.02, r * 1.05, 0.055, 8, 1, true), true), PLAYER.blindfold);
  const knot = paint(new THREE.BoxGeometry(0.07, 0.05, 0.05), PLAYER.blindfold);
  return merge([
    hood,
    place(peak, 0, r * 0.55, r * 0.75),
    place(face, 0, -0.02, -r * 1.08),
    place(band, 0, r * 0.38, 0, -0.18, 0, 0),
    place(knot, 0, r * 0.45, r * 1.0),
  ]);
}

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
  /** Blindfold tails, left and right of the knot. */
  private tails: Ribbon[] = [];
  private tailsLaid = false;
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
    this.torso = meshOf(robeGeo(), mat);
    this.head = meshOf(hoodGeo(), mat);
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
    this.makeTails();
  }

  private makeTails() {
    const len = Math.max(0.1, tuning.cloth.tailLength);
    this.tails = [0, 1].map(() => new Ribbon(TAIL_POINTS, len / (TAIL_POINTS - 1)));
    this.tailsLaid = false;
  }

  /** Planted foot positions (debug + tests). */
  get footPositions() {
    return this.feet.map((f) => f.pos);
  }

  private groundAt(x: number, z: number, fromY: number, fallbackY: number) {
    const g = this.physics.groundY(x, z, fromY + 1.4, 3.5);
    return g ? g.y : fallbackY;
  }

  private local(x: number, y: number, z: number, out: THREE.Vector3) {
    return out.set(x, y, z).applyQuaternion(this.bodyQuat).add(this.hips);
  }

  /** Phase 1: body, feet and head. Call before placing the weapon. */
  updateBody(inp: BipedInput, dt: number) {
    const b = tuning.biped;
    _qYaw.setFromAxisAngle(_up, inp.yaw);
    this.yawQuat.copy(_qYaw);
    this.forward.set(0, 0, -1).applyQuaternion(_qYaw);
    this.right.set(1, 0, 0).applyQuaternion(_qYaw);

    if (inp.dead) {
      this.updateDead(inp, dt);
      return;
    }
    this.deadT = 0;

    if (!this.initialized) {
      this.initialized = true;
      for (const f of this.feet) {
        f.planted.copy(inp.root).addScaledVector(this.right, f.side * b.stanceWidth);
        f.pos.copy(f.planted);
      }
    }

    // ---- feet
    const walk = Math.max(0.1, tuning.player.walkSpeed);
    const hspeed = Math.hypot(inp.vel.x, inp.vel.z);
    const sprintBlend = clamp((hspeed - walk) / (walk * 0.83), 0, 1);
    const stepDur = Math.max(0.02, THREE.MathUtils.lerp(b.stepDuration, b.stepDurationSprint, sprintBlend));
    if (inp.rolling) {
      for (const f of this.feet) f.stepping = false;
    } else if (!inp.grounded) {
      for (const f of this.feet) {
        f.stepping = false;
        f.pos.copy(inp.root).addScaledVector(this.right, f.side * b.stanceWidth * 0.8).addScaledVector(this.forward, 0.08);
        f.pos.y += 0.1;
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
      const still = hspeed < 0.24;
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
          f.pos.y += stepArc(f.t, b.stepHeight * clamp(0.5 + hspeed / (walk * 2), 0.5, 1.2));
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
    const moving = clamp(safeDiv(hspeed, walk), 0, 1.4);
    this.bob = finite(damp(this.bob, (lift - 0.5) * b.bobAmount * moving, 25, dt));
    const lowFoot = Math.min(this.feet[0].pos.y, this.feet[1].pos.y);
    const drop = inp.grounded && !inp.rolling ? clamp(lowFoot - inp.root.y, -0.4, 0) : 0;

    // ---- lean into velocity and acceleration (body-local)
    const fwdVel = inp.vel.dot(this.forward);
    const sideVel = inp.vel.dot(this.right);
    const fwdAcc = inp.accel.dot(this.forward);
    const sideAcc = inp.accel.dot(this.right);
    const maxLean = b.leanMaxDeg * DEG;
    const wantPitch = clamp(-(fwdVel * b.leanPerSpeed + fwdAcc * b.leanAccel), -maxLean, maxLean);
    const wantRoll = clamp(-(sideVel * b.leanPerSpeed + sideAcc * b.leanAccel), -maxLean, maxLean);
    this.leanPitch = finite(damp(this.leanPitch, inp.rolling ? 0 : wantPitch, 10, dt));
    this.leanRoll = finite(damp(this.leanRoll, inp.rolling ? 0 : wantRoll, 10, dt));

    // Dodge roll: tuck and tumble forward.
    const tumble = inp.rolling ? -Math.PI * 2 * tuning.roll.tumbleTurns * stepEase(inp.rollT) : 0;
    _e.set(this.leanPitch + tumble, 0, this.leanRoll, 'YXZ');
    _q.setFromEuler(_e);
    this.bodyQuat.copy(_qYaw).multiply(_q);

    if (inp.rolling) this.hips.copy(inp.root).addScaledVector(_up, B.rollHip);
    else this.hips.copy(inp.root).addScaledVector(_up, b.hipHeight + this.bob + drop);

    // Rolling: tuck the chest down toward the hips.
    const tuck = inp.rolling ? 0.35 : 1;
    this.local(0, B.chestY * tuck, 0, this.chest);
    this.torso.position.copy(this.chest);
    this.torso.quaternion.copy(this.bodyQuat);
    this.local(B.shoulderX, B.shoulderY * tuck, -0.02, this.shoulderR);
    this.local(-B.shoulderX, B.shoulderY * tuck, -0.02, this.shoulderL);

    if (inp.rolling) {
      for (const f of this.feet) this.local(f.side * 0.12, -0.25, -0.15, f.pos);
    }

    // ---- head looks at the aim point (clamped relative to the body)
    this.local(0, B.neckY * tuck, -0.02, this.head.position);
    if (inp.rolling) {
      this.head.quaternion.copy(this.bodyQuat);
      this.headYaw = 0;
      this.headPitch = 0;
    } else {
      this.head.position.addScaledVector(_up, B.headUp);
      _v2.subVectors(inp.aimPoint, this.head.position);
      const dYaw = Math.atan2(-_v2.x, -_v2.z) - inp.yaw;
      const relYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      const pitch = Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
      this.headYaw = finite(damp(this.headYaw, clamp(relYaw, -75 * DEG, 75 * DEG), b.headLookRate, dt));
      this.headPitch = finite(damp(this.headPitch, clamp(pitch, -50 * DEG, 50 * DEG), b.headLookRate, dt));
      _e.set(this.headPitch, inp.yaw + this.headYaw, 0, 'YXZ');
      this.head.quaternion.setFromEuler(_e);
    }
  }

  private deadT = 0;

  /** Falls back onto the ground and lies still. */
  private updateDead(inp: BipedInput, dt: number) {
    this.deadT += dt;
    const fall = stepEase(Math.min(1, this.deadT / 0.55));
    // A small bounce as she lands.
    const settle = this.deadT > 0.55 ? Math.sin(Math.min(1, (this.deadT - 0.55) / 0.25) * Math.PI) * 0.03 : 0;
    _e.set((Math.PI / 2) * fall, 0, 0.12 * fall, 'YXZ');
    _q.setFromEuler(_e);
    this.bodyQuat.copy(this.yawQuat).multiply(_q);
    this.hips.copy(inp.root).addScaledVector(_up, THREE.MathUtils.lerp(B.hip, 0.17, fall) + settle);
    this.local(0, B.chestY, 0, this.chest);
    this.torso.position.copy(this.chest);
    this.torso.quaternion.copy(this.bodyQuat);
    this.local(B.shoulderX, B.shoulderY, -0.02, this.shoulderR);
    this.local(-B.shoulderX, B.shoulderY, -0.02, this.shoulderL);
    for (const f of this.feet) {
      // Legs straighten out along the ground; one knee stays a little raised.
      this.local(f.side * 0.16, -B.thigh - B.shin + 0.05, f.side < 0 ? -0.18 : -0.05, f.pos);
      f.planted.copy(f.pos);
      f.stepping = false;
    }
    this.local(0, B.neckY + B.headUp, -0.02, this.head.position);
    this.head.quaternion.copy(this.bodyQuat);
    this.wasRolling = true; // replant cleanly when revived
  }

  /** Arm targets while lying dead: flung out to the sides. */
  deadHands(outR: THREE.Vector3, outL: THREE.Vector3) {
    this.local(0.5, B.shoulderY - 0.05, -0.05, outR);
    this.local(-0.45, B.shoulderY + 0.1, -0.05, outL);
  }

  /** Phase 2: arm IK to the given hand targets. */
  solveArms(rightTarget: THREE.Vector3, leftTarget: THREE.Vector3) {
    this.debugHandTargets[0].copy(rightTarget);
    this.debugHandTargets[1].copy(leftTarget);
    _pole.copy(this.shoulderR).addScaledVector(this.right, 0.5).addScaledVector(_up, -0.5).addScaledVector(this.forward, -0.2);
    solveTwoBone(this.shoulderR, rightTarget, _pole, B.upperArm, B.forearm, this.elbowR, this.handR);
    _pole.copy(this.shoulderL).addScaledVector(this.right, -0.5).addScaledVector(_up, -0.5).addScaledVector(this.forward, -0.2);
    solveTwoBone(this.shoulderL, leftTarget, _pole, B.upperArm, B.forearm, this.elbowL, this.handL);
  }

  /** Phase 3: legs, arms, blindfold tails, all pushed into the instanced limb renderer. */
  draw(limbs: LimbRenderer, dt: number) {
    const L = PLAYER.limb;
    // Legs: dark sticks below the robe, heavy boots.
    for (const f of this.feet) {
      const hip = this.local(f.side * B.hipX, -0.03, 0, _v);
      _pole.copy(hip).addScaledVector(this.forward, 0.8).addScaledVector(this.right, f.side * 0.25);
      _v2.copy(f.pos).addScaledVector(_up, 0.05);
      solveTwoBone(hip, _v2, _pole, B.thigh, B.shin, _knee, _end);
      limbs.seg(hip, _knee, 0.06, L);
      limbs.seg(_knee, _end, 0.05, L);
      limbs.knob(_knee, 0.06, L);
      _q.copy(this.yawQuat);
      limbs.knob(_end.addScaledVector(this.forward, 0.03), 0.07, L, 1, 0.6, 1.6, _q);
    }
    // Arms: robe sleeves to the elbow, dark forearms and hands.
    for (const [s, e, h] of [
      [this.shoulderR, this.elbowR, this.handR],
      [this.shoulderL, this.elbowL, this.handL],
    ]) {
      limbs.seg(s, e, 0.065, PLAYER.robe);
      limbs.knob(e, 0.062, PLAYER.robeShade);
      limbs.seg(e, h, 0.04, L);
      limbs.knob(h, 0.052, L);
      limbs.knob(s, 0.075, PLAYER.cowl);
    }
    this.drawTails(limbs, dt);

    if (tuning.debug.showIK) {
      for (const f of this.feet) {
        limbs.knob(f.planted, 0.08, 0x33ff66);
        limbs.knob(f.desired, 0.06, 0xffee33);
      }
      limbs.knob(this.debugHandTargets[0], 0.055, 0x33ccff);
      limbs.knob(this.debugHandTargets[1], 0.055, 0x3366ff);
    }
  }

  /** The blindfold's two loose ends stream from the knot at the back of the hood. */
  private drawTails(limbs: LimbRenderer, dt: number) {
    const c = tuning.cloth;
    if (Math.abs(this.tails[0].length - c.tailLength) > 1e-3) this.makeTails();
    const back = c.restBackDeg * DEG;
    const params = { gravity: c.gravity, drag: c.drag, stiffness: c.stiffness };
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const anchor = _a.set(side * 0.03, B.headR * 0.45, B.headR * 1.02).applyQuaternion(this.head.quaternion).add(this.head.position);
      // At rest the tails hang down and back from the knot, splayed a little.
      const rest = _b.set(side * 0.18, -Math.cos(back), Math.sin(back)).normalize().applyQuaternion(this.yawQuat);
      anchor.toArray(_anchor);
      rest.toArray(_rest);
      const tail = this.tails[i];
      if (!this.tailsLaid) tail.reset(_anchor, _rest);
      else tail.step(dt, _anchor, _rest, params);
      const p = tail.pos;
      for (let k = 1; k < tail.count; k++) {
        _v.fromArray(p, (k - 1) * 3);
        _v2.fromArray(p, k * 3);
        limbs.seg(_v, _v2, 0.022 - k * 0.002, PLAYER.blindfold);
      }
    }
    this.tailsLaid = true;
  }
}

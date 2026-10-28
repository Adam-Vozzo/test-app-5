// Procedural humanoid rig for v2 enemies: the player's biped approach (planted feet with arcing steps, two-bone
// IK arms and legs) without her cloth and aim logic. Arms follow the pose the AI hands it (src/enemies/foes.ts);
// gear rides the hands. Telegraphs glow magenta through the materials' emissive.
import * as THREE from 'three';
import { BIPED_GROUPS, selectSteps, stepArc, stepEase, type LegGaitState } from '../anim/gait';
import { solveTwoBone } from '../anim/ik';
import { clamp, damp } from '../core/math';
import type { Physics } from '../physics/world';
import { meshOf, toonMat } from '../render/geo';
import type { LimbRenderer } from '../render/limbs';
import { SIGNAL } from '../render/palette';
import type { FoeRig } from './beast';
import type { ArmPose, FoePlan } from './foes';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _up = new THREE.Vector3(0, 1, 0);
const _pole = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _end = new THREE.Vector3();
const _white = new THREE.Color(1, 1, 1);
const _black = new THREE.Color(0, 0, 0);
const _tele = new THREE.Color(SIGNAL.telegraph);

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

export class HumanoidRig implements FoeRig {
  readonly group = new THREE.Group();
  readonly s: number;
  readonly yawQuat = new THREE.Quaternion();
  readonly bodyQuat = new THREE.Quaternion();
  readonly hips = new THREE.Vector3();
  readonly chest = new THREE.Vector3();
  readonly handR = new THREE.Vector3();
  readonly handL = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  private shoulderR = new THREE.Vector3();
  private shoulderL = new THREE.Vector3();
  private elbowR = new THREE.Vector3();
  private elbowL = new THREE.Vector3();
  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  readonly weapon: THREE.Mesh;
  readonly offhand: THREE.Mesh | null;
  private weak: THREE.Mesh | null = null;
  private bodyMat: THREE.MeshToonMaterial;
  private gearMat: THREE.MeshToonMaterial;
  private feet: Foot[];
  private gait: LegGaitState[] = [
    { error: 0, stepping: false },
    { error: 0, stepping: false },
  ];
  private placed = false;
  private bob = 0;
  private deadT = 0;
  /** Which way a corpse falls (horizontal, world): away from the blow that killed it. */
  private readonly fallDir = new THREE.Vector3();
  onFootstep: (p: THREE.Vector3) => void = () => {};
  /** How far its blows can really reach from its chest: arm plus weapon (m). */
  readonly reach: number;
  /** Its movement capsule's half height (m). */
  readonly capsuleHalf: number;

  constructor(
    scene: THREE.Scene,
    private physics: Physics,
    readonly plan: FoePlan,
  ) {
    this.s = plan.height / 1.6;
    this.capsuleHalf = 0.42 * this.s;
    this.bodyMat = toonMat({ emissive: 0x000000 });
    this.gearMat = toonMat({ emissive: 0x000000 });
    this.torso = meshOf(plan.torso(), this.bodyMat);
    this.head = meshOf(plan.head(), this.bodyMat);
    this.weapon = meshOf(plan.weapon(), this.gearMat);
    this.offhand = plan.offhand ? meshOf(plan.offhand(), this.gearMat) : null;
    for (const m of [this.torso, this.head, this.weapon, this.offhand]) if (m) m.scale.setScalar(this.s);
    // Weapons point along -Z from the grip.
    const len = (g: THREE.BufferGeometry) => {
      g.computeBoundingBox();
      return Math.max(0, -g.boundingBox!.min.z);
    };
    this.reach = (0.52 + Math.max(len(this.weapon.geometry), this.offhand ? len(this.offhand.geometry) : 0)) * this.s;
    this.group.add(this.torso, this.head, this.weapon);
    if (this.offhand) this.group.add(this.offhand);
    if (plan.weakGlow) {
      this.weak = new THREE.Mesh(new THREE.IcosahedronGeometry(plan.weakGlow.r * this.s, 1).scale(1.4, 0.6, 1), new THREE.MeshBasicMaterial({ color: SIGNAL.weakSpot }));
      this.group.add(this.weak);
    }
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

  /** Which way it falls when it dies (the killing blow's direction); zero falls backward. */
  setFallDir(dir: THREE.Vector3) {
    this.fallDir.set(dir.x, 0, dir.z);
    if (this.fallDir.lengthSq() > 1e-6) this.fallDir.normalize();
  }

  /** Teleport: replant the feet under `root`. */
  reset(root: THREE.Vector3, yaw: number) {
    this.placed = false;
    this.deadT = 0;
    this.fallDir.set(0, 0, 0);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.yawQuat.setFromAxisAngle(_up, yaw);
    this.right.set(1, 0, 0).applyQuaternion(this.yawQuat);
    for (const f of this.feet) {
      f.planted.copy(root).addScaledVector(this.right, f.side * 0.13 * this.s);
      f.pos.copy(f.planted);
      f.stepping = false;
    }
  }

  /** Telegraph glow (0..1, magenta) and hit flash (white) on body and gear. */
  setGlow(glow: number, flash: boolean) {
    for (const m of [this.bodyMat, this.gearMat]) {
      if (flash) m.emissive.copy(_white);
      // The weapon carries the full glow; the body only blushes, so the wind-up pose still reads.
      else m.emissive.copy(_black).lerp(_tele, clamp(glow, 0, 1) * (m === this.gearMat ? 1 : 0.4));
    }
  }

  private local(x: number, y: number, z: number, out: THREE.Vector3) {
    return out.set(x * this.s, y * this.s, z * this.s).applyQuaternion(this.bodyQuat).add(this.chest);
  }

  update(dt: number, root: THREE.Vector3, yaw: number, vel: THREE.Vector3, p: ArmPose, dead: boolean) {
    const s = this.s;
    this.yawQuat.setFromAxisAngle(_up, yaw);
    this.forward.set(0, 0, -1).applyQuaternion(this.yawQuat);
    this.right.set(1, 0, 0).applyQuaternion(this.yawQuat);
    if (!this.placed) {
      // (reset clears `placed`, so set it after: otherwise every frame replants the feet and nothing ever steps)
      this.reset(root, yaw);
      this.placed = true;
    }

    if (dead) {
      // The knees go first (the hips drop), then it topples away from the killing blow and lies still. Feet stay
      // where they were planted; the whole body moves with the root, so a corpse sinking into the ground stays whole.
      if (this.deadT === 0 && this.fallDir.lengthSq() < 1e-6) this.fallDir.copy(this.forward).negate();
      this.deadT += dt;
      const buckle = stepEase(Math.min(1, this.deadT / 0.25));
      const fall = stepEase(clamp((this.deadT - 0.12) / 0.55, 0, 1));
      // Tip over about the axis across the fall direction (up turns toward fallDir).
      _v2.crossVectors(_up, this.fallDir).normalize();
      _q.setFromAxisAngle(_v2, (Math.PI / 2) * 0.92 * fall);
      this.bodyQuat.copy(_q).multiply(this.yawQuat);
      this.hips
        .copy(root)
        .addScaledVector(_up, THREE.MathUtils.lerp(0.62 * s, 0.42 * s, buckle) - 0.26 * s * fall)
        .addScaledVector(this.fallDir, 0.35 * s * fall);
      this.chest.copy(this.hips).addScaledVector(_v.set(0, 0.32 * s, 0).applyQuaternion(this.bodyQuat), 1);
      for (const f of this.feet) {
        // The legs fold under, then trail behind the fall.
        f.pos
          .copy(root)
          .addScaledVector(this.right, f.side * 0.15 * s)
          .addScaledVector(this.fallDir, -0.25 * s * fall);
        f.pos.y = root.y + 0.06;
        f.planted.copy(f.pos);
      }
    } else {
      this.deadT = 0;
      this.stepFeet(dt, root, vel);
      // Hips: step bob, crouch, and lean (the hunch is part of every pose).
      let lift = 0;
      for (const f of this.feet) if (f.stepping) lift = Math.max(lift, Math.sin(Math.PI * clamp(f.t, 0, 1)));
      const speed = Math.hypot(vel.x, vel.z);
      this.bob = damp(this.bob, (lift - 0.5) * 0.05 * s * clamp(speed / 2, 0, 1), 20, dt);
      const low = Math.min(this.feet[0].pos.y, this.feet[1].pos.y);
      const drop = clamp(low - root.y, -0.4, 0);
      this.hips.copy(root).addScaledVector(_up, (0.64 - 0.2 * p.crouch) * s + this.bob + drop);
      _e.set(-p.lean, 0, 0, 'YXZ');
      this.bodyQuat.copy(this.yawQuat).multiply(_q.setFromEuler(_e));
      this.chest.copy(this.hips).addScaledVector(_v.set(0, 0.3 * s, 0).applyQuaternion(this.bodyQuat), 1);
    }

    this.torso.position.copy(this.chest);
    this.torso.quaternion.copy(this.bodyQuat);
    this.local(0, 0.36, -0.02, this.head.position);
    this.head.quaternion.copy(this.bodyQuat);
    this.local(0.21, 0.17, 0, this.shoulderR);
    this.local(-0.21, 0.17, 0, this.shoulderL);

    if (dead) {
      this.local(0.55, 0.12, 0, this.handR);
      this.local(-0.5, 0.2, 0, this.handL);
    } else {
      this.local(p.handR[0], p.handR[1], p.handR[2], this.handR);
      this.local(p.handL[0], p.handL[1], p.handL[2], this.handL);
    }
    const reach = 0.52 * s;
    _pole.copy(this.shoulderR).addScaledVector(this.right, 0.5).addScaledVector(_up, -0.5).addScaledVector(this.forward, -0.2);
    solveTwoBone(this.shoulderR, this.handR, _pole, reach / 2, reach / 2, this.elbowR, this.handR);
    _pole.copy(this.shoulderL).addScaledVector(this.right, -0.5).addScaledVector(_up, -0.5).addScaledVector(this.forward, -0.2);
    solveTwoBone(this.shoulderL, this.handL, _pole, reach / 2, reach / 2, this.elbowL, this.handL);

    this.weapon.position.copy(this.handR);
    _e.set(p.weapon[0], p.weapon[1], p.weapon[2], 'YXZ');
    this.weapon.quaternion.copy(this.bodyQuat).multiply(_q.setFromEuler(_e));
    if (this.offhand) {
      this.offhand.position.copy(this.handL);
      _e.set(p.off[0], p.off[1], p.off[2], 'YXZ');
      this.offhand.quaternion.copy(this.bodyQuat).multiply(_q.setFromEuler(_e));
      if (this.plan.shield) this.offhand.position.addScaledVector(this.forward, -0.02);
    }
    if (this.weak && this.plan.weakGlow) {
      const g = this.plan.weakGlow;
      this.weak.position.copy(this.hips).addScaledVector(_v.set(g.at[0], g.at[1] - 0.64, g.at[2]).multiplyScalar(s).applyQuaternion(this.bodyQuat), 1);
      this.weak.quaternion.copy(this.bodyQuat);
    }
  }

  private stepFeet(dt: number, root: THREE.Vector3, vel: THREE.Vector3) {
    const s = this.s;
    const speed = Math.hypot(vel.x, vel.z);
    const stepDur = THREE.MathUtils.lerp(0.36, 0.24, clamp(speed / 5, 0, 1));
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      f.desired.copy(root).addScaledVector(this.right, f.side * 0.13 * s).addScaledVector(vel, 0.12);
      const g = this.physics.groundY(f.desired.x, f.desired.z, root.y + 1.2, 3);
      f.desired.y = g ? g.y : root.y;
      this.gait[i].error = Math.hypot(f.planted.x - f.desired.x, f.planted.z - f.desired.z) + Math.abs(f.planted.y - f.desired.y) * 0.5;
      this.gait[i].stepping = f.stepping;
    }
    const starts = selectSteps(this.gait, BIPED_GROUPS, { threshold: (speed < 0.2 ? 0.1 : 0.32) * s, panicFactor: 2.2, joinFraction: 0.3 });
    for (const i of starts) {
      const f = this.feet[i];
      f.stepping = true;
      f.t = 0;
      f.from.copy(f.planted);
      f.to.copy(f.desired).addScaledVector(vel, stepDur * 0.5);
      f.to.y = f.desired.y;
    }
    for (const f of this.feet) {
      if (!f.stepping) {
        f.pos.copy(f.planted);
        continue;
      }
      f.t += dt / stepDur;
      f.pos.lerpVectors(f.from, f.to, stepEase(f.t));
      f.pos.y += stepArc(f.t, 0.14 * s);
      if (f.t >= 1) {
        f.stepping = false;
        f.planted.copy(f.to);
        f.pos.copy(f.to);
        this.onFootstep(f.pos);
      }
    }
  }

  draw(limbs: LimbRenderer) {
    if (!this.group.visible) return;
    const s = this.s;
    const leg = 0.36 * s;
    for (const f of this.feet) {
      const hip = _v.copy(this.right).multiplyScalar(f.side * 0.1 * s).add(this.hips);
      _pole.copy(hip).addScaledVector(this.forward, 0.8).addScaledVector(this.right, f.side * 0.25);
      _v2.copy(f.pos).addScaledVector(_up, 0.05 * s);
      solveTwoBone(hip, _v2, _pole, leg, leg, _knee, _end);
      limbs.seg(hip, _knee, 0.065 * s, this.plan.limb);
      limbs.seg(_knee, _end, 0.055 * s, this.plan.limb);
      limbs.knob(_end.addScaledVector(this.forward, 0.03 * s), 0.075 * s, this.plan.limb, 1, 0.6, 1.6, this.yawQuat);
    }
    for (const [sh, el, h] of [
      [this.shoulderR, this.elbowR, this.handR],
      [this.shoulderL, this.elbowL, this.handL],
    ]) {
      limbs.seg(sh, el, 0.07 * s, this.plan.sleeve);
      limbs.seg(el, h, 0.045 * s, this.plan.limb);
      limbs.knob(h, 0.055 * s, this.plan.limb);
      limbs.knob(sh, 0.085 * s, this.plan.sleeve);
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}

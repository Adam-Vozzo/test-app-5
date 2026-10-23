// Player: controller + biped rig + held weapon. Places the weapon from the aim point and drives arm IK.
import * as THREE from 'three';
import { damp, DEG, Spring3 } from '../core/math';
import { Biped } from '../anim/biped';
import { Physics } from '../physics/world';
import { tuning } from '../tuning';
import { LimbRenderer } from '../render/limbs';
import type { WeaponModel } from '../weapons/model';
import { Controller, type MoveInput } from './controller';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const _hand = new THREE.Vector3();

/** Per-frame pose overrides from the weapon system (recoil, reload choreography). */
export interface WeaponPose {
  /** Weapon-local kick: position (x,y,z) and rotation (pitch, yaw, roll) springs. */
  kickPos: Spring3;
  kickRot: Spring3;
  /** Reload: extra weapon tilt (radians) and drop (units). */
  tilt: number;
  drop: number;
  /** Left-hand override, evaluated after the weapon is placed (reload choreography). */
  leftHand: ((weapon: THREE.Object3D, biped: Biped, out: THREE.Vector3) => THREE.Vector3) | null;
}

export class Player {
  readonly controller: Controller;
  readonly biped: Biped;
  readonly weaponRoot = new THREE.Group();
  model: WeaponModel | null = null;
  combatTimer = 0;
  aiming = false;
  private weaponQuat = new THREE.Quaternion();
  private adsBlend = 0;
  private swayT = 0;
  readonly muzzleWorld = new THREE.Vector3();
  readonly muzzleDir = new THREE.Vector3();
  readonly ejectWorld = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    physics: Physics,
    spawn: THREE.Vector3,
    yaw: number,
  ) {
    this.controller = new Controller(physics, spawn, yaw);
    this.biped = new Biped(scene, physics);
    scene.add(this.weaponRoot);
  }

  get pos() {
    return this.controller.pos;
  }
  get combat() {
    return this.aiming || this.combatTimer > 0;
  }

  setWeapon(model: WeaponModel) {
    if (this.model) this.weaponRoot.remove(this.model.root);
    this.model = model;
    this.weaponRoot.add(model.root);
  }

  move(dt: number, inp: Omit<MoveInput, 'combat'>) {
    this.combatTimer = Math.max(0, this.combatTimer - dt);
    this.controller.update(dt, { ...inp, combat: this.combat });
  }

  /**
   * Animate the rig and place the weapon pointing at `aimPoint`.
   * `camPos` keeps very-near aim points from twisting the weapon.
   */
  animate(dt: number, aimPoint: THREE.Vector3, camPos: THREE.Vector3, ads: number, pose: WeaponPose) {
    const c = this.controller;
    const b = this.biped;
    b.updateBody(
      {
        root: c.pos,
        yaw: c.yaw,
        vel: c.vel,
        accel: c.accel,
        grounded: c.grounded,
        rolling: c.rolling,
        rollT: c.rollT,
        aimPoint,
        sprinting: c.sprinting,
      },
      dt,
    );

    this.adsBlend = damp(this.adsBlend, ads, 18, dt);
    const model = this.model;
    if (!model) return;

    // Weapon pivot: right of the chest, pulled toward centre-line when aiming down sights.
    const px = THREE.MathUtils.lerp(0.17, 0.12, this.adsBlend);
    const py = THREE.MathUtils.lerp(0.04, 0.1, this.adsBlend);
    const pivot = _v.set(px, py, -0.14).applyQuaternion(c.rolling ? b.bodyQuat : b.yawQuat).add(b.chest);

    if (c.rolling) {
      _q.copy(b.bodyQuat);
      _q2.setFromEuler(_e.set(-0.6, 0.4, 0));
      _q.multiply(_q2);
      this.weaponQuat.copy(_q);
    } else {
      if (this.combat) {
        _aim.copy(aimPoint);
        // Keep the aim point at least 2.5 units ahead along the view so close walls don't fold the gun.
        if (_aim.distanceTo(camPos) < 2.5) _aim.copy(camPos).addScaledVector(_v.clone().subVectors(aimPoint, camPos).normalize(), 2.5);
        _m.lookAt(pivot, _aim, _up);
        _q.setFromRotationMatrix(_m);
      } else {
        // Low-ready: muzzle down and across the body.
        _q.copy(b.yawQuat);
        _q2.setFromEuler(_e.set(-38 * DEG, 22 * DEG, -8 * DEG));
        _q.multiply(_q2);
      }
      const rate = this.combat ? 40 : 12;
      this.weaponQuat.slerp(_q, 1 - Math.exp(-rate * dt));
    }

    // Reload tilt + recoil springs in weapon-local space.
    const root = this.weaponRoot;
    root.position.copy(pivot);
    root.quaternion.copy(this.weaponQuat);
    _q2.setFromEuler(_e.set(pose.kickRot.x.x + pose.tilt * 0.35, pose.kickRot.y.x, pose.kickRot.z.x + pose.tilt, 'XYZ'));
    root.quaternion.multiply(_q2);
    // Idle breathing sway (biped.armSwingIdle), damped out while moving and mostly out while aiming.
    this.swayT += dt;
    const still = 1 - Math.min(1, Math.hypot(c.vel.x, c.vel.z) / 2);
    const sway = tuning.biped.armSwingIdle * still * (1 - 0.7 * this.adsBlend);
    const sx = Math.sin(this.swayT * 0.9) * sway * 0.5;
    const sy = Math.sin(this.swayT * 1.7) * sway;
    root.position.add(_v.set(pose.kickPos.x.x + sx, pose.kickPos.y.x - pose.drop + sy, pose.kickPos.z.x).applyQuaternion(this.weaponQuat));
    root.updateMatrixWorld(true);

    const gripW = model.grip.clone().applyMatrix4(root.matrixWorld);
    const foreW = pose.leftHand ? pose.leftHand(root, b, _hand) : model.fore.clone().applyMatrix4(root.matrixWorld);
    b.solveArms(gripW, foreW);

    this.muzzleWorld.copy(model.muzzle).applyMatrix4(root.matrixWorld);
    this.muzzleDir.set(0, 0, -1).applyQuaternion(root.quaternion);
    this.ejectWorld.copy(model.eject).applyMatrix4(root.matrixWorld);
  }

  draw(limbs: LimbRenderer, dt: number) {
    this.biped.draw(limbs, dt);
  }
}

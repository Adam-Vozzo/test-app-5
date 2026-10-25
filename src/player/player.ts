// Player: controller + biped rig + held weapon. Places the weapon from the aim point and drives arm IK.
import * as THREE from 'three';
import { damp, DEG, Spring3 } from '../core/math';
import { BODY } from '../anim/body';
import { Biped } from '../anim/biped';
import { Physics } from '../physics/world';
import { tuning } from '../tuning';
import { LimbRenderer } from '../render/limbs';
import type { WeaponModel } from '../weapons/model';
import type { SwordPose } from '../weapons/swordrifle';
import { Controller, type MoveInput } from './controller';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const _hand = new THREE.Vector3();
const _mouth = new THREE.Vector3();
const _pouch = new THREE.Vector3();
const _healHand = new THREE.Vector3();
const _hr = new THREE.Vector3();
const _hl = new THREE.Vector3();
const _sw = new THREE.Vector3();
const _qs = new THREE.Quaternion();
const _es = new THREE.Euler(0, 0, 0, 'YXZ');
const _slotPos = new THREE.Vector3();
const _slotQuat = new THREE.Quaternion();
const _over = new THREE.Vector3();
const _restL = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bm = new THREE.Matrix4();

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
  /** The weapon slung on her back (the SwordRifle while the pistol is out). */
  readonly backRoot = new THREE.Group();
  backModel: WeaponModel | null = null;
  /** Drawing or stowing the held weapon from or to the back slot: 0 = in hand, 1 = on the back. */
  holster = 0;
  /** SwordRifle sword-mode placement (blend 0 = the usual aimed hold, 1 = blade pose). */
  swordPose: SwordPose | null = null;
  combatTimer = 0;
  aiming = false;
  dead = false;
  /** Heal progress 0..1 while drinking, or -1. Drives the off hand to the mouth. */
  healT = -1;
  /** Heal lands at this progress (the drop disappears). */
  healApplyAt = 0.7;
  readonly drop: THREE.Mesh;
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
    scene.add(this.weaponRoot, this.backRoot);
    // The heal: a draught carried to the mouth.
    this.drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6).scale(1, 1.4, 1),
      new THREE.MeshToonMaterial({ color: 0xcfeaff, emissive: 0x2a4a5a }),
    );
    this.drop.visible = false;
    scene.add(this.drop);
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

  /** Sling a weapon on her back (null clears the slot). */
  setBackWeapon(model: WeaponModel | null) {
    if (this.backModel) this.backRoot.remove(this.backModel.root);
    this.backModel = model;
    if (!model) return;
    model.root.position.set(0, 0, 0);
    model.root.quaternion.identity();
    this.backRoot.add(model.root);
  }

  /** The back slot in world space: chest-relative, riding the body (it tumbles with a roll, falls with her). */
  private backSlot(outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    const b = this.biped;
    const s = BODY.back;
    outPos.set(s.x, s.y, s.z).applyQuaternion(b.bodyQuat).add(b.chest);
    // Model forward (-Z) along the muzzle line, its top (+Y) facing back against her.
    _bz.set(-s.muzzle[0], -s.muzzle[1], -s.muzzle[2]).normalize();
    _by.set(0, 0, 1);
    _by.addScaledVector(_bz, -_by.dot(_bz)).normalize();
    _bx.crossVectors(_by, _bz);
    _bm.makeBasis(_bx, _by, _bz);
    outQuat.setFromRotationMatrix(_bm).premultiply(b.bodyQuat);
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
        dead: this.dead,
      },
      dt,
    );
    if (this.backModel) {
      this.backSlot(_slotPos, _slotQuat);
      this.backRoot.position.copy(_slotPos);
      this.backRoot.quaternion.copy(_slotQuat);
      this.backRoot.updateMatrixWorld(true);
    }
    if (this.dead) {
      this.animateDead();
      return;
    }

    this.adsBlend = damp(this.adsBlend, ads, 18, dt);
    const model = this.model;
    if (!model) return;

    // Weapon pivot: right of the chest, pulled toward centre-line when aiming down sights.
    const w = BODY.weapon;
    const px = THREE.MathUtils.lerp(w.hipX, w.adsX, this.adsBlend);
    const py = THREE.MathUtils.lerp(w.hipY, w.adsY, this.adsBlend);
    const pivot = _v.set(px, py, w.z).applyQuaternion(c.rolling ? b.bodyQuat : b.yawQuat).add(b.chest);

    if (c.rolling) {
      _q.copy(b.bodyQuat);
      _q2.setFromEuler(_e.set(-0.6, 0.4, 0));
      _q.multiply(_q2);
      this.weaponQuat.copy(_q);
    } else {
      if (this.combat) {
        _aim.copy(aimPoint);
        // Keep the aim point a few metres ahead along the view so close walls don't fold the gun.
        const minD = BODY.minAimDistance;
        if (_aim.distanceTo(camPos) < minD) _aim.copy(camPos).addScaledVector(_v.clone().subVectors(aimPoint, camPos).normalize(), minD);
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

    // Sword mode: the blade's angles are body-relative and the hands sweep an arc in front of the chest.
    const sp = this.swordPose;
    const swordK = sp && !c.rolling ? THREE.MathUtils.clamp(sp.blend, 0, 1) : 0;
    if (swordK > 0 && sp) {
      _q2.setFromEuler(_es.set(sp.pitch, sp.yaw, sp.roll, 'YXZ'));
      _qs.copy(b.yawQuat).multiply(_q2);
      _sw.set(0.06, sp.handY, -sp.reach).applyAxisAngle(_up, sp.yaw * 0.5).applyQuaternion(b.yawQuat).add(b.chest);
      pivot.lerp(_sw, swordK);
      this.weaponQuat.slerp(_qs, swordK);
    }

    // Reload tilt + recoil springs in weapon-local space.
    const root = this.weaponRoot;
    root.position.copy(pivot);
    root.quaternion.copy(this.weaponQuat);
    _q2.setFromEuler(_e.set(pose.kickRot.x.x + pose.tilt * 0.35, pose.kickRot.y.x, pose.kickRot.z.x + pose.tilt, 'XYZ'));
    root.quaternion.multiply(_q2);
    // Idle breathing sway (biped.armSwingIdle), damped out while moving and mostly out while aiming.
    this.swayT += dt;
    const still = 1 - Math.min(1, Math.hypot(c.vel.x, c.vel.z) / 3.2);
    const sway = tuning.biped.armSwingIdle * still * (1 - 0.7 * this.adsBlend);
    const sx = Math.sin(this.swayT * 0.9) * sway * 0.5;
    const sy = Math.sin(this.swayT * 1.7) * sway;
    root.position.add(_v.set(pose.kickPos.x.x + sx, pose.kickPos.y.x - pose.drop + sy, pose.kickPos.z.x).applyQuaternion(this.weaponQuat));
    // Drawing from / stowing to the back: the weapon arcs over the right shoulder; the right hand rides the grip,
    // the off hand lets go.
    const hk = c.rolling ? 0 : THREE.MathUtils.clamp(this.holster, 0, 1);
    if (hk > 0) {
      this.backSlot(_slotPos, _slotQuat);
      const o = BODY.back.over;
      _over.set(o[0], o[1], o[2]).applyQuaternion(b.yawQuat).add(b.chest);
      const u = 1 - hk;
      root.position.multiplyScalar(u * u).addScaledVector(_over, 2 * hk * u).addScaledVector(_slotPos, hk * hk);
      root.quaternion.slerp(_slotQuat, THREE.MathUtils.smoothstep(hk, 0.15, 1));
    }
    root.updateMatrixWorld(true);

    const gripW = model.grip.clone().applyMatrix4(root.matrixWorld);
    let foreW = pose.leftHand ? pose.leftHand(root, b, _hand) : model.fore.clone().applyMatrix4(root.matrixWorld);
    if (hk > 0) {
      const r = BODY.restHandL;
      _restL.set(r[0], r[1], r[2]).applyQuaternion(b.yawQuat).add(b.chest);
      foreW.lerp(_restL, THREE.MathUtils.smoothstep(hk, 0, 0.35));
    }
    this.drop.visible = false;
    if (this.healT >= 0) {
      // Off hand leaves the gun, brings the draught to the mouth, holds, then returns.
      const t = this.healT;
      const mouth = _mouth.copy(b.head.position).addScaledVector(b.forward, BODY.mouth.forward).addScaledVector(_up, BODY.mouth.up);
      const pouch = _pouch.copy(b.hips).addScaledVector(b.right, BODY.pouch.x);
      const toMouth = THREE.MathUtils.smoothstep(t, 0.15, 0.45);
      const back = THREE.MathUtils.smoothstep(t, this.healApplyAt + 0.05, 1);
      const p = _healHand.copy(foreW).lerp(pouch, THREE.MathUtils.smoothstep(t, 0, 0.15) * (1 - toMouth)).lerp(mouth, toMouth * (1 - back));
      foreW = p.lerp(foreW, back);
      if (t > 0.08 && t < this.healApplyAt) {
        this.drop.visible = true;
        this.drop.position.copy(foreW).addScaledVector(_up, 0.06);
      }
    }
    b.solveArms(gripW, foreW);

    this.muzzleWorld.copy(model.muzzle).applyMatrix4(root.matrixWorld);
    this.muzzleDir.set(0, 0, -1).applyQuaternion(root.quaternion);
    this.ejectWorld.copy(model.eject).applyMatrix4(root.matrixWorld);
  }

  /** Dead: the gun lies on the ground beside her. */
  private animateDead() {
    const b = this.biped;
    const c = this.controller;
    this.drop.visible = false;
    this.weaponRoot.position.copy(c.pos).addScaledVector(b.right, 0.75).addScaledVector(b.forward, 0.35);
    this.weaponRoot.position.y += 0.03;
    _q.copy(b.yawQuat);
    _q2.setFromEuler(_e.set(0, 0.6, Math.PI / 2));
    this.weaponRoot.quaternion.copy(_q).multiply(_q2);
    this.weaponRoot.updateMatrixWorld(true);
    b.deadHands(_hr, _hl);
    b.solveArms(_hr, _hl);
  }

  draw(limbs: LimbRenderer, dt: number) {
    this.biped.draw(limbs, dt);
  }
}

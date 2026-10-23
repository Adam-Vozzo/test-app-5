// Target dummy: a pill-bug on a cork post. Weak-spot head, hit flash, flinch spring, fall-over death, respawn.
import * as THREE from 'three';
import { clamp, Spring } from '../core/math';
import { Physics, RAPIER, type DamageInfo, type Damageable } from '../physics/world';
import { merge, meshOf, paint, place, stripe, toonMat } from '../render/geo';
import { CHARACTER, PROPS, SIGNAL } from '../render/palette';
import { tuning } from '../tuning';

const BODY_Y = 0.85;
const HEAD_Y = 1.42;
const _v = new THREE.Vector3();

export class Dummy implements Damageable {
  readonly group = new THREE.Group();
  private pivot = new THREE.Group();
  private mat: THREE.MeshToonMaterial;
  private bar: THREE.Group;
  private barFill: THREE.Mesh;
  private bodyCol: RAPIER.Collider;
  private headCol: RAPIER.Collider;
  health: number;
  alive = true;
  private flash = 0;
  private deadTime = 0;
  /** Flinch springs: tilt about X (toward/away) and Z (sideways), radians. */
  private tiltX = new Spring();
  private tiltZ = new Spring();
  private slidePhase = 0;
  readonly base: THREE.Vector3;
  /** Time of first damage in the current life (for TTK readout). */
  firstHitTime = -1;
  /** Poise: stagger damage within a short window breaks it. */
  private poise: number;
  private sincePoiseHit = 10;
  staggered = 0;
  onStagger: () => void = () => {};

  constructor(
    scene: THREE.Scene,
    private physics: Physics,
    pos: THREE.Vector3,
    readonly slide: boolean,
  ) {
    this.base = pos.clone();
    this.health = tuning.dummy.health;
    this.poise = tuning.dummy.poise;
    this.mat = toonMat({ emissive: 0x000000 });
    const post = paint(new THREE.CylinderGeometry(0.1, 0.13, BODY_Y, 8).translate(0, BODY_Y / 2, 0), PROPS.cork);
    const foot = paint(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 10).translate(0, 0.06, 0), PROPS.corkDark);
    const body = stripe(new THREE.SphereGeometry(0.42, 14, 14).scale(1, 1.15, 0.9), CHARACTER.enemyShellA, CHARACTER.enemyShellB, 0.09);
    const belly = paint(new THREE.SphereGeometry(0.3, 10, 8).scale(1, 1.2, 0.5), CHARACTER.enemyBelly);
    const head = paint(new THREE.SphereGeometry(0.2, 12, 10), CHARACTER.enemyShellB);
    const target = paint(new THREE.TorusGeometry(0.24, 0.035, 4, 16), PROPS.paper);
    const geo = merge([post, foot, place(body, 0, BODY_Y, 0), place(belly, 0, BODY_Y, -0.24), place(head, 0, HEAD_Y, 0), place(target, 0, BODY_Y, -0.36)]);
    this.pivot.add(meshOf(geo, this.mat));
    // Weak spot: glowing cyan eye-band on the head (unlit so it reads in any light).
    const weak = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.04, 6, 18), new THREE.MeshBasicMaterial({ color: SIGNAL.weakSpot }));
    weak.position.set(0, HEAD_Y + 0.02, 0);
    weak.rotation.x = Math.PI / 2;
    this.pivot.add(weak);
    this.group.add(this.pivot);

    // Health bar (billboarded each frame).
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.07), new THREE.MeshBasicMaterial({ color: 0x1e1414, depthWrite: false }));
    this.barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.045).translate(0.33, 0, 0),
      new THREE.MeshBasicMaterial({ color: SIGNAL.kill, depthWrite: false }),
    );
    this.barFill.position.set(-0.33, 0, 0.001);
    this.bar.add(bg, this.barFill);
    this.bar.position.set(0, HEAD_Y + 0.42, 0);
    this.group.add(this.bar);

    this.group.position.copy(pos);
    scene.add(this.group);

    this.bodyCol = physics.addHitbox(RAPIER.ColliderDesc.ball(0.44), { part: 'body', owner: this });
    this.headCol = physics.addHitbox(RAPIER.ColliderDesc.ball(0.22), { part: 'weak', owner: this });
    if (!slide) physics.addStatic(RAPIER.ColliderDesc.cylinder(BODY_Y / 2, 0.14).setTranslation(pos.x, BODY_Y / 2, pos.z));
    this.syncColliders();
  }

  takeDamage(info: DamageInfo): boolean {
    if (!this.alive) return false;
    const d = tuning.dummy;
    this.health -= info.amount;
    this.flash = tuning.feel.hitFlashTime;
    // Flinch: impulse into the tilt springs in the direction of the shot.
    const k = info.amount * d.flinchPerDamage * (1 + info.knockback);
    this.tiltX.impulse(-info.dir.z * k);
    this.tiltZ.impulse(info.dir.x * k);
    // Poise break: a big lurch you can see across the range.
    this.poise -= info.stagger;
    this.sincePoiseHit = 0;
    if (this.poise <= 0 && this.staggered <= 0) {
      this.staggered = d.staggerTime;
      this.poise = d.poise;
      this.tiltX.impulse(-Math.sign(info.dir.z || 1) * 9);
      this.tiltZ.impulse(Math.sign(info.dir.x) * 4);
      this.onStagger();
    }
    if (this.health <= 0) {
      this.alive = false;
      this.deadTime = 0;
      this.health = 0;
      // Topple away from the shooter.
      this.tiltX.target = -Math.sign(info.dir.z || 1) * (Math.PI / 2 - 0.12);
      return true;
    }
    return false;
  }

  update(dt: number, camera: THREE.Camera) {
    const d = tuning.dummy;
    for (const s of [this.tiltX, this.tiltZ]) {
      s.stiffness = !this.alive ? 60 : this.staggered > 0 ? d.flinchStiffness * 0.4 : d.flinchStiffness;
      s.damping = !this.alive ? 12 : this.staggered > 0 ? d.flinchDamping * 0.6 : d.flinchDamping;
      s.step(dt);
    }
    this.sincePoiseHit += dt;
    if (this.sincePoiseHit > d.poiseRegenDelay) this.poise = Math.min(d.poise, this.poise + d.poiseRegen * dt);
    if (this.staggered > 0) this.staggered -= dt;
    if (!this.alive) {
      this.deadTime += dt;
      if (this.deadTime >= d.respawnTime) this.respawn();
    }
    if (this.slide && this.alive) {
      this.slidePhase += (d.slideSpeed / Math.max(0.1, d.slideRange)) * dt;
      this.group.position.x = this.base.x + Math.sin(this.slidePhase) * d.slideRange;
    }
    this.flash = Math.max(0, this.flash - dt);
    const f = this.flash > 0 ? 1 : 0;
    this.mat.emissive.setRGB(f, f, f);
    this.pivot.rotation.set(clamp(this.tiltX.x, -1.6, 1.6), 0, clamp(this.tiltZ.x, -1.6, 1.6));
    this.barFill.scale.x = Math.max(0.001, this.health / d.health);
    this.bar.visible = this.alive && this.health < d.health;
    this.bar.quaternion.copy(camera.quaternion);
    this.syncColliders();
  }

  private respawn() {
    this.alive = true;
    this.health = tuning.dummy.health;
    this.tiltX.target = 0;
    this.tiltX.impulse(-4);
    this.firstHitTime = -1;
    this.poise = tuning.dummy.poise;
    this.staggered = 0;
  }

  private syncColliders() {
    this.group.updateMatrixWorld(true);
    const m = this.pivot.matrixWorld;
    _v.set(0, BODY_Y, 0).applyMatrix4(m);
    this.bodyCol.setTranslation(_v);
    _v.set(0, HEAD_Y, 0).applyMatrix4(m);
    this.headCol.setTranslation(_v);
    // Dead dummies can't be hit (keeps kill counts honest).
    this.bodyCol.setEnabled(this.alive);
    this.headCol.setEnabled(this.alive);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.physics.removeCollider(this.bodyCol);
    this.physics.removeCollider(this.headCol);
  }
}

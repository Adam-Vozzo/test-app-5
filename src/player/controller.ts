// Kinematic character controller: walk, sprint, gravity, dodge-roll. Body commitment lives here.
import * as THREE from 'three';
import { damp, dampAngle, DEG } from '../core/math';
import { GROUPS, Physics, RAPIER } from '../physics/world';
import { tuning } from '../tuning';

export type MoveState = 'move' | 'roll' | 'rollRecover';

export interface MoveInput {
  /** Camera-relative move axes: x = right, y = forward, each -1..1. */
  x: number;
  y: number;
  sprint: boolean;
  rollPressed: boolean;
  /** Face the camera yaw (aiming, firing, reloading). */
  combat: boolean;
  /** Multiplier applied by other systems (ADS, reload, heal). */
  speedMul: number;
  /** Roll speed multiplier (the Devil's weight: a burdened roll falls short). */
  rollMul?: number;
  camYaw: number;
}

export class Controller {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  /** Feet position. */
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  readonly accel = new THREE.Vector3();
  private prevVel = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  state: MoveState = 'move';
  stateTime = 0;
  sprinting = false;
  private rollDir = new THREE.Vector3();
  private lastGood = new THREE.Vector3();
  /** External shove (weapon self-knockback, hits) that decays over time. */
  private pushVel = new THREE.Vector3();
  private vy = 0;
  private center = new THREE.Vector3();
  private halfH: number;
  private radius: number;

  constructor(
    physics: Physics,
    spawn: THREE.Vector3,
    yaw: number,
  ) {
    const t = tuning.player;
    this.halfH = t.capsuleHalfHeight;
    this.radius = t.capsuleRadius;
    const w = physics.world;
    this.pos.copy(spawn);
    this.lastGood.copy(spawn);
    this.yaw = yaw;
    this.center.set(spawn.x, spawn.y + this.halfH + this.radius, spawn.z);
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.center.x, this.center.y, this.center.z));
    this.collider = w.createCollider(
      RAPIER.ColliderDesc.capsule(this.halfH, this.radius).setCollisionGroups(GROUPS.player),
      this.body,
    );
    this.kcc = w.createCharacterController(0.032);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.setSlideEnabled(true);
    this.kcc.setApplyImpulsesToDynamicBodies(false);
    this.applyTuning();
  }

  applyTuning() {
    const t = tuning.player;
    this.kcc.enableAutostep(t.stepHeight, 0.24, false);
    this.kcc.enableSnapToGround(t.snapToGround);
    this.kcc.setMaxSlopeClimbAngle(t.maxSlopeDeg * DEG);
    this.kcc.setMinSlopeSlideAngle((t.maxSlopeDeg + 5) * DEG);
  }

  get rolling() {
    return this.state === 'roll';
  }
  /** Committed: no shooting, no reloading, no turning. */
  get committed() {
    return this.state !== 'move';
  }
  get rollT() {
    return this.state === 'roll' ? Math.min(1, this.stateTime / Math.max(0.05, tuning.roll.duration)) : 0;
  }
  get invulnerable() {
    return this.state === 'roll' && this.stateTime < tuning.roll.iFrames;
  }

  push(vx: number, vz: number) {
    this.pushVel.x += vx;
    this.pushVel.z += vz;
  }

  teleport(p: THREE.Vector3, yaw: number) {
    this.pushVel.set(0, 0, 0);
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = yaw;
    this.state = 'move';
    this.center.set(p.x, p.y + this.halfH + this.radius, p.z);
    this.body.setTranslation(this.center, true);
    this.body.setNextKinematicTranslation(this.center);
  }

  update(dt: number, inp: MoveInput) {
    if (dt <= 0) return;
    const t = tuning.player;
    const r = tuning.roll;
    this.applyTuning();
    this.stateTime += dt;

    // Camera-relative wish direction (yaw 0 faces -Z).
    const sy = Math.sin(inp.camYaw);
    const cy = Math.cos(inp.camYaw);
    let wx = inp.x * cy - inp.y * sy;
    let wz = -inp.x * sy - inp.y * cy;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const moving = wl > 0.1;

    if (this.state === 'move' && inp.rollPressed && this.grounded) {
      this.state = 'roll';
      this.stateTime = 0;
      if (moving) this.rollDir.set(wx, 0, wz).normalize();
      else this.rollDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.yaw = Math.atan2(-this.rollDir.x, -this.rollDir.z);
    } else if (this.state === 'roll' && this.stateTime >= r.duration) {
      this.state = 'rollRecover';
      this.stateTime = 0;
    } else if (this.state === 'rollRecover' && this.stateTime >= r.recovery) {
      this.state = 'move';
      this.stateTime = 0;
    }

    let tx = 0;
    let tz = 0;
    if (this.state === 'roll') {
      const k = Math.min(1, this.stateTime / Math.max(0.05, r.duration));
      const sp = r.speed * (1 - (1 - r.endSpeedMul) * k * k) * (inp.rollMul ?? 1);
      tx = this.rollDir.x * sp;
      tz = this.rollDir.z * sp;
      this.vel.x = tx;
      this.vel.z = tz;
      this.sprinting = false;
    } else {
      const forwardish = inp.y > 0.3;
      this.sprinting = this.state === 'move' && inp.sprint && moving && forwardish && !inp.combat;
      let speed = this.sprinting ? t.sprintSpeed : t.walkSpeed;
      speed *= inp.speedMul;
      if (this.state === 'rollRecover') speed *= 0.25;
      tx = wx * speed;
      tz = wz * speed;
      const rate = (moving ? t.accel : t.decel) * (this.grounded ? 1 : t.airControl);
      // Accelerate toward target velocity at a capped rate (units/s²).
      const dx = tx - this.vel.x;
      const dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz);
      const maxD = rate * dt;
      if (dl <= maxD) {
        this.vel.x = tx;
        this.vel.z = tz;
      } else {
        this.vel.x += (dx / dl) * maxD;
        this.vel.z += (dz / dl) * maxD;
      }
    }

    // Facing.
    if (this.state === 'move') {
      if (inp.combat) this.yaw = dampAngle(this.yaw, inp.camYaw, t.turnRate * 1.5, dt);
      else if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(-wx, -wz), t.turnRate, dt);
    }

    // Gravity.
    if (this.grounded && this.vy <= 0) this.vy = -3.2;
    else this.vy -= t.gravity * dt;

    const desired = { x: (this.vel.x + this.pushVel.x) * dt, y: this.vy * dt, z: (this.vel.z + this.pushVel.z) * dt };
    this.pushVel.multiplyScalar(Math.exp(-t.pushDecay * dt));
    this.kcc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.player);
    const mv = this.kcc.computedMovement();
    this.grounded = this.kcc.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = -3.2;
    this.center.x += mv.x;
    this.center.y += mv.y;
    this.center.z += mv.z;
    this.body.setNextKinematicTranslation(this.center);
    // Actual horizontal velocity after collision (so the walk cycle doesn't moonwalk into walls).
    const actualX = mv.x / dt - this.pushVel.x;
    const actualZ = mv.z / dt - this.pushVel.z;
    this.vel.x = damp(this.vel.x, actualX, 30, dt);
    this.vel.z = damp(this.vel.z, actualZ, 30, dt);
    this.pos.set(this.center.x, this.center.y - this.halfH - this.radius, this.center.z);

    this.accel.subVectors(this.vel, this.prevVel).divideScalar(dt);
    this.prevVel.copy(this.vel);

    // A bad tuning value must never leave the player at NaN (invisible forever): restore the last good spot.
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z + this.vel.x + this.vel.z)) {
      this.vel.set(0, 0, 0);
      this.teleport(this.lastGood, this.yaw);
    } else if (this.grounded) this.lastGood.copy(this.pos);
    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    // Fell out of the world: put back at origin.
    if (this.pos.y < -48) this.teleport(new THREE.Vector3(0, 3, 0), this.yaw);
  }
}

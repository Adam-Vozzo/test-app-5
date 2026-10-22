// Over-the-shoulder camera: shoulder swap, ADS zoom, collision, recoil kick, FOV punch, trauma² shake.
import * as THREE from 'three';
import { clamp, damp, DEG, noise1, Spring } from '../core/math';
import { GROUPS, Physics } from '../physics/world';
import { tuning } from '../tuning';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class OTSCamera {
  /** Base aim angles (mouse). Recoil climb is written into these directly. */
  yaw = 0;
  pitch = 0;
  side = 1;
  private sideSmooth = 1;
  private zoom = 0;
  private dist = 0;
  private pivotY = 0;
  private pivotInit = false;
  /** Recoil kick springs (radians) on top of the base aim; part of the aim. */
  readonly kickPitch = new Spring(180, 22);
  readonly kickYaw = new Spring(180, 22);
  readonly fovPunch = new Spring(300, 24);
  trauma = 0;
  /** Aim origin/direction without shake (what bullets use). */
  readonly aimOrigin = new THREE.Vector3();
  readonly aimDir = new THREE.Vector3();
  /** Distance from the camera to the pivot along aimDir (aim rays start past the player). */
  aimStartOffset = 0;

  constructor(
    readonly cam: THREE.PerspectiveCamera,
    private physics: Physics,
  ) {}

  get aimYaw() {
    return this.yaw + this.kickYaw.x;
  }
  get aimPitch() {
    return this.pitch + this.kickPitch.x;
  }
  get adsAmount() {
    return this.zoom;
  }

  look(dx: number, dy: number) {
    const c = tuning.camera;
    const sens = c.sensitivity * (1 - this.zoom * (1 - c.adsSensitivityMul));
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, c.pitchMinDeg * DEG, c.pitchMaxDeg * DEG);
  }

  addTrauma(t: number) {
    this.trauma = Math.min(1, this.trauma + t);
  }

  snap(target: THREE.Vector3, yaw: number) {
    this.yaw = yaw;
    this.pitch = -0.08;
    this.pivotY = target.y;
    this.pivotInit = true;
    this.kickPitch.reset();
    this.kickYaw.reset();
    this.trauma = 0;
  }

  /**
   * @param realDt real-time dt (camera stays responsive during hitstop)
   * @param simDt simulation dt (springs follow slow-mo)
   */
  update(target: THREE.Vector3, ads: boolean, realDt: number, simDt: number, time: number) {
    const c = tuning.camera;
    const f = tuning.feel;
    this.zoom = damp(this.zoom, ads ? 1 : 0, c.zoomRate, realDt);
    this.sideSmooth = damp(this.sideSmooth, this.side, c.swapRate, realDt);
    this.kickPitch.step(simDt);
    this.kickYaw.step(simDt);
    this.fovPunch.step(simDt);
    this.trauma = Math.max(0, this.trauma - f.traumaDecay * simDt);

    if (!this.pivotInit) {
      this.pivotY = target.y;
      this.pivotInit = true;
    }
    // Smooth vertical follow hides autostep pops.
    this.pivotY = damp(this.pivotY, target.y, c.followRate * 0.4, realDt);

    const yaw = this.aimYaw;
    const pitch = this.aimPitch;
    _fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const shoulder = THREE.MathUtils.lerp(c.shoulder, c.adsShoulder, this.zoom) * this.sideSmooth;
    const wantDist = THREE.MathUtils.lerp(c.distance, c.adsDistance, this.zoom);
    _pivot.set(target.x, this.pivotY + c.height, target.z);
    // Shoulder-side point (cast origin), then pull back along -forward.
    _desired.copy(_pivot).addScaledVector(_right, shoulder);
    _desired.y += c.lift;
    // Collision 1: pivot → shoulder point.
    _dir.subVectors(_desired, _pivot);
    const sideLen = _dir.length();
    _dir.normalize();
    const sideHit = this.physics.sphereCast(_pivot, _dir, c.collisionRadius, sideLen, GROUPS.qCamera);
    const shoulderPt = _pivot.clone().addScaledVector(_dir, sideHit);
    // Collision 2: shoulder point → back.
    _dir.copy(_fwd).negate();
    const backHit = this.physics.sphereCast(shoulderPt, _dir, c.collisionRadius, wantDist, GROUPS.qCamera);
    // Snap in instantly, ease back out.
    if (backHit < this.dist || this.dist === 0) this.dist = backHit;
    else this.dist = Math.min(backHit, damp(this.dist, backHit, c.collisionRecoverRate, realDt));
    const camPos = shoulderPt.addScaledVector(_dir, this.dist);

    this.aimOrigin.copy(camPos);
    this.aimDir.copy(_fwd);
    this.aimStartOffset = Math.max(0, _fwd.dot(_pivot.clone().sub(camPos)));

    // Trauma² shake: visual only.
    const shake = this.trauma * this.trauma;
    const t = time * f.shakeFreq;
    const sp = shake * f.shakeMaxAngleDeg * DEG * noise1(t, 1);
    const sw = shake * f.shakeMaxAngleDeg * DEG * noise1(t, 2);
    const sr = shake * f.shakeMaxRollDeg * DEG * noise1(t, 3);
    this.cam.position.copy(camPos);
    this.cam.position.x += shake * f.shakeMaxOffset * noise1(t, 4);
    this.cam.position.y += shake * f.shakeMaxOffset * noise1(t, 5);
    _e.set(pitch + sp, yaw + sw, sr);
    this.cam.quaternion.setFromEuler(_e);

    const fov = THREE.MathUtils.lerp(c.fovDeg, c.adsFovDeg, this.zoom) + this.fovPunch.x;
    if (Math.abs(this.cam.fov - fov) > 1e-3) {
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
  }
}

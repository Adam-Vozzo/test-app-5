// Weapon behaviour, driven entirely by a WeaponDef: fire on the input frame, spread/bloom, pellet patterns,
// hitscan or projectile, recoil pattern + kick springs, self-knockback, pump/bolt cycling by the off hand,
// and committed reloads (whole magazine, or one round at a time).
import * as THREE from 'three';
import { BODY } from '../anim/body';
import { clamp, damp, DEG, safeDiv, smoothstep, Spring3 } from '../core/math';
import { makeRng } from '../core/rng';
import type { Synth } from '../audio/synth';
import type { Fx } from '../fx/fx';
import type { Biped } from '../anim/biped';
import type { Clock } from '../core/time';
import { GROUPS, Physics, type RayHit, type RAPIER } from '../physics/world';
import type { OTSCamera } from '../player/camera';
import type { Player, WeaponPose } from '../player/player';
import { PROPS } from '../render/palette';
import { tuning } from '../tuning';
import type { Hud, HitKind } from '../ui/hud';
import type { WeaponDef } from './defs';
import { resolveHit, ShotFeedback } from './hit';
import type { WeaponModel } from './model';
import type { Projectiles } from './projectiles';
import { stepFireRate, type FireRateState } from './firerate';

export interface HitEvent {
  damage: number;
  kind: HitKind;
  distance: number;
  owner: unknown;
  /** Which trigger pull this came from (pellets share one). */
  shotId: number;
}

export interface GunContext {
  physics: Physics;
  player: Player;
  camera: OTSCamera;
  fx: Fx;
  synth: Synth;
  hud: Hud;
  clock: Clock;
  projectiles: Projectiles;
  onHit: (e: HitEvent) => void;
  onShot: (shotId: number) => void;
  /** A guard turned a blow (shield sparks). */
  onBlocked?: () => void;
}

const _origin = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _mz = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const hitA: RayHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, collider: null as never, target: null };
const hitB: RayHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, collider: null as never, target: null };
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Spread uses its own stream: deterministic per seed, independent of world generation. */
const spreadRng = makeRng(0x5eed);
let nextShotId = 1;

export class Gun {
  mag: number;
  reserve: number;
  private fireRate: FireRateState = { cooldown: 0 };
  private fireBuffer = 0;
  private shotIndex = 0;
  private sinceShot = 10;
  bloom = 0;
  reloading = false;
  /** Progress through the reload (mag mode) or through the current round (single mode), 0..1. */
  reloadT = 0;
  private reloadEvents = new Set<string>();
  private reloadEnv = 0;
  private roundsThisReload = 0;
  /** Off-hand action cycle after a shot (pump / bolt), 0..1; 1 = idle. */
  cycleT = 1;
  private cycleDur = 0.3;
  private cycleEjected = true;
  private hammerAngle: number;
  private pumpRestZ: number;
  /** Aim spread half-angle in degrees (next shot). */
  spread = 0;
  /** What the crosshair shows: aim spread + pellet cone. */
  displaySpread = 0;
  /** Damage and shot-sound pitch multipliers (the SwordRifle's repair stage sets them). */
  damageMul = 1;
  toneMul = 1;
  readonly pose: WeaponPose;

  constructor(
    readonly def: WeaponDef,
    readonly model: WeaponModel,
    infiniteReserve: boolean,
  ) {
    this.mag = def.magSize;
    this.reserve = infiniteReserve || def.infiniteReserve ? Infinity : def.reserve;
    this.hammerAngle = model.hammerCocked;
    this.pumpRestZ = model.pump?.position.z ?? 0;
    this.pose = {
      kickPos: new Spring3(420, 24),
      kickRot: new Spring3(420, 24),
      tilt: 0,
      drop: 0,
      leftHand: (root, biped, out) => this.leftHand(root, biped, out),
    };
    this.syncModel();
  }

  refill() {
    this.mag = this.def.magSize;
    if (this.reserve !== Infinity) this.reserve = this.def.reserve;
    this.cancelReload(false);
  }

  /** Progress shown in the HUD (0..1). */
  get reloadProgress() {
    if (!this.reloading) return 0;
    if (this.def.reloadMode === 'single') return clamp((this.mag + this.reloadT) / this.def.magSize, 0, 1);
    return this.reloadT;
  }

  startReload(ctx: GunContext) {
    if (this.reloading || this.mag >= this.def.magSize || this.reserve <= 0 || ctx.player.controller.committed) return;
    this.reloading = true;
    this.reloadT = 0;
    this.roundsThisReload = 0;
    this.reloadEvents.clear();
    ctx.player.combatTimer = Math.max(ctx.player.combatTimer, tuning.player.combatModeTime);
  }

  /** Dodge or swap cancels a reload and its progress is lost (rounds already loaded one-by-one stay). */
  cancelReload(lost: boolean, hud?: Hud) {
    if (!this.reloading) return;
    this.reloading = false;
    this.reloadT = 0;
    this.syncModel();
    if (lost && hud) hud.toast('reload lost');
  }

  /**
   * @param canAct false while swapping weapons (no firing or reloading)
   */
  update(dt: number, ctx: GunContext, fireHeld: boolean, firePressed: boolean, reloadPressed: boolean, canAct = true) {
    const d = this.def;
    const p = ctx.player;
    const committed = p.controller.committed || !canAct;

    // Springs follow the def every frame so panel edits apply live.
    this.pose.kickPos.set(d.weaponKickStiffness, d.weaponKickDamping);
    this.pose.kickRot.set(d.weaponKickStiffness, d.weaponKickDamping);
    ctx.camera.kickPitch.stiffness = ctx.camera.kickYaw.stiffness = d.cameraKickStiffness;
    ctx.camera.kickPitch.damping = ctx.camera.kickYaw.damping = d.cameraKickDamping;
    ctx.camera.fovPunch.stiffness = d.fovPunchStiffness;
    ctx.camera.fovPunch.damping = d.fovPunchDamping;
    this.pose.kickPos.step(dt);
    this.pose.kickRot.step(dt);

    if (this.reloading && p.controller.rolling) this.cancelReload(true, ctx.hud);
    if (reloadPressed && canAct) this.startReload(ctx);
    // Single-round reloads give way to the trigger instantly (responsive trigger).
    if (this.reloading && d.reloadMode === 'single' && firePressed && this.mag > 0 && !p.controller.committed) this.cancelReload(false);

    if (this.reloading) this.stepReload(dt, ctx);
    this.reloadEnv = damp(this.reloadEnv, this.reloading ? 1 : 0, 12, dt);
    this.pose.tilt = tuning.reload.weaponTiltDeg * DEG * this.reloadEnv;
    this.pose.drop = tuning.reload.weaponDrop * this.reloadEnv;

    // ---- action cycle (pump / bolt) after a shot
    if (this.cycleT < 1) {
      this.cycleT = Math.min(1, this.cycleT + dt / Math.max(0.02, this.cycleDur));
      if (d.cycle === 'pump' && !this.cycleEjected && this.cycleT > 0.45) {
        this.cycleEjected = true;
        this.ejectCasing(ctx, PROPS.seedPale);
      }
    }

    // ---- fire: resolve on the input frame; the RPM accumulator lets low frame rates keep up.
    this.sinceShot += dt;
    const interval = 60 / Math.max(1, d.rpm);
    // A click shorter than one frame still fires: the press itself counts for automatics too.
    // Semi-autos buffer a press briefly, so clicking just before the pump/bolt finishes still fires.
    if (firePressed) this.fireBuffer = tuning.feel.fireBuffer;
    else this.fireBuffer = Math.max(0, this.fireBuffer - dt);
    const wants = d.auto ? fireHeld || firePressed : firePressed || this.fireBuffer > 0;
    const canShoot = !committed && !this.reloading && this.mag > 0;
    if (wants && !committed && !this.reloading && this.mag <= 0 && firePressed) {
      ctx.synth.dry();
      this.startReload(ctx);
    }
    const shots = stepFireRate(this.fireRate, dt, interval, wants, canShoot, d.auto ? 8 : 1);
    for (let i = 0; i < shots && this.mag > 0; i++) this.fire(ctx, interval);
    if (shots > 0) this.fireBuffer = 0;
    if (this.sinceShot > Math.max(0.25, interval * 2.5)) this.shotIndex = 0;
    if (this.sinceShot > interval * 1.5) this.bloom = Math.max(0, this.bloom - d.bloomRecovery * dt);

    // ---- current spread for crosshair + next shot
    const c = p.controller;
    const hspeed = Math.hypot(c.vel.x, c.vel.z);
    let s = THREE.MathUtils.lerp(d.hipSpread, d.adsSpread, ctx.camera.adsAmount);
    if (hspeed > 1) s *= THREE.MathUtils.lerp(1, d.moveSpreadMul, clamp(safeDiv(hspeed, tuning.player.walkSpeed), 0, 1));
    if (!c.grounded) s *= d.airSpreadMul;
    this.spread = s + this.bloom;
    this.displaySpread = this.spread + this.pelletCone(ctx);

    this.syncModel();
  }

  private pelletCone(ctx: GunContext) {
    return this.def.pellets > 1 ? this.def.pelletSpread * THREE.MathUtils.lerp(1, this.def.adsPelletMul, ctx.camera.adsAmount) : 0;
  }

  private stepReload(dt: number, ctx: GunContext) {
    const d = this.def;
    ctx.player.combatTimer = Math.max(ctx.player.combatTimer, 0.3);
    this.reloadT += dt / Math.max(0.05, d.reloadTime);
    if (d.reloadMode === 'single') {
      // Per round: reach to the pouch, carry a seed to the port, push it in.
      if (this.reloadT >= 0.4 && !this.reloadEvents.has('pouch')) {
        this.reloadEvents.add('pouch');
        ctx.synth.reload('pouch');
      }
      if (this.reloadT >= 1) {
        this.mag++;
        if (this.reserve !== Infinity) this.reserve--;
        this.roundsThisReload++;
        ctx.synth.reload('in');
        this.pose.kickPos.z.impulse(-0.5);
        this.reloadEvents.clear();
        if (this.mag >= d.magSize || this.reserve <= 0) this.cancelReload(false);
        else this.reloadT -= 1;
      }
      return;
    }
    this.magFoley(ctx);
    if (this.reloadT >= 1) {
      const take = Math.min(d.magSize - this.mag, this.reserve);
      this.mag += take;
      if (this.reserve !== Infinity) this.reserve -= take;
      this.cancelReload(false);
    }
  }

  private fire(ctx: GunContext, interval: number) {
    const d = this.def;
    const { physics, player, camera, fx, synth } = ctx;
    this.mag--;
    this.sinceShot = 0;
    player.combatTimer = tuning.player.combatModeTime;
    const shotId = nextShotId++;
    ctx.onShot(shotId);
    const fb = new ShotFeedback(shotId);

    const exclude = player.controller.collider;
    _origin.copy(camera.aimOrigin).addScaledVector(camera.aimDir, camera.aimStartOffset);
    _mz.copy(player.muzzleWorld);
    // One aim deviation per trigger pull; pellets fan out around it in a fixed pattern.
    this.spreadDir(camera.aimDir, this.spread, _aim);
    const n = Math.max(1, Math.round(d.pellets));
    const cone = this.pelletCone(ctx);

    for (let i = 0; i < n; i++) {
      if (n > 1) this.pelletDir(_aim, cone, i, n, d.pelletJitter, _dir);
      else _dir.copy(_aim);

      if (!d.hitscan) {
        // Projectile: fly from the muzzle toward where the camera ray lands.
        const h = physics.raycast(_origin, _dir, d.range, GROUPS.qShot, exclude, hitA);
        const target = h ? h.point : _end.copy(_origin).addScaledVector(_dir, d.range);
        _tmp.subVectors(target, _mz).normalize();
        ctx.projectiles.launch(d, _mz, _tmp, fb, this.damageMul);
        continue;
      }

      const skip = new Set<number>();
      let pierceLeft = d.pierce;
      let from = _origin;
      let range = d.range;
      let lastPoint: THREE.Vector3 | null = null;
      // Walk the ray, passing through up to `pierce` targets.
      for (let seg = 0; seg < 4; seg++) {
        const pred = skip.size ? (col: RAPIER.Collider) => !skip.has(col.handle) : undefined;
        let hit = physics.raycast(from, _dir, range, GROUPS.qShot, exclude, hitA, pred);
        // Muzzle check (first segment only): the camera ray can see past cover the gun can't.
        if (seg === 0) {
          const target = hit ? hit.point : _end.copy(from).addScaledVector(_dir, range);
          _tmp.subVectors(target, _mz);
          const len = _tmp.length();
          if (len > 0.05) {
            _tmp.divideScalar(len);
            const block = physics.raycast(_mz, _tmp, len - 0.05, GROUPS.qShot, exclude, hitB, pred);
            if (block) hit = block;
          }
        }
        if (!hit) {
          lastPoint = _end.copy(from).addScaledVector(_dir, range).clone();
          break;
        }
        lastPoint = hit.point.clone();
        const struck = resolveHit(ctx, d, hit, _dir, fb, this.damageMul);
        if (struck && pierceLeft-- > 0) {
          skip.add(hit.collider.handle);
          from = hit.point.clone();
          range -= hit.distance;
          continue;
        }
        break;
      }
      if (lastPoint) fx.tracer(_mz, lastPoint, d.tracerColor, d.tracerSpeed, d.tracerLength, d.tracerWidth);
    }
    fb.flush(ctx);

    // ---- feedback
    fx.muzzleFlash(_mz, d.flashScale, d.flashFrames, d.flashLight, d.flashColor);
    if (d.cycle !== 'pump' && d.casingSpeed > 0) this.ejectCasing(ctx, PROPS.wood);
    synth.shot(d, this.toneMul);
    this.applyRecoil(ctx);
    this.bloom = Math.min(d.bloomMax, this.bloom + d.bloomPerShot);
    this.shotIndex++;
    if (d.selfKnockback > 0) player.controller.push(-camera.aimDir.x * d.selfKnockback, -camera.aimDir.z * d.selfKnockback);

    if (d.cycle !== 'none') {
      this.cycleT = 0;
      this.cycleDur = interval * clamp(d.cycleTime, 0.05, 1);
      this.cycleEjected = false;
      synth.playLayers(d.cycleLayers, 1, d.volume);
      if (d.cycle === 'bolt') this.hammerAngle = 0;
    }
  }

  private ejectCasing(ctx: GunContext, color: number) {
    const d = this.def;
    const q = ctx.player.weaponRoot.quaternion;
    const right = _a.set(1, 0, 0).applyQuaternion(q);
    const up = _b.set(0, 1, 0).applyQuaternion(q);
    const speed = Math.max(0.5, d.casingSpeed);
    ctx.fx.casing(ctx.player.ejectWorld, _w.copy(right).multiplyScalar(speed).addScaledVector(up, speed * 0.9).add(ctx.player.controller.vel), color);
  }

  /** Pattern + randomness → camera climb (kept) and kick (springs back), weapon spring, FOV punch, trauma. */
  private applyRecoil(ctx: GunContext) {
    const d = this.def;
    const cam = ctx.camera;
    const i = this.shotIndex;
    const ramp = 1 + d.recoilRamp * Math.min(1, i / Math.max(1, d.recoilRampShots));
    const adsMul = THREE.MathUtils.lerp(1, d.adsRecoilMul, cam.adsAmount);
    const mul = adsMul * d.cameraKickMul * DEG;
    const pitch = (d.recoilVertical * ramp + spreadRng.signed() * d.recoilRandom) * mul;
    const yaw = (d.recoilHorizontal * Math.sin(i * d.recoilHorizontalFreq) + d.recoilHorizontalBias + spreadRng.signed() * d.recoilRandom) * mul;
    const keep = 1 - d.kickReturn;
    cam.pitch = clamp(cam.pitch + pitch * keep, tuning.camera.pitchMinDeg * DEG, tuning.camera.pitchMaxDeg * DEG);
    cam.yaw -= yaw * keep;
    cam.kickPitch.x += pitch * d.kickReturn;
    cam.kickYaw.x -= yaw * d.kickReturn;

    // Separate procedural weapon/arm spring: impulse sized so the peak ≈ the configured amount.
    const kv = Math.sqrt(d.weaponKickStiffness) * 1.3;
    this.pose.kickPos.z.impulse(d.weaponKickBack * kv);
    this.pose.kickPos.y.impulse(d.weaponKickBack * 0.25 * kv);
    this.pose.kickRot.x.impulse(d.weaponKickPitch * DEG * kv);
    this.pose.kickRot.z.impulse(spreadRng.signed() * d.weaponKickRoll * DEG * kv);
    cam.fovPunch.impulse(d.fovPunch * Math.sqrt(d.fovPunchStiffness) * 1.3);
    cam.addTrauma(d.trauma);
  }

  private basis(base: THREE.Vector3) {
    _u.set(0, 1, 0);
    if (Math.abs(base.y) > 0.95) _u.set(1, 0, 0);
    _a.crossVectors(base, _u).normalize();
    _b.crossVectors(_a, base).normalize();
  }

  /** Random direction uniformly inside a cone of half-angle spreadDeg. */
  private spreadDir(base: THREE.Vector3, spreadDeg: number, out: THREE.Vector3) {
    out.copy(base);
    if (spreadDeg <= 0) return out;
    const r = Math.tan(spreadDeg * DEG) * Math.sqrt(spreadRng());
    const th = spreadRng() * Math.PI * 2;
    this.basis(base);
    return out.addScaledVector(_a, Math.cos(th) * r).addScaledVector(_b, Math.sin(th) * r).normalize();
  }

  /** Pellet i of n on a sunflower pattern (even, readable spread) with a little jitter. */
  private pelletDir(base: THREE.Vector3, coneDeg: number, i: number, n: number, jitter: number, out: THREE.Vector3) {
    const k = Math.sqrt((i + 0.5) / n);
    const r = Math.tan(coneDeg * DEG) * k * (1 + spreadRng.signed() * jitter * 0.5);
    const th = i * GOLDEN + spreadRng.signed() * jitter;
    this.basis(base);
    return out.copy(base).addScaledVector(_a, Math.cos(th) * r).addScaledVector(_b, Math.sin(th) * r).normalize();
  }

  private magFoley(ctx: GunContext) {
    const r = tuning.reload;
    const ev = (name: string, at: number, fn: () => void) => {
      if (this.reloadT >= at && !this.reloadEvents.has(name)) {
        this.reloadEvents.add(name);
        fn();
      }
    };
    ev('out', r.magOutAt, () => ctx.synth.reload('out'));
    ev('pouch', r.pouchAt, () => ctx.synth.reload('pouch'));
    ev('in', r.magInAt, () => {
      ctx.synth.reload('in');
      this.pose.kickPos.y.impulse(-0.6);
    });
    ev('rack', r.rackAt, () => {
      ctx.synth.reload('rack');
      this.pose.kickPos.z.impulse(0.8);
    });
  }

  /** Pump slide, hammer angle and magazine visibility follow the gun's state. */
  private syncModel() {
    const m = this.model;
    const r = tuning.reload;
    const c = this.cycleT;
    if (m.pump) {
      // Back then forward: rack-rack.
      const k = c < 1 ? Math.sin(Math.PI * smoothstep(0.05, 0.85, c)) : 0;
      m.pump.position.z = this.pumpRestZ + m.pumpTravel * k;
    }
    if (m.hammer) {
      if (this.reloading && this.def.reloadMode === 'mag') {
        // Hinge the arm open to swap the staple strip.
        const t = this.reloadT;
        const open = smoothstep(0.08, r.magOutAt, t) * (1 - smoothstep(r.magInAt, r.rackAt, t));
        m.hammer.rotation.x = THREE.MathUtils.lerp(m.hammerCocked, 1.05, open);
      } else {
        if (this.cycleT < 1) this.hammerAngle = THREE.MathUtils.lerp(0, m.hammerCocked, smoothstep(0.3, 0.75, c));
        else if (this.cycleT >= 1 && this.hammerAngle !== 0) this.hammerAngle = m.hammerCocked;
        m.hammer.rotation.x = this.hammerAngle;
      }
    }
    if (!this.reloading) {
      m.mag.position.copy(m.magSeat);
      m.mag.visible = !m.magHiddenAtRest;
    }
    if (m.loaded) m.loaded.visible = this.mag > 0 && !(this.reloading && this.reloadT > r.magOutAt);
  }

  /** Off-hand target: reload choreography, pump/bolt cycle, or resting on the fore-grip. */
  private leftHand(root: THREE.Object3D, biped: Biped, out: THREE.Vector3): THREE.Vector3 {
    const m = this.model;
    if (this.reloading) return this.def.reloadMode === 'single' ? this.singleReloadHand(root, biped, out) : this.magReloadHand(root, biped, out);
    const fore = out.copy(m.fore);
    if (this.cycleT < 1) {
      const c = this.cycleT;
      if (this.def.cycle === 'pump' && m.pump) {
        fore.z += m.pump.position.z - this.pumpRestZ;
      } else if (this.def.cycle === 'bolt' && m.hammer) {
        // Reach up to the arm, lift it to cocked, come back.
        m.hammer.updateMatrix();
        const grip = _w.copy(m.hammerGrip).applyMatrix4(m.hammer.matrix);
        const reach = smoothstep(0, 0.3, c) * (1 - smoothstep(0.75, 1, c));
        fore.lerp(grip, reach);
      }
    }
    return fore.applyMatrix4(root.matrixWorld);
  }

  private pouchPoint(biped: Biped, out: THREE.Vector3) {
    const p = BODY.pouch;
    out.copy(biped.hips).addScaledVector(biped.right, p.x).addScaledVector(biped.forward, -p.z);
    out.y += p.y;
    return out;
  }

  /** One round per cycle: hand to pouch, seed to the port, push it in. */
  private singleReloadHand(root: THREE.Object3D, biped: Biped, out: THREE.Vector3): THREE.Vector3 {
    const m = this.model;
    const t = this.reloadT;
    const start = _a.copy(this.roundsThisReload === 0 ? m.fore : m.loadPort).applyMatrix4(root.matrixWorld);
    const port = _b.copy(m.loadPort).applyMatrix4(root.matrixWorld);
    const pushed = _tmp.copy(m.loadPort).add(_end.set(-0.01, 0, -0.05)).applyMatrix4(root.matrixWorld);
    const pouch = this.pouchPoint(biped, _u);
    if (t < 0.4) out.lerpVectors(start, pouch, smoothstep(0, 0.4, t));
    else if (t < 0.8) out.lerpVectors(pouch, port, smoothstep(0.4, 0.8, t));
    else out.lerpVectors(port, pushed, smoothstep(0.8, 1, t));
    const carrying = t >= 0.4 && t < 0.95;
    m.mag.visible = carrying || !m.magHiddenAtRest;
    if (carrying) m.mag.position.copy(root.worldToLocal(_end.copy(out)));
    return out;
  }

  /** Whole-magazine choreography: off the seat, to the hip, back on, then work the lever. */
  private magReloadHand(root: THREE.Object3D, biped: Biped, out: THREE.Vector3): THREE.Vector3 {
    const r = tuning.reload;
    const m = this.model;
    const t = this.reloadT;
    const fore = _a.copy(m.fore).applyMatrix4(root.matrixWorld);
    const seat = _b.copy(m.magSeat).applyMatrix4(root.matrixWorld);
    seat.y += 0.03;
    const pouch = this.pouchPoint(biped, _u);
    const lever = _w.copy(m.lever).applyMatrix4(root.matrixWorld);
    const leverBack = _tmp.copy(m.lever).add(_end.set(0.02, 0, 0.09)).applyMatrix4(root.matrixWorld);

    const seg = (t0: number, t1: number) => smoothstep(t0, t1, t);
    const reach = Math.min(r.handReachTime, r.magOutAt);
    if (t < reach) out.lerpVectors(fore, seat, seg(0, reach));
    else if (t < r.magOutAt) out.copy(seat);
    else if (t < r.pouchAt) out.lerpVectors(seat, pouch, seg(r.magOutAt, r.pouchAt));
    else if (t < r.magInAt) out.lerpVectors(pouch, seat, seg(r.pouchAt, r.magInAt));
    else if (t < r.rackAt) {
      const k = seg(r.magInAt, r.magInAt + (r.rackAt - r.magInAt) * 0.6);
      out.lerpVectors(seat, lever, k);
      if (t > r.rackAt - 0.06) out.lerp(leverBack, seg(r.rackAt - 0.06, r.rackAt));
    } else out.lerpVectors(leverBack, fore, seg(r.rackAt, 1));

    // The magazine rides in the hand between mag-out and mag-in.
    if (t >= r.magOutAt && t < r.magInAt) m.mag.position.copy(root.worldToLocal(_end.copy(out)));
    else m.mag.position.copy(m.magSeat);
    m.mag.visible = true;
    return out;
  }
}

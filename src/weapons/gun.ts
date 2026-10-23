// Weapon behaviour: fire on the input frame, spread/bloom, recoil pattern, kick springs, hit resolution,
// feedback (flash, tracer, impacts, decals, casings, markers, hitstop, audio) and committed reload.
import * as THREE from 'three';
import { clamp, DEG, safeDiv, smoothstep, Spring3 } from '../core/math';
import { makeRng } from '../core/rng';
import type { Synth } from '../audio/synth';
import type { Fx } from '../fx/fx';
import type { Biped } from '../anim/biped';
import type { Clock } from '../core/time';
import { GROUPS, Physics, type RayHit, type RAPIER } from '../physics/world';
import type { OTSCamera } from '../player/camera';
import type { Player, WeaponPose } from '../player/player';
import { GARDEN, SIGNAL } from '../render/palette';
import { tuning } from '../tuning';
import type { Hud, HitKind } from '../ui/hud';
import type { WeaponDef } from './defs';
import type { WeaponModel } from './model';

export interface HitEvent {
  damage: number;
  kind: HitKind;
  distance: number;
  owner: unknown;
}

export interface GunContext {
  physics: Physics;
  player: Player;
  camera: OTSCamera;
  fx: Fx;
  synth: Synth;
  hud: Hud;
  clock: Clock;
  onHit: (e: HitEvent) => void;
  onShot: () => void;
}

const _origin = new THREE.Vector3();
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

/** Spread uses its own stream: deterministic per seed, independent of world generation. */
const spreadRng = makeRng(0x5eed);

export class Gun {
  mag: number;
  reserve: number;
  private cooldown = 0;
  private shotIndex = 0;
  private sinceShot = 10;
  bloom = 0;
  reloading = false;
  reloadT = 0;
  private reloadEvents = new Set<string>();
  /** Current total spread half-angle in degrees (for the crosshair). */
  spread = 0;
  readonly pose: WeaponPose;

  constructor(
    readonly def: WeaponDef,
    readonly model: WeaponModel,
    infiniteReserve: boolean,
  ) {
    this.mag = def.magSize;
    this.reserve = infiniteReserve ? Infinity : def.reserve;
    this.pose = { kickPos: new Spring3(420, 24), kickRot: new Spring3(420, 24), tilt: 0, drop: 0, leftHand: null };
  }

  refill() {
    this.mag = this.def.magSize;
    if (this.reserve !== Infinity) this.reserve = this.def.reserve;
    this.cancelReload(false);
  }

  get canFireNow() {
    return !this.reloading && this.mag > 0;
  }

  startReload(ctx: GunContext) {
    if (this.reloading || this.mag >= this.def.magSize || this.reserve <= 0 || ctx.player.controller.committed) return;
    this.reloading = true;
    this.reloadT = 0;
    this.reloadEvents.clear();
    ctx.player.combatTimer = Math.max(ctx.player.combatTimer, tuning.player.combatModeTime);
    this.pose.leftHand = (root, biped, out) => this.reloadHand(root, biped, out);
  }

  /** Dodge cancels a reload and the progress is lost. */
  cancelReload(lost: boolean, hud?: Hud) {
    if (!this.reloading) return;
    this.reloading = false;
    this.reloadT = 0;
    this.pose.leftHand = null;
    this.pose.tilt = 0;
    this.pose.drop = 0;
    this.model.mag.position.copy(this.model.magSeat);
    this.model.mag.visible = true;
    if (lost && hud) hud.toast('reload lost');
  }

  /**
   * @param fireHeld trigger held this frame
   * @param firePressed trigger went down this frame
   */
  update(dt: number, ctx: GunContext, fireHeld: boolean, firePressed: boolean, reloadPressed: boolean) {
    const d = this.def;
    const p = ctx.player;
    const committed = p.controller.committed;

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
    if (reloadPressed) this.startReload(ctx);

    // ---- reload progress
    if (this.reloading) {
      this.reloadT += dt / Math.max(0.05, d.reloadTime);
      this.reloadFoley(ctx);
      const r = tuning.reload;
      const env = smoothstep(0, 0.14, this.reloadT) * (1 - smoothstep(0.88, 1, this.reloadT));
      this.pose.tilt = r.weaponTiltDeg * DEG * env;
      this.pose.drop = r.weaponDrop * env;
      p.combatTimer = Math.max(p.combatTimer, 0.3);
      if (this.reloadT >= 1) {
        const need = d.magSize - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take;
        if (this.reserve !== Infinity) this.reserve -= take;
        this.cancelReload(false);
      }
    }

    // ---- fire: resolve on the input frame; the RPM accumulator lets low frame rates keep up.
    this.sinceShot += dt;
    const interval = 60 / Math.max(1, d.rpm);
    this.cooldown -= dt;
    // A click shorter than one frame still fires: the press itself counts for automatics too.
    const wants = d.auto ? fireHeld || firePressed : firePressed;
    if (!wants && this.cooldown < 0) this.cooldown = 0;
    if (wants && !committed && !this.reloading) {
      if (this.mag <= 0) {
        if (firePressed) {
          ctx.synth.dry();
          this.startReload(ctx);
        }
      } else {
        let guard = 0;
        while (this.cooldown <= 0 && this.mag > 0 && guard++ < 8) {
          this.fire(ctx);
          this.cooldown += interval;
          if (!d.auto) break;
        }
      }
    }
    if (this.sinceShot > Math.max(0.25, interval * 2.5)) this.shotIndex = 0;
    if (this.sinceShot > interval * 1.5) this.bloom = Math.max(0, this.bloom - d.bloomRecovery * dt);

    // ---- current spread for crosshair + next shot
    const c = p.controller;
    const hspeed = Math.hypot(c.vel.x, c.vel.z);
    let s = THREE.MathUtils.lerp(d.hipSpread, d.adsSpread, ctx.camera.adsAmount);
    if (hspeed > 0.6) s *= THREE.MathUtils.lerp(1, d.moveSpreadMul, clamp(safeDiv(hspeed, tuning.player.walkSpeed), 0, 1));
    if (!c.grounded) s *= d.airSpreadMul;
    this.spread = s + this.bloom;

    if (this.model.loaded) this.model.loaded.visible = this.mag > 0 && !(this.reloading && this.reloadT > tuning.reload.magOutAt);
  }

  private fire(ctx: GunContext) {
    const d = this.def;
    const { physics, player, camera, fx, synth, hud, clock } = ctx;
    this.mag--;
    this.sinceShot = 0;
    player.combatTimer = tuning.player.combatModeTime;
    ctx.onShot();

    const exclude = player.controller.collider;
    _origin.copy(camera.aimOrigin).addScaledVector(camera.aimDir, camera.aimStartOffset);
    _mz.copy(player.muzzleWorld);
    let hitstop = 0;

    for (let pellet = 0; pellet < Math.max(1, d.pellets); pellet++) {
      this.spreadDir(camera.aimDir, this.spread, _dir);
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
        const dist = hit.point.distanceTo(player.pos);
        if (hit.target && hit.target.owner.alive) {
          const crit = hit.target.part === 'weak';
          const falloff = THREE.MathUtils.lerp(1, d.falloffMinMul, clamp((dist - d.falloffStart) / Math.max(0.01, d.falloffEnd - d.falloffStart), 0, 1));
          let dmg = d.damage * falloff * (crit ? d.critMultiplier : 1);
          if (hit.target.part === 'armor') dmg *= 0.2;
          const killed = hit.target.owner.takeDamage({
            amount: dmg,
            crit,
            point: hit.point,
            dir: _dir,
            knockback: d.knockback,
            stagger: d.stagger,
          });
          const kind: HitKind = killed ? 'kill' : crit ? 'crit' : 'hit';
          hud.hit(kind);
          synth.hit(kind);
          fx.sparksAt(hit.point, _dir, crit || killed ? SIGNAL.crit : 0xffffff, crit ? 10 : 6, crit ? 6 : 4);
          if (killed) hitstop = Math.max(hitstop, tuning.feel.hitstopKill);
          else if (crit) hitstop = Math.max(hitstop, tuning.feel.hitstopCrit);
          ctx.onHit({ damage: dmg, kind, distance: dist, owner: hit.target.owner });
          if (pierceLeft-- > 0) {
            skip.add(hit.collider.handle);
            from = hit.point.clone();
            range -= hit.distance;
            continue;
          }
        } else if (!hit.target) {
          fx.impact(hit.point, hit.normal, GARDEN.dust, d.impactParticles, d.impactSpeed);
          fx.decal(hit.point, hit.normal, 0.07, GARDEN.decal);
        }
        break;
      }
      if (lastPoint) fx.tracer(_mz, lastPoint, d.tracerColor, d.tracerSpeed, d.tracerLength, d.tracerWidth);
    }
    if (hitstop > 0) clock.addHitstop(hitstop);

    // ---- feedback
    fx.muzzleFlash(_mz, d.flashScale, d.flashFrames, d.flashLight, d.flashColor);
    const right = _a.set(1, 0, 0).applyQuaternion(player.weaponRoot.quaternion);
    const up = _b.set(0, 1, 0).applyQuaternion(player.weaponRoot.quaternion);
    fx.casing(
      player.ejectWorld,
      _w.copy(right).multiplyScalar(d.casingSpeed).addScaledVector(up, d.casingSpeed * 0.9).add(player.controller.vel),
      0xd9a066,
    );
    synth.shot(d);
    this.applyRecoil(ctx);
    this.bloom = Math.min(d.bloomMax, this.bloom + d.bloomPerShot);
    this.shotIndex++;
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

  private spreadDir(base: THREE.Vector3, spreadDeg: number, out: THREE.Vector3) {
    out.copy(base);
    if (spreadDeg <= 0) return out;
    // Uniform over the cone's disc.
    const r = Math.tan(spreadDeg * DEG) * Math.sqrt(spreadRng());
    const th = spreadRng() * Math.PI * 2;
    _u.set(0, 1, 0);
    if (Math.abs(base.y) > 0.95) _u.set(1, 0, 0);
    _a.crossVectors(base, _u).normalize();
    _b.crossVectors(_a, base).normalize();
    out.addScaledVector(_a, Math.cos(th) * r).addScaledVector(_b, Math.sin(th) * r).normalize();
    return out;
  }

  private reloadFoley(ctx: GunContext) {
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

  /** Procedural reload choreography for the off hand (and the magazine it carries). */
  private reloadHand(root: THREE.Object3D, biped: Biped, out: THREE.Vector3): THREE.Vector3 {
    const r = tuning.reload;
    const m = this.model;
    const t = this.reloadT;
    const fore = _a.copy(m.fore).applyMatrix4(root.matrixWorld);
    const seat = _b.copy(m.magSeat).applyMatrix4(root.matrixWorld);
    seat.y += 0.03;
    const pouch = _u.copy(biped.hips).addScaledVector(biped.right, -0.16).addScaledVector(biped.forward, 0.02);
    pouch.y += 0.02;
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
    if (t >= r.magOutAt && t < r.magInAt) {
      m.mag.position.copy(root.worldToLocal(_end.copy(out)));
    } else {
      m.mag.position.copy(m.magSeat);
    }
    return out;
  }
}

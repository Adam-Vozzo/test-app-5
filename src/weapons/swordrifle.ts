// The SwordRifle (DESIGN.md → Weapons): one weapon, two modes, one pool of charges.
//   Rifle mode: the wrapped Gun fires heavy bolts; each shot spends a charge (charges are its magazine, no reload).
//   Sword mode: LMB swings a three-hit combo, RMB held charges a heavy strike. Blade hits refill charges; the charged
//   strike spends them. F switches modes with a committed transform (the stock folds into a pommel).
// Charge cells on the weapon and HUD pips show the pool. The repair stage (rusted → restored) scales damage, switch
// time, tone and cell glow.
import * as THREE from 'three';
import { clamp, smoothstep } from '../core/math';
import { GROUPS, type DamageInfo, type Damageable, type HitTarget, type RayHit } from '../physics/world';
import { SIGNAL } from '../render/palette';
import { tuning } from '../tuning';
import type { HitKind } from '../ui/hud';
import { REPAIR_STAGES, type SwordMeleeDef } from './defs';
import type { Gun, GunContext } from './gun';
import { blockFeedback } from './hit';
import { bladePose, chargeAfterHit, SwingState, type BladePose, type MeleeTiming, type SwingDef, type SwingEvent } from './swing';

export type SwordMode = 'rifle' | 'sword';

export interface SwordInput {
  fireHeld: boolean;
  firePressed: boolean;
  reloadPressed: boolean;
  aimHeld: boolean;
  aimPressed: boolean;
  aimReleased: boolean;
  switchPressed: boolean;
}

/** Sword-mode weapon placement for Player.animate: body-relative blade angles, hand reach, and 0..1 blend. */
export interface SwordPose {
  blend: number;
  yaw: number;
  pitch: number;
  roll: number;
  reach: number;
  handY: number;
}

const DEG = Math.PI / 180;
const SAMPLES = 6;
const SPENT = new THREE.Color(0x2b2f38);
const WHITE = new THREE.Color(1, 1, 1);
const _c = new THREE.Color();
const _lit = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hit: RayHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, collider: null as never, target: null };
const RUST = new THREE.Color(0xa86a4a);
/** Arc sweep step (radians). */
const ARC_STEP = 12 * (Math.PI / 180);
const _arcQ = new THREE.Quaternion();
const _stepQ = new THREE.Quaternion();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _chestT = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _neg = new THREE.Vector3();

function timing(m: SwordMeleeDef): MeleeTiming {
  return {
    combo: [m.swing1 as SwingDef, m.swing2 as SwingDef, m.swing3 as SwingDef],
    charged: m.charged as SwingDef,
    comboWindow: m.comboWindow,
    cancelInto: m.cancelInto,
    chargeHold: m.chargeHold,
  };
}

export class SwordRifle {
  mode: SwordMode = 'rifle';
  /** 0 = rifle pose, 1 = sword pose; animates through a switch. */
  blend = 0;
  switching = false;
  private switchT = 0;
  private switchFrom = 0;
  private switchClacked = false;
  readonly swing = new SwingState();
  readonly pose: SwordPose = { blend: 0, yaw: 0, pitch: 0, roll: 0, reach: 0.4, handY: -0.08 };
  private blade: BladePose = { yaw: 0, pitch: 0, roll: 0 };
  private events: SwingEvent[] = [];
  private struck = new Set<Damageable>();
  private gained = 0;
  private prev: THREE.Vector3[] = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  private cur: THREE.Vector3[] = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  private havePrev = false;
  private prevChest = new THREE.Vector3();
  private flare: number[] = [];
  private dryFlicker = 0;
  private emptyToasts = 0;
  private lastMag: number;

  constructor(readonly gun: Gun) {
    this.lastMag = gun.mag;
    this.syncCells(0);
  }

  get stage() {
    return REPAIR_STAGES[clamp(Math.round(tuning.swordRifle.repairStage), 0, REPAIR_STAGES.length - 1)];
  }
  /** Swinging, charging or mid-transform: no swap, no heal. */
  get busy() {
    return this.switching || this.swing.busy;
  }
  /** Committed: a swing's windup and active phases can't be rolled out of. */
  get blocksRoll() {
    return !this.swing.canCancel;
  }
  get allowsAim() {
    return this.mode === 'rifle' && !this.switching;
  }
  get moveMul() {
    return this.swing.busy ? tuning.melee.moveMul : this.switching ? 0.6 : 1;
  }
  get charges() {
    return this.gun.mag;
  }
  get maxCharges() {
    return this.gun.def.magSize;
  }

  /** A roll cancels a switch in progress (the transform is lost) and any cancellable swing or charge. */
  onRoll() {
    if (this.switching) {
      this.switching = false;
      this.mode = this.switchFrom > 0.5 ? 'sword' : 'rifle';
    }
    if (this.swing.busy && this.swing.canCancel) this.swing.cancel();
  }

  /** Death, swap-away, rest: stop whatever was in progress. */
  cancelActions() {
    this.swing.cancel();
    if (this.switching) {
      this.switching = false;
      this.mode = this.switchFrom > 0.5 ? 'sword' : 'rifle';
    }
    this.blend = this.mode === 'sword' ? 1 : 0;
  }

  update(dt: number, ctx: GunContext, inp: SwordInput, canAct: boolean) {
    const st = this.stage;
    this.gun.damageMul = st.damageMul;
    this.gun.toneMul = st.toneMul;
    const committed = ctx.player.controller.committed || !canAct;

    // ---- mode switch (F): committed transform; the stock folds, the off hand moves, the pose blends.
    if (inp.switchPressed && !committed && !this.busy && !this.gun.reloading && this.gun.cycleT >= 1) {
      this.switching = true;
      this.switchT = 0;
      this.switchFrom = this.blend;
      this.switchClacked = false;
      this.mode = this.mode === 'rifle' ? 'sword' : 'rifle';
      ctx.player.combatTimer = Math.max(ctx.player.combatTimer, 0.6);
    }
    if (this.switching) {
      const dur = Math.max(0.05, tuning.swordRifle.switchTime * st.switchMul);
      this.switchT += dt / dur;
      const target = this.mode === 'sword' ? 1 : 0;
      this.blend = THREE.MathUtils.lerp(this.switchFrom, target, smoothstep(0.15, 0.85, this.switchT));
      if (!this.switchClacked && this.switchT >= 0.45) {
        this.switchClacked = true;
        ctx.synth.sfx('modeSwitch', 1, 0, st.toneMul);
      }
      if (this.switchT >= 1) {
        this.switching = false;
        this.blend = target;
      }
    }

    // ---- rifle mode: the Gun does everything; a dry trigger flickers the empty cells.
    const rifle = this.mode === 'rifle' && !this.switching;
    this.gun.update(dt, ctx, rifle && inp.fireHeld, rifle && inp.firePressed, false, canAct && rifle);
    if (rifle && inp.firePressed && this.gun.mag <= 0 && !committed) this.emptyTrigger(ctx);

    // ---- sword mode: the swing state machine.
    const m = tuning.melee;
    const sword = this.mode === 'sword' && !this.switching && canAct && !ctx.player.controller.rolling;
    this.events.length = 0;
    if (sword || this.swing.busy) {
      this.swing.step(
        dt,
        {
          light: sword && inp.firePressed,
          heavyHeld: sword && inp.aimHeld,
          heavyPressed: sword && inp.aimPressed,
          heavyReleased: inp.aimReleased || !sword,
        },
        timing(m),
        this.events,
      );
    }
    for (const e of this.events) this.onSwingEvent(e, ctx);
    if (this.swing.busy) ctx.player.combatTimer = Math.max(ctx.player.combatTimer, tuning.player.combatModeTime);

    // ---- pose for Player.animate
    const guard = { yaw: m.guardYawDeg * DEG, pitch: m.guardPitchDeg * DEG, roll: 0 };
    const charge = { yaw: m.chargeYawDeg * DEG, pitch: m.chargePitchDeg * DEG, roll: 0 };
    bladePose(this.swing, timing(m), guard, charge, this.blade);
    const p = this.pose;
    p.blend = this.blend;
    p.yaw = this.blade.yaw;
    p.pitch = this.blade.pitch;
    p.roll = this.blade.roll;
    p.reach = m.reach;
    p.handY = m.handY;
    // The transform dips and tilts the weapon; the stock folds with the blend; the off hand follows.
    const sw = this.switching ? Math.sin(Math.PI * clamp(this.switchT, 0, 1)) : 0;
    this.gun.pose.drop += sw * 0.15;
    this.gun.pose.tilt += sw * 0.7;
    const s = this.gun.model.sword!;
    s.stock.rotation.x = s.stockFolded * this.blend;
    this.gun.model.fore.lerpVectors(s.rifleFore, s.swordFore, this.blend);
    _c.setRGB(1, 1, 1).lerp(RUST, clamp((1 - st.damageMul) / 0.35, 0, 1) * 0.7);
    s.steel.color.copy(_c);

    if (this.gun.mag > this.lastMag) this.flareFrom(this.lastMag, this.gun.mag);
    this.lastMag = this.gun.mag;
    this.syncCells(dt);
  }

  private onSwingEvent(e: SwingEvent, ctx: GunContext) {
    const m = tuning.melee;
    const st = this.stage;
    switch (e.type) {
      case 'chargeStart':
        if (this.gun.mag < m.chargedCost) {
          this.swing.cancel();
          this.emptyTrigger(ctx);
        }
        break;
      case 'chargeReady':
        ctx.synth.sfx('chargeReady', 1, 0, st.toneMul);
        break;
      case 'begin':
        this.struck.clear();
        this.gained = 0;
        this.havePrev = false;
        if (e.charged) this.gun.mag = Math.max(0, this.gun.mag - m.chargedCost);
        break;
      case 'activeStart': {
        const d = this.swing.def(timing(m));
        ctx.synth.sfx(this.swing.charged ? 'swingHeavy' : 'swing', 1, 0, st.toneMul * (0.95 + this.swing.index * 0.05));
        // Lunge along the view: a push that decays (pushDecay), so distance ≈ speed / decay.
        const yaw = ctx.camera.yaw;
        const v = d.lunge * tuning.player.pushDecay;
        ctx.player.controller.push(-Math.sin(yaw) * v, -Math.cos(yaw) * v);
        ctx.camera.addTrauma(this.swing.charged ? m.traumaCharged * 0.5 : m.trauma * 0.3);
        this.havePrev = false;
        break;
      }
      case 'activeEnd':
      case 'end':
        this.havePrev = false;
        break;
    }
  }

  private emptyTrigger(ctx: GunContext) {
    this.dryFlicker = 0.35;
    ctx.synth.dry();
    ctx.synth.sfx('chargeEmpty', 0.8);
    if (this.emptyToasts < 3) {
      this.emptyToasts++;
      ctx.hud.toast(this.mode === 'rifle' ? 'no charge: strike with the blade (F)' : `the charged strike needs ${tuning.melee.chargedCost} charges`, 1.8);
    }
  }

  /** Called after the rig is animated: sweep the blade from last frame to this frame and strike what it crosses. */
  afterAnimate(ctx: GunContext) {
    const s = this.gun.model.sword;
    if (!s) return;
    const root = ctx.player.weaponRoot;
    for (let i = 0; i < SAMPLES; i++) this.cur[i].lerpVectors(s.bladeBase, s.bladeTip, i / (SAMPLES - 1)).applyMatrix4(root.matrixWorld);
    const chest = ctx.player.biped.chest;
    if (this.swing.phase === 'active' && this.mode === 'sword') {
      const exclude = ctx.player.controller.collider;
      // Along the blade itself (catches anything it starts inside), then each sample's path since last frame.
      this.cast(ctx, this.cur[0], this.cur[SAMPLES - 1], exclude);
      if (this.havePrev) for (let i = 0; i < SAMPLES; i++) this.sweepArc(ctx, i, chest, exclude);
      this.havePrev = true;
    }
    for (let i = 0; i < SAMPLES; i++) this.prev[i].copy(this.cur[i]);
    this.prevChest.copy(chest);
  }

  /**
   * A fast swing moves the blade tens of degrees per frame at low frame rates. A straight chord between frames cuts
   * inside the arc and misses targets near the tip, so walk the arc around the chest in small steps instead.
   */
  private sweepArc(ctx: GunContext, i: number, chest: THREE.Vector3, exclude: unknown) {
    _a.subVectors(this.prev[i], this.prevChest);
    _b.subVectors(this.cur[i], chest);
    const la = _a.length();
    const lb = _b.length();
    if (la < 1e-4 || lb < 1e-4) {
      this.cast(ctx, this.prev[i], this.cur[i], exclude);
      return;
    }
    _a.divideScalar(la);
    _b.divideScalar(lb);
    const angle = Math.acos(clamp(_a.dot(_b), -1, 1));
    const steps = Math.max(1, Math.ceil(angle / ARC_STEP));
    _arcQ.setFromUnitVectors(_a, _b);
    _from.copy(this.prev[i]);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      _stepQ.identity().slerp(_arcQ, t);
      _to.copy(_a).applyQuaternion(_stepQ).multiplyScalar(THREE.MathUtils.lerp(la, lb, t));
      _to.add(_chestT.lerpVectors(this.prevChest, chest, t));
      this.cast(ctx, _from, _to, exclude);
      _from.copy(_to);
    }
  }

  private cast(ctx: GunContext, from: THREE.Vector3, to: THREE.Vector3, exclude: unknown) {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 1e-4 || this.swing.phase !== 'active') return;
    _d.divideScalar(len);
    const pred = (c: { handle: number }) => {
      const t = ctx.physics.hitTargets.get(c.handle);
      return !!t && !this.struck.has(t.owner);
    };
    const hit = ctx.physics.raycast(from, _d, len, GROUPS.qHitbox, exclude as never, _hit, pred);
    if (hit?.target) this.strike(ctx, hit.target, hit.point);
  }

  private strike(ctx: GunContext, target: HitTarget, point: THREE.Vector3) {
    const owner = target.owner;
    if (!owner.alive || this.struck.has(owner)) return;
    this.struck.add(owner);
    const m = tuning.melee;
    const d = this.swing.def(timing(m));
    // The blow travels from her toward the target, flat.
    _dir.subVectors(point, ctx.player.biped.chest).setY(0);
    if (_dir.lengthSq() < 1e-6) _dir.set(-Math.sin(ctx.camera.yaw), 0, -Math.cos(ctx.camera.yaw));
    _dir.normalize();
    if (owner.blocks?.(_dir)) {
      blockFeedback(ctx, point, _dir);
      this.swing.rebound(m.reboundTime);
      ctx.camera.addTrauma(m.reboundTrauma);
      ctx.player.controller.push(-_dir.x * 3, -_dir.z * 3);
      return;
    }
    const crit = target.part === 'weak';
    const charged = this.swing.charged;
    const info: DamageInfo = {
      amount: d.damage * this.stage.damageMul * (crit ? m.critMultiplier : 1) * (target.part === 'armor' ? (owner.armorMul ?? 0.2) : 1),
      crit,
      point: point.clone(),
      dir: _dir.clone(),
      knockback: d.knockback,
      stagger: d.stagger * (crit ? 1.5 : 1),
    };
    const killed = owner.takeDamage(info);
    const kind: HitKind = killed ? 'kill' : crit ? 'crit' : 'hit';
    ctx.hud.hit(kind);
    ctx.synth.hit(kind);
    ctx.synth.sfx('bladeHit', 1, 0, this.stage.toneMul);
    ctx.fx.sparksAt(point, _neg.copy(_dir).negate(), crit || killed ? SIGNAL.crit : 0xffffff, charged ? 16 : 8, charged ? 8 : 5);
    ctx.clock.addHitstop(charged ? m.hitstopCharged : m.hitstop);
    ctx.camera.addTrauma(charged ? m.traumaCharged : m.trauma);
    ctx.onHit({ damage: info.amount, kind, distance: point.distanceTo(ctx.player.pos), owner, shotId: -1 });
    // Blade hits feed the rifle.
    const before = this.gun.mag;
    this.gun.mag = chargeAfterHit(this.gun.mag, this.gun.def.magSize, m.chargePerHit, this.gained, m.chargeCapPerSwing);
    if (this.gun.mag > before) {
      this.gained += this.gun.mag - before;
      ctx.synth.sfx('chargeGain', 1, 0, 1 + this.gun.mag * 0.04);
    }
  }

  private flareFrom(from: number, to: number) {
    for (let i = from; i < to; i++) this.flare[i] = tuning.swordRifle.cellFlareTime;
  }

  /** Cells: lit (charge colour × the stage's glow), spent (dark), flaring on refill, flickering on a dry trigger. */
  private syncCells(dt: number) {
    const s = this.gun.model.sword;
    if (!s) return;
    const n = Math.min(this.gun.def.magSize, s.cellAt.length);
    const glow = this.stage.cellGlow;
    this.dryFlicker = Math.max(0, this.dryFlicker - dt);
    const charging = this.swing.phase === 'charging';
    const pulse = charging ? 0.75 + 0.25 * Math.sin(performance.now() * 0.02) : 1;
    for (let i = 0; i < n; i++) {
      this.flare[i] = Math.max(0, (this.flare[i] ?? 0) - dt);
      const f = this.flare[i] / Math.max(0.01, tuning.swordRifle.cellFlareTime);
      const lit = i < this.gun.mag;
      if (lit) {
        _lit.setHex(SIGNAL.charge).multiplyScalar(glow * pulse);
        _c.copy(_lit).lerp(WHITE, f * 0.7);
      } else {
        _c.copy(SPENT);
        if (this.dryFlicker > 0 && Math.sin(this.dryFlicker * 60) > 0) _c.setHex(SIGNAL.charge).multiplyScalar(0.25);
      }
      s.cells.setColorAt(i, _c);
      const k = 1 + f * 0.6;
      _m.compose(s.cellAt[i], _q.identity(), _s.set(k, k, k));
      s.cells.setMatrixAt(i, _m);
    }
    s.cells.count = n;
    s.cells.instanceMatrix.needsUpdate = true;
    if (s.cells.instanceColor) s.cells.instanceColor.needsUpdate = true;
  }
}

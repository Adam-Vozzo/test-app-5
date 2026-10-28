// Melee timing and pose, as pure logic (no Three/DOM) so it can be unit-tested. The SwordRifle's sword mode drives
// this: LMB is a light combo (windup → active → recover, chaining when pressed in the combo window), and holding
// RMB charges a heavy strike that releases on let-go. Committed body: a swing can only be rolled out of during its
// recovery or while charging.

export type SwingPhase = 'idle' | 'windup' | 'active' | 'recover' | 'charging';

/** One swing's timing (seconds) and arc (degrees, body-relative: yaw + = blade to the left, pitch + = up). */
export interface SwingDef {
  windup: number;
  active: number;
  recover: number;
  damage: number;
  /** Lunge distance (m) at the start of the active phase. */
  lunge: number;
  stagger: number;
  knockback: number;
  yawFromDeg: number;
  yawToDeg: number;
  pitchFromDeg: number;
  pitchToDeg: number;
  rollDeg: number;
}

export interface MeleeTiming {
  combo: SwingDef[];
  charged: SwingDef;
  /** Seconds into recovery during which a press still chains the next swing. */
  comboWindow: number;
  /** Fraction of recovery after which a queued swing starts (earlier = snappier chains). */
  cancelInto: number;
  /** Seconds RMB must be held before the charged strike is ready. */
  chargeHold: number;
}

export interface SwingInput {
  /** LMB went down this frame. */
  light: boolean;
  /** RMB is held / went down this frame / went up this frame. */
  heavyHeld: boolean;
  heavyPressed: boolean;
  heavyReleased: boolean;
}

export type SwingEvent =
  | { type: 'begin'; index: number; charged: boolean }
  | { type: 'activeStart' }
  | { type: 'activeEnd' }
  | { type: 'end' }
  | { type: 'chargeStart' }
  | { type: 'chargeReady' }
  | { type: 'chargeCancel' };

export class SwingState {
  phase: SwingPhase = 'idle';
  /** Seconds into the current phase. */
  t = 0;
  /** Combo index of the current swing (0..combo.length-1). */
  index = 0;
  /** This swing is the charged strike. */
  charged = false;
  /** The charge is held long enough to strike. */
  chargeReady = false;
  private queued = false;
  /** A press during a recovery that can't chain (the last swing, a rebound): it starts a fresh combo on the end. */
  private late = false;
  private recoverTime = 0;

  get busy() {
    return this.phase !== 'idle';
  }
  /** Roll may cancel only recovery and charging (committed body). */
  get canCancel() {
    return this.phase === 'idle' || this.phase === 'recover' || this.phase === 'charging';
  }

  def(m: MeleeTiming): SwingDef {
    return this.charged ? m.charged : m.combo[Math.min(this.index, m.combo.length - 1)];
  }

  /** A guard caught the blade: drop straight into a longer recovery (no chaining out of it). */
  rebound(extraRecover: number) {
    if (this.phase !== 'active' && this.phase !== 'windup') return;
    this.phase = 'recover';
    this.t = -Math.max(0, extraRecover);
    this.queued = false;
    this.index = 99;
  }

  cancel() {
    this.phase = 'idle';
    this.t = 0;
    this.index = 0;
    this.queued = false;
    this.late = false;
    this.charged = false;
    this.chargeReady = false;
  }

  step(dt: number, inp: SwingInput, m: MeleeTiming, out: SwingEvent[] = []): SwingEvent[] {
    if (!(dt >= 0) || !Number.isFinite(dt)) dt = 0;
    const begin = (index: number, charged: boolean) => {
      this.phase = 'windup';
      this.t = 0;
      this.index = index;
      this.charged = charged;
      this.queued = false;
      out.push({ type: 'begin', index, charged });
    };

    if (this.phase === 'idle') {
      if (inp.heavyPressed) {
        this.phase = 'charging';
        this.t = 0;
        this.chargeReady = false;
        out.push({ type: 'chargeStart' });
      } else if (inp.light) {
        begin(0, false);
      }
      return out;
    }

    if (this.phase === 'charging') {
      this.t += dt;
      if (!this.chargeReady && this.t >= m.chargeHold) {
        this.chargeReady = true;
        out.push({ type: 'chargeReady' });
      }
      if (inp.heavyReleased || !inp.heavyHeld) {
        if (this.chargeReady) begin(0, true);
        else {
          this.cancel();
          out.push({ type: 'chargeCancel' });
        }
      }
      return out;
    }

    if (inp.light && this.phase !== 'recover') this.queued = true;
    this.t += dt;
    const d = this.def(m);
    // Advance through as many phases as dt covers (low frame rates never skip an active window's events).
    for (let guard = 0; guard < 4; guard++) {
      if (this.phase === 'windup' && this.t >= d.windup) {
        this.t -= d.windup;
        this.phase = 'active';
        out.push({ type: 'activeStart' });
        continue;
      }
      if (this.phase === 'active' && this.t >= d.active) {
        this.t -= d.active;
        this.phase = 'recover';
        this.recoverTime = 0;
        out.push({ type: 'activeEnd' });
        continue;
      }
      break;
    }
    if (this.phase === 'recover') {
      this.recoverTime = this.t;
      if (inp.light && !this.charged && this.recoverTime <= m.comboWindow) this.queued = true;
      const last = this.charged || this.index >= m.combo.length - 1;
      // Pressed too late to chain (or out of a rebound): remembered, not dropped. It starts a new combo at the end.
      if (inp.light && (last || this.recoverTime > m.comboWindow)) this.late = true;
      if (this.queued && !last && this.t >= d.recover * m.cancelInto) {
        begin(this.index + 1, false);
        return out;
      }
      if (this.t >= d.recover) {
        const again = this.late;
        this.cancel();
        out.push({ type: 'end' });
        if (again) begin(0, false);
      }
    }
    return out;
  }
}

/** The blade's body-relative angles (radians) for a phase: guard → from (windup), from → to (active), to → guard. */
export interface BladePose {
  yaw: number;
  pitch: number;
  roll: number;
}

const DEG = Math.PI / 180;
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function bladePose(s: SwingState, m: MeleeTiming, guard: BladePose, chargePose: BladePose, out: BladePose): BladePose {
  if (s.phase === 'idle') return Object.assign(out, guard);
  if (s.phase === 'charging') {
    const k = ease(Math.min(1, s.t / Math.max(0.01, m.chargeHold)));
    out.yaw = lerp(guard.yaw, chargePose.yaw, k);
    out.pitch = lerp(guard.pitch, chargePose.pitch, k);
    out.roll = lerp(guard.roll, chargePose.roll, k);
    return out;
  }
  const d = s.def(m);
  const from = { yaw: d.yawFromDeg * DEG, pitch: d.pitchFromDeg * DEG, roll: d.rollDeg * DEG };
  const to = { yaw: d.yawToDeg * DEG, pitch: d.pitchToDeg * DEG, roll: d.rollDeg * DEG };
  let a: BladePose;
  let b: BladePose;
  let k: number;
  if (s.phase === 'windup') {
    a = s.charged ? chargePose : guard;
    b = from;
    k = ease(Math.min(1, s.t / Math.max(0.01, d.windup)));
  } else if (s.phase === 'active') {
    a = from;
    b = to;
    k = ease(Math.min(1, s.t / Math.max(0.01, d.active)));
  } else {
    a = to;
    b = guard;
    k = ease(Math.min(1, s.t / Math.max(0.01, d.recover)));
  }
  out.yaw = lerp(a.yaw, b.yaw, k);
  out.pitch = lerp(a.pitch, b.pitch, k);
  out.roll = lerp(a.roll, b.roll, k);
  return out;
}

/** Charges after a landed blade hit: +perHit, at most `cap` per swing, never above max. */
export function chargeAfterHit(current: number, max: number, perHit: number, gainedThisSwing: number, cap: number) {
  const room = Math.max(0, Math.min(cap - gainedThisSwing, max - current));
  return current + Math.min(perHit, room);
}

/**
 * Does a guard facing `facing` (xz, unit) block a blow travelling along `incoming` (xz, attacker → target)?
 * Blocked when the blow comes at the guard's front, within half of `coneDeg` of straight on.
 */
export function inGuardCone(facingX: number, facingZ: number, incomingX: number, incomingZ: number, coneDeg: number) {
  const len = Math.hypot(incomingX, incomingZ);
  if (len < 1e-6) return false;
  // The blow arrives from -incoming; the guard faces it when facing · (-incoming) is large.
  const cos = (-incomingX * facingX - incomingZ * facingZ) / len;
  return cos >= Math.cos((coneDeg / 2) * DEG);
}

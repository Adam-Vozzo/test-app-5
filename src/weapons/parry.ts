// The parry: Justice's unbinding (DESIGN.md → Decided). Answer in kind: meet a blow as it lands and it's turned,
// the attacker reels, and the SwordRifle drinks a charge. Pure timing logic (tested); the game decides what a blow
// is (melee from in front, or a thrown blade) and applies the outcome.
import { inArc } from '../enemies/foe-ai';

export interface ParryTune {
  /** How long a press turns blows (s). */
  window: number;
  /** Committed recovery after the window (s): a whiffed parry is punishable. */
  recover: number;
  /** Only blows arriving within this cone of her facing (degrees). */
  coneDeg: number;
}

export class ParryState {
  /** Time since the press, or -1 when idle. */
  t = -1;

  get phase(): 'idle' | 'active' | 'recover' {
    return this.t < 0 ? 'idle' : this.t < this.tune.window ? 'active' : 'recover';
  }
  get active() {
    return this.phase === 'active';
  }
  /** In the parry at all (can't fire, swing, heal or swap). */
  get busy() {
    return this.t >= 0;
  }

  constructor(private tune: ParryTune) {}

  /** Start a parry; false if already in one. */
  start(): boolean {
    if (this.t >= 0) return false;
    this.t = 0;
    return true;
  }

  /** A successful parry ends the stance at once: you're free to answer. */
  succeed() {
    this.t = -1;
  }

  cancel() {
    this.t = -1;
  }

  update(dt: number) {
    if (this.t < 0) return;
    this.t += dt;
    if (this.t >= this.tune.window + this.tune.recover) this.t = -1;
  }

  /** Does a blow from (fromX, fromZ) toward a player at (x, z) facing `yaw` get parried right now? */
  turns(yaw: number, x: number, z: number, fromX: number, fromZ: number): boolean {
    return this.active && inArc(yaw, fromX - x, fromZ - z, this.tune.coneDeg);
  }
}

// The Devil's binding (DESIGN.md → The Devil: "binding attacks look fatal, but one roll always breaks them": you
// could always have walked away). Pure timing: caught, she's held for `time` seconds and then struck; a roll at any
// moment breaks it. The game roots her while bound, lets the roll through regardless of stamina, and draws the coil.

export type BindOutcome = 'held' | 'struck' | 'broken' | null;

export class Binding {
  /** Seconds since she was caught, or -1 when free. */
  t = -1;
  /** How long this binding holds before its blow lands. */
  time = 0;
  damage = 0;
  knockback = 0;
  /** Bindings broken by a roll so far (the save's tally for hints and tests). */
  broken = 0;

  get active() {
    return this.t >= 0;
  }

  /** 0 when caught, 1 when the blow lands: the coil tightens with it. */
  get k() {
    return this.t < 0 ? 0 : Math.min(1, this.t / Math.max(1e-3, this.time));
  }

  /** Caught. A second binding while held only refreshes the hold (it never stacks damage). */
  catch(time: number, damage: number, knockback: number) {
    if (this.t >= 0) {
      this.time = Math.max(this.time - this.t, time);
      this.t = 0;
      this.damage = Math.max(this.damage, damage);
      return;
    }
    this.t = 0;
    this.time = time;
    this.damage = damage;
    this.knockback = knockback;
  }

  /** One roll breaks any binding. */
  roll(): BindOutcome {
    if (this.t < 0) return null;
    this.t = -1;
    this.broken++;
    return 'broken';
  }

  /** Advance; returns 'struck' on the frame the blow lands (and she's free again), 'held' while bound. */
  update(dt: number): BindOutcome {
    if (this.t < 0) return null;
    this.t += dt;
    if (this.t < this.time) return 'held';
    this.t = -1;
    return 'struck';
  }

  cancel() {
    this.t = -1;
  }
}

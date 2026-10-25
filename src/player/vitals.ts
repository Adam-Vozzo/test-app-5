// Souls-like player rules as plain logic: health, stamina (gates roll + sprint, regen after a delay),
// committed heal with limited charges, hurt stun, death, currency. No Three/DOM, so it is unit-tested.
import { tuning } from '../tuning';

export interface DamageResult {
  applied: boolean;
  died: boolean;
  interruptedHeal: boolean;
}

export class Vitals {
  health = tuning.vitals.maxHealth;
  stamina = tuning.vitals.maxStamina;
  healCharges = tuning.vitals.healCharges;
  /** Extra flasks bought from the Magician. */
  bonusCharges = 0;
  /** Carried currency (pentacles in v2 scenes, pollen in the v1 ones). */
  currency = 0;
  healing = false;
  /** Heal progress 0..1. */
  healT = 0;
  private healApplied = false;
  hurtStun = 0;
  dead = false;
  exhausted = false;
  private sinceStamina = 10;

  get maxHealth() {
    return tuning.vitals.maxHealth;
  }

  get maxCharges() {
    return tuning.vitals.healCharges + this.bonusCharges;
  }

  /** Busy = can't shoot, reload, roll or swap. */
  get busy() {
    return this.healing || this.hurtStun > 0 || this.dead;
  }

  canRoll() {
    return !this.dead && !this.healing && this.stamina > 0 && !this.exhausted;
  }

  spendRoll() {
    this.spend(tuning.vitals.rollCost);
  }

  canSprint() {
    return !this.exhausted && this.stamina > 0 && !this.healing;
  }

  private spend(n: number) {
    this.stamina = Math.max(0, this.stamina - n);
    this.sinceStamina = 0;
    if (this.stamina <= 0) this.exhausted = true;
  }

  startHeal(): boolean {
    if (this.dead || this.healing || this.healCharges <= 0 || this.health >= this.maxHealth || this.hurtStun > 0) return false;
    this.healCharges--;
    this.healing = true;
    this.healT = 0;
    this.healApplied = false;
    return true;
  }

  /** Advance timers. Returns 'healed' on the frame the heal lands. */
  tick(dt: number, sprinting: boolean): 'healed' | null {
    const v = tuning.vitals;
    let event: 'healed' | null = null;
    if (sprinting) this.spend(v.sprintDrain * dt);
    else this.sinceStamina += dt;
    if (this.sinceStamina >= v.staminaRegenDelay) this.stamina = Math.min(v.maxStamina, this.stamina + v.staminaRegen * dt);
    if (this.exhausted && this.stamina >= v.exhaustedUntil) this.exhausted = false;
    this.hurtStun = Math.max(0, this.hurtStun - dt);
    if (this.healing) {
      this.healT += dt / Math.max(0.05, v.healTime);
      if (!this.healApplied && this.healT >= v.healApplyAt) {
        this.healApplied = true;
        this.health = Math.min(this.maxHealth, this.health + v.healAmount);
        event = 'healed';
      }
      if (this.healT >= 1) this.healing = false;
    }
    return event;
  }

  /** Damage interrupts a heal that hasn't landed yet; the charge is spent either way. */
  damage(amount: number, invulnerable: boolean, god: boolean): DamageResult {
    if (this.dead || invulnerable || god || amount <= 0) return { applied: false, died: false, interruptedHeal: false };
    const interruptedHeal = this.healing && !this.healApplied;
    if (this.healing) this.healing = false;
    this.health = Math.max(0, this.health - amount);
    this.hurtStun = tuning.vitals.hurtStun;
    if (this.health <= 0) this.dead = true;
    return { applied: true, died: this.dead, interruptedHeal };
  }

  /** Respawn / rest: full health, stamina and heal charges. */
  restore() {
    this.health = this.maxHealth;
    this.stamina = tuning.vitals.maxStamina;
    this.healCharges = this.maxCharges;
    this.healing = false;
    this.hurtStun = 0;
    this.dead = false;
    this.exhausted = false;
  }
}

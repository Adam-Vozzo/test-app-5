import { describe, expect, it } from 'vitest';
import { Vitals } from '../src/player/vitals';
import { tuning } from '../src/tuning';

describe('Vitals', () => {
  it('enemies hit hard: 3–4 hits kill', () => {
    const e = tuning.enemies;
    for (const dmg of [e.skitterer.damage, e.spitter.damage, e.brute.chargeDamage, e.brute.buttDamage]) {
      const hits = Math.ceil(tuning.vitals.maxHealth / dmg);
      expect(hits).toBeGreaterThanOrEqual(3);
      expect(hits).toBeLessThanOrEqual(4);
    }
  });

  it('rolling spends stamina; regen waits for the delay', () => {
    const v = new Vitals();
    v.spendRoll();
    const after = v.stamina;
    v.tick(tuning.vitals.staminaRegenDelay * 0.5, false);
    expect(v.stamina).toBe(after);
    v.tick(tuning.vitals.staminaRegenDelay, false);
    expect(v.stamina).toBeGreaterThan(after);
  });

  it('emptying stamina exhausts: no roll or sprint until it refills a bit', () => {
    const v = new Vitals();
    while (v.stamina > 0) v.spendRoll();
    expect(v.canRoll()).toBe(false);
    expect(v.canSprint()).toBe(false);
    for (let i = 0; i < 200 && v.exhausted; i++) v.tick(0.05, false);
    expect(v.canRoll()).toBe(true);
  });

  it('heal is committed, uses a charge and lands partway through', () => {
    const v = new Vitals();
    v.damage(50, false, false);
    v.tick(1, false);
    expect(v.startHeal()).toBe(true);
    expect(v.healCharges).toBe(tuning.vitals.healCharges - 1);
    expect(v.busy).toBe(true);
    let healed = false;
    for (let t = 0; t < tuning.vitals.healTime + 0.1; t += 0.05) if (v.tick(0.05, false) === 'healed') healed = true;
    expect(healed).toBe(true);
    expect(v.health).toBe(Math.min(100, 50 + tuning.vitals.healAmount));
    expect(v.healing).toBe(false);
  });

  it('damage interrupts a heal before it lands (and the charge is gone)', () => {
    const v = new Vitals();
    v.damage(50, false, false);
    v.tick(1, false);
    v.startHeal();
    v.tick(0.1, false);
    const r = v.damage(10, false, false);
    expect(r.interruptedHeal).toBe(true);
    for (let i = 0; i < 40; i++) v.tick(0.05, false);
    expect(v.health).toBe(40);
    expect(v.healCharges).toBe(tuning.vitals.healCharges - 1);
  });

  it('i-frames and god mode ignore damage', () => {
    const v = new Vitals();
    expect(v.damage(30, true, false).applied).toBe(false);
    expect(v.damage(30, false, true).applied).toBe(false);
    expect(v.health).toBe(100);
  });

  it('dies at zero and restore() brings everything back', () => {
    const v = new Vitals();
    v.startHeal();
    for (let i = 0; i < 4; i++) v.damage(30, false, false);
    expect(v.dead).toBe(true);
    v.restore();
    expect(v.dead).toBe(false);
    expect(v.health).toBe(100);
    expect(v.healCharges).toBe(tuning.vitals.healCharges);
  });
});

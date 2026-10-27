import { describe, expect, it } from 'vitest';
import { buy, canBuy, clearDimension, effects, gainRelic, gateOpen, newSave, nextLine, parseSave, type SaveData } from '../src/core/save';
import { DIMENSION_ORDER, PRIESTESS_LINES, SHOP, STAR_SHOP, UNBINDINGS } from '../src/world/hub-data';
import { ParryState } from '../src/weapons/parry';

const item = (id: string) => SHOP.find((i) => i.id === id)!;

describe('save', () => {
  it('round-trips through JSON and survives junk', () => {
    const s = { ...newSave(42), pentacles: 120, upgrades: ['flask'] };
    expect(parseSave(JSON.stringify(s), 7)).toEqual(s);
    expect(parseSave(null, 7)).toEqual(newSave(7));
    expect(parseSave('{not json', 7)).toEqual(newSave(7));
    expect(parseSave(JSON.stringify({ version: 99 }), 7)).toEqual(newSave(7));
    // Wrong types are dropped, not trusted.
    const odd = parseSave(JSON.stringify({ version: 1, seed: 'x', pentacles: -5, upgrades: [3, 'flask'], progress: { justice: 'two' } }), 9);
    expect(odd.seed).toBe(9);
    expect(odd.pentacles).toBe(0);
    expect(odd.upgrades).toEqual(['flask']);
    expect(odd.progress).toEqual({});
  });

  it("sells the Magician's items once, for their price, and only with what they need", () => {
    let s = { ...newSave(1), pentacles: 1000 };
    expect(canBuy(s, item('repair1')).ok).toBe(false);
    expect(canBuy(s, item('repair1')).reason).toContain('relic');
    s = buy(s, item('flask'));
    expect(s.pentacles).toBe(1000 - item('flask').price);
    expect(canBuy(s, item('flask')).reason).toBe('owned');
    expect(buy(s, item('flask'))).toBe(s);
    s = gainRelic(s, 'swords');
    s = buy(s, item('repair1'));
    expect(s.repairStage).toBe(1);
    const poor = { ...newSave(1), pentacles: 10 };
    expect(canBuy(poor, item('pistolMag')).ok).toBe(false);
  });

  it('folds upgrades into the numbers the game applies', () => {
    const s = { ...newSave(1), upgrades: ['pistolDamage', 'pistolMag', 'flask'], repairStage: 1 };
    expect(effects(s, SHOP)).toEqual({ pistolDamageMul: 1.15, pistolMagBonus: 8, healBonus: 1, healMul: 1, repairStage: 1 });
    expect(effects(newSave(1), SHOP)).toEqual({ pistolDamageMul: 1, pistolMagBonus: 0, healBonus: 0, healMul: 1, repairStage: 0 });
  });

  it("the Star's pool (after the Tower) adds a flask and a stronger pour", () => {
    const s = { ...newSave(1), upgrades: ['flask', 'starFlask', 'starPour'] };
    const e = effects(s, [...SHOP, ...STAR_SHOP]);
    expect(e.healBonus).toBe(2);
    expect(e.healMul).toBeCloseTo(1.3, 6);
  });

  it("clearing Justice frees the parry, restarts her road, and wakes the next gate", () => {
    let s: SaveData = { ...newSave(1), progress: { justice: 3 } };
    expect(gateOpen(s, DIMENSION_ORDER, 'justice')).toBe(true);
    expect(gateOpen(s, DIMENSION_ORDER, 'devil')).toBe(false);
    s = clearDimension(s, 'justice', UNBINDINGS.justice);
    expect(s.unbound).toEqual(['parry']);
    expect(s.progress.justice).toBe(0);
    expect(gateOpen(s, DIMENSION_ORDER, 'devil')).toBe(true);
    expect(clearDimension(s, 'justice', 'parry').unbound).toEqual(['parry']);
  });

  it("cycles a character's lines for the save's state", () => {
    let s = newSave(1);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = nextLine(s, 'priestess', PRIESTESS_LINES, 'fresh');
      seen.push(r.line);
      s = r.save;
    }
    expect(seen[0]).toBe(PRIESTESS_LINES.fresh[0]);
    expect(seen[4]).toBe(PRIESTESS_LINES.fresh[0]);
    for (const lines of Object.values(PRIESTESS_LINES)) {
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('parry', () => {
  const tune = { window: 0.2, recover: 0.4, coneDeg: 140 };
  it('turns blows only inside its window and from in front', () => {
    const p = new ParryState(tune);
    expect(p.turns(0, 0, 0, 0, -2)).toBe(false);
    expect(p.start()).toBe(true);
    expect(p.start()).toBe(false);
    p.update(0.1);
    expect(p.turns(0, 0, 0, 0, -2)).toBe(true);
    expect(p.turns(0, 0, 0, 0, 2)).toBe(false);
    p.update(0.15);
    expect(p.phase).toBe('recover');
    expect(p.turns(0, 0, 0, 0, -2)).toBe(false);
    expect(p.busy).toBe(true);
    p.update(0.4);
    expect(p.phase).toBe('idle');
  });
  it('a success frees you at once', () => {
    const p = new ParryState(tune);
    p.start();
    p.succeed();
    expect(p.busy).toBe(false);
  });
});

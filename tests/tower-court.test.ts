import { describe, expect, it } from 'vitest';
import { CROWNED_TOWER_PLAN, WANDS_PLANS } from '../src/enemies/court-wands';
import { TOWER_PLANS } from '../src/enemies/tower-foes';
import { pickAttack, type AttackTune } from '../src/enemies/foe-ai';
import { clearDimension, gateOpen, newSave } from '../src/core/save';
import { DIMENSION_ORDER, PRIESTESS_LINES, STAR_SHOP, UNBINDING_LINES, UNBINDINGS } from '../src/world/hub-data';
import { TOWER_DIMENSION as DIM } from '../src/world/dimensions';
import { ScaffoldGrid } from '../src/world/scaffold';
import { tuning } from '../src/tuning';

describe("the Tower's own", () => {
  it('every plan has a motion for each attack', () => {
    for (const p of [...Object.values(TOWER_PLANS), ...Object.values(WANDS_PLANS), CROWNED_TOWER_PLAN]) {
      for (const name of Object.keys(p.tune().attacks)) expect(p.motions[name], `${p.id}.${name}`).toBeDefined();
    }
  });
  it("the Tower's rooms hold only its own (no borrowed archetypes left)", () => {
    const own = ['firebrand', 'faller', 'builder', 'pageWands'];
    for (const l of DIM.levels) for (const ids of Object.values(l.roster)) for (const id of ids) expect(own).toContain(id);
    expect(DIM.levels.map((l) => l.court)).toEqual(['knightWands', 'queenWands', 'kingWands']);
  });
  it('fire feeds the rule: the Firebrand, the Knight, the Queen, the King and the Crowned Tower all set timber alight', () => {
    const f = tuning.foes;
    expect(f.firebrand.attacks.pot.ignite).toBeGreaterThan(0);
    expect(f.firebrand.attacks.pot.lob).toBeGreaterThan(0);
    expect(f.knightWands.attacks.charge.ignite).toBeGreaterThan(0);
    expect(f.queenWands.attacks.firezone.ignite).toBeGreaterThan(0);
    expect(f.kingWands.attacks.judgement.ignite).toBeGreaterThan(0);
    expect(WANDS_PLANS.kingWands.phaseBurn).toBeGreaterThan(0);
    expect(f.crownedTower.attacks.smash.ignite).toBeGreaterThan(0);
  });
  it("a lob is never thrown point-blank (it couldn't be read)", () => {
    const pot = { pot: tuning.foes.firebrand.attacks.pot as AttackTune };
    expect(pickAttack(pot, 3, {}, 0.5)).toBe(null);
    expect(pickAttack(pot, 10, {}, 0.5)).toBe('pot');
  });
  it("the Page of Wands' signal is long enough to stop (a real chance to stagger it)", () => {
    const sig = tuning.foes.pageWands.attacks.signal;
    expect(sig.kind).toBe('signal');
    expect(sig.windup).toBeGreaterThanOrEqual(2);
    expect(sig.count).toBeGreaterThan(0);
  });
  it("a Faller's shadow gives time to get out of it", () => {
    const fa = tuning.foes.faller;
    // From the middle of its ring to outside it at a walk, within the fall.
    expect((fa.attacks.grapple.radius ?? 0) / tuning.player.walkSpeed).toBeLessThan(fa.fallTime);
  });
  it('the Queen of Wands calls her cat; the King calls Firebrands', () => {
    expect(WANDS_PLANS.queenWands.squadId).toBe('cat');
    expect(WANDS_PLANS.kingWands.squadId).toBe('firebrand');
  });
});

describe("the Crowned Tower's floor", () => {
  it('holes are never decks, and stay holes through a rest', () => {
    const g = new ScaffoldGrid(3, 3, [], [0, 8]);
    expect(g.state[0]).toBe('gone');
    expect(g.ignite(0)).toBe(null);
    g.reset();
    expect(g.state[8]).toBe('gone');
    expect(g.state[4]).toBe('sound');
  });
  it('a ring given way warns first: it falls only after the warning and the crack', () => {
    const g = new ScaffoldGrid(1, 1, []);
    g.crack(0, 1.6);
    const T = { crackTime: 1, burnTime: 4, spreadPerSec: 0 };
    let t = 0;
    while (g.state[0] !== 'gone' && t < 10) {
      g.update(0.05, T, () => 0.5);
      t += 0.05;
    }
    expect(t).toBeGreaterThanOrEqual(2.55);
  });
  it('phases at two thirds and one third', () => {
    expect(tuning.foes.crownedTower.phases).toEqual([0.66, 0.33]);
  });
});

describe('after the Tower', () => {
  it('clearing it frees the safe fall and wakes the eagle, and the Star comes', () => {
    let s = clearDimension(clearDimension(newSave(1), 'justice', UNBINDINGS.justice), 'devil', UNBINDINGS.devil);
    s = clearDimension(s, 'tower', UNBINDINGS.tower);
    expect(s.unbound).toContain('fall');
    expect(gateOpen(s, DIMENSION_ORDER, 'moon')).toBe(true);
    expect(UNBINDING_LINES.tower.first).toContain('land');
    expect(PRIESTESS_LINES.tower.length).toBeGreaterThanOrEqual(3);
    expect(STAR_SHOP.length).toBeGreaterThanOrEqual(2);
  });
});

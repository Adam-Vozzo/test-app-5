import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PENTACLES_PLANS } from '../src/enemies/court-pentacles';
import { DEVIL_BOSS_PLAN } from '../src/enemies/devil-boss';
import { pickAttack, phaseOf, type AttackTune } from '../src/enemies/foe-ai';
import { buy, canBuy, clearDimension, gainRelic, gateOpen, newSave } from '../src/core/save';
import { DIMENSION_ORDER, PRIESTESS_LINES, SHOP, UNBINDINGS, UNBINDING_LINES } from '../src/world/hub-data';
import { DEVIL_DIMENSION } from '../src/world/dimensions';
import { CoinPiles } from '../src/world/coins';
import { tuning } from '../src/tuning';

const item = (id: string) => SHOP.find((i) => i.id === id)!;

describe('the Pentacles court: rank is the verb, suit is the flavour', () => {
  it('each card uses its rank verbs, and the Devil levels seat them in the throne rooms', () => {
    expect(PENTACLES_PLANS.knightPentacles.rank).toBe('knight');
    expect(PENTACLES_PLANS.queenPentacles.rank).toBe('queen');
    expect(PENTACLES_PLANS.kingPentacles.rank).toBe('king');
    expect(DEVIL_DIMENSION.levels.map((l) => l.court)).toEqual(['knightPentacles', 'queenPentacles', 'kingPentacles']);
    for (const p of Object.values(PENTACLES_PLANS)) {
      // Every attack has a pose to move between, and every pose names a sound.
      for (const name of Object.keys(p.tune().attacks)) expect(p.motions[name], `${p.id}.${name}`).toBeDefined();
    }
  });
  it("the Knight's charge binds (the Devil's rule), and it can't be staggered by shots", () => {
    const k = tuning.foes.knightPentacles;
    expect(k.attacks.charge.binds).toBe(true);
    expect(k.attacks.recharge.binds).toBe(true);
    expect(k.poise).toBeGreaterThan(10000);
  });
  it("the Queen's seeds sprout Imps, with time to trample one", () => {
    const q = tuning.foes.queenPentacles.attacks;
    expect(q.sow.kind).toBe('sow');
    expect(q.sow.spawn).toBe('imp');
    // Long enough to reach a seed 6.5 m away at a walk (and the harvest only from phase 2).
    expect(q.sow.delay).toBeGreaterThan(6.5 / tuning.player.walkSpeed);
    expect(q.harvest.minPhase).toBe(1);
  });
  it('the King hires Misers and his coin rain leaves coin', () => {
    expect(PENTACLES_PLANS.kingPentacles.squadId).toBe('miser');
    expect(tuning.foes.kingPentacles.attacks.coinRain.coins).toBeGreaterThan(0);
    expect(phaseOf(0.5, tuning.foes.kingPentacles.phases)).toBe(1);
  });
});

describe('the Devil', () => {
  it('offers the pact at half health, and holds it out long enough to read', () => {
    const d = tuning.foes.devil;
    expect(d.phases).toEqual([0.5]);
    expect(d.pactTime).toBeGreaterThanOrEqual(4);
    expect(DEVIL_BOSS_PLAN.height).toBeGreaterThan(6);
  });
  it('phase 2 adds coin rain and shackles in threes; phase 1 never uses them', () => {
    const atk = tuning.foes.devil.attacks as Record<string, AttackTune>;
    const seen1 = new Set<string>();
    const seen2 = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = i / 400;
      const a1 = pickAttack(atk, 20, {}, r, 0);
      const a2 = pickAttack(atk, 20, {}, r, 1);
      if (a1) seen1.add(a1);
      if (a2) seen2.add(a2);
    }
    expect(seen1.has('coinRain') || seen1.has('chains')).toBe(false);
    expect(seen2.has('coinRain') && seen2.has('chains')).toBe(true);
  });
});

describe('the hub after the Devil', () => {
  it('clearing the Devil frees the dash and wakes the lion', () => {
    let s = clearDimension(newSave(1), 'justice', UNBINDINGS.justice);
    expect(gateOpen(s, DIMENSION_ORDER, 'devil')).toBe(true);
    expect(gateOpen(s, DIMENSION_ORDER, 'tower')).toBe(false);
    s = clearDimension(s, 'devil', UNBINDINGS.devil);
    expect(s.unbound).toContain('dash');
    expect(gateOpen(s, DIMENSION_ORDER, 'tower')).toBe(true);
    expect(UNBINDING_LINES.devil.first).toContain('dash');
    expect(PRIESTESS_LINES.devil.length).toBeGreaterThanOrEqual(3);
  });
  it("the barrel's repair needs the relic of Pentacles and the first repair", () => {
    let s = { ...newSave(1), pentacles: 5000 };
    expect(canBuy(s, item('repair2')).ok).toBe(false);
    s = gainRelic(gainRelic(s, 'swords'), 'pentacles');
    expect(canBuy(s, item('repair2')).ok).toBe(false);
    s = buy(s, item('repair1'));
    expect(canBuy(s, item('repair2')).ok).toBe(true);
    s = buy(s, item('repair2'));
    expect(s.repairStage).toBe(2);
  });
});

describe('coin on the floor', () => {
  it('drops piles, gives up the ones you walk over (once), and clears', () => {
    const c = new CoinPiles(new THREE.Scene());
    c.drop(new THREE.Vector3(0, 0, 0), 1);
    c.drop(new THREE.Vector3(10, 0, 0), 3);
    expect(c.count).toBe(4);
    // Coin that lands under you isn't taken by standing still: step clear, then come back for it.
    const on = new THREE.Vector3(0.5, 0, 0);
    const off = new THREE.Vector3(5, 0, 0);
    expect(c.update(on, 1.2)).toBe(0);
    expect(c.update(on, 1.2)).toBe(0);
    expect(c.update(off, 1.2)).toBe(0);
    expect(c.update(on, 1.2)).toBe(1);
    expect(c.update(on, 1.2)).toBe(0);
    // Too far below (another floor) doesn't count.
    c.update(new THREE.Vector3(0, 0, 30), 1.2);
    expect(c.update(new THREE.Vector3(10, 5, 0), 1.2)).toBe(0);
    c.clear();
    expect(c.count).toBe(0);
  });
});

describe('a binding charge reaches what it aims at', () => {
  // (The Swords Knight's charge closes the gap and may stop short: its lane shows where. A binding charge has to land.)
  it("the Knight of Pentacles' charges run at least as far as the range they start from", () => {
    for (const id of ['knightPentacles'] as const) {
      for (const a of Object.values(tuning.foes[id].attacks as Record<string, AttackTune>)) {
        if (a.kind !== 'charge') continue;
        expect((a.speed ?? 0) * a.active, `${id}`).toBeGreaterThanOrEqual(a.range);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { CUPS_PLANS, SHADOW_PLAN } from '../src/enemies/court-cups';
import { MOON_PLANS } from '../src/enemies/moon-foes';
import { pickAttack, volleyOffsets, type AttackTune } from '../src/enemies/foe-ai';
import { clearDimension, gateOpen, newSave } from '../src/core/save';
import { DIMENSION_ORDER, PRIESTESS_LINES, SUN_LINE, UNBINDING_LINES, UNBINDINGS } from '../src/world/hub-data';
import { MOON_DIMENSION as DIM } from '../src/world/dimensions';
import { tuning } from '../src/tuning';

describe("the Moon's own", () => {
  it('every plan has a motion for each attack', () => {
    for (const p of [...Object.values(MOON_PLANS), ...Object.values(CUPS_PLANS), SHADOW_PLAN]) {
      for (const name of Object.keys(p.tune().attacks)) expect(p.motions[name], `${p.id}.${name}`).toBeDefined();
    }
  });
  it("the Moon's rooms hold only its own, and its throne rooms the Cups court", () => {
    const own = ['dog', 'wolf', 'crayfish', 'phantom', 'pageCups'];
    for (const l of DIM.levels) for (const ids of Object.values(l.roster)) for (const id of ids) expect(own).toContain(id);
    expect(DIM.levels.map((l) => l.court)).toEqual(['knightCups', 'queenCups', 'kingCups']);
    expect(DIM.rangedFoes).toEqual(['pageCups']);
  });
  it('the Dog and the Wolf howl for each other: a long wind-up, a real window to punish it', () => {
    for (const id of ['dog', 'wolf'] as const) {
      const t = tuning.foes[id];
      expect(t.attacks.howl.kind).toBe('howl');
      expect(t.attacks.howl.windup).toBeGreaterThanOrEqual(1);
      // It is actually chosen (a zero weight never is).
      expect(t.attacks.howl.weight).toBeGreaterThan(0);
      expect(t.rage).toBeGreaterThan(1);
      expect(t.rageTime).toBeGreaterThan(0);
    }
    // The pair: a level with dogs has wolves too.
    for (const l of DIM.levels) {
      const all = Object.values(l.roster).flat();
      if (all.includes('dog')) expect(all).toContain('wolf');
    }
  });
  it("Phantoms are only ever reflections; the Crayfish's ripples give time to step out", () => {
    expect(MOON_PLANS.phantom.phantom).toBe(true);
    expect(tuning.foes.phantom.reward).toBe(0);
    const c = tuning.foes.crayfish;
    expect((c.attacks.surge.radius ?? 0) / tuning.player.walkSpeed).toBeLessThan(c.fallTime);
    // Armoured in front, soft behind.
    expect(MOON_PLANS.crayfish.shield).toBe(true);
    expect(MOON_PLANS.crayfish.hitboxes.some((h) => h.part === 'weak' && h.at[2] > 0.5)).toBe(true);
  });
  it('the Page of Cups pours fish, and the pour is a channel you can stop', () => {
    const pour = tuning.foes.pageCups.attacks.pour;
    expect(pour.kind).toBe('spawn');
    expect(pour.spawn).toBe('fish');
    expect(pour.windup).toBeGreaterThanOrEqual(1.2);
    expect(MOON_PLANS.fish).toBeDefined();
  });
});

describe('the Cups court', () => {
  it("the Knight's cup, the Queen's mirror and the King's wave are rank verbs on data", () => {
    expect(tuning.foes.knightCups.attacks.offer.kind).toBe('offer');
    // Never offered at arm's length (it would be drunk where she stands).
    const offer = { offer: tuning.foes.knightCups.attacks.offer as AttackTune };
    expect(pickAttack(offer, 3, {}, 0.5)).toBe(null);
    expect(pickAttack(offer, 12, {}, 0.5)).toBe('offer');
    expect(tuning.foes.queenCups.attacks.mirror.kind).toBe('mirror');
    expect(tuning.foes.queenCups.attacks.mirror.count).toBeGreaterThanOrEqual(1);
    expect(tuning.foes.kingCups.attacks.wave.kind).toBe('wave');
    expect(CUPS_PLANS.kingCups.squadId).toBe('wolf');
  });
  it('a wave runs wall to wall (no gap: roll through it), slow enough to see coming down the room', () => {
    for (const w of [tuning.foes.kingCups.attacks.wave, tuning.foes.kingCups.attacks.flood]) {
      const lanes = w.lanes ?? 9;
      // Every lane drawn on the water, mirrored or not: nothing to step into.
      expect(volleyOffsets(lanes, w.spacing ?? 2, -1, false).length).toBe(lanes);
      expect(volleyOffsets(lanes, w.spacing ?? 2, -1, true).length).toBe(lanes);
      expect(w.range / (w.speed ?? 1)).toBeGreaterThan(1.5);
    }
  });
  it("a single lane (the Shadow's rifle) has no gap", () => {
    expect(volleyOffsets(1, 1, -1, false)).toEqual([0]);
    expect(volleyOffsets(1, 1, -1, true)).toEqual([0]);
  });
});

describe('the Shadow and the ending', () => {
  it("uses her moves: quick shots, the rifle's single lane, a three-swing combo and a charged ring", () => {
    const a = tuning.foes.shadow.attacks;
    expect(a.shots.hits).toBe(3);
    expect(a.rifle.lanes).toBe(1);
    expect(a.combo.hits).toBe(3);
    expect(a.charged.radius).toBeGreaterThan(0);
    expect(a.split.kind).toBe('mirror');
    // The split comes only with its phases.
    expect(a.split.weight).toBe(0);
    expect(tuning.foes.shadow.phases).toEqual([0.6, 0.3]);
  });
  it('clearing the Moon frees the blindfold, and the Sun follows', () => {
    let s = newSave(1);
    for (const d of ['justice', 'devil', 'tower']) s = clearDimension(s, d, UNBINDINGS[d]);
    expect(gateOpen(s, DIMENSION_ORDER, 'moon')).toBe(true);
    s = clearDimension(s, 'moon', UNBINDINGS.moon);
    expect(s.unbound).toEqual(['parry', 'dash', 'fall', 'blindfold']);
    expect(UNBINDING_LINES.moon.first.length).toBeGreaterThan(0);
    expect(SUN_LINE.length).toBeGreaterThan(0);
    expect(PRIESTESS_LINES.moon.length).toBeGreaterThanOrEqual(3);
  });
});

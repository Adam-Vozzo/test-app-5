import { describe, expect, it } from 'vitest';
import { COURT_PLANS, COURT_RANKS } from '../src/enemies/court';
import { JUSTICE_PLAN } from '../src/enemies/justice';
import { attackDuration, attackTimeline, guards, hears, inArc, leashBroken, loudest, mirrorAcross, phaseOf, pickAttack, rangedMinDistance, slamCentre, volleyOffsets, type AttackTune } from '../src/enemies/foe-ai';
import { FOE_IDS, mirrorPose, PLANS } from '../src/enemies/foes';
import { tuning } from '../src/tuning';

const A = (o: Partial<AttackTune>): AttackTune => ({ range: 2, windup: 0.5, active: 0.1, recover: 0.6, cooldown: 1, damage: 10, knockback: 2, arcDeg: 90, lunge: 1, weight: 1, ...o });

describe('attack timeline', () => {
  it('runs wind-up → active → recover → done', () => {
    const a = A({});
    expect(attackTimeline(a, 0.2).phase).toBe('windup');
    expect(attackTimeline(a, 0.55).phase).toBe('active');
    expect(attackTimeline(a, 0.7).phase).toBe('recover');
    expect(attackTimeline(a, attackDuration(a) + 0.01).phase).toBe('done');
    expect(attackDuration(a)).toBeCloseTo(1.2, 6);
  });

  it('mirrors every second swing of a combo, with a shorter follow-up wind-up', () => {
    const a = A({ hits: 2, comboWindup: 0.3 });
    expect(attackDuration(a)).toBeCloseTo(0.5 + 0.1 + 0.3 + 0.1 + 0.6, 6);
    const first = attackTimeline(a, 0.55);
    expect(first).toMatchObject({ phase: 'active', hit: 0, mirrored: false });
    const second = attackTimeline(a, 0.5 + 0.1 + 0.3 + 0.05);
    expect(second).toMatchObject({ phase: 'active', hit: 1, mirrored: true });
    expect(attackTimeline(a, 0.7)).toMatchObject({ phase: 'windup', hit: 1 });
  });

  it('every Justice attack telegraphs for at least 0.3 s and leaves a punish window', () => {
    for (const id of FOE_IDS) {
      for (const [name, a] of Object.entries(tuning.foes[id].attacks as Record<string, AttackTune>)) {
        expect(a.windup, `${id}.${name}`).toBeGreaterThanOrEqual(0.3);
        expect(a.recover, `${id}.${name}`).toBeGreaterThanOrEqual(0.5);
        expect(PLANS[id].motions[name], `${id}.${name} has a pose`).toBeTruthy();
      }
    }
  });
});

describe('attack choice', () => {
  const attacks = { thrust: A({ range: 2.5, weight: 1 }), bash: A({ range: 1.7, weight: 0.7 }), throw: A({ range: 20, speed: 16 }) };
  it('only picks attacks that reach and are off cooldown', () => {
    expect(pickAttack({ thrust: attacks.thrust }, 3, {}, 0.5)).toBeNull();
    expect(pickAttack({ thrust: attacks.thrust }, 2, {}, 0.5)).toBe('thrust');
    expect(pickAttack({ thrust: attacks.thrust }, 2, { thrust: 0.2 }, 0.5)).toBeNull();
  });
  it("doesn't throw point-blank", () => {
    expect(pickAttack({ throw: attacks.throw }, 2, {}, 0.5)).toBeNull();
    expect(pickAttack({ throw: attacks.throw }, 10, {}, 0.5)).toBe('throw');
  });
  it('favours the tighter attack up close, by weight', () => {
    let bash = 0;
    for (let i = 0; i < 100; i++) if (pickAttack({ thrust: attacks.thrust, bash: attacks.bash }, 1.5, {}, i / 100) === 'bash') bash++;
    expect(bash).toBeGreaterThan(30);
    expect(bash).toBeLessThan(70);
  });
});

describe('arcs, guards and hearing', () => {
  it('arcs are measured from the facing (yaw 0 faces -Z)', () => {
    expect(inArc(0, 0, -1, 60)).toBe(true);
    expect(inArc(0, 0, 1, 60)).toBe(false);
    expect(inArc(0, 1, -0.2, 60)).toBe(false);
    expect(inArc(0, 0, 1, 360)).toBe(true);
  });
  it('a shield turns blows from the front, not the flank or back', () => {
    // A blow travelling +Z (from in front of a guard facing -Z) is blocked; one travelling -Z (from behind) isn't.
    expect(guards(0, 0, 1, 120)).toBe(true);
    expect(guards(0, 0, -1, 120)).toBe(false);
    expect(guards(0, -1, 0, 120)).toBe(false);
  });
  it('hears noises within their reach; walking is near silent', () => {
    const n = tuning.foes.noise;
    expect(hears(0, 0, 0, { x: 30, y: 0, z: 0, r: n.pistol })).toBe(true);
    expect(hears(0, 0, 0, { x: 6, y: 0, z: 0, r: n.walk })).toBe(false);
    expect(hears(0, 0, 0, { x: 6, y: 0, z: 0, r: n.sprint })).toBe(true);
    expect(n.walk).toBeLessThan(tuning.foes.blindfold.senseRange + 1);
    const best = loudest(0, 0, 0, [
      { x: 2, y: 0, z: 0, r: 3 },
      { x: 10, y: 0, z: 0, r: 40 },
    ]);
    expect(best?.x).toBe(10);
  });
  it('slams land ahead; leashes snap past their length', () => {
    const [x, z] = slamCentre(0, 0, 0, 2);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-2, 6);
    expect(leashBroken(0, 0, 10, 0, 9)).toBe(true);
    expect(leashBroken(0, 0, 5, 0, 9)).toBe(false);
  });
});

describe('fair range (LEVELS.md → Combat spaces)', () => {
  it('a Page stands far enough off to read and dodge a throw', () => {
    const min = rangedMinDistance(tuning.foes.page.attacks.throw, tuning.roll);
    expect(min).toBeCloseTo(tuning.foes.page.attacks.throw.windup * tuning.foes.page.attacks.throw.speed + tuning.roll.speed * tuning.roll.duration, 6);
    expect(tuning.foes.page.holdRange).toBeGreaterThanOrEqual(min - 1);
  });
});

describe('mirrored poses', () => {
  it('a dual-wielder swaps hands and flips yaw and roll', () => {
    const p = PLANS.blindfold.motions.slash.windup;
    const m = mirrorPose(p, true);
    expect(m.handR[0]).toBeCloseTo(-p.handL[0], 6);
    expect(m.handL[0]).toBeCloseTo(-p.handR[0], 6);
    expect(m.weapon[1]).toBeCloseTo(-p.off[1], 6);
    expect(mirrorPose(m, true)).toEqual(p);
  });
  it('a single blade stays in the right hand and swings back the other way', () => {
    const p = PLANS.page.motions.cut.windup;
    const m = mirrorPose(p);
    expect(m.handR[0]).toBeCloseTo(-p.handR[0], 6);
    expect(m.weapon[1]).toBeCloseTo(-p.weapon[1], 6);
    expect(m.weapon[0]).toBeCloseTo(p.weapon[0], 6);
  });
});

describe('court cards (V2-5)', () => {
  it('step up a phase at each health threshold', () => {
    expect(phaseOf(1, [0.5])).toBe(0);
    expect(phaseOf(0.5, [0.5])).toBe(1);
    expect(phaseOf(0.7, [0.66, 0.33])).toBe(0);
    expect(phaseOf(0.5, [0.66, 0.33])).toBe(1);
    expect(phaseOf(0.1, [0.66, 0.33])).toBe(2);
  });

  it('volleys always leave a gap wide enough to stand in, and the follow-up mirrors it', () => {
    for (const lanes of [5, 7, 9]) {
      for (let gap = 1; gap < lanes - 1; gap++) {
        const a = volleyOffsets(lanes, 1.7, gap, false);
        const b = volleyOffsets(lanes, 1.7, gap, true);
        expect(a).toHaveLength(lanes - 1);
        // Mirrored: the same lanes reflected across the throw.
        const flip = [...b].map((x) => -x + 0).sort((x, y) => x - y);
        flip.forEach((x, i) => expect(x).toBeCloseTo([...a].sort((p, q) => p - q)[i], 9));
        // The gap between neighbouring blades is two spacings: room for the player (0.6 m wide) and then some.
        const sorted = [...a].sort((x, y) => x - y);
        const widest = Math.max(...sorted.slice(1).map((x, i) => x - sorted[i]));
        expect(widest).toBeCloseTo(3.4, 6);
      }
    }
  });

  it('only use phase-two attacks once they reach phase two', () => {
    const atk = tuning.foes.knight.attacks as Record<string, AttackTune>;
    for (let i = 0; i < 50; i++) expect(pickAttack(atk, 10, {}, i / 50, 0)).toBe('charge');
    let re = 0;
    for (let i = 0; i < 50; i++) if (pickAttack(atk, 10, {}, i / 50, 1) === 'recharge') re++;
    expect(re).toBeGreaterThan(0);
    // Charges need a run-up.
    expect(pickAttack({ charge: atk.charge }, 3, {}, 0.5, 0)).toBeNull();
  });

  it('every court attack telegraphs, has a pose, and leaves a punish window', () => {
    for (const rank of COURT_RANKS) {
      const t = tuning.foes[rank];
      expect(t.phases.length).toBeGreaterThan(0);
      for (const [name, a] of Object.entries(t.attacks as Record<string, AttackTune>)) {
        expect(a.windup, `${rank}.${name}`).toBeGreaterThanOrEqual(0.35);
        expect(a.recover, `${rank}.${name}`).toBeGreaterThanOrEqual(0.7);
        expect(COURT_PLANS[rank].motions[name], `${rank}.${name} has a pose`).toBeTruthy();
      }
      // The suit reads before the face: every court card is taller than the commons.
      expect(COURT_PLANS[rank].height).toBeGreaterThan(2);
    }
  });
});

describe('Justice (V2-6)', () => {
  it("echoes across her arena's axis: what lands on one side lands on the other", () => {
    // Axis through (0, -96) heading north (yaw 0): x flips, z stays.
    const [x, z] = mirrorAcross(7, -90, 0, -96, 0);
    expect(x).toBeCloseTo(-7, 6);
    expect(z).toBeCloseTo(-90, 6);
    // On the axis, a point is its own mirror; mirroring twice is the identity.
    expect(mirrorAcross(0, -80, 0, -96, 0)[0]).toBeCloseTo(0, 6);
    const [x2, z2] = mirrorAcross(...mirrorAcross(3, -70, 1, -96, 0.4), 1, -96, 0.4);
    expect(x2).toBeCloseTo(3, 6);
    expect(z2).toBeCloseTo(-70, 6);
  });
  it('is an arcana: large, with phase-two attacks', () => {
    expect(JUSTICE_PLAN.height / 1.6).toBeGreaterThanOrEqual(1.5);
    expect(JUSTICE_PLAN.height / 1.6).toBeLessThanOrEqual(4);
    const atk = tuning.foes.justice.attacks as Record<string, AttackTune>;
    expect(Object.values(atk).some((a) => (a.minPhase ?? 0) >= 1)).toBe(true);
    for (const name of Object.keys(atk)) expect(JUSTICE_PLAN.motions[name], name).toBeTruthy();
  });
});

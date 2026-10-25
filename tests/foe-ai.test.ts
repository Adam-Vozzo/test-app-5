import { describe, expect, it } from 'vitest';
import { attackDuration, attackTimeline, guards, hears, inArc, leashBroken, loudest, pickAttack, rangedMinDistance, slamCentre, type AttackTune } from '../src/enemies/foe-ai';
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
  it('swap hands and flip yaw and roll', () => {
    const p = PLANS.blindfold.motions.slash.windup;
    const m = mirrorPose(p);
    expect(m.handR[0]).toBeCloseTo(-p.handL[0], 6);
    expect(m.handL[0]).toBeCloseTo(-p.handR[0], 6);
    expect(m.weapon[1]).toBeCloseTo(-p.off[1], 6);
    expect(mirrorPose(m)).toEqual(p);
  });
});

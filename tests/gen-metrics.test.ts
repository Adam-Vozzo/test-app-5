// The generator's range, measured (LEVELS.md → Measuring the generator): each dimension's levels take its card's
// shape, read off what it generates. The means print as a table (the record LEVELS.md keeps).
import { describe, expect, it } from 'vitest';
import { DIMENSIONS } from '../src/world/dimensions';
import { generateLevel } from '../src/world/gen-level';
import { levelMetrics, meanMetrics, type LevelMetrics } from '../src/world/gen-metrics';
import type { LevelParts } from '../src/world/gen-validate';

const SEEDS = Array.from({ length: 20 }, (_, i) => i * 7919 + 13);
const means: Record<string, LevelMetrics & { sequences: number }> = {};
for (const id of ['justice', 'devil', 'tower', 'moon']) {
  const dim = DIMENSIONS[id];
  const ms: LevelMetrics[] = [];
  const seqs = new Set<string>();
  for (const level of [0, 1, 2])
    for (const seed of SEEDS) {
      const { layout: L } = generateLevel(dim, level, seed, { rangedMin: 14 });
      const p: LevelParts = { dim, script: L.script, graph: L.graph, space: L.space, furn: L.furn, sockets: L.sockets, dressing: L.dressing };
      ms.push(levelMetrics(p));
      seqs.add(L.graph.critical.map((n) => L.graph.nodes[n].kind).join('-'));
    }
  means[id] = { ...meanMetrics(ms), sequences: seqs.size };
}

describe("each dimension's levels take its card's shape (60 levels each)", () => {
  it('prints the table', () => {
    const rows = Object.entries(means).map(([id, m]) => `${id.padEnd(8)} ${Object.entries(m).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ')}`);
    console.log(`\n${rows.join('\n')}`);
  });

  it('none is the straight north spine any more: every dimension turns and spreads its headings', () => {
    for (const m of Object.values(means)) {
      expect(m.straightness).toBeLessThan(0.75);
      expect(m.headingSpread).toBeGreaterThan(0.4);
      expect(m.landings).toBeGreaterThan(1);
    }
  });

  it('Justice weighs: wings off a formal axis, flat', () => {
    expect(means.justice.heightRange).toBeLessThan(5);
    expect(means.justice.turns).toBeGreaterThanOrEqual(3);
  });

  it('the Devil spirals down round the pit, and the pedestal is nearly always in sight', () => {
    expect(means.devil.heightRange).toBeGreaterThan(20);
    expect(means.devil.straightness).toBeLessThan(0.6);
    expect(means.devil.landmarkShare).toBeGreaterThan(0.75);
  });

  it('the Tower spirals up round the tower, the crown in sight from every room', () => {
    expect(means.tower.heightRange).toBeGreaterThan(20);
    expect(means.tower.straightness).toBeLessThan(0.6);
    expect(means.tower.landmarkShare).toBe(1);
  });

  it('the Moon meanders: turning often, level', () => {
    expect(means.moon.turns).toBeGreaterThanOrEqual(5);
    expect(means.moon.heightRange).toBeLessThan(3);
  });

  it('later rooms show before they are reached', () => {
    for (const m of Object.values(means)) expect(m.seenEarly).toBeGreaterThan(1);
  });

  it('the pace: a fight every ~120 m walked (V2-16 had stretched it to ~150), and one past every gate', () => {
    for (const m of Object.values(means)) {
      expect(m.fights).toBeGreaterThanOrEqual(4);
      expect(m.perFight).toBeLessThan(125);
      // Past the gate, a fight before the next lantern: the shortcut (or the opened axis) brings you back to it.
      expect(m.pastGate).toBeGreaterThanOrEqual(1);
    }
  });
});

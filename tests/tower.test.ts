import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { TOWER_DIMENSION as DIM } from '../src/world/dimensions';
import { doorCells } from '../src/world/gen-dress';
import { generateLevel } from '../src/world/gen-level';
import { connected, ScaffoldGrid } from '../src/world/scaffold';
import { tuning } from '../src/tuning';

const T = { crackTime: 1, burnTime: 4, spreadPerSec: 0.5 };

describe("the Tower's decks (collapse, pure)", () => {
  it('a rotten deck cracks when stepped on and falls after crackTime; a sound one never does', () => {
    const g = new ScaffoldGrid(3, 3, [4]);
    expect(g.step(0)).toBe(null);
    expect(g.step(4)?.kind).toBe('crack');
    expect(g.step(4)).toBe(null);
    let fell = 0;
    for (let t = 0; t < 1.5; t += 0.1) fell += g.update(0.1, T, () => 0.99).filter((e) => e.kind === 'fall').length;
    expect(fell).toBe(1);
    expect(g.state[4]).toBe('gone');
    expect(g.state[0]).toBe('sound');
  });
  it('fire spreads to sound neighbours over time, and burnt decks fall', () => {
    const g = new ScaffoldGrid(5, 1, []);
    g.ignite(2);
    const rng = makeRng(7);
    for (let t = 0; t < 12; t += 0.1) g.update(0.1, T, rng);
    // With spread at 0.5/s, the whole row has caught and burnt through.
    expect(g.state.every((s) => s === 'gone')).toBe(true);
  });
  it("fire doesn't jump gaps: a fallen deck stops it", () => {
    const g = new ScaffoldGrid(5, 1, []);
    g.state[2] = 'gone';
    g.ignite(0);
    for (let t = 0; t < 10; t += 0.1) g.update(0.1, T, () => 0);
    expect(g.state[3]).toBe('sound');
    expect(g.state[4]).toBe('sound');
  });
  it('a rest brings every deck back', () => {
    const g = new ScaffoldGrid(2, 2, [0]);
    g.step(0);
    g.ignite(3);
    for (let t = 0; t < 6; t += 0.1) g.update(0.1, T, () => 0.99);
    g.reset();
    expect(g.state.every((s) => s === 'sound')).toBe(true);
  });
  it('connected: a wall of rot cuts the way; a gap in it lets you through', () => {
    const wall = [2, 7, 12, 17, 22];
    expect(connected(5, 5, (i) => wall.includes(i), [[0, 2]], [[4, 2]])).toBe(false);
    expect(connected(5, 5, (i) => wall.slice(1).includes(i), [[0, 2]], [[4, 2]])).toBe(true);
  });
});

describe('the Tower: levels that climb on timber', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => i * 7919 + 13);
  const levels = [0, 1, 2].flatMap((level) => seeds.map((seed) => ({ level, seed, ...generateLevel(DIM, level, seed, { rangedMin: 14 }) })));
  it('every seed is valid', () => {
    for (const { report, level, seed } of levels) expect(report.ok, `L${level + 1} seed ${seed}: ${report.failures.flat().join('; ')}`).toBe(true);
  });
  it('always going up: the exit stands well above the spawn', () => {
    for (const { layout: L } of levels) {
      const crit = L.graph.critical.map((id) => L.space.rooms.find((r) => r.node === id)!);
      expect(crit[crit.length - 1].y - crit[0].y).toBeGreaterThan(-DIM.descent * 3);
    }
  });
  it('the fights are on timber, the lanterns and the throne on stone', () => {
    for (const { layout: L } of levels) {
      const decked = new Set(L.dressing.scaffolds.map((s) => s.node));
      for (const r of L.space.rooms) expect(decked.has(r.node)).toBe(!!DIM.kits[r.kit].scaffold);
      for (const l of L.dressing.lanterns) expect(decked.has(l.node)).toBe(false);
    }
  });
  it("the rot never cuts a room's doors apart, and it grows with the beat", () => {
    const share = [0, 0, 0];
    const total = [0, 0, 0];
    for (const { layout: L, level } of levels) {
      for (const s of L.dressing.scaffolds) {
        const r = L.space.rooms.find((x) => x.node === s.node)!;
        const doors = doorCells(s, r);
        expect(connected(s.cols, s.rows, (i) => s.rotten.includes(i), doors.slice(0, 1), doors)).toBe(true);
        share[level] += s.rotten.length;
        total[level] += s.cols * s.rows;
      }
    }
    const f = share.map((n, i) => n / total[i]);
    expect(f[0]).toBeLessThan(f[1]);
    expect(f[1]).toBeLessThan(f[2]);
  });
  it('lightning comes more often as the levels climb', () => {
    const l = tuning.tower.lightning;
    expect(l[2][1]).toBeLessThan(l[0][0]);
    // A mark is always readable: its delay outlasts a roll's commitment.
    expect(tuning.tower.lightningDelay).toBeGreaterThan(tuning.roll.duration + tuning.roll.recovery + 0.4);
  });
});

describe('the stage keeps changing (playtest: it emptied too fast)', () => {
  it('a fallen deck is built back after regrowTime, but never under someone standing there', () => {
    const g = new ScaffoldGrid(2, 1, [0]);
    const T = { crackTime: 1, burnTime: 4, spreadPerSec: 0, regrowTime: 6 };
    g.step(0);
    const run = (s: number, occupied = false) => {
      const ev: string[] = [];
      for (let t = 0; t < s; t += 0.1) ev.push(...g.update(0.1, T, () => 0.5, () => occupied).map((e) => e.kind));
      return ev;
    };
    expect(run(1.2)).toContain('fall');
    expect(g.state[0]).toBe('gone');
    // Someone in the hole's space (falling through it, or standing beside it): it waits.
    run(7, true);
    expect(g.state[0]).toBe('gone');
    expect(run(0.3)).toContain('regrow');
    expect(g.state[0]).toBe('sound');
    // Rotten it was, and rotten it is: it cracks again when stepped on.
    expect(g.step(0)).not.toBeNull();
  });
  it('holes in a round floor never grow decks, and without regrowTime nothing comes back', () => {
    const g = new ScaffoldGrid(2, 1, [], [1]);
    for (let t = 0; t < 20; t += 0.5) g.update(0.5, { crackTime: 1, burnTime: 4, spreadPerSec: 0, regrowTime: 6 }, () => 0.5);
    expect(g.state[1]).toBe('gone');
    const h = new ScaffoldGrid(1, 1, []);
    h.crack(0);
    for (let t = 0; t < 20; t += 0.5) h.update(0.5, { crackTime: 1, burnTime: 4, spreadPerSec: 0 }, () => 0.5);
    expect(h.state[0]).toBe('gone');
  });
});

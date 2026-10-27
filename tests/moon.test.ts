import { describe, expect, it } from 'vitest';
import { MOON_DIMENSION as DIM } from '../src/world/dimensions';
import { generateLevel } from '../src/world/gen-level';
import { landmarkVisible, type LevelParts } from '../src/world/gen-validate';

const seeds = Array.from({ length: 50 }, (_, i) => i * 7919 + 13);
const levels = [0, 1, 2].flatMap((level) => seeds.map((seed) => ({ level, seed, ...generateLevel(DIM, level, seed, { rangedMin: 14 }) })));

describe("the Moon's marsh (illusion, but fair)", () => {
  it('every seed is valid, and the marsh is level', () => {
    for (const { layout: L, report, level, seed } of levels) {
      expect(report.ok, `L${level + 1} seed ${seed}: ${report.failures.flat().join('; ')}`).toBe(true);
      const crit = L.graph.critical.map((id) => L.space.rooms.find((r) => r.node === id)!);
      for (const r of crit) expect(r.y).toBeCloseTo(DIM.kits[r.kit].floor, 6);
    }
  });
  it('reflections grow with the beat, and no room is only reflections', () => {
    const share = [0, 1, 2].map((lv) => {
      const s = levels.filter((l) => l.level === lv).flatMap((l) => l.layout.sockets.filter((x) => x.kind !== 'miniboss'));
      return s.filter((x) => x.illusion).length / s.length;
    });
    expect(share[0]).toBeGreaterThan(0.05);
    expect(share[0]).toBeLessThan(share[1]);
    expect(share[1]).toBeLessThan(share[2]);
    for (const { layout: L } of levels) {
      for (const n of new Set(L.sockets.map((s) => s.node))) {
        const here = L.sockets.filter((s) => s.node === n && s.kind !== 'miniboss');
        if (here.length) expect(here.some((s) => !s.illusion)).toBe(true);
      }
      expect(L.sockets.some((s) => s.kind === 'miniboss' && s.illusion)).toBe(false);
    }
  });
  it('false paths are only ever branches, and their caches are reflections', () => {
    for (const { layout: L } of levels) {
      expect(L.dressing.falsePaths.length).toBe(Math.min(DIM.illusion!.falseBranches, L.space.connectors.filter((c) => c.kind === 'branch').length));
      for (const i of L.dressing.falsePaths) {
        const c = L.space.connectors[i];
        expect(c.kind).toBe('branch');
        expect(L.dressing.caches.filter((k) => k.node === c.to).every((k) => k.reflection)).toBe(true);
      }
      // Every other cache is real.
      const lies = new Set(L.dressing.falsePaths.map((i) => L.space.connectors[i].to));
      for (const k of L.dressing.caches) expect(!!k.reflection).toBe(lies.has(k.node));
    }
  });
  it('the Moon and its two towers are in plain sight from the spawn and every vista', () => {
    for (const { layout: L } of levels) {
      const p: LevelParts = { dim: DIM, script: L.script, graph: L.graph, space: L.space, furn: L.furn, sockets: L.sockets, dressing: L.dressing, rangedMin: 14 };
      expect(landmarkVisible(p, L.dressing.spawn.x, L.dressing.spawn.y, L.dressing.spawn.z)).toBe(true);
      for (const v of L.dressing.vistas) expect(landmarkVisible(p, v.x, v.y, v.z)).toBe(true);
    }
  });
});

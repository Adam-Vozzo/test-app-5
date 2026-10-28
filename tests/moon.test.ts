import { describe, expect, it } from 'vitest';
import { MOON_DIMENSION as DIM } from '../src/world/dimensions';
import { generateLevel } from '../src/world/gen-level';
import { landmarkVisible, type LevelParts } from '../src/world/gen-validate';
import { toLocal } from '../src/world/gen-space';

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
  it('false paths are only ever branches, each with a hidden way across, and the cache beyond is real', () => {
    for (const { layout: L } of levels) {
      expect(L.dressing.falsePaths.length).toBe(Math.min(DIM.illusion!.falseBranches, L.space.connectors.filter((c) => c.kind === 'branch').length));
      for (const i of L.dressing.falsePaths) expect(L.space.connectors[i].kind).toBe('branch');
      // Stones only where there are false paths; reading their shadows earns a real cache.
      expect(L.dressing.stones.length > 0).toBe(L.dressing.falsePaths.length > 0);
      for (const k of L.dressing.caches) expect(!!k.reflection).toBe(false);
    }
  });
  it("the hidden stones wind: the drawn boardwalk's middle line has holes a body falls through", () => {
    for (const { layout: L } of levels) {
      for (const i of L.dressing.falsePaths) {
        const c = L.space.connectors[i];
        const len = Math.hypot(c.bx - c.ax, c.bz - c.az);
        const ux = (c.bx - c.ax) / len;
        const uz = (c.bz - c.az) / len;
        // Walk the middle line in 5 cm steps: is a 0.3 m-radius body over some stone?
        let hole = 0;
        let longest = 0;
        for (let a = 0; a <= len; a += 0.05) {
          const x = c.ax + ux * a;
          const z = c.az + uz * a;
          // Each stone is turned square to its path: measure in its own frame.
          const held = L.dressing.stones.some((s) => {
            const [u, v] = toLocal({ x: s.x, z: s.z, yaw: s.yaw }, x, z);
            return Math.max(0, Math.abs(u) - s.size / 2) ** 2 + Math.max(0, Math.abs(v) - s.size / 2) ** 2 < 0.3 ** 2;
          });
          hole = held ? 0 : hole + 0.05;
          longest = Math.max(longest, hole);
        }
        expect(longest).toBeGreaterThan(1.2);
      }
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

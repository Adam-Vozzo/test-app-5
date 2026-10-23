import { describe, expect, it } from 'vitest';
import { generateZone, walkDistance, zoneHeight, type ZoneLayout } from '../src/world/gen';
import type { ThemeId } from '../src/world/themes';

const SEEDS = [1, 2, 3, 42, 1234, 99999, 777, 31337];
const THEMES: ThemeId[] = ['garden', 'kitchen'];

function bfsDepths(L: ZoneLayout) {
  const adj = new Map<number, number[]>();
  for (const [a, b] of L.edges) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const depth = new Map<number, number>([[0, 0]]);
  const q = [0];
  while (q.length) {
    const n = q.shift()!;
    for (const m of adj.get(n) ?? []) if (!depth.has(m)) { depth.set(m, depth.get(n)! + 1); q.push(m); }
  }
  return { depth, adj };
}

describe('generateZone', () => {
  it('is deterministic for a seed + theme', () => {
    for (const t of THEMES) expect(JSON.stringify(generateZone(4242, t))).toBe(JSON.stringify(generateZone(4242, t)));
  });

  it('differs across seeds', () => {
    const a = JSON.stringify(generateZone(1, 'garden').nodes);
    const b = JSON.stringify(generateZone(2, 'garden').nodes);
    expect(a).not.toBe(b);
  });

  for (const theme of THEMES) {
    it(`${theme}: 6–10 connected clearings, start → boss is the farthest, one side-branch cache`, () => {
      for (const seed of SEEDS) {
        const L = generateZone(seed, theme);
        expect(L.nodes.length).toBeGreaterThanOrEqual(6);
        expect(L.nodes.length).toBeLessThanOrEqual(10);
        const { depth, adj } = bfsDepths(L);
        expect(depth.size).toBe(L.nodes.length); // connected
        expect(L.nodes[0].role).toBe('start');
        const boss = L.nodes.filter((n) => n.role === 'boss');
        expect(boss.length).toBe(1);
        const maxMain = Math.max(...L.nodes.filter((n) => n.role !== 'cache').map((n) => depth.get(n.id)!));
        expect(depth.get(boss[0].id)).toBe(maxMain);
        const cache = L.nodes.filter((n) => n.role === 'cache');
        expect(cache.length).toBe(1);
        expect(adj.get(cache[0].id)!.length).toBe(1); // a dead end
        expect(L.mainPath).not.toContain(cache[0].id); // optional: off the main path
        const parent = adj.get(cache[0].id)![0];
        expect(parent).not.toBe(0);
        expect(parent).not.toBe(boss[0].id);
      }
    });

    it(`${theme}: clearings don't overlap, spawns are walkable, brute in the boss clearing`, () => {
      for (const seed of SEEDS) {
        const L = generateZone(seed, theme);
        for (let i = 0; i < L.nodes.length; i++)
          for (let j = i + 1; j < L.nodes.length; j++) {
            const a = L.nodes[i];
            const b = L.nodes[j];
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(a.r + b.r + 4);
          }
        for (const s of L.spawns) {
          expect(walkDistance(L, s.x, s.z)).toBeLessThan(0);
          expect(L.nodes[s.node].role).not.toBe('start');
        }
        const brutes = L.spawns.filter((s) => s.kind === 'brute');
        expect(brutes.length).toBe(1);
        expect(L.nodes[brutes[0].node].role).toBe('boss');
        expect(walkDistance(L, L.checkpoint.x, L.checkpoint.z)).toBeLessThan(0);
      }
    });
  }

  it('clearings are flat (height matches the node) and the kitchen is level', () => {
    const L = generateZone(42, 'garden');
    for (const n of L.nodes) expect(zoneHeight(L, n.x, n.z)).toBeCloseTo(n.h, 5);
    const K = generateZone(42, 'kitchen');
    expect(zoneHeight(K, 13, -7)).toBe(0);
  });
});

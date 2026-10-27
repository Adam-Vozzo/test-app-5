import { describe, expect, it } from 'vitest';
import { fleeHeading, flankPoints, segmentDistance } from '../src/enemies/foe-ai';
import { Binding } from '../src/player/binding';
import { DEVIL_DIMENSION as DEV } from '../src/world/dimensions';
import { generateLevel } from '../src/world/gen-level';
import { inRoom } from '../src/world/gen-dress';
import { tuning } from '../src/tuning';

describe("the Devil's binding (one roll always breaks it)", () => {
  it('holds, then strikes once when its time is up', () => {
    const b = new Binding();
    b.catch(1.5, 48, 8);
    expect(b.active).toBe(true);
    let struck = 0;
    for (let t = 0; t < 2; t += 0.1) if (b.update(0.1) === 'struck') struck++;
    expect(struck).toBe(1);
    expect(b.active).toBe(false);
  });
  it('breaks to one roll at any moment, and the blow never lands', () => {
    for (const at of [0, 0.5, 1.49]) {
      const b = new Binding();
      b.catch(1.5, 48, 8);
      b.update(at);
      expect(b.roll()).toBe('broken');
      expect(b.active).toBe(false);
      for (let t = 0; t < 3; t += 0.1) expect(b.update(0.1)).toBe(null);
    }
  });
  it('a roll while free breaks nothing; a second catch refreshes the hold without stacking', () => {
    const b = new Binding();
    expect(b.roll()).toBe(null);
    b.catch(1.5, 30, 8);
    b.update(1.0);
    b.catch(1.5, 48, 8);
    expect(b.k).toBe(0);
    expect(b.damage).toBe(48);
    let struck = 0;
    for (let t = 0; t < 3; t += 0.05) if (b.update(0.05) === 'struck') struck++;
    expect(struck).toBe(1);
  });
  it('the coil tightens from 0 to 1 over the hold', () => {
    const b = new Binding();
    b.catch(2, 10, 1);
    expect(b.k).toBe(0);
    b.update(1);
    expect(b.k).toBeCloseTo(0.5, 6);
  });
});

describe('Thrall geometry (pure)', () => {
  it('segmentDistance: across the middle, past the ends, and a point on the chain', () => {
    expect(segmentDistance(0, 1, -2, 0, 2, 0)).toBeCloseTo(1, 6);
    expect(segmentDistance(5, 0, -2, 0, 2, 0)).toBeCloseTo(3, 6);
    expect(segmentDistance(0.5, 0, -2, 0, 2, 0)).toBeCloseTo(0, 6);
    expect(segmentDistance(1, 1, 0, 0, 0, 0)).toBeCloseTo(Math.SQRT2, 6);
  });
  it('flankPoints put the player at the middle of the chain, along its current axis', () => {
    const [ax, az, bx, bz] = flankPoints(10, 5, 3, 0, -3, 0, 2.7);
    expect((ax + bx) / 2).toBeCloseTo(10, 6);
    expect((az + bz) / 2).toBeCloseTo(5, 6);
    expect(Math.hypot(ax - bx, az - bz)).toBeCloseTo(5.4, 6);
    // The lead keeps its side.
    expect(ax).toBeGreaterThan(bx);
    expect(segmentDistance(10, 5, ax, az, bx, bz)).toBeCloseTo(0, 6);
  });
  it('fleeHeading runs straight away near home, and bends along the edge near the leash', () => {
    const [x, z] = fleeHeading(0, 0, 0, 5, 0, 0, 30, 1);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-1, 6);
    // At the leash edge, the heading turns sideways (and a little back toward home), never further out.
    const [ex, ez] = fleeHeading(0, -27, 0, -20, 0, 0, 30, 1);
    expect(ez).toBeGreaterThan(-0.3);
    expect(Math.abs(ex)).toBeGreaterThan(0.5);
    expect(Math.hypot(ex, ez)).toBeCloseTo(1, 6);
  });
});

describe("the Devil's temptation: hoards in plain sight", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 104729 + 7);
  it('every level has its hoards inside rooms, off the way through, each with a cost its level teaches', () => {
    for (const level of [0, 1, 2]) {
      for (const seed of seeds) {
        const { layout: L, report } = generateLevel(DEV, level, seed);
        expect(report.ok).toBe(true);
        const plain = L.dressing.hoards.filter((h) => !h.branch);
        expect(plain.length).toBeGreaterThanOrEqual(DEV.temptation!.hoards[level][0]);
        for (const h of L.dressing.hoards) {
          const r = L.space.rooms.find((x) => x.node === h.node)!;
          expect(inRoom(r, h.x, h.z)).toBe(true);
          if (!h.branch) expect(DEV.temptation!.costs[level]).toContain(h.cost);
          for (const s of L.sockets) expect(Math.hypot(s.x - h.x, s.z - h.z)).toBeGreaterThanOrEqual(2.5);
        }
        // Risk branches hold a hoard, not a cache.
        expect(L.dressing.caches.length).toBe(0);
        const branches = L.graph.nodes.filter((n) => n.kind === 'branch').length;
        expect(L.dressing.hoards.filter((h) => h.branch).length).toBe(branches);
      }
    }
  });
  it('one new cost at a time: level 1 only rings, level 2 adds weight, level 3 adds the ambush', () => {
    const seen = [0, 1, 2].map((level) => new Set(seeds.flatMap((seed) => generateLevel(DEV, level, seed).layout.dressing.hoards.filter((h) => !h.branch).map((h) => h.cost))));
    expect([...seen[0]]).toEqual(['bell']);
    expect(seen[1].has('weight')).toBe(true);
    expect(seen[1].has('ambush')).toBe(false);
    expect(seen[2].has('ambush')).toBe(true);
  });
  it('the weight is a burden with a ceiling, not a death spiral', () => {
    const h = tuning.foes.hoard;
    expect(h.weightRollMul ** h.weightMax).toBeGreaterThan(0.5);
    expect(h.weightMoveMul ** h.weightMax).toBeGreaterThan(0.65);
  });
  it("the Devil's own hold its rooms: no Justice archetypes left in its rosters", () => {
    const justice = ['bailiff', 'gavel', 'blindfold', 'page'];
    for (const l of DEV.levels) for (const role of Object.values(l.roster)) for (const id of role) expect(justice).not.toContain(id);
  });
});

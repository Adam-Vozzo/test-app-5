import { describe, expect, it } from 'vitest';
import { DEVIL_DIMENSION, JUSTICE_DIMENSION as DIM } from '../src/world/dimensions';
import { isCombat } from '../src/world/gen-graph';
import { attemptLevel, generateLevel, type LevelLayout } from '../src/world/gen-level';
import { connLength, obbOverlap, roomObb, segmentsOf, sidePoint, toLocal, wrapAngle } from '../src/world/gen-space';
import { rangedMinDistance } from '../src/enemies/foe-ai';
import { tuning } from '../src/tuning';
import { checkGraph, checkSockets, checkSpace, landmarkVisible, segmentHitsBox, validate, type LevelParts } from '../src/world/gen-validate';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 13);
const RANGED = rangedMinDistance(tuning.foes.page.attacks.throw, tuning.roll);
const OPTS = { rangedMin: RANGED };
const parts = (L: LevelLayout): LevelParts => ({ dim: DIM, script: L.script, graph: L.graph, space: L.space, furn: L.furn, sockets: L.sockets, dressing: L.dressing, rangedMin: RANGED });

// Generate once, check many properties.
const levels = [0, 1, 2].flatMap((level) => SEEDS.map((seed) => ({ level, seed, ...generateLevel(DIM, level, seed, OPTS) })));

describe('level generator: validity and budget', () => {
  it('every seed yields a valid level, quickly', () => {
    for (const { layout, report, level, seed } of levels) {
      expect(report.ok, `L${level + 1} seed ${seed}: ${report.failures.flat().join('; ')}`).toBe(true);
      expect(validate(parts(layout))).toEqual([]);
      expect(report.attempts).toBeLessThanOrEqual(8);
      // LEVELS.md budget: < 200 ms including retries (generous here: CI machines are slow).
      expect(report.ms).toBeLessThan(200);
    }
  });

  it('most seeds pass on the first attempt', () => {
    const first = levels.filter((l) => l.report.attempts === 1).length;
    expect(first / levels.length).toBeGreaterThan(0.7);
  });

  it('is deterministic: same dimension, level and seed give the same level', () => {
    for (const level of [0, 1, 2]) {
      const a = generateLevel(DIM, level, 4242, OPTS).layout;
      const b = generateLevel(DIM, level, 4242, OPTS).layout;
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });

  it('different seeds and different levels give different layouts', () => {
    const sig = (L: LevelLayout) => L.space.rooms.map((r) => `${r.kit}@${r.x.toFixed(1)},${r.z.toFixed(1)}`).join('|');
    const sigs = new Set(levels.map((l) => sig(l.layout)));
    expect(sigs.size).toBeGreaterThan(levels.length * 0.9);
  });
});

describe('level generator: mission graph', () => {
  it('runs start → … → lantern → miniboss → exit, with 9–10 critical nodes', () => {
    for (const { layout: L } of levels) {
      const kinds = L.graph.critical.map((id) => L.graph.nodes[id].kind);
      expect(kinds[0]).toBe('start');
      expect(kinds.slice(-3)).toEqual(['lantern', 'miniboss', 'exit']);
      expect(kinds.length).toBeGreaterThanOrEqual(DIM.criticalNodes[0]);
      expect(kinds.length).toBeLessThanOrEqual(DIM.criticalNodes[1]);
      expect(kinds.filter((k) => k === 'setpiece')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'gate')).toHaveLength(1);
    }
  });

  it('has ≥ 2 vistas, the set-piece past the axis gate, and a mirrored pair of branches off the wings', () => {
    for (const { layout: L } of levels) {
      const crit = L.graph.critical.map((id) => L.graph.nodes[id]);
      const n = crit.length;
      expect(crit.filter((nd) => nd.vista).length).toBeGreaterThanOrEqual(2);
      const sp = crit.findIndex((nd) => nd.kind === 'setpiece');
      expect(crit[sp - 1].kind).toBe('gate');
      expect(sp).toBeGreaterThanOrEqual(Math.floor(n / 3));
      expect(sp).toBeLessThan(Math.ceil(0.8 * n));
      const branches = L.graph.nodes.filter((nd) => nd.kind === 'branch');
      expect(branches).toHaveLength(2);
      const [left, right] = L.graph.wings!;
      expect(branches.map((b) => b.host).sort()).toEqual([left[0], right[0]].sort());
    }
  });

  it('never puts two fights back to back along a way, except in the twist level', () => {
    let twistAdjacent = 0;
    for (const { layout: L, level } of levels) {
      const adjacent = L.graph.edges.some(([a, b]) => isCombat(L.graph.nodes[a]) && isCombat(L.graph.nodes[b]));
      if (level < 2) expect(adjacent).toBe(false);
      else if (adjacent) twistAdjacent++;
    }
    // The twist may, and sometimes does.
    expect(twistAdjacent).toBeGreaterThan(0);
  });

  it("carries each beat's required encounter and rank", () => {
    for (const { layout: L, level } of levels) {
      const templates = L.graph.nodes.map((nd) => nd.template);
      expect(templates).toContain(DIM.levels[level].mustInclude[0]);
      expect(L.script.miniboss).toBe(['knight', 'queen', 'king'][level]);
      expect(L.script.beat).toBe(['introduce', 'develop', 'twist'][level]);
    }
  });

  it('weighs: two mirrored wings off the mid lantern, a key room at the end of each, then the axis gate', () => {
    for (const { layout: L } of levels) {
      const { gate, lantern } = L.graph.shortcut;
      const [left, right] = L.graph.wings!;
      expect(L.graph.nodes[lantern].kind).toBe('lantern');
      expect(L.graph.nodes[gate].kind).toBe('gate');
      expect(left).toHaveLength(right.length);
      expect(L.graph.nodes[left[left.length - 1]].kind).toBe('key');
      expect(L.graph.nodes[right[right.length - 1]].kind).toBe('key');
      // The wings mirror: the same kinds, kits and templates.
      left.forEach((id, i) => {
        const a = L.graph.nodes[id];
        const b = L.graph.nodes[right[i]];
        expect([b.kind, b.kit, b.template]).toEqual([a.kind, a.kit, a.template]);
      });
      // Both wings fork from the lantern; the gate follows it on the axis.
      expect(L.graph.edges).toContainEqual([lantern, left[0]]);
      expect(L.graph.edges).toContainEqual([lantern, right[0]]);
      expect(L.graph.edges).toContainEqual([lantern, gate]);
      // Played left wing, right wing, then on through the gate.
      expect(L.graph.nodes[gate].index).toBe(L.graph.nodes[right[right.length - 1]].index + 1);
      expect(L.graph.loop).toEqual([]);
    }
  });
});

describe('level generator: space', () => {
  it('lays rooms and connectors at any heading without overlaps, every way square to its doors and climbable', () => {
    let turned = 0;
    let landings = 0;
    for (const { layout: L } of levels) {
      const rooms = L.space.rooms;
      for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) expect(obbOverlap(roomObb(rooms[i], 1), roomObb(rooms[j], 1))).toBe(false);
      turned += rooms.filter((r) => Math.abs(Math.sin(2 * r.yaw)) > 0.05).length;
      L.space.connectors.forEach((c, i) => {
        const segs = segmentsOf(c);
        landings += c.bends.length;
        for (const g of segs) expect(Math.abs(g.by - g.ay) / g.len).toBeLessThanOrEqual(DIM.connector.maxSlope + 1e-9);
        // Square to both doorways (so its parapets run on flush).
        const a = rooms.find((r) => r.node === c.from)!.doors.find((d) => d.connector === i)!;
        const b = rooms.find((r) => r.node === c.to)!.doors.find((d) => d.connector === i)!;
        expect(Math.abs(wrapAngle(segs[0].yaw - a.yaw))).toBeLessThan(1e-6);
        expect(Math.abs(wrapAngle(segs[segs.length - 1].yaw - b.yaw - Math.PI))).toBeLessThan(1e-6);
      });
    }
    // The wings bend off the grid, turning on landings.
    expect(turned).toBeGreaterThan(levels.length);
    expect(landings).toBeGreaterThan(levels.length);
  });

  it('bars the axis at the mid lantern until both keys are set; the wings mirror about it', () => {
    for (const { layout: L } of levels) {
      const sc = L.space.connectors[L.space.shortcut];
      const hub = L.space.rooms.find((r) => r.node === L.graph.shortcut.lantern)!;
      const gate = L.space.rooms.find((r) => r.node === L.graph.shortcut.gate)!;
      expect(sc.ax).toBeCloseTo(hub.x, 6);
      expect(sc.bx).toBeCloseTo(gate.x, 6);
      const len = connLength(sc);
      expect(len).toBeGreaterThanOrEqual(DIM.loop.shortcut[0]);
      expect(len).toBeLessThanOrEqual(DIM.loop.shortcut[1]);
      expect(L.dressing.door.opens).toBe('keys');
      expect(Math.hypot(L.dressing.door.x - sc.ax, L.dressing.door.z - sc.az)).toBeLessThan(1e-6);
      expect(L.dressing.keys.map((k) => k.wing).sort()).toEqual([0, 1]);
      // Each pan rides back to the mid lantern's rest spot.
      const rest = L.dressing.lanterns.find((l) => l.node === hub.node)!.rest;
      for (const k of L.dressing.keys) expect([k.ride.x, k.ride.z]).toEqual([rest.x, rest.z]);
      const [left, right] = L.graph.wings!;
      left.forEach((id, i) => {
        const a = L.space.rooms.find((r) => r.node === id)!;
        const b = L.space.rooms.find((r) => r.node === right[i])!;
        expect(a.x + b.x).toBeCloseTo(2 * hub.x, 6);
        expect(b.z).toBeCloseTo(a.z, 6);
        expect(wrapAngle(a.yaw + b.yaw)).toBeCloseTo(0, 6);
      });
    }
  });

  it('places the landmark beyond the exit and keeps it in sight from the spawn and every vista', () => {
    for (const { layout: L } of levels) {
      const exit = L.space.rooms[L.space.rooms.findIndex((r) => r.node === L.graph.critical[L.graph.critical.length - 1])];
      // Up the axis from the exit's doorway (past the gate the way swings, so the exit may stand turned).
      expect(L.dressing.landmark.z).toBeLessThan(sidePoint(exit, 'front').z - DIM.landmark.beyondExit + 1e-6);
      const p = parts(L);
      const s = L.dressing.spawn;
      expect(landmarkVisible(p, s.x, s.y, s.z)).toBe(true);
      for (const v of L.dressing.vistas) expect(landmarkVisible(p, v.x, v.y, v.z)).toBe(true);
    }
  });
});

describe('level generator: encounters', () => {
  it('keeps spawns 15 m from lanterns, in front of the entry, and fills every fight', () => {
    for (const { layout: L } of levels) {
      for (const s of L.sockets) {
        for (const l of L.dressing.lanterns) expect(Math.hypot(l.x - s.x, l.z - s.z)).toBeGreaterThanOrEqual(15);
        const r = L.space.rooms.find((x) => x.node === s.node)!;
        if (s.template !== 'ambush') expect(toLocal(r, s.x, s.z)[1]).toBeGreaterThanOrEqual(-r.d / 2 + 6);
      }
      for (const nd of L.graph.nodes) if (isCombat(nd)) expect(L.sockets.some((s) => s.node === nd.id)).toBe(true);
      const mb = L.graph.nodes.find((nd) => nd.kind === 'miniboss')!;
      expect(L.sockets.filter((s) => s.node === mb.id && s.kind === 'miniboss')).toHaveLength(1);
    }
  });

  it("fills sockets from the beat's roster, and keeps throwers a fair distance from the way in", () => {
    for (const { layout: L, level } of levels) {
      const roster = DIM.levels[level].roster;
      for (const s of L.sockets) {
        if (s.kind === 'miniboss') continue;
        // A ranged role may fall back to a fighter; every other role draws from its own list.
        const allowed = s.kind === 'ranged' ? [...roster.ranged, ...roster.grunt, ...roster.guard] : roster[s.kind];
        expect(allowed).toContain(s.foe);
        if (DIM.rangedFoes.includes(s.foe)) {
          const r = L.space.rooms.find((x) => x.node === s.node)!;
          const [, v] = toLocal(r, s.x, s.z);
          expect(Math.hypot(toLocal(r, s.x, s.z)[0], v + r.d / 2)).toBeGreaterThanOrEqual(RANGED - 1e-6);
        }
      }
      // Introduce: one new enemy at a time. Level 1 has only Bailiffs and the signature Blindfold.
      if (level === 0) for (const s of L.sockets) expect(['bailiff', 'blindfold', 'miniboss']).toContain(s.foe);
      for (const s of L.sockets) if (s.kind === 'signature') expect(s.foe).toBe('blindfold');
    }
  });

  it('mirrors cover about the room axis in a symmetric dimension', () => {
    for (const { layout: L } of levels.slice(0, 20)) {
      for (const r of L.space.rooms) {
        const cover = L.furn.boxes.filter((b) => b.node === r.node && (b.kind === 'half' || b.kind === 'full'));
        for (const b of cover) {
          const [u, v] = toLocal(r, b.x, b.z);
          const twin = cover.some((c) => {
            const [cu, cv] = toLocal(r, c.x, c.z);
            return Math.abs(cu + u) < 1e-6 && Math.abs(cv - v) < 1e-6;
          });
          expect(twin).toBe(true);
        }
      }
    }
  });
});

describe('level validation catches bad levels', () => {
  const base = levels[0].layout;
  const clone = (): LevelParts => parts(JSON.parse(JSON.stringify(base)));

  it('flags a spawn beside a lantern', () => {
    const p = clone();
    const l = p.dressing.lanterns[1];
    p.sockets[0] = { ...p.sockets[0], x: l.x + 2, z: l.z };
    expect(checkSockets(p).some((f) => f.includes('lantern'))).toBe(true);
  });

  it('flags missing vistas and a misplaced set-piece', () => {
    const p = clone();
    for (const nd of p.graph.nodes) nd.vista = false;
    const sp = p.graph.nodes.find((nd) => nd.kind === 'setpiece')!;
    const first = p.graph.nodes[1];
    [sp.kind, first.kind] = [first.kind, sp.kind];
    const f = checkGraph(p);
    expect(f.some((x) => x.includes('vistas'))).toBe(true);
    expect(f.some((x) => x.includes('set-piece'))).toBe(true);
  });

  it('flags overlapping rooms and an over-long shortcut', () => {
    const p = clone();
    p.space.rooms[1] = { ...p.space.rooms[1], x: p.space.rooms[0].x, z: p.space.rooms[0].z };
    const sc = p.space.connectors[p.space.shortcut];
    sc.az += 500;
    const f = checkSpace(p);
    expect(f.some((x) => x.includes('overlap'))).toBe(true);
    expect(f.some((x) => x.includes('shortcut'))).toBe(true);
  });

  it('a wall across the sight line hides the landmark', () => {
    const p = clone();
    const s = p.dressing.spawn;
    expect(landmarkVisible(p, s.x, s.y, s.z)).toBe(true);
    p.furn.boxes.push({ x: s.x, z: s.z - 4, y: s.y, sx: 400, sz: 1, h: 400, yaw: 0, kind: 'wall', node: -1 });
    expect(landmarkVisible(p, s.x, s.y, s.z)).toBe(false);
  });

  it('segment–box test', () => {
    const box = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };
    expect(segmentHitsBox([-5, 1, 0], [5, 1, 0], box)).toBe(true);
    expect(segmentHitsBox([-5, 3, 0], [5, 3, 0], box)).toBe(false);
    expect(segmentHitsBox([-5, 1, 0], [-2, 1, 0], box)).toBe(false);
  });

  it('a failed attempt reports why', () => {
    // Some attempt somewhere fails; its reasons are strings naming the check.
    let found = false;
    for (let s = 0; s < 400 && !found; s++) {
      const a = attemptLevel(DIM, 2, s, OPTS);
      if (a.fail.length) {
        found = true;
        for (const f of a.fail) expect(f).toMatch(/^(graph|space|sockets|landmark|shape|budget):/);
      }
    }
    expect(found).toBe(true);
  });
});

describe('the Devil: a descending dimension (V2-8)', () => {
  const DEV = DEVIL_DIMENSION;
  const dparts = (L: LevelLayout): LevelParts => ({ dim: DEV, script: L.script, graph: L.graph, space: L.space, furn: L.furn, sockets: L.sockets, dressing: L.dressing, rangedMin: RANGED });
  const devil = [0, 1, 2].flatMap((level) => SEEDS.map((seed) => ({ level, seed, ...generateLevel(DEV, level, seed, OPTS) })));

  it('every seed yields a valid level within budget', () => {
    for (const { layout, report, level, seed } of devil) {
      expect(report.ok, `L${level + 1} seed ${seed}: ${report.failures.flat().join('; ')}`).toBe(true);
      expect(validate(dparts(layout))).toEqual([]);
      expect(report.attempts).toBeLessThanOrEqual(8);
    }
  });

  it('always goes down: each step outside the loop drops, the loop and its shortcut stay level', () => {
    for (const { layout: L } of devil) {
      const crit = L.graph.critical.map((id) => L.space.rooms.find((r) => r.node === id)!);
      const kitFloor = (i: number) => DEV.kits[crit[i].kit].floor;
      const { loop } = L.graph;
      const gate = L.graph.shortcut.gate;
      const datum = crit.map((r, i) => r.y - kitFloor(i));
      for (let i = 1; i < crit.length; i++) {
        const inLoop = loop.includes(crit[i].node) || crit[i].node === gate;
        expect(datum[i] - datum[i - 1]).toBeCloseTo(inLoop ? 0 : -DEV.descent, 6);
      }
      const sc = L.space.connectors[L.space.shortcut];
      expect(Math.abs(sc.y1 - sc.y0)).toBeLessThan(0.05);
      expect(crit[0].y - crit[crit.length - 1].y).toBeGreaterThan(DEV.descent * 3);
      // Branches hang level off their host.
      for (const c of L.space.connectors.filter((c) => c.kind === 'branch')) expect(c.y1).toBeCloseTo(c.y0, 6);
    }
  });

  it('Justice stays level (descent 0)', () => {
    for (const { layout: L } of levels) {
      for (const id of L.graph.critical) {
        const r = L.space.rooms.find((r) => r.node === id)!;
        expect(r.y).toBeCloseTo(DIM.kits[r.kit].floor, 6);
      }
    }
  });

  it("the pedestal's brazier is in plain sight from the spawn and every vista", () => {
    for (const { layout: L } of devil) {
      const p = dparts(L);
      expect(landmarkVisible(p, L.dressing.spawn.x, L.dressing.spawn.y, L.dressing.spawn.z)).toBe(true);
      for (const v of L.dressing.vistas) expect(landmarkVisible(p, v.x, v.y, v.z)).toBe(true);
    }
  });
});

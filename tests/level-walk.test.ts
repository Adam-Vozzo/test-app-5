// Walk the real player controller through every staircase of real generated levels (their real colliders: floors,
// parapets with door gaps, ramps, decks) and check she never catches on the way.
import './support/dom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Physics } from '../src/physics/world';
import { Controller } from '../src/player/controller';
import { DIMENSIONS } from '../src/world/dimensions';
import { generateLevel } from '../src/world/gen-level';
import { inRoom, segmentsOf } from '../src/world/gen-space';
import { buildLevel } from '../src/world/level';
import { tuning } from '../src/tuning';

let ready: Promise<void> | null = null;

describe('walking the stairs of generated levels', () => {
  for (const dim of ['justice', 'devil', 'tower', 'moon']) {
    it(`${dim}: every stair and causeway can be walked both ways without catching or falling`, async () => {
      ready ??= Physics.init();
      await ready;
      const stuck: string[] = [];
      let walked = 0;
      for (const seed of [42, 7]) {
        for (const level of [0, 1, 2]) {
          const physics = new Physics();
          const { layout, report } = generateLevel(DIMENSIONS[dim], level, seed);
          buildLevel(layout, report, DIMENSIONS[dim], physics);
          physics.step();
          const c = new Controller(physics, new THREE.Vector3(), 0);
          layout.space.connectors.forEach((k, i) => {
            // Every way between rooms (stairs, causeways and their landings), but not the Moon's lies nor a barred
            // shortcut.
            if (layout.dressing.falsePaths.includes(i) || k.kind === 'shortcut') return;
            const segs = segmentsOf(k);
            const hug = k.width / 2 - tuning.player.capsuleRadius - 0.05;
            // Down the middle and hugging either parapet, through every landing, steering as a player would; on a
            // straight one, also coming at the foot from the side.
            const lanes: [number, number][] = [[0, 0], [hug, 0], [-hug, 0]];
            if (!k.bends.length) lanes.push([hug, 1], [-hug, 1]);
            for (const [o, side] of lanes)
              for (const up of [true, false]) {
                const runs = up ? segs : [...segs].reverse().map((g) => ({ ...g, ax: g.bx, az: g.bz, ay: g.by, bx: g.ax, bz: g.az, by: g.ay }));
                // Lateral offset `o` metres right of each run.
                // Along each run in its lane; across a landing by its middle (as you'd cross one).
                const pts: [number, number][] = [];
                for (const g of runs) {
                  const ux = (g.bx - g.ax) / g.len;
                  const uz = (g.bz - g.az) / g.len;
                  const into = g.landing === (up ? 'end' : 'start');
                  const outOf = g.landing === (up ? 'start' : 'end');
                  pts.push(outOf ? [g.ax, g.az] : [g.ax - uz * o, g.az + ux * o], into ? [g.bx, g.bz] : [g.bx - uz * o, g.bz + ux * o]);
                }
                const f = runs[0];
                const l = runs[runs.length - 1];
                const fu = [(f.bx - f.ax) / f.len, (f.bz - f.az) / f.len];
                const lu = [(l.bx - l.ax) / l.len, (l.bz - l.az) / l.len];
                const start: [number, number] = [f.ax - fu[0] * 4 - fu[1] * side * (o + 1), f.az - fu[1] * 4 + fu[0] * side * (o + 1)];
                const goal: [number, number] = [l.bx + lu[0] * 3 - lu[1] * o, l.bz + lu[1] * 3 + lu[0] * o];
                // Coming from the side: first onto the foot of the way, then along it.
                const foot: [number, number] = [pts[0][0] + fu[0] * 0.8, pts[0][1] + fu[1] * 0.8];
                const route: [number, number][] = [...(side ? [foot] : []), ...pts.slice(1, -1), goal];
                const roomA = layout.space.rooms.find((r) => r.node === (up ? k.from : k.to))!;
                if (!inRoom(roomA, start[0], start[1], 0.5)) continue;
                c.teleport(new THREE.Vector3(start[0], f.ay + 0.1, start[1]), 0);
                const dist = segs.reduce((a, g) => a + g.len, 0) + 10;
                let n = 0;
                for (let t = 0; t < dist / 3 + 4; t += 1 / 30) {
                  const target = route[n];
                  if (n < route.length - 1 && Math.hypot(c.pos.x - target[0], c.pos.z - target[1]) < 0.8) n++;
                  const yaw = Math.atan2(-(route[n][0] - c.pos.x), -(route[n][1] - c.pos.z));
                  c.update(1 / 30, { x: 0, y: 1, sprint: true, rollPressed: false, combat: false, speedMul: 1, camYaw: yaw });
                  physics.step();
                  if (n === route.length - 1 && Math.hypot(c.pos.x - goal[0], c.pos.z - goal[1]) < 0.8) break;
                }
                walked++;
                const left = Math.hypot(c.pos.x - goal[0], c.pos.z - goal[1]);
                const yb = up ? k.y1 : k.y0;
                if (left > 1.2 || Math.abs(c.pos.y - yb) > 0.6) stuck.push(`${dim} seed ${seed} L${level + 1} conn ${i} (${k.bends.length} landings) lane ${o.toFixed(1)} from ${side} ${up ? 'up' : 'down'}: ${left.toFixed(1)} m short at (${c.pos.x.toFixed(1)}, ${c.pos.y.toFixed(2)}, ${c.pos.z.toFixed(1)})`);
              }
          });
          // The ramps up to a nest's raised tier, in and out.
          for (const r of layout.furn.ramps) {
            // Rooms (and their tiers) stand at any heading.
            const rl = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
            const ux = (r.x1 - r.x0) / rl;
            const uz = (r.z1 - r.z0) / rl;
            for (const [from, to, ya, yb] of [
              [[r.x0 - ux * 2, r.z0 - uz * 2], [r.x1 + ux * 2, r.z1 + uz * 2], r.y0, r.y1],
              [[r.x1 + ux * 2, r.z1 + uz * 2], [r.x0 - ux * 2, r.z0 - uz * 2], r.y1, r.y0],
            ] as const) {
              c.teleport(new THREE.Vector3(from[0], ya + 0.1, from[1]), 0);
              const yaw = Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
              const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
              for (let t = 0; t < dist / 3 + 4; t += 1 / 60) {
                c.update(1 / 60, { x: 0, y: 1, sprint: false, rollPressed: false, combat: false, speedMul: 1, camYaw: yaw });
                physics.step();
                if (Math.hypot(c.pos.x - to[0], c.pos.z - to[1]) < 0.8) break;
              }
              walked++;
              const left = Math.hypot(c.pos.x - to[0], c.pos.z - to[1]);
              if (left > 1.2 || Math.abs(c.pos.y - yb) > 0.6) stuck.push(`${dim} seed ${seed} L${level + 1} tier ramp ${ya < yb ? 'up' : 'down'}: ${left.toFixed(1)} m short at (${c.pos.x.toFixed(1)}, ${c.pos.y.toFixed(2)}, ${c.pos.z.toFixed(1)})`);
            }
          }
          physics.world.free();
        }
      }
      expect(walked).toBeGreaterThan(0);
      expect(stuck).toEqual([]);
    }, 60000);
  }
});

describe("the Moon's false paths", () => {
  it('walking the drawn boardwalk drops you through; stepping stone to stone gets you across', async () => {
    ready ??= Physics.init();
    await ready;
    let tried = 0;
    for (const seed of [42, 7, 99]) {
      for (const level of [0, 1, 2]) {
        const dim = DIMENSIONS.moon;
        const { layout, report } = generateLevel(dim, level, seed);
        if (!layout.dressing.falsePaths.length) continue;
        const physics = new Physics();
        buildLevel(layout, report, dim, physics);
        physics.step();
        const c = new Controller(physics, new THREE.Vector3(), 0);
        for (const i of layout.dressing.falsePaths) {
          const k = layout.space.connectors[i];
          const len = Math.hypot(k.bx - k.ax, k.bz - k.az);
          const ux = (k.bx - k.ax) / len;
          const uz = (k.bz - k.az) / len;
          const steer = (targets: [number, number][], seconds: number) => {
            let n = 0;
            let low = Infinity;
            for (let t = 0; t < seconds && n < targets.length; t += 1 / 60) {
              const [tx, tz] = targets[n];
              if (Math.hypot(c.pos.x - tx, c.pos.z - tz) < 0.35) n++;
              const yaw = Math.atan2(-(tx - c.pos.x), -(tz - c.pos.z));
              c.update(1 / 60, { x: 0, y: 1, sprint: false, rollPressed: false, combat: false, speedMul: 1, camYaw: yaw });
              physics.step();
              low = Math.min(low, c.pos.y);
            }
            return low;
          };
          // The middle of the drawn boardwalk: nothing holds her.
          c.teleport(new THREE.Vector3(k.ax - ux * 2, k.y0 + 0.1, k.az - uz * 2), 0);
          const low = steer([[k.bx + ux * 2, k.bz + uz * 2]], len / 3 + 3);
          expect(low, `seed ${seed} L${level + 1} conn ${i}: walked the lie`).toBeLessThan(k.y0 - 2);
          // Stone to stone, following their shadows.
          const mine = layout.dressing.stones
            .map((s) => ({ s, along: (s.x - k.ax) * ux + (s.z - k.az) * uz }))
            .filter((o) => o.along > 0 && o.along < len && Math.hypot(o.s.x - (k.ax + ux * o.along), o.s.z - (k.az + uz * o.along)) < 2.5)
            .sort((a, b) => a.along - b.along)
            .map((o) => [o.s.x, o.s.z] as [number, number]);
          c.teleport(new THREE.Vector3(k.ax - ux * 1, k.y0 + 0.1, k.az - uz * 1), 0);
          const lowest = steer([...mine, [k.bx + ux * 2, k.bz + uz * 2]], len / 1.5 + 6);
          expect(lowest, `seed ${seed} L${level + 1} conn ${i}: fell off the stones`).toBeGreaterThan(Math.min(k.y0, k.y1) - 0.5);
          expect(Math.hypot(c.pos.x - (k.bx + ux * 2), c.pos.z - (k.bz + uz * 2))).toBeLessThan(0.8);
          tried++;
        }
        physics.world.free();
      }
    }
    expect(tried).toBeGreaterThan(2);
  }, 60000);
});

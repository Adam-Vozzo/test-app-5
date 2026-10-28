// Walk the real player controller through every staircase of real generated levels (their real colliders: floors,
// parapets with door gaps, ramps, decks) and check she never catches on the way.
import './support/dom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Physics } from '../src/physics/world';
import { Controller } from '../src/player/controller';
import { DIMENSIONS } from '../src/world/dimensions';
import { generateLevel } from '../src/world/gen-level';
import { buildLevel } from '../src/world/level';
import { tuning } from '../src/tuning';

let ready: Promise<void> | null = null;

describe('walking the stairs of generated levels', () => {
  for (const dim of ['justice', 'devil', 'tower']) {
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
            // Every way between rooms (stairs and causeways), but not the Moon's lies nor a barred shortcut.
            if (layout.dressing.falsePaths.includes(i) || k.kind === 'shortcut') return;
            const ux = Math.sign(k.bx - k.ax);
            const uz = Math.sign(k.bz - k.az);
            // Lateral offset `o` (metres right of the connector's axis) at `back` metres before point (x, z).
            const at = (x: number, z: number, back: number, o: number): [number, number] => [x - ux * back - uz * o, z - uz * back + ux * o];
            const hug = k.width / 2 - tuning.player.capsuleRadius - 0.05;
            // Down the middle and hugging either parapet, steering for the far end as a player would.
            for (const [o, side] of [[0, 0], [hug, 0], [-hug, 0]])
              for (const up of [true, false]) {
                const [sx, sz, ex, ez, ya, yb, s] = up ? [k.ax, k.az, k.bx, k.bz, k.y0, k.y1, 1] : [k.bx, k.bz, k.ax, k.az, k.y1, k.y0, -1];
                const start = at(sx, sz, 4 * s, o + side * s);
                const foot = at(sx, sz, -0.8 * s, o);
                const goal = at(ex, ez, -3 * s, o);
                c.teleport(new THREE.Vector3(start[0], ya + 0.1, start[1]), 0);
                let target = side ? foot : goal;
                const dist = Math.hypot(goal[0] - start[0], goal[1] - start[1]) + 6;
                for (let t = 0; t < dist / 3 + 4; t += 1 / 30) {
                  if (target === foot && Math.hypot(c.pos.x - foot[0], c.pos.z - foot[1]) < 0.6) target = goal;
                  const yaw = Math.atan2(-(target[0] - c.pos.x), -(target[1] - c.pos.z));
                  c.update(1 / 30, { x: 0, y: 1, sprint: true, rollPressed: false, combat: false, speedMul: 1, camYaw: yaw });
                  physics.step();
                  if (Math.hypot(c.pos.x - goal[0], c.pos.z - goal[1]) < 0.8) break;
                }
                walked++;
                const left = Math.hypot(c.pos.x - goal[0], c.pos.z - goal[1]);
                if (left > 1.2 || Math.abs(c.pos.y - yb) > 0.6) stuck.push(`${dim} seed ${seed} L${level + 1} conn ${i} lane ${o.toFixed(1)} from ${side} ${up ? 'up' : 'down'}: ${left.toFixed(1)} m short at (${c.pos.x.toFixed(1)}, ${c.pos.y.toFixed(2)}, ${c.pos.z.toFixed(1)})`);
              }
          });
          // The ramps up to a nest's raised tier, in and out.
          for (const r of layout.furn.ramps) {
            const ux = Math.sign(r.x1 - r.x0);
            const uz = Math.sign(r.z1 - r.z0);
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

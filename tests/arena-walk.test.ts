// Walk the real player controller through the real boss arenas: start platform, approach, onto the arena floor.
import './support/dom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Physics } from '../src/physics/world';
import { Controller } from '../src/player/controller';
import { buildBossArena, BOSS_ARENA, type ArenaKind } from '../src/world/boss';
import { makeRng } from '../src/core/rng';

let ready: Promise<void> | null = null;

describe('the boss arenas can be walked into', () => {
  for (const kind of ['justice', 'devil', 'tower', 'moon'] as ArenaKind[]) {
    it(`${kind}: from the spawn, down the approach and well into the arena, without falling`, async () => {
      ready ??= Physics.init();
      await ready;
      const physics = new Physics();
      const world = buildBossArena(physics, makeRng(42), kind);
      physics.step();
      const c = new Controller(physics, world.spawn.clone(), 0);
      let low = Infinity;
      // Straight north (-Z) along the axis, then a few lanes across the entry.
      const goalZ = BOSS_ARENA.centreZ + 8;
      for (const x of [0, -2.2, 2.2]) {
        c.teleport(new THREE.Vector3(x, 0.05, -50), 0);
        for (let t = 0; t < 14 && c.pos.z > goalZ; t += 1 / 60) {
          c.update(1 / 60, { x: 0, y: 1, sprint: false, rollPressed: false, combat: false, speedMul: 1, camYaw: 0 });
          physics.step();
          low = Math.min(low, c.pos.y);
        }
        expect(c.pos.z, `${kind} lane ${x}: stopped at z ${c.pos.z.toFixed(1)}`).toBeLessThan(goalZ + 0.5);
      }
      expect(low).toBeGreaterThan(-0.3);
      // The spawn stands on something solid, in the open.
      c.teleport(world.spawn.clone(), 0);
      for (let t = 0; t < 1; t += 1 / 60) {
        c.update(1 / 60, { x: 0, y: 0, sprint: false, rollPressed: false, combat: false, speedMul: 1, camYaw: 0 });
        physics.step();
      }
      expect(c.grounded).toBe(true);
      expect(Math.abs(c.pos.y - world.spawn.y)).toBeLessThan(0.2);
      physics.world.free();
    });
  }
});

describe('the arenas keep their distance', () => {
  it('no distant scenery stands up through the spawn, the approach or the arena (it has no collider)', async () => {
    ready ??= Physics.init();
    await ready;
    for (const kind of ['justice', 'devil', 'tower', 'moon'] as ArenaKind[]) {
      for (let seed = 1; seed <= 25; seed++) {
        const physics = new Physics();
        const world = buildBossArena(physics, makeRng(seed), kind);
        // The far scenery: the unshadowed mesh that isn't the landmark (FOG_MARK) and isn't the ground.
        // (merged in world space: at the origin, toon-shaded; the veil, glows and flames are placed meshes)
        const far = world.group.children.filter(
          (o): o is THREE.Mesh =>
            o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.position.lengthSq() === 0 && !o.castShadow && !o.receiveShadow && !('FOG_MARK' in (o.material.defines ?? {})),
        );
        for (const m of far) {
          const p = m.geometry.getAttribute('position');
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const y = p.getY(i);
            const z = p.getZ(i);
            const inStrip = Math.abs(x) < 12 && z < 12 && z > BOSS_ARENA.centreZ - BOSS_ARENA.radius - 4;
            if (inStrip && y > 1 && y < 8) throw new Error(`${kind} seed ${seed}: scenery at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
          }
        }
        physics.world.free();
      }
    }
    expect(true).toBe(true);
  }, 60000);
});

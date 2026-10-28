// A headless fight for behaviour tests: real Rapier physics, a flat floor, and a stand-in EnemyWorld whose player
// stands where the test puts her. Records what the enemies did to her.
import * as THREE from 'three';
import { Physics, RAPIER } from '../../src/physics/world';
import type { EnemyWorld, Hostile } from '../../src/enemies/enemy';
import { Hazards } from '../../src/enemies/hazards';
import type { Noise } from '../../src/enemies/foe-ai';

let ready: Promise<void> | null = null;

export async function makeArena(size = 60) {
  ready ??= Physics.init();
  await ready;
  const physics = new Physics();
  physics.addStatic(RAPIER.ColliderDesc.cuboid(size, 0.5, size).setTranslation(0, -0.5, 0));
  const scene = new THREE.Scene();
  const hazards = new Hazards(scene);
  const enemies: Hostile[] = [];
  const noises: Noise[] = [];
  const log = { hurt: 0, damage: 0, summoned: [] as string[] };
  const player = new THREE.Vector3(0, 0, 0);
  const chest = new THREE.Vector3(0, 1.1, 0);
  const w: EnemyWorld = {
    physics,
    playerPos: player,
    playerChest: chest,
    playerVel: new THREE.Vector3(),
    playerAlive: true,
    enemies,
    noises,
    hazards,
    summon: (id) => {
      log.summoned.push(id);
      return null;
    },
    alertNear: () => {},
    hurtPlayer: (amount) => {
      log.hurt++;
      log.damage += amount;
      return true;
    },
    sound: () => {},
    shake: () => {},
  };
  /** Advance the world `t` seconds in 1/30 s steps. */
  const run = (t: number, each?: () => void) => {
    for (let s = 0; s < t; s += 1 / 30) {
      chest.copy(player).setY(player.y + 1.1);
      for (const e of enemies) e.update(1 / 30, w);
      hazards.updateKnives(1 / 30, w);
      hazards.updateVerdicts(1 / 30, w);
      physics.step();
      each?.();
    }
  };
  return { physics, scene, hazards, enemies, noises, log, player, w, run };
}

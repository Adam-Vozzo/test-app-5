// Owns every enemy: spawning, per-frame update, glob impacts, respawn rules (elites stay dead once slain),
// and the debug AI labels.
import * as THREE from 'three';
import type { LimbRenderer } from '../render/limbs';
import { Enemy, type EnemyWorld } from './enemy';
import type { Hazards } from './hazards';
import type { EnemyKind } from './types';

export interface SpawnSpec {
  kind: EnemyKind;
  pos: THREE.Vector3;
  yaw: number;
}

export class EnemyManager {
  readonly enemies: Enemy[] = [];
  onKilled: (e: Enemy) => void = () => {};

  constructor(
    private scene: THREE.Scene,
    private hazards: Hazards,
  ) {}

  spawnAll(specs: SpawnSpec[], physics: EnemyWorld['physics']) {
    for (const s of specs) {
      const e = new Enemy(s.kind, this.scene, physics, s.pos, s.yaw);
      e.onKilled = (x) => this.onKilled(x);
      this.enemies.push(e);
    }
  }

  clear() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.hazards.clear();
  }

  /** Respawn everyone except elites that have been slain. */
  reset() {
    this.hazards.clear();
    for (const e of this.enemies) {
      if (e.elite && e.slain) e.despawn();
      else e.respawn();
    }
  }

  update(dt: number, w: EnemyWorld) {
    for (const e of this.enemies) if (e.group.visible || e.alive) e.update(dt, w);
    for (const hit of this.hazards.update(dt)) {
      w.sound('splash', hit.at);
      const dx = w.playerPos.x - hit.at.x;
      const dz = w.playerPos.z - hit.at.z;
      const dy = Math.abs(w.playerPos.y - hit.at.y);
      if (Math.hypot(dx, dz) <= hit.radius && dy < 1.6) w.hurtPlayer(hit.damage, hit.at, hit.knockback);
    }
  }

  draw(limbs: LimbRenderer) {
    for (const e of this.enemies) if (e.group.visible) e.rig.draw(limbs);
  }

  /** The elite currently fighting the player (for the boss bar). */
  get activeElite(): Enemy | null {
    return this.enemies.find((e) => e.elite && e.aggroed) ?? null;
  }
}

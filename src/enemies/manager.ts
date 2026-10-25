// Owns every enemy: spawning, per-frame update, glob impacts, respawn rules (elites stay dead once slain),
// and the debug AI labels.
import * as THREE from 'three';
import type { LimbRenderer } from '../render/limbs';
import type { Rng } from '../core/rng';
import { Enemy, type EnemyWorld, type Hostile } from './enemy';
import { Foe, type FoeIdle } from './foe';
import type { FoeId } from './foe-ai';
import type { Hazards } from './hazards';
import type { EnemyKind } from './types';

export interface SpawnSpec {
  kind: EnemyKind;
  pos: THREE.Vector3;
  yaw: number;
}

/** A v2 humanoid's spawn (from a level's encounter sockets). */
export interface FoeSpawn {
  id: FoeId;
  pos: THREE.Vector3;
  yaw: number;
  idle: FoeIdle;
}

export class EnemyManager {
  readonly enemies: Hostile[] = [];
  onKilled: (e: Hostile) => void = () => {};

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

  spawnFoes(specs: FoeSpawn[], physics: EnemyWorld['physics'], rng: Rng) {
    specs.forEach((s, i) => {
      const e = new Foe(s.id, this.scene, physics, s.pos, s.yaw, s.idle, rng.fork(`foe${i}`));
      e.onKilled = (x) => this.onKilled(x);
      this.enemies.push(e);
    });
  }

  /** Wake every enemy within `radius` of `from` (a Page's whistle). */
  alertNear(from: THREE.Vector3, radius: number, at: THREE.Vector3, caller: Hostile) {
    for (const e of this.enemies) if (e !== caller && e.alive && e.center.distanceTo(from) <= radius) e.alert?.(at);
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
    this.hazards.updateKnives(dt, w);
    for (const hit of this.hazards.update(dt)) {
      w.sound('splash', hit.at);
      const dx = w.playerPos.x - hit.at.x;
      const dz = w.playerPos.z - hit.at.z;
      const dy = Math.abs(w.playerPos.y - hit.at.y);
      if (Math.hypot(dx, dz) <= hit.radius && dy < 1.6) w.hurtPlayer(hit.damage, hit.at, hit.knockback);
    }
  }

  draw(limbs: LimbRenderer) {
    for (const e of this.enemies) if (e.group.visible) e.draw(limbs);
  }

  /** The elite currently fighting the player (for the boss bar). */
  get activeElite(): Hostile | null {
    return this.enemies.find((e) => e.bar && e.aggroed) ?? null;
  }
}

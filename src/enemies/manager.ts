// Owns every enemy: spawning, per-frame update, glob impacts, respawn rules (elites stay dead once slain),
// and the debug AI labels.
import * as THREE from 'three';
import type { LimbRenderer } from '../render/limbs';
import type { Rng } from '../core/rng';
import { Enemy, type EnemyWorld, type Hostile } from './enemy';
import { Foe, type FoeIdle } from './foe';
import { COURT_PLANS, CourtCard, isCourtRank } from './court';
import { JUSTICE_PLAN, JusticeBoss } from './justice';
import { PLANS, type FoePlan } from './foes';
import { DEVIL_PLANS, spawnThrallPair } from './devil';
import type { Hazards } from './hazards';
import type { EnemyKind } from './types';

/** Every common archetype by id: Justice's and the Devil's (data plans read by the one Foe state machine). */
const ARCHETYPES: Record<string, FoePlan> = { ...PLANS, ...DEVIL_PLANS };

export interface SpawnSpec {
  kind: EnemyKind;
  pos: THREE.Vector3;
  yaw: number;
}

/** A v2 humanoid's spawn (from a level's encounter sockets). */
export interface FoeSpawn {
  /** An archetype ('bailiff', …) or a court rank ('knight', 'queen', 'king'). */
  id: string;
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

  spawnFoes(specs: FoeSpawn[], physics: EnemyWorld['physics'], rng: Rng): Foe[] {
    return specs.flatMap((s, i) => {
      const r = rng.fork(`foe${this.enemies.length}-${i}`);
      // A Thrall socket holds a chained pair.
      const made: Foe[] =
        s.id === 'thrall'
          ? spawnThrallPair(this.scene, physics, s.pos, s.yaw, s.idle, r)
          : [
              s.id === 'justice'
                ? new JusticeBoss(JUSTICE_PLAN, this.scene, physics, s.pos, s.yaw, r)
                : isCourtRank(s.id)
                  ? new CourtCard(COURT_PLANS[s.id], this.scene, physics, s.pos, s.yaw, r)
                  : new Foe(ARCHETYPES[s.id] ?? PLANS.bailiff, this.scene, physics, s.pos, s.yaw, s.idle, r),
            ];
      for (const e of made) {
        e.onKilled = (x) => this.onKilled(x);
        this.enemies.push(e);
      }
      return made;
    });
  }

  /** A summoned enemy joins the fight now; it's gone (not respawned) when the player rests or dies. */
  summon(id: string, pos: THREE.Vector3, yaw: number, at: THREE.Vector3, physics: EnemyWorld['physics'], rng: Rng): Hostile {
    const [e] = this.spawnFoes([{ id, pos: pos.clone(), yaw, idle: 'stand' }], physics, rng);
    e.summoned = true;
    e.alert(at);
    return e;
  }

  /** Wake every enemy within `radius` of `from` (a Page's whistle). */
  alertNear(from: THREE.Vector3, radius: number, at: THREE.Vector3, caller?: Hostile) {
    for (const e of this.enemies) if (e !== caller && e.alive && e.center.distanceTo(from) <= radius) e.alert?.(at);
  }

  clear() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.hazards.clear();
  }

  /** Respawn everyone except elites that have been slain; summoned squads are dismissed. */
  reset() {
    this.hazards.clear();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e instanceof Foe && e.summoned) {
        e.dispose();
        this.enemies.splice(i, 1);
      }
    }
    for (const e of this.enemies) {
      if (e.elite && e.slain) e.despawn();
      else e.respawn();
    }
  }

  update(dt: number, w: EnemyWorld) {
    for (const e of this.enemies) if (e.group.visible || e.alive) e.update(dt, w);
    this.hazards.updateKnives(dt, w);
    this.hazards.updateVerdicts(dt, w);
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

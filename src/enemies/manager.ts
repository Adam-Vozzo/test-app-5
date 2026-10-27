// Owns every enemy: spawning, per-frame update, glob impacts, respawn rules (elites stay dead once slain),
// and the debug AI labels.
import * as THREE from 'three';
import type { LimbRenderer } from '../render/limbs';
import type { Rng } from '../core/rng';
import { Enemy, type EnemyWorld, type Hostile } from './enemy';
import { Foe, type FoeIdle } from './foe';
import { COURT_PLANS, CourtCard } from './court';
import { JUSTICE_PLAN, JusticeBoss } from './justice';
import { PLANS, type FoePlan } from './foes';
import { DEVIL_PLANS, spawnThrallPair } from './devil';
import { DevilBoss } from './devil-boss';
import { PENTACLES_PLANS } from './court-pentacles';
import { CrownedTower, WANDS_PLANS } from './court-wands';
import { Faller, TOWER_PLANS, TowerFoe } from './tower-foes';
import { Lurker, MOON_PLANS, MoonFoe } from './moon-foes';
import { CUPS_PLANS, CupsCard, ShadowBoss } from './court-cups';
import type { Hazards } from './hazards';
import type { EnemyKind } from './types';

/** Every common archetype by id: Justice's and the Devil's (data plans read by the one Foe state machine). */
const ARCHETYPES: Record<string, FoePlan> = { ...PLANS, ...DEVIL_PLANS };
/** Every court card by id: the Swords court (by rank) and the Pentacles court. */
const COURTS: Record<string, FoePlan> = { ...COURT_PLANS, ...PENTACLES_PLANS, ...WANDS_PLANS };

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
  /** The Moon: a reflection (no shadow, no footsteps, harmless; one hit dispels it). */
  illusion?: boolean;
}

const _bm = new THREE.Matrix4();
const _bq = new THREE.Quaternion();
const _bp = new THREE.Vector3();
const _bs = new THREE.Vector3();

export class EnemyManager {
  readonly enemies: Hostile[] = [];
  onKilled: (e: Hostile) => void = () => {};
  /**
   * A soft dark blob under every real v2 enemy (one instanced draw): the shadow reads at any range and at pixel scale.
   * The Moon's reflections have none: that's their tell.
   */
  private blobs: THREE.InstancedMesh;

  constructor(
    private scene: THREE.Scene,
    private hazards: Hazards,
  ) {
    const tex = blobTexture();
    this.blobs = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.45 }),
      256,
    );
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    scene.add(this.blobs);
  }

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
                : s.id === 'devil'
                  ? new DevilBoss(this.scene, physics, s.pos, s.yaw, r)
                  : s.id === 'crownedTower'
                    ? new CrownedTower(this.scene, physics, s.pos, s.yaw, r)
                    : s.id === 'shadow'
                      ? new ShadowBoss(this.scene, physics, s.pos, s.yaw, r)
                      : CUPS_PLANS[s.id as keyof typeof CUPS_PLANS]
                        ? new CupsCard(CUPS_PLANS[s.id as keyof typeof CUPS_PLANS], this.scene, physics, s.pos, s.yaw, r)
                    : s.id === 'crayfish'
                      ? new Lurker(this.scene, physics, s.pos, s.yaw, s.idle, r)
                      : MOON_PLANS[s.id as keyof typeof MOON_PLANS]
                        ? new MoonFoe(MOON_PLANS[s.id as keyof typeof MOON_PLANS], this.scene, physics, s.pos, s.yaw, s.idle, r)
                    : COURTS[s.id]
                      ? new CourtCard(COURTS[s.id], this.scene, physics, s.pos, s.yaw, r)
                      : s.id === 'faller'
                        ? new Faller(this.scene, physics, s.pos, s.yaw, s.idle, r)
                        : TOWER_PLANS[s.id as keyof typeof TOWER_PLANS]
                          ? new TowerFoe(TOWER_PLANS[s.id as keyof typeof TOWER_PLANS], this.scene, physics, s.pos, s.yaw, s.idle, r)
                          : new Foe(ARCHETYPES[s.id] ?? PLANS.bailiff, this.scene, physics, s.pos, s.yaw, s.idle, r),
            ];
      for (const e of made) {
        e.onKilled = (x) => this.onKilled(x);
        if (s.illusion || e.plan.phantom) e.makeIllusion();
        this.enemies.push(e);
      }
      return made;
    });
  }

  /** A summoned enemy joins the fight now; it's gone (not respawned) when the player rests or dies. */
  summon(id: string, pos: THREE.Vector3, yaw: number, at: THREE.Vector3, physics: EnemyWorld['physics'], rng: Rng, illusion = false): Hostile {
    const [e] = this.spawnFoes([{ id, pos: pos.clone(), yaw, idle: 'stand', illusion }], physics, rng);
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
    this.hazards.updateWaves(dt, w);
    this.hazards.updateCups(dt, w);
    for (const hit of this.hazards.update(dt)) {
      w.sound('splash', hit.at);
      const dx = w.playerPos.x - hit.at.x;
      const dz = w.playerPos.z - hit.at.z;
      const dy = Math.abs(w.playerPos.y - hit.at.y);
      if (Math.hypot(dx, dz) <= hit.radius && dy < 1.6) w.hurtPlayer(hit.damage, hit.at, hit.knockback);
      if (hit.ignite > 0) w.ignite?.(hit.at, hit.ignite);
    }
  }

  /** Reflections draw their limbs into `ghosts` (a renderer that casts no shadow), and get no blob shadow. */
  draw(limbs: LimbRenderer, ghosts: LimbRenderer = limbs) {
    let n = 0;
    for (const e of this.enemies) {
      if (!e.group.visible) continue;
      const ghost = e instanceof Foe && e.illusion;
      e.draw(ghost ? ghosts : limbs);
      if (ghost || !(e instanceof Foe) || n >= 256) continue;
      const size = e.plan.radius * (e.plan.height / 1.6) * 3.4 * e.rig.group.scale.x;
      _bm.compose(_bp.copy(e.ground).setY(e.ground.y + 0.05), _bq.identity(), _bs.set(size, 1, size));
      this.blobs.setMatrixAt(n++, _bm);
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  /** The elite currently fighting the player (for the boss bar). */
  get activeElite(): Hostile | null {
    return this.enemies.find((e) => e.bar && e.aggroed) ?? null;
  }
}

/** A soft round falloff for the blob shadows. */
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

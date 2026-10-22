// Rapier wrapper: init, collision groups, ray/shape queries, hitbox registry.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export { RAPIER };

/** Membership bits. QUERY is the bit our ray/shape casts carry. */
export const G = {
  WORLD: 1 << 0,
  PLAYER: 1 << 1,
  HITBOX: 1 << 2,
  ENEMY_BODY: 1 << 3,
  QUERY: 1 << 15,
} as const;

export const groups = (membership: number, filter: number) => ((membership & 0xffff) << 16) | (filter & 0xffff);

export const GROUPS = {
  world: groups(G.WORLD, G.PLAYER | G.ENEMY_BODY | G.QUERY),
  player: groups(G.PLAYER, G.WORLD | G.ENEMY_BODY | G.QUERY),
  hitbox: groups(G.HITBOX, G.QUERY),
  enemyBody: groups(G.ENEMY_BODY, G.WORLD | G.PLAYER | G.ENEMY_BODY),
  /** Query masks */
  qWorld: groups(G.QUERY, G.WORLD),
  qShot: groups(G.QUERY, G.WORLD | G.HITBOX),
  qCamera: groups(G.QUERY, G.WORLD),
  qMove: groups(G.WORLD | G.PLAYER, G.WORLD | G.ENEMY_BODY),
};

export interface HitTarget {
  /** 'body' or 'weak' (crit). */
  part: 'body' | 'weak' | 'armor';
  owner: Damageable;
}

export interface DamageInfo {
  amount: number;
  crit: boolean;
  point: THREE.Vector3;
  dir: THREE.Vector3;
  knockback: number;
  stagger: number;
}

export interface Damageable {
  alive: boolean;
  /** Returns true if this damage killed it. */
  takeDamage(info: DamageInfo): boolean;
}

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: RAPIER.Collider;
  target: HitTarget | null;
}

export class Physics {
  world!: RAPIER.World;
  readonly hitTargets = new Map<number, HitTarget>();
  private ball: RAPIER.Ball | null = null;
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });

  static async init() {
    await RAPIER.init();
  }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  }

  reset() {
    this.world.free();
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.hitTargets.clear();
  }

  addStatic(desc: RAPIER.ColliderDesc) {
    desc.setCollisionGroups(GROUPS.world);
    return this.world.createCollider(desc);
  }

  addHitbox(desc: RAPIER.ColliderDesc, target: HitTarget) {
    desc.setCollisionGroups(GROUPS.hitbox).setSensor(true);
    const c = this.world.createCollider(desc);
    this.hitTargets.set(c.handle, target);
    return c;
  }

  removeCollider(c: RAPIER.Collider) {
    this.hitTargets.delete(c.handle);
    this.world.removeCollider(c, false);
  }

  /** Update broad-phase so queries see colliders moved this frame. */
  step() {
    this.world.step();
  }

  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    mask: number,
    exclude?: RAPIER.Collider,
    out?: RayHit,
    predicate?: (c: RAPIER.Collider) => boolean,
  ): RayHit | null {
    this.ray.origin = origin;
    this.ray.dir = dir;
    const hit = this.world.castRayAndGetNormal(this.ray, maxDist, true, undefined, mask, exclude, undefined, predicate);
    if (!hit) return null;
    const r: RayHit = out ?? {
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      distance: 0,
      collider: hit.collider,
      target: null,
    };
    r.distance = hit.timeOfImpact;
    r.point.copy(dir).multiplyScalar(hit.timeOfImpact).add(origin);
    r.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    r.collider = hit.collider;
    r.target = this.hitTargets.get(hit.collider.handle) ?? null;
    return r;
  }

  /** Sphere cast; returns distance travelled before contact (or maxDist). */
  sphereCast(origin: THREE.Vector3, dir: THREE.Vector3, radius: number, maxDist: number, mask: number): number {
    if (!this.ball || this.ball.radius !== radius) this.ball = new RAPIER.Ball(radius);
    const shape = this.ball;
    const hit = this.world.castShape(
      origin,
      { x: 0, y: 0, z: 0, w: 1 },
      dir,
      shape,
      0,
      maxDist,
      true,
      undefined,
      mask,
    );
    return hit ? hit.time_of_impact : maxDist;
  }

  /** Ground height under (x, z) searching down from `fromY`. */
  groundY(x: number, z: number, fromY: number, maxDrop = 50): { y: number; normal: THREE.Vector3 } | null {
    _o.set(x, fromY, z);
    const h = this.raycast(_o, _down, maxDrop, GROUPS.qWorld, undefined, _gh);
    return h ? { y: h.point.y, normal: h.normal } : null;
  }
}

const _o = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _gh: RayHit = {
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: 0,
  collider: null as unknown as RAPIER.Collider,
  target: null,
};

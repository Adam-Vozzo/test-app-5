// Enemy attack visuals that make danger readable: spitter globs with a ground marker that fills as impact
// approaches, and the brute's charge lane. All in telegraph magenta (STYLE.md signal colour).
import * as THREE from 'three';
import { G, groups } from '../physics/world';
import { DEVIL, SIGNAL } from '../render/palette';
import type { EnemyWorld } from './enemy';

interface Knife {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  damage: number;
  knockback: number;
  mesh: THREE.Mesh;
}

/**
 * What a marked zone does when its time is up: strike whoever stands in it (a verdict, a coin rain), bind them (the
 * Devil's shackles), or — a seed — sprout something unless it was trampled first (stepping in crushes it).
 */
export type ZoneKind = 'strike' | 'shackle' | 'seed';

export interface ZoneOpts {
  kind?: ZoneKind;
  /** How long a shackle holds (s). */
  bindTime?: number;
  /** Called when the zone resolves: `caught` is whether the player was in it (for a seed: crushed). */
  onDone?: (caught: boolean, at: THREE.Vector3) => void;
}

interface Verdict {
  at: THREE.Vector3;
  radius: number;
  t: number;
  delay: number;
  damage: number;
  knockback: number;
  g: THREE.Group;
  kind: ZoneKind;
  bindTime: number;
  onDone?: ZoneOpts['onDone'];
}

const knifeGeo = new THREE.OctahedronGeometry(0.1, 0).scale(0.7, 0.7, 3.2);
const _seg = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();
const SOLID = groups(G.QUERY, G.WORLD);

interface Glob {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  t: number;
  T: number;
  gravity: number;
  radius: number;
  damage: number;
  knockback: number;
  marker: THREE.Group;
  mesh: THREE.Mesh;
}

export interface GlobImpact {
  at: THREE.Vector3;
  radius: number;
  damage: number;
  knockback: number;
}

const ringGeo = new THREE.RingGeometry(0.88, 1, 32).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const globGeo = new THREE.IcosahedronGeometry(0.2, 1);
const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);

export class Hazards {
  private globs: Glob[] = [];
  private pool: { marker: THREE.Group; mesh: THREE.Mesh }[] = [];
  private ringMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  private discMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  private globMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, fog: false });
  private lanes = new Map<object, THREE.Group>();
  private laneMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.32, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private laneFillMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private time = 0;
  private rings = new Map<object, THREE.Group>();
  readonly knives: Knife[] = [];
  readonly verdicts: Verdict[] = [];
  private verdictPool: THREE.Group[] = [];
  private seedPool: THREE.Group[] = [];
  private seedRingMat = new THREE.MeshBasicMaterial({ color: DEVIL.accent, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  private seedDiscMat = new THREE.MeshBasicMaterial({ color: DEVIL.accent, transparent: true, opacity: 0.4, depthWrite: false, fog: false });
  private knifePool: THREE.Mesh[] = [];
  private knifeMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, fog: false });

  constructor(private scene: THREE.Scene) {}

  /** Show / update a slam's ground ring at `at`, its fill growing with the wind-up (0..1). */
  ring(owner: object, at: THREE.Vector3, radius: number, fill: number) {
    let g = this.rings.get(owner);
    if (!g) {
      g = new THREE.Group();
      const ring = new THREE.Mesh(ringGeo, this.ringMat);
      const disc = new THREE.Mesh(discGeo, this.discMat);
      disc.name = 'fill';
      g.add(ring, disc);
      g.renderOrder = 5;
      this.scene.add(g);
      this.rings.set(owner, g);
    }
    g.visible = true;
    g.position.copy(at).setY(at.y + 0.12);
    g.scale.setScalar(radius);
    g.children[1].scale.setScalar(Math.max(0.02, fill));
  }

  hideRing(owner: object) {
    const g = this.rings.get(owner);
    if (g) g.visible = false;
  }

  /** A verdict: a marked zone that fills over `delay` seconds, then strikes whoever stands in it (see ZoneKind). */
  verdict(at: THREE.Vector3, radius: number, delay: number, damage: number, knockback: number, opts: ZoneOpts = {}) {
    const kind = opts.kind ?? 'strike';
    const pool = kind === 'seed' ? this.seedPool : this.verdictPool;
    let g = pool.pop();
    if (!g) {
      g = new THREE.Group();
      // Seeds are coin, not danger: gilt, the hoards' motif (trample them). Everything else is telegraph magenta.
      const ring = new THREE.Mesh(ringGeo, kind === 'seed' ? this.seedRingMat : this.ringMat);
      const disc = new THREE.Mesh(discGeo, kind === 'seed' ? this.seedDiscMat : this.discMat);
      g.add(ring, disc);
      g.renderOrder = 5;
      this.scene.add(g);
    }
    g.visible = true;
    g.position.copy(at).setY(at.y + 0.12);
    g.scale.setScalar(radius);
    this.verdicts.push({ at: at.clone(), radius, t: 0, delay, damage, knockback, g, kind, bindTime: opts.bindTime ?? 1.5, onDone: opts.onDone });
  }

  /** Fill verdict zones and strike the ones whose time is up. */
  updateVerdicts(dt: number, w: EnemyWorld) {
    for (let i = this.verdicts.length - 1; i >= 0; i--) {
      const v = this.verdicts[i];
      v.t += dt;
      const k = Math.min(1, v.t / v.delay);
      v.g.children[1].scale.setScalar(Math.max(0.02, k));
      v.g.children[0].scale.setScalar(1 + 0.04 * Math.sin(v.t * (8 + 20 * k)));
      const p = w.playerPos;
      const inside = Math.hypot(p.x - v.at.x, p.z - v.at.z) <= v.radius && Math.abs(p.y - v.at.y) < 1.6;
      if (v.kind === 'seed') {
        // Trampled before it ripens: crushed, nothing grows.
        if (inside && w.playerAlive) {
          w.sound('coinJingle', v.at);
          v.onDone?.(true, v.at);
          this.retire(i);
          continue;
        }
        if (v.t < v.delay) continue;
        v.onDone?.(false, v.at);
        this.retire(i);
        continue;
      }
      if (v.t < v.delay) continue;
      if (v.kind === 'shackle') {
        w.sound('chainSnap', v.at);
        if (inside) w.bindPlayer?.(v.bindTime, v.damage, v.knockback, v.at, null);
      } else {
        w.sound('slamImpact', v.at);
        w.shake(0.45, v.at);
        if (inside) w.hurtPlayer(v.damage, v.at, v.knockback);
      }
      v.onDone?.(inside, v.at);
      this.retire(i);
    }
  }

  private retire(i: number) {
    const v = this.verdicts[i];
    v.g.visible = false;
    (v.kind === 'seed' ? this.seedPool : this.verdictPool).push(v.g);
    this.verdicts.splice(i, 1);
  }

  /** A thrown blade: flies straight, stops at walls, hurts on contact. */
  knife(from: THREE.Vector3, vel: THREE.Vector3, damage: number, knockback: number) {
    const mesh = this.knifePool.pop() ?? this.makeKnife();
    mesh.visible = true;
    mesh.position.copy(from);
    this.knives.push({ pos: from.clone(), vel: vel.clone(), t: 0, damage, knockback, mesh });
  }

  private makeKnife() {
    const m = new THREE.Mesh(knifeGeo, this.knifeMat);
    m.renderOrder = 5;
    this.scene.add(m);
    return m;
  }

  /** Move thrown blades; walls stop them, the player's body takes them (unless rolling: hurtPlayer decides). */
  updateKnives(dt: number, w: EnemyWorld) {
    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      k.t += dt;
      const step = _seg.copy(k.vel).multiplyScalar(dt);
      const len = step.length();
      const hit = len > 0 ? w.physics.raycast(k.pos, _dir.copy(step).divideScalar(len), len, SOLID) : null;
      // Closest approach to the player's body (a vertical segment through the chest).
      _p.copy(w.playerChest);
      const t = Math.max(0, Math.min(1, _p.clone().sub(k.pos).dot(step) / Math.max(1e-6, len * len)));
      const near = k.pos.clone().addScaledVector(step, t);
      const dy = Math.max(0, Math.abs(near.y - _p.y) - 0.5);
      const struck = Math.hypot(near.x - _p.x, near.z - _p.z, dy) < 0.42 && (!hit || hit.distance >= len * t);
      if (struck) w.hurtPlayer(k.damage, near, k.knockback, 'projectile');
      k.pos.add(step);
      k.mesh.position.copy(k.pos);
      k.mesh.lookAt(_p.copy(k.pos).add(k.vel));
      if (struck || hit || k.t > 3) {
        if (hit && !struck) w.sound('armor', k.pos);
        k.mesh.visible = false;
        this.knifePool.push(k.mesh);
        this.knives.splice(i, 1);
      }
    }
  }

  /** Lob a glob that lands on `target` after `T` seconds. */
  lob(from: THREE.Vector3, target: THREE.Vector3, T: number, gravity: number, radius: number, damage: number, knockback: number) {
    const slot = this.pool.pop() ?? this.makeSlot();
    // Ballistic: v = (Δ - ½gT²)/T
    const vel = new THREE.Vector3().subVectors(target, from).divideScalar(T);
    vel.y += 0.5 * gravity * T;
    slot.marker.position.copy(target).setY(target.y + 0.03);
    slot.marker.scale.setScalar(radius);
    slot.marker.visible = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(from);
    this.globs.push({ pos: from.clone(), vel, target: target.clone(), t: 0, T, gravity, radius, damage, knockback, ...slot });
  }

  private makeSlot() {
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    const disc = new THREE.Mesh(discGeo, this.discMat);
    disc.name = 'fill';
    marker.add(ring, disc);
    marker.renderOrder = 5;
    const mesh = new THREE.Mesh(globGeo, this.globMat);
    this.scene.add(marker, mesh);
    return { marker, mesh };
  }

  /** Show / update a charge lane from `from` along `dir` for `length`, filled to `fill` (0..1). */
  lane(owner: object, from: THREE.Vector3, yaw: number, length: number, width: number, fill: number) {
    let g = this.lanes.get(owner);
    if (!g) {
      g = new THREE.Group();
      const back = new THREE.Mesh(laneGeo, this.laneMat);
      const front = new THREE.Mesh(laneGeo, this.laneFillMat);
      front.name = 'fill';
      g.add(back, front);
      g.renderOrder = 5;
      this.scene.add(g);
      this.lanes.set(owner, g);
    }
    g.visible = true;
    // Above paving (flagstones sit a few cm proud of the slab).
    g.position.copy(from).setY(from.y + 0.12);
    g.rotation.set(0, yaw, 0);
    const back = g.children[0];
    const front = g.children[1];
    back.scale.set(width, 1, length);
    front.scale.set(width * 0.9, 1, Math.max(0.001, length * fill));
  }

  hideLane(owner: object) {
    const g = this.lanes.get(owner);
    if (g) g.visible = false;
  }

  /** Advance globs; returns the impacts that landed this frame. */
  update(dt: number): GlobImpact[] {
    this.time += dt;
    const out: GlobImpact[] = [];
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 18);
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      g.t += dt;
      g.vel.y -= g.gravity * dt;
      g.pos.addScaledVector(g.vel, dt);
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 9;
      const k = Math.min(1, g.t / g.T);
      const fill = g.marker.getObjectByName('fill')!;
      fill.scale.setScalar(Math.max(0.02, k));
      (g.marker.children[0] as THREE.Mesh).scale.setScalar(pulse * 0.08 + 0.95);
      if (g.t >= g.T) {
        out.push({ at: g.target, radius: g.radius, damage: g.damage, knockback: g.knockback });
        g.marker.visible = false;
        g.mesh.visible = false;
        this.pool.push({ marker: g.marker, mesh: g.mesh });
        this.globs.splice(i, 1);
      }
    }
    return out;
  }

  clear() {
    for (const g of this.globs) {
      g.marker.visible = false;
      g.mesh.visible = false;
      this.pool.push({ marker: g.marker, mesh: g.mesh });
    }
    this.globs.length = 0;
    for (const lane of this.lanes.values()) lane.visible = false;
    for (const r of this.rings.values()) r.visible = false;
    for (const v of this.verdicts) {
      v.g.visible = false;
      (v.kind === 'seed' ? this.seedPool : this.verdictPool).push(v.g);
    }
    this.verdicts.length = 0;
    for (const k of this.knives) {
      k.mesh.visible = false;
      this.knifePool.push(k.mesh);
    }
    this.knives.length = 0;
  }
}

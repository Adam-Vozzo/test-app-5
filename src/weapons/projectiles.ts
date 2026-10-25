// Visible projectiles for slow weapons (staples). Each step sweeps a ray along the travel segment, so fast
// projectiles never tunnel. Pierce continues past live targets. Rendered as one instanced mesh.
import * as THREE from 'three';
import { GROUPS, type RayHit } from '../physics/world';
import type { WeaponDef } from './defs';
import type { GunContext } from './gun';
import { resolveHit, ShotFeedback } from './hit';
import { boltGeo } from './model';
import { toonMat } from '../render/geo';

interface Projectile {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  def: WeaponDef;
  pierceLeft: number;
  skip: Set<number>;
  life: number;
  fb: ShotFeedback;
  /** Damage multiplier from the firing gun (the SwordRifle's repair stage). */
  damageMul: number;
  /** Stuck in a wall: stays visible briefly. */
  stuck: number;
  travelled: number;
}

const MAX = 48;
const _dir = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _fwd = new THREE.Vector3(0, 0, -1);
const _hit: RayHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, collider: null as never, target: null };

export class Projectiles {
  private list: Projectile[] = [];
  private mesh: THREE.InstancedMesh;
  /** Bright streak behind each projectile so it reads in flight. */
  private trail: THREE.InstancedMesh;

  constructor(scene: THREE.Scene) {
    this.trail = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false, fog: false }),
      MAX,
    );
    this.trail.count = 0;
    this.trail.frustumCulled = false;
    this.trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.trail);
    this.mesh = new THREE.InstancedMesh(boltGeo(), toonMat(), MAX);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }

  launch(def: WeaponDef, from: THREE.Vector3, dir: THREE.Vector3, fb: ShotFeedback, damageMul = 1) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      pos: from.clone(),
      vel: dir.clone().multiplyScalar(def.projectileSpeed),
      def,
      pierceLeft: def.pierce,
      skip: new Set(),
      life: def.range / Math.max(1, def.projectileSpeed) + 0.5,
      fb,
      damageMul,
      stuck: 0,
      travelled: 0,
    });
  }

  update(dt: number, ctx: GunContext) {
    const exclude = ctx.player.controller.collider;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.stuck > 0) {
        p.stuck -= dt;
        if (p.stuck <= 0) this.list.splice(i, 1);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      if (dt <= 0) continue;
      p.vel.y -= p.def.projectileGravity * dt;
      let remaining = p.vel.length() * dt;
      p.travelled += remaining;
      _dir.copy(p.vel).normalize();
      // Sweep; at most a few pierces per step.
      for (let guard = 0; guard < 4 && remaining > 0; guard++) {
        const pred = p.skip.size ? (c: { handle: number }) => !p.skip.has(c.handle) : undefined;
        const hit = ctx.physics.raycast(p.pos, _dir, remaining, GROUPS.qShot, exclude, _hit, pred);
        if (!hit) {
          p.pos.addScaledVector(_dir, remaining);
          remaining = 0;
          break;
        }
        const struckTarget = resolveHit(ctx, p.def, hit, _dir, p.fb, p.damageMul);
        p.fb.flush(ctx);
        remaining -= hit.distance;
        p.pos.copy(hit.point);
        if (struckTarget && p.pierceLeft > 0) {
          p.pierceLeft--;
          p.skip.add(hit.collider.handle);
          continue;
        }
        if (!struckTarget && !hit.target) {
          // Embed in the world for a moment: a bolt stuck in the stone.
          p.pos.addScaledVector(_dir, 0.03);
          p.stuck = 1.5;
        } else {
          p.life = 0;
        }
        remaining = 0;
      }
    }
    let n = 0;
    let tn = 0;
    for (const p of this.list) {
      if (p.life <= 0 && p.stuck <= 0) continue;
      _q.setFromUnitVectors(_fwd, _dir.copy(p.vel).normalize());
      _m.compose(p.pos, _q, _s.setScalar(p.def.projectileScale));
      this.mesh.setMatrixAt(n++, _m);
      if (p.stuck <= 0) {
        const len = Math.min(p.def.tracerLength, p.travelled);
        _m.compose(p.pos, _q, _s.set(p.def.tracerWidth, p.def.tracerWidth, len));
        this.trail.setMatrixAt(tn++, _m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.trail.count = tn;
    this.trail.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.list.length = 0;
    this.mesh.count = 0;
    this.trail.count = 0;
  }
}

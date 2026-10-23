// Enemy attack visuals that make danger readable: spitter globs with a ground marker that fills as impact
// approaches, and the brute's charge lane. All in telegraph magenta (STYLE.md signal colour).
import * as THREE from 'three';
import { SIGNAL } from '../render/palette';

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

  constructor(private scene: THREE.Scene) {}

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
    g.position.copy(from).setY(from.y + 0.04);
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
  }
}

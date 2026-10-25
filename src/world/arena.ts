// Hand-placed test layouts built from procedural props: the greybox arena and the target-dummy range.
// (Seeded procedural zones replace the arena in M5; these stay as test beds.)
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { meshOf, paintBy, prep, toonMat } from '../render/geo';
import type { BiomePalette } from '../render/palette';
import type { SpawnSpec } from '../enemies/manager';
import { bottleCapGeo, buttonGeo, grassBladeGeo, leafGeo, matchstickGeo, pebbleGeo, sugarCubeGeo } from './props';

/** `justice` is the v2 scene; the rest are v1 bug-scale scenes, reachable by URL only (`?mode=`). */
export type LayoutKind = 'justice' | 'arena' | 'range' | 'garden' | 'kitchen';

export interface BuiltWorld {
  group: THREE.Group;
  spawn: THREE.Vector3;
  spawnYaw: number;
  dummySpots: { pos: THREE.Vector3; slide: boolean; guardYaw?: number }[];
  enemySpots: SpawnSpec[];
  /** Checkpoint: rest here (E). */
  checkpoint: THREE.Vector3 | null;
  /** What the checkpoint is called in prompts ("the lantern"). */
  restLabel?: string;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Builder {
  readonly group = new THREE.Group();
  readonly mat = toonMat();
  /** Ground height for placing props (flat arenas use 0). */
  heightAt: (x: number, z: number) => number = () => 0;
  constructor(
    readonly physics: Physics,
    readonly pal: BiomePalette,
    readonly rng: Rng,
  ) {}

  add(geo: THREE.BufferGeometry, shadows = true) {
    const m = meshOf(geo, this.mat, shadows);
    this.group.add(m);
    return m;
  }

  ground(radius: number, stripeW: number) {
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2, 90, 90).rotateX(-Math.PI / 2);
    const p = this.pal;
    const lit = new THREE.Color(p.groundLit);
    const light = new THREE.Color(p.groundLight);
    const shade = new THREE.Color(p.groundShade);
    const shadow = new THREE.Color(p.groundShadow);
    const geo = paintBy(prep(g), (v, out) => {
      const r = Math.hypot(v.x, v.z);
      const t = (v.z + Math.sin(v.x * 0.12) * 2.2 + Math.sin(v.x * 0.031 + 1) * 5) / stripeW;
      const band = Math.floor(t) % 2 === 0;
      if (r > radius * 0.62) out.copy(band ? shade : shadow);
      else out.copy(band ? lit : light);
    });
    const m = this.add(geo, false);
    m.receiveShadow = true;
    this.physics.addStatic(RAPIER.ColliderDesc.cuboid(radius, 1, radius).setTranslation(0, -1, 0));
  }

  /** Instanced grass blades: [x, z, radius, height][]. `low` = cheap walls. */
  grass(spots: [number, number, number, number][], low = false) {
    const variants = [0, 1, 2].map((i) => grassBladeGeo(this.pal, this.rng.fork(`grass${i}`), low ? 9 : 20));
    const buckets: [number, number, number, number][][] = [[], [], []];
    spots.forEach((s, i) => buckets[i % 3].push(s));
    buckets.forEach((list, vi) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(variants[vi], this.mat, list.length);
      im.castShadow = true;
      im.receiveShadow = true;
      list.forEach(([x, z, r, h], i) => {
        const y = this.heightAt(x, z) - 0.3;
        _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, this.rng.range(0, 6.28), 0)), _s.set(r, h, r));
        im.setMatrixAt(i, _m);
        this.physics.addStatic(RAPIER.ColliderDesc.cylinder(h * 0.3, r * 0.9).setTranslation(x, y + h * 0.3, z));
      });
      im.computeBoundingSphere();
      this.group.add(im);
    });
  }

  /** Instanced pebbles: [x, z, sx, sy, sz][] with convex-hull colliders. */
  pebbles(spots: [number, number, number, number, number][]) {
    const variants = [0, 1, 2].map((i) => pebbleGeo(this.pal, this.rng.fork(`pebble${i}`)));
    const buckets: [number, number, number, number, number][][] = [[], [], []];
    spots.forEach((s, i) => buckets[i % 3].push(s));
    buckets.forEach((list, vi) => {
      if (!list.length) return;
      const geo = variants[vi];
      const im = new THREE.InstancedMesh(geo, this.mat, list.length);
      im.castShadow = true;
      im.receiveShadow = true;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      list.forEach(([x, z, sx, sy, sz], i) => {
        _m.compose(_p.set(x, this.heightAt(x, z) + sy * 0.35, z), _q.setFromEuler(_e.set(0, this.rng.range(0, 6.28), 0)), _s.set(sx, sy, sz));
        im.setMatrixAt(i, _m);
        const pts = new Float32Array(pos.count * 3);
        const v = new THREE.Vector3();
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(_m);
          pts.set([v.x, v.y, v.z], k * 3);
        }
        const desc = RAPIER.ColliderDesc.convexHull(pts);
        if (desc) this.physics.addStatic(desc);
      });
      im.computeBoundingSphere();
      this.group.add(im);
    });
  }

  matchstick(x: number, y: number, z: number, yaw: number, pitch: number, len = 22, w = 1.1) {
    const m = this.add(matchstickGeo(len, w));
    m.position.set(x, y, z);
    m.rotation.set(0, yaw, pitch, 'YZX');
    m.updateMatrixWorld();
    const q = new THREE.Quaternion().setFromEuler(m.rotation);
    const c = new THREE.Vector3(0, w / 2, 0).applyQuaternion(q).add(m.position);
    this.physics.addStatic(
      RAPIER.ColliderDesc.cuboid(len / 2, w / 2, (w * 1.1) / 2)
        .setTranslation(c.x, c.y, c.z)
        .setRotation(q),
    );
  }

  buttonStack(x: number, z: number, levels: number, h: number, r0: number) {
    const colors = [0x7a8fb8, 0xe8c25a, 0x9c6fa8, 0x6fae8f, 0xd9765e, 0xeee3cf];
    for (let i = 0; i < levels; i++) {
      const r = r0 * (1 - i / (levels + 1.5));
      const col = colors[i % colors.length];
      const rim = new THREE.Color(col).multiplyScalar(0.7).getHex();
      const m = this.add(buttonGeo(col, rim, h));
      m.position.set(x, i * h, z);
      m.scale.set(r, 1, r);
      this.physics.addStatic(RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, i * h + h / 2, z));
    }
  }

  leaf(x: number, y: number, z: number, yaw: number, tilt: number, len: number, wid: number) {
    const geo = leafGeo(this.pal, len, wid);
    const m = this.add(geo);
    m.position.set(x, y, z);
    m.rotation.set(0, yaw, tilt, 'YZX');
    m.updateMatrixWorld();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const pts = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
      pts.set([v.x, v.y, v.z], k * 3);
    }
    const desc = RAPIER.ColliderDesc.convexHull(pts);
    if (desc) this.physics.addStatic(desc);
  }

  bottleCap(x: number, z: number, yaw: number, radius = 14) {
    const { geo, walls } = bottleCapGeo(radius, 3, 36, 3);
    const m = this.add(geo);
    const y0 = this.heightAt(x, z);
    m.position.set(x, y0, z);
    m.rotation.y = yaw;
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    for (const w of walls) {
      q.setFromEuler(_e.set(0, w.rot + yaw, 0));
      v.set(w.x, w.h / 2, w.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw).add(m.position);
      this.physics.addStatic(RAPIER.ColliderDesc.cuboid(w.w / 2, w.h / 2, w.d / 2).setTranslation(v.x, v.y, v.z).setRotation(q));
    }
    this.physics.addStatic(RAPIER.ColliderDesc.cylinder(0.06, radius).setTranslation(x, y0 + 0.06, z));
  }

  sugarCube(x: number, z: number, size: number, yaw: number) {
    const m = this.add(sugarCubeGeo(this.rng.fork(`sugar${x},${z}`)));
    const y0 = this.heightAt(x, z) - 0.1;
    m.position.set(x, y0, z);
    m.scale.setScalar(size);
    m.rotation.y = yaw;
    const q = new THREE.Quaternion().setFromEuler(_e.set(0, yaw, 0));
    this.physics.addStatic(RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setTranslation(x, y0 + size / 2, z).setRotation(q));
  }

  /** Dense ring of tall blades: the dark "forest wall" that frames the stage. */
  forestRing(r0: number, r1: number, count: number) {
    const spots: [number, number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(r0, r1);
      spots.push([Math.cos(a) * r, Math.sin(a) * r, this.rng.range(0.7, 1.8), this.rng.range(16, 42)]);
    }
    this.grass(spots, true);
  }
}

export function buildWorld(kind: 'arena' | 'range', physics: Physics, pal: BiomePalette, rng: Rng): BuiltWorld {
  const b = new Builder(physics, pal, rng);
  return kind === 'arena' ? buildArena(b) : buildRange(b);
}

function buildArena(b: Builder): BuiltWorld {
  const rng = b.rng;
  b.ground(80, 2.6);
  b.forestRing(42, 62, 150);

  // Scattered "trees" and boulders in the clearing, kept clear of the spawn.
  const grass: [number, number, number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(14, 38);
    grass.push([Math.cos(a) * r, Math.sin(a) * r, rng.range(0.5, 1.1), rng.range(10, 26)]);
  }
  b.grass(grass);
  const pebbles: [number, number, number, number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(9, 36);
    const s = rng.range(0.8, 2.6);
    pebbles.push([Math.cos(a) * r, Math.sin(a) * r, s * rng.range(0.9, 1.4), s * rng.range(0.6, 1), s]);
  }
  b.pebbles(pebbles);

  // Matchstick ramp up onto a big boulder.
  b.pebbles([[16, -20, 4.5, 4.2, 4.5]]);
  b.matchstick(4, 0.0, -11, -0.62, 0.155, 20);
  // Button ziggurat: 0.3-high steps to test foot planting and autostep.
  b.buttonStack(-12, -10, 6, 0.3, 3.2);
  // Leaf slope.
  b.leaf(-2, 0.3, -24, 0.4, 0.22, 12, 6);
  // Bottle-cap arena with an entrance facing the spawn.
  b.bottleCap(-22, 16, Math.PI * 0.12);
  // Sugar-cube shrine behind the spawn (the future checkpoint).
  b.sugarCube(0, 6, 2.2, 0.3);

  const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const enemySpots: SpawnSpec[] = [
    { kind: 'skitterer', pos: V(8, -15), yaw: 0.4 },
    { kind: 'skitterer', pos: V(10.5, -17), yaw: 0.6 },
    { kind: 'skitterer', pos: V(-7, -21), yaw: -0.3 },
    { kind: 'skitterer', pos: V(-9.5, -19), yaw: -0.2 },
    { kind: 'spitter', pos: V(12, -27), yaw: 0.5 },
    { kind: 'spitter', pos: V(-15, -28), yaw: -0.5 },
    { kind: 'brute', pos: V(-22, 16), yaw: -2.4 },
  ];
  return { group: b.group, spawn: new THREE.Vector3(0, 0.05, 0), spawnYaw: 0, dummySpots: [], enemySpots, checkpoint: new THREE.Vector3(0, 0, 6) };
}

function buildRange(b: Builder): BuiltWorld {
  const rng = b.rng;
  b.ground(80, 2.2);
  b.forestRing(30, 50, 120);
  // Lane walls of grass.
  const walls: [number, number, number, number][] = [];
  for (let z = 8; z > -60; z -= 3.2) {
    walls.push([-11 + rng.signed() * 0.8, z, rng.range(0.6, 1.0), rng.range(14, 30)]);
    walls.push([11 + rng.signed() * 0.8, z, rng.range(0.6, 1.0), rng.range(14, 30)]);
  }
  b.grass(walls);
  // Distance markers: matchsticks lying across the lane.
  for (const d of [5, 10, 20, 40]) b.matchstick(0, 0, -d + 1.2, 0, 0, 7, 0.35);
  // A little cover to shoot around.
  b.pebbles([
    [-5, -7, 1.4, 0.9, 1.2],
    [5.5, -14, 1.6, 1.1, 1.4],
    [-4, -27, 2, 1.4, 1.6],
  ]);
  b.sugarCube(-7, 3, 1.4, 0.4);
  const spots = [
    { pos: new THREE.Vector3(1.5, 0, -5), slide: false },
    { pos: new THREE.Vector3(-1.5, 0, -10), slide: false },
    { pos: new THREE.Vector3(0, 0, -15), slide: true },
    { pos: new THREE.Vector3(2, 0, -20), slide: false },
    { pos: new THREE.Vector3(0, 0, -40), slide: false },
  ];
  return { group: b.group, spawn: new THREE.Vector3(0, 0.05, 2), spawnYaw: 0, dummySpots: spots, enemySpots: [], checkpoint: null };
}

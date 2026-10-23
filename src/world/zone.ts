// Builds a playable zone (meshes + colliders) from a generated ZoneLayout and its theme.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { makeRng } from '../core/rng';
import type { SpawnSpec } from '../enemies/manager';
import { Physics, RAPIER } from '../physics/world';
import { meshOf, paintBy, prep, toonMat } from '../render/geo';
import { Builder, type BuiltWorld } from './arena';
import { generateZone, walkDistance, zoneHeight, type ZoneLayout } from './gen';
import { boxGeo, chairLegGeo, crumbGeo, flowerParts, forkGeo, trowelGeo } from './props';
import { THEMES, type ThemeDef, type ThemeId } from './themes';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** The pollen cache: a bud in the side clearing that blooms when touched, once per zone. */
export class PollenCache {
  readonly group = new THREE.Group();
  private petals: THREE.Mesh;
  private heart: THREE.Mesh;
  opened = false;
  private bloom = 0;
  constructor(
    readonly at: THREE.Vector3,
    readonly amount: number,
  ) {
    const { petals, heart, stem } = flowerParts();
    const mat = toonMat();
    this.petals = meshOf(petals, mat);
    this.heart = new THREE.Mesh(heart, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.group.add(meshOf(stem, mat), this.petals, this.heart);
    this.petals.position.y = this.heart.position.y = 2.2;
    this.group.position.copy(at);
    this.update(0, new THREE.Vector3(1e6, 0, 0));
  }
  /** Returns the pollen collected this frame (0 if none). */
  update(dt: number, player: THREE.Vector3): number {
    let got = 0;
    if (!this.opened && player.distanceTo(this.group.position) < 2.6) {
      this.opened = true;
      got = this.amount;
    }
    this.bloom = Math.min(1, this.bloom + (this.opened ? dt * 2 : 0));
    const b = this.bloom;
    this.petals.scale.set(0.35 + 0.65 * b, 1 + (1 - b) * 3, 0.35 + 0.65 * b);
    this.petals.rotation.y += dt * 0.3;
    // Closed bud glows gold so you can spot it; spent flowers fade to a pale heart.
    this.heart.scale.setScalar(this.opened ? 0.6 : 1 + Math.sin(performance.now() * 0.004) * 0.08);
    (this.heart.material as THREE.MeshBasicMaterial).color.setScalar(this.opened ? 0.55 : 1);
    return got;
  }
}

export interface ZoneWorld extends BuiltWorld {
  layout: ZoneLayout;
  theme: ThemeDef;
  cache: PollenCache;
}

export function buildZone(seed: number, themeId: ThemeId, physics: Physics): ZoneWorld {
  const theme = THEMES[themeId];
  const L = generateZone(seed, themeId);
  const rng = makeRng(seed).fork(`zone-build-${themeId}`);
  const b = new Builder(physics, theme.palette, rng);
  const h = (x: number, z: number) => zoneHeight(L, x, z);
  b.heightAt = h;

  buildGround(b, L, theme);
  buildWalls(b, L, theme, rng.fork('walls'));
  buildDecor(b, L, rng.fork('decor'));

  const spawnY = h(L.spawn.x, L.spawn.z) + 0.05;
  const enemySpots: SpawnSpec[] = L.spawns.map((s) => ({ kind: s.kind, pos: new THREE.Vector3(s.x, h(s.x, s.z) + 0.02, s.z), yaw: s.yaw }));
  const cache = new PollenCache(new THREE.Vector3(L.cache.x, h(L.cache.x, L.cache.z), L.cache.z), L.cache.amount);
  b.group.add(cache.group);
  return {
    group: b.group,
    spawn: new THREE.Vector3(L.spawn.x, spawnY, L.spawn.z),
    spawnYaw: L.spawn.yaw,
    dummySpots: [],
    enemySpots,
    checkpoint: new THREE.Vector3(L.checkpoint.x, h(L.checkpoint.x, L.checkpoint.z), L.checkpoint.z),
    layout: L,
    theme,
    cache,
  };
}

function tileTexture(theme: ThemeDef): THREE.Texture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  g.fillStyle = hex(theme.palette.groundShadow);
  g.fillRect(0, 0, s, s);
  g.fillStyle = hex(theme.palette.groundLit);
  g.fillRect(2, 2, s - 4, s - 4);
  // A faint glaze highlight band on each tile.
  g.fillStyle = hex(theme.palette.groundLight);
  g.fillRect(8, 8, s - 16, 16);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Heightfield ground: lit stripes (or tiles) in the walkable area, darker shading toward the walls. */
function buildGround(b: Builder, L: ZoneLayout, theme: ThemeDef) {
  const { minX, maxX, minZ, maxZ } = L.bounds;
  const cell = 2.2;
  const nx = Math.ceil((maxX - minX) / cell);
  const nz = Math.ceil((maxZ - minZ) / cell);
  const geo = new THREE.PlaneGeometry(nx * cell, nz * cell, nx, nz).rotateX(-Math.PI / 2).translate(minX + (nx * cell) / 2, 0, minZ + (nz * cell) / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, zoneHeight(L, pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // Collider from the indexed grid before colouring (which de-indexes).
  const verts = new Float32Array(pos.array as ArrayLike<number>);
  const idx = new Uint32Array(geo.index!.array as ArrayLike<number>);
  b.physics.addStatic(RAPIER.ColliderDesc.trimesh(verts, idx));

  const p = theme.palette;
  const lit = new THREE.Color(p.groundLit);
  const light = new THREE.Color(p.groundLight);
  const shade = new THREE.Color(p.groundShade);
  const shadow = new THREE.Color(p.groundShadow);
  const tiles = theme.ground.kind === 'tiles';
  const white = new THREE.Color(1, 1, 1);
  const dim = new THREE.Color(0.62, 0.62, 0.66);
  const colored = paintBy(prep(geo), (v, out) => {
    const wd = walkDistance(L, v.x, v.z);
    if (tiles) {
      // Tiles come from the texture; vertex colour only darkens outside the walkable area.
      out.copy(wd < 1.5 ? white : dim);
      return;
    }
    const t = (v.z + Math.sin(v.x * 0.12) * 2.2 + Math.sin(v.x * 0.031 + 1) * 5) / theme.ground.tile;
    const band = Math.floor(t) % 2 === 0;
    if (wd > 2) out.copy(band ? shade : shadow);
    else out.copy(band ? lit : light);
  });
  const mat = tiles ? toonMat({ map: tileTexture(theme) }) : b.mat;
  if (tiles) {
    // World-space UVs: one tile per `theme.ground.tile` units.
    const n = colored.getAttribute('position').count;
    const uv = new Float32Array(n * 2);
    const cp = colored.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      uv[i * 2] = cp.getX(i) / theme.ground.tile;
      uv[i * 2 + 1] = cp.getZ(i) / theme.ground.tile;
    }
    colored.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const mesh = meshOf(colored, mat, false);
  mesh.receiveShadow = true;
  b.group.add(mesh);

  // Fence at the bounds so nobody walks off the edge of the world.
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const hw = (maxX - minX) / 2;
  const hd = (maxZ - minZ) / 2;
  for (const [x, z, sx, sz] of [
    [cx, minZ, hw, 1],
    [cx, maxZ, hw, 1],
    [minX, cz, 1, hd],
    [maxX, cz, 1, hd],
  ]) {
    b.physics.addStatic(RAPIER.ColliderDesc.cuboid(sx, 30, sz).setTranslation(x, 0, z));
  }
}

/** Dense props in a band around the walkable area: the dark "forest wall" (or kitchen clutter). */
function buildWalls(b: Builder, L: ZoneLayout, theme: ThemeDef, rng: Rng) {
  const { minX, maxX, minZ, maxZ } = L.bounds;
  const sp = theme.wall.spacing;
  const grass: [number, number, number, number][] = [];
  const legs: { x: number; z: number; r: number }[] = [];
  const boxes: { x: number; z: number; w: number; d: number; h: number; rot: number }[] = [];
  for (let x = minX; x <= maxX; x += sp) {
    for (let z = minZ; z <= maxZ; z += sp) {
      const px = x + rng.range(-0.45, 0.45) * sp;
      const pz = z + rng.range(-0.45, 0.45) * sp;
      const wd = walkDistance(L, px, pz);
      if (wd < 1 || wd > theme.wall.band) continue;
      const id = rng.pick(theme.wall.ids);
      if (id === 'grass') {
        const r = rng.range(0.7, 1.7);
        if (wd < r + 0.6) continue;
        grass.push([px, pz, r, rng.range(14, 42)]);
      } else if (id === 'chairLeg') {
        const r = rng.range(1.2, 1.8);
        if (wd < r + 0.8 || rng() < 0.6) continue;
        legs.push({ x: px, z: pz, r });
      } else if (id === 'box') {
        const w = rng.range(4, 8);
        const d = rng.range(4, 8);
        if (wd < Math.max(w, d) * 0.72 + 0.5) continue;
        boxes.push({ x: px, z: pz, w, d, h: rng.range(6, 16), rot: rng.range(0, Math.PI) });
      }
    }
  }
  if (grass.length) b.grass(grass, true);
  if (legs.length) chairLegs(b, legs, rng);
  if (boxes.length) cardboard(b, boxes, rng);
}

function chairLegs(b: Builder, legs: { x: number; z: number; r: number }[], _rng: Rng) {
  const H = 60;
  const im = new THREE.InstancedMesh(chairLegGeo(H), b.mat, legs.length);
  im.castShadow = true;
  im.receiveShadow = true;
  legs.forEach((l, i) => {
    const y = b.heightAt(l.x, l.z);
    _m.compose(_p.set(l.x, y, l.z), _q.identity(), _s.set(l.r, 1, l.r));
    im.setMatrixAt(i, _m);
    b.physics.addStatic(RAPIER.ColliderDesc.cylinder(H / 2, l.r).setTranslation(l.x, y + H / 2, l.z));
  });
  im.computeBoundingSphere();
  b.group.add(im);
}

function cardboard(b: Builder, boxes: { x: number; z: number; w: number; d: number; h: number; rot: number }[], rng: Rng) {
  const variants = [0, 1, 2].map(() => boxGeo(rng));
  const buckets: (typeof boxes)[] = [[], [], []];
  boxes.forEach((bx, i) => buckets[i % 3].push(bx));
  buckets.forEach((list, vi) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(variants[vi], b.mat, list.length);
    im.castShadow = true;
    im.receiveShadow = true;
    list.forEach((bx, i) => {
      const y = b.heightAt(bx.x, bx.z);
      _q.setFromEuler(_e.set(0, bx.rot, 0));
      _m.compose(_p.set(bx.x, y, bx.z), _q, _s.set(bx.w, bx.h, bx.d));
      im.setMatrixAt(i, _m);
      b.physics.addStatic(RAPIER.ColliderDesc.cuboid(bx.w / 2, bx.h / 2, bx.d / 2).setTranslation(bx.x, y + bx.h / 2, bx.z).setRotation(_q));
    });
    im.computeBoundingSphere();
    b.group.add(im);
  });
}

function buildDecor(b: Builder, L: ZoneLayout, rng: Rng) {
  const pebbles: [number, number, number, number, number][] = [];
  const grass: [number, number, number, number][] = [];
  const crumbs: { x: number; z: number; s: number; rot: number }[] = [];
  const legs: { x: number; z: number; r: number }[] = [];
  for (const d of L.decor) {
    const y = b.heightAt(d.x, d.z);
    switch (d.id) {
      case 'pebble':
        pebbles.push([d.x, d.z, d.s * rng.range(0.9, 1.4), d.s * rng.range(0.6, 1), d.s]);
        break;
      case 'grass':
        grass.push([d.x, d.z, d.s, rng.range(10, 24)]);
        break;
      case 'leaf':
        b.leaf(d.x, y + 0.2, d.z, d.rot, rng.range(0.05, 0.22), 12 * d.s, 6 * d.s);
        break;
      case 'crumb':
        crumbs.push({ x: d.x, z: d.z, s: d.s, rot: d.rot });
        break;
      case 'chairLeg':
        legs.push({ x: d.x, z: d.z, r: 1.5 * d.s });
        break;
      case 'sugar':
        b.sugarCube(d.x, d.z, d.s, d.rot);
        break;
      case 'bottlecap':
        b.bottleCap(d.x, d.z, -d.rot, d.s);
        break;
      case 'trowel':
        hero(b, trowelGeo(), d.x, y, d.z, d.rot, 0.08);
        break;
      case 'fork':
        hero(b, forkGeo(), d.x, y, d.z, d.rot, 0);
        break;
      case 'box':
        break;
    }
  }
  if (pebbles.length) b.pebbles(pebbles);
  if (grass.length) b.grass(grass);
  if (legs.length) chairLegs(b, legs, rng);
  if (crumbs.length) crumbField(b, crumbs, rng);
}

function crumbField(b: Builder, crumbs: { x: number; z: number; s: number; rot: number }[], rng: Rng) {
  const variants = [0, 1, 2].map(() => crumbGeo(rng));
  const buckets: (typeof crumbs)[] = [[], [], []];
  crumbs.forEach((c, i) => buckets[i % 3].push(c));
  const v = new THREE.Vector3();
  buckets.forEach((list, vi) => {
    if (!list.length) return;
    const geo = variants[vi];
    const im = new THREE.InstancedMesh(geo, b.mat, list.length);
    im.castShadow = true;
    im.receiveShadow = true;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    list.forEach((c, i) => {
      const y = b.heightAt(c.x, c.z);
      _q.setFromEuler(_e.set(0, c.rot, 0));
      _m.compose(_p.set(c.x, y + 0.45 * c.s, c.z), _q, _s.setScalar(c.s));
      im.setMatrixAt(i, _m);
      const pts = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(_m);
        pts.set([v.x, v.y, v.z], k * 3);
      }
      const desc = RAPIER.ColliderDesc.convexHull(pts);
      if (desc) b.physics.addStatic(desc);
    });
    im.computeBoundingSphere();
    b.group.add(im);
  });
}

/** A large landmark mesh with a convex-hull collider per merged part (approximated by its bounds pieces). */
function hero(b: Builder, geo: THREE.BufferGeometry, x: number, y: number, z: number, rot: number, tilt: number) {
  const m = meshOf(geo, b.mat);
  m.position.set(x, y, z);
  m.rotation.set(0, rot, tilt, 'YXZ');
  m.updateMatrixWorld();
  b.group.add(m);
  // Collide with a hull per ~triangle cluster: split positions into chunks along X.
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const chunks = 8;
  const span = (bb.max.x - bb.min.x) / chunks;
  const v = new THREE.Vector3();
  for (let c = 0; c < chunks; c++) {
    const lo = bb.min.x + c * span - 0.01;
    const hi = lo + span + 0.02;
    const pts: number[] = [];
    for (let k = 0; k < pos.count; k++) {
      const px = pos.getX(k);
      if (px < lo || px > hi) continue;
      v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
      pts.push(v.x, v.y, v.z);
    }
    if (pts.length < 12) continue;
    const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(pts));
    if (desc) b.physics.addStatic(desc);
  }
}

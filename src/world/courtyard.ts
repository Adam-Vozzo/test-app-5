// V2-1 greybox: a Justice courtyard on a windswept plateau, built to check the v2 look (STYLE.md) at humanoid
// scale. Hand-placed by rules, not generated (the generator is V2-3). Symmetric about x = 0, entered from +Z.
//
//   spawn → path → dark gate (the frame) → chalk court with colonnades and cover → dais → far gate
//   … and beyond, through the fog, the great scales on the same axis (the landmark).
//
// Doubles as the pistol range: training dummies stand in the court at 8 / 16 / 32 / 47 m from the gate.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { merge, meshOf, paint, paintBy, place, prep, toonMat } from '../render/geo';
import { GEAR, JUSTICE } from '../render/palette';
import type { BuiltWorld } from './arena';
import { block, columnGeo, facet, gateGeo, grassTuftGeo, hillGeo, LANTERN_GLASS, lanternGlassGeo, lanternPostGeo, scalesGeo, shade, swordGeo } from './kit';

const S = JUSTICE.surfaces;
/** Walkable plateau radius; a ring of broken stone stops the player at its edge. */
const PLATEAU_R = 74;
const COURT = { x: 18, zFront: 0, zBack: -52 };
const GATE_W = 8;

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function buildCourtyard(physics: Physics, rng: Rng): BuiltWorld {
  const group = new THREE.Group();
  const mat = toonMat();
  const solid: THREE.BufferGeometry[] = [];
  const flat: THREE.BufferGeometry[] = [];
  const far: THREE.BufferGeometry[] = [];

  /** Static box: geometry + matching collider. y is the base. */
  const box = (x: number, z: number, w: number, h: number, d: number, color: number, rotY = 0, y = 0, list = solid) => {
    list.push(place(block(w, h, d, color, 0.05, x * 7 + z), x, y, z, 0, rotY, 0));
    _q.setFromEuler(_e.set(0, rotY, 0));
    physics.addStatic(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y + h / 2, z).setRotation(_q));
  };

  // ---- ground: the plateau disc (wind-flattened grass), a skirt falling away below it, and the ground collider
  // A polar grid (not a fan) so colour patches stay small and blotchy rather than long wedges.
  const disc = paintBy(prep(new THREE.RingGeometry(0.2, PLATEAU_R + 6, 72, 26).rotateX(-Math.PI / 2), true), (p, out) => {
    const n = Math.sin(p.x * 0.11) * Math.cos(p.z * 0.09) + Math.sin((p.x + p.z) * 0.031);
    out.setHex(n > 0.55 ? S.light : S.growth).multiplyScalar(0.94 + ((Math.abs(p.x * 13 + p.z * 7) % 1) * 0.08));
  });
  flat.push(disc);
  const skirt = facet(new THREE.CylinderGeometry(PLATEAU_R + 6, PLATEAU_R + 40, 70, 24, 2, true).translate(0, -35.05, 0), S.dark, 0.08);
  far.push(skirt);
  physics.addStatic(RAPIER.ColliderDesc.cuboid(PLATEAU_R + 10, 1, PLATEAU_R + 10).setTranslation(0, -1, 0));

  // ---- the court floor: slate bed with chalk flagstones (the grout reads as slate lines)
  const tiles: THREE.BufferGeometry[] = [paint(new THREE.PlaneGeometry(COURT.x * 2, -COURT.zBack + 2).rotateX(-Math.PI / 2), S.dark)];
  tiles[0] = place(tiles[0], 0, 0.015, (COURT.zFront + COURT.zBack) / 2);
  const T = 3;
  for (let x = -COURT.x + T / 2; x < COURT.x; x += T) {
    for (let z = COURT.zFront - T / 2; z > COURT.zBack; z -= T) {
      const k = 0.92 + rng() * 0.1;
      const c = new THREE.Color(S.light).lerp(new THREE.Color(S.mid), rng() < 0.12 ? 0.35 : 0).multiplyScalar(k).getHex();
      tiles.push(place(paint(new THREE.PlaneGeometry(T - 0.14, T - 0.14).rotateX(-Math.PI / 2), c), x, 0.03, z));
    }
  }
  // The path from the spawn to the gate.
  for (let z = 22; z > 0.5; z -= 2.2) tiles.push(place(paint(new THREE.PlaneGeometry(4.6, 2.0).rotateX(-Math.PI / 2), shade(S.light, 0.9 + rng() * 0.08)), rng.signed() * 0.15, 0.025, z));
  flat.push(merge(tiles));

  // ---- walls: slate, with a gate front and back and a doorway in each side (flank routes)
  const WALL_H = 3.6;
  const WALL_T = 1.2;
  const sideRuns: [number, number][] = [
    [COURT.zFront, -23],
    [-29, COURT.zBack],
  ];
  for (const sx of [-1, 1]) {
    const x = sx * (COURT.x + WALL_T / 2);
    for (const [z0, z1] of sideRuns) box(x, (z0 + z1) / 2, WALL_T, WALL_H, Math.abs(z1 - z0), S.dark);
    for (const z of [COURT.zFront, COURT.zBack]) {
      const inner = GATE_W / 2 + 2;
      const outer = COURT.x + WALL_T;
      box(sx * ((inner + outer) / 2), z, outer - inner, WALL_H, WALL_T, S.dark);
    }
  }
  // Gates: the near one is the dark foreground frame of the spawn view; the far one frames the scales.
  for (const [z, color] of [
    [COURT.zFront, S.shadow],
    [COURT.zBack, S.dark],
  ] as const) {
    solid.push(place(gateGeo(GATE_W, 7, 2.4, 2, color, shade(color, 1.25)), 0, 0, z));
    for (const sx of [-1, 1]) {
      physics.addStatic(RAPIER.ColliderDesc.cuboid(1, 3.5, 1.2).setTranslation(sx * (GATE_W / 2 + 1), 3.5, z));
    }
  }

  // ---- colonnades: pale steel columns under a chalk entablature (full cover)
  const colZ = [-7, -14, -21, -31, -38, -45];
  for (const sx of [-1, 1]) {
    const x = sx * 11;
    for (const z of colZ) {
      solid.push(place(columnGeo(1.0, 6.5, S.mid, S.light), x, 0, z));
      physics.addStatic(RAPIER.ColliderDesc.cuboid(0.62, 3.25, 0.62).setTranslation(x, 3.25, z));
    }
    const len = colZ[0] - colZ[colZ.length - 1] + 1.6;
    solid.push(place(block(1.4, 0.8, len, S.light), x, 6.5, (colZ[0] + colZ[colZ.length - 1]) / 2));
  }

  // ---- cover: waist-high chalk walls in mirrored pairs, and a central plinth with a planted sword
  for (const sx of [-1, 1]) {
    box(sx * 5, -11, 3.2, 0.95, 0.6, S.light);
    box(sx * 6.5, -26, 0.6, 0.95, 2.8, S.light);
    box(sx * 4, -37, 3, 0.95, 0.6, S.light);
  }
  box(0, -22, 2.4, 1.0, 2.4, S.mid);
  solid.push(place(swordGeo(3.4, S.light, S.shadow), 0, 1.0, -22, 0.06, 0.4, 0.05));

  // ---- the dais: three 0.3 m steps at the far end
  for (let i = 0; i < 3; i++) box(0, -48.2, 16 - i * 1.4, 0.3, 7 - i * 0.7, shade(S.light, 0.96 - i * 0.03), 0, i * 0.3);

  // ---- sword graveyard outside the walls: human-scale swords at grave-marker angles
  const nearCourt = (x: number, z: number, m: number) => Math.abs(x) < COURT.x + WALL_T + m && z < COURT.zFront + m && z > COURT.zBack - m;
  const onPath = (x: number, z: number) => Math.abs(x) < 4.5 && z > -2 && z < 24;
  let placed = 0;
  for (let i = 0; i < 400 && placed < 70; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(14, PLATEAU_R - 4);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (nearCourt(x, z, 3) || onPath(x, z)) continue;
    const len = rng.range(1.8, 2.6);
    const yaw = rng.range(0, Math.PI * 2);
    const tilt = rng.range(-0.3, 0.3);
    solid.push(place(swordGeo(len, shade(S.mid, rng.range(0.95, 1.12)), S.shadow), x, 0, z, tilt, yaw, rng.range(-0.15, 0.15)));
    _q.setFromEuler(_e.set(tilt, yaw, 0));
    physics.addStatic(RAPIER.ColliderDesc.cuboid(0.12, len * 0.35, 0.12).setTranslation(x, len * 0.35, z).setRotation(_q));
    placed++;
  }
  // Two great swords inside the plateau (hero props you can stand under), the rest out in the fog.
  const greatSwords: [number, number, number, number, number][] = [
    [-34, -18, 16, 0.18, 0.5],
    [31, -40, 13, -0.22, 2.1],
  ];
  for (const [x, z, len, tilt, yaw] of greatSwords) {
    solid.push(place(swordGeo(len, S.mid, S.dark), x, 0, z, tilt, yaw, 0.08));
    _q.setFromEuler(_e.set(tilt, yaw, 0.08));
    const c = new THREE.Vector3(0, len * 0.3, 0).applyQuaternion(_q).add(_p.set(x, 0, z));
    physics.addStatic(RAPIER.ColliderDesc.cuboid(len * 0.05, len * 0.32, len * 0.02).setTranslation(c.x, c.y, c.z).setRotation(_q));
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r = rng.range(110, 240);
    const len = rng.range(30, 70);
    far.push(place(swordGeo(len, S.mid, S.dark), Math.cos(a) * r, -30 + rng.range(0, 12), Math.sin(a) * r, rng.range(-0.35, 0.35), rng.range(0, 6.28), rng.range(-0.2, 0.2)));
  }

  // ---- the plateau's edge: a ring of broken stone blocks (no invisible walls)
  const ringN = Math.ceil((Math.PI * 2 * PLATEAU_R) / 2.6);
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    const h = rng.range(1.5, 3.4);
    const x = Math.cos(a) * PLATEAU_R;
    const z = Math.sin(a) * PLATEAU_R;
    box(x, z, 3.0, h, rng.range(1.4, 2.2), rng() < 0.5 ? S.dark : S.mid, -a + Math.PI / 2 + rng.range(-0.12, 0.12));
  }

  // ---- distance: two rings of low hills down in the valley, so fog layers them into silhouettes
  for (const [r0, r1, n, y, hMin, hMax, color] of [
    [150, 240, 16, -55, 25, 55, S.dark],
    [300, 460, 14, -50, 40, 90, S.mid],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const r = rng.range(r0, r1);
      // Keep the axis toward the scales open.
      if (Math.abs(Math.atan2(Math.cos(a), -Math.sin(a))) < 0.18 && Math.sin(a) < 0) continue;
      far.push(place(hillGeo(rng, rng.range(50, 110), rng.range(hMin, hMax), color), Math.cos(a) * r, y, Math.sin(a) * r));
    }
  }

  // ---- the landmark: the great scales, far down the court's axis. Sized and placed so the dark near gate frames
  // them from the spawn (beam ~15° up, pans just above the far gate's crown) at roughly 80% fog.
  far.push(place(scalesGeo(130, S.dark, S.shadow, JUSTICE.accent, JUSTICE.accentShade), 0, -40, -360));

  // ---- the checkpoint: the Hermit's lantern beside the path, with a warm pool of light
  const lanternAt = new THREE.Vector3(3.4, 0, 9);
  solid.push(place(lanternPostGeo(S.shadow, GEAR.metalDark), lanternAt.x, 0, lanternAt.z, 0, Math.PI, 0));
  physics.addStatic(RAPIER.ColliderDesc.cuboid(0.25, 1.2, 0.25).setTranslation(lanternAt.x, 1.2, lanternAt.z));
  const glass = new THREE.Mesh(lanternGlassGeo(GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true }));
  glass.position.copy(lanternAt).add(_p.copy(LANTERN_GLASS).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI));
  group.add(glass);
  group.add(glowPool(glass.position, 3.2, GEAR.lantern));

  // ---- wind-flattened grass tufts (instanced, one draw call), kept off the court and path
  const tuft = grassTuftGeo(0xffffff);
  const spots: [number, number][] = [];
  for (let i = 0; i < 6000 && spots.length < 1500; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng()) * (PLATEAU_R - 2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (nearCourt(x, z, 1) || onPath(x, z)) continue;
    spots.push([x, z]);
  }
  const grass = new THREE.InstancedMesh(tuft, mat, spots.length);
  const col = new THREE.Color();
  const _light = new THREE.Color(S.light);
  spots.forEach(([x, z], i) => {
    const s = rng.range(0.3, 0.6);
    _m.compose(_p.set(x, 0, z), _q.setFromEuler(_e.set(0, rng.range(-0.25, 0.25), 0)), _s.set(s, s * rng.range(0.8, 1.2), s));
    grass.setMatrixAt(i, _m);
    grass.setColorAt(i, col.setHex(S.growth).lerp(_light, rng.range(0.15, 0.45)));
  });
  grass.receiveShadow = true;
  grass.computeBoundingSphere();
  group.add(grass);

  // ---- merge into a few meshes: shadow casters, ground (receives only), and far scenery (no shadows)
  group.add(meshOf(merge(solid), mat));
  const ground = meshOf(merge(flat), mat, false);
  group.add(ground);
  const distant = meshOf(merge(far), mat, false);
  distant.receiveShadow = false;
  group.add(distant);

  const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  return {
    group,
    spawn: new THREE.Vector3(0, 0.05, 16),
    spawnYaw: 0,
    dummySpots: [
      { pos: V(-1.5, -8), slide: false },
      { pos: V(1.5, -8), slide: false },
      { pos: V(0, -16), slide: true },
      { pos: V(3.5, -32), slide: false },
      { pos: new THREE.Vector3(0, 0.9, -47), slide: false },
      // Guard dummies inside the gate, shields toward the entrance: flank them.
      { pos: V(-6, -4), slide: false, guardYaw: Math.PI },
      { pos: V(6, -4), slide: false, guardYaw: Math.PI },
    ],
    enemySpots: [],
    checkpoint: lanternAt,
    restLabel: 'the lantern',
  };
}

let glowTex: THREE.Texture | null = null;
/** Warm light pooled on the ground: an additive radial gradient (no extra real light; see CLAUDE.md). */
function glowPool(at: THREE.Vector3, r: number, color: number) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  m.position.set(at.x, 0.06, at.z);
  return m;
}

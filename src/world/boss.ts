// The boss arena (LEVELS.md → Boss arenas): a fixed shape per boss with seeded dressing.
//   1. a lantern platform;
//   2. a long walled approach under arches: compression into
//   3. the reveal: an octagonal arena beneath the landmark you walked toward for three levels.
// Justice's stands under the great scales; in phase 2 two brass pans lower out of the fog and settle into it as low
// platforms. The Devil's (V2-10) is the pit at the foot of his pedestal, ringed by chained pillars. The Tower's (V2-12)
// is its top floor, falling away ring by ring. The Moon's (V2-14) is an island in the marsh between the two towers,
// the Moon itself hung over it; at each of the Shadow's phases the Moon is eclipsed a little more.
// The way out (north) is veiled until the arcana falls.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { merge, meshOf, paint, paintBy, place, prep, toonMat } from '../render/geo';
import { AREAS, DEVIL_FOES, GEAR, JUSTICE } from '../render/palette';
import type { BuiltWorld, Interactable, RestPoint } from './arena';
import { glowPool } from './courtyard';
import { Decks } from './decks';
import { bar, block, columnGeo, MOON_R, moonTowersGeo, facet, flameGeo, gateGeo, hillGeo, LANTERN_GLASS, lanternGlassGeo, lanternPostGeo, PEDESTAL_BRAZIER_Z, PEDESTAL_FLAME, pedestalGeo, pitPillarGeo, scalesGeo, shade, swordGeo } from './kit';

/** The surfaces of the arena being built (set at the top of buildBossArena). */
let S = JUSTICE.surfaces;
const FOUNDATION = 34;
/** Arena layout (m). The arena's axis runs north (-Z) through its centre; Justice faces the way in. */
export const BOSS_ARENA = { centreZ: -96, radius: 28, approach: { from: -11, to: -68, width: 6 }, pans: { x: 10, r: 6, top: 0.35, high: 70, lowerTime: 3 } };

export type ArenaKind = 'justice' | 'devil' | 'tower' | 'moon';

export interface BossWorld extends BuiltWorld {
  boss: ArenaKind;
  /** The boss stepped into a phase (the scales come down at phase 1). */
  onBossPhase(phase: number): void;
  /** The pans are down (phase 2 arena). */
  pansDown: () => boolean;
  /** The Crowned Tower's top floor: timber decks that fall away ring by ring. */
  decks: Decks | null;
  exitOpen?: () => boolean;
}

export function buildBossArena(physics: Physics, rng: Rng, kind: ArenaKind = 'justice'): BossWorld {
  const P0 = AREAS[kind] ?? JUSTICE;
  S = P0.surfaces;
  const devil = kind === 'devil';
  const tower = kind === 'tower';
  const moon = kind === 'moon';
  const group = new THREE.Group();
  const mat = toonMat();
  const solid: THREE.BufferGeometry[] = [];
  const flat: THREE.BufferGeometry[] = [];
  const far: THREE.BufferGeometry[] = [];
  const A = BOSS_ARENA;
  const cz = A.centreZ;
  const staticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, q?: THREE.Quaternion) => {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
    if (q) d.setRotation(q);
    physics.addStatic(d);
  };
  const box = (x: number, z: number, sx: number, sz: number, h: number, color: number, y = 0, rotY = 0) => {
    solid.push(place(block(sx, h, sz, color, 0.05, x * 7 + z), x, y, z, 0, rotY, 0));
    staticBox(x, y + h / 2, z, sx / 2, h / 2, sz / 2, rotY ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY) : undefined);
  };

  // ---- 1. the lantern platform
  const startW = 22;
  far.push(place(facet(new THREE.BoxGeometry(startW + 1.2, FOUNDATION, startW + 1.2).translate(0, -FOUNDATION / 2, 0), S.dark, 0.06), 0, 0, 0));
  staticBox(0, -1, 0, startW / 2, 1, startW / 2);
  flat.push(place(paint(new THREE.PlaneGeometry(startW, startW).rotateX(-Math.PI / 2), S.light), 0, 0.02, 0));
  for (const sx of [-1, 1]) box(sx * (startW / 2 - 0.3), 0, 0.6, startW, 1.1, S.mid);
  box(0, startW / 2 - 0.3, startW, 0.6, 1.1, S.mid);
  for (const sx of [-1, 1]) box(sx * (startW / 4 + A.approach.width / 4 + 0.5), -startW / 2 + 0.3, startW / 2 - A.approach.width / 2 - 0.5, 0.6, 1.1, S.mid);
  const lantern = new THREE.Vector3(3.2, 0, 4);
  solid.push(place(lanternPostGeo(S.shadow, GEAR.metalDark), lantern.x, 0, lantern.z, 0, Math.PI, 0));
  staticBox(lantern.x, 1.2, lantern.z, 0.25, 1.2, 0.25);
  const glass = new THREE.Mesh(lanternGlassGeo(GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true }));
  glass.position.copy(lantern).add(new THREE.Vector3().copy(LANTERN_GLASS).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI));
  group.add(glass, glowPool(glass.position, 3.2, GEAR.lantern));

  // ---- 2. the approach: a walled pass under three arches (the long compression)
  const ap = A.approach;
  const len = ap.from - ap.to;
  const mz = (ap.from + ap.to) / 2;
  far.push(place(block(ap.width + 1.2, FOUNDATION, len, S.dark, 0.06), 0, -FOUNDATION, mz));
  solid.push(place(block(ap.width + 1.2, 1, len, S.mid, 0.05), 0, -1, mz));
  flat.push(place(paint(new THREE.PlaneGeometry(ap.width, len).rotateX(-Math.PI / 2), S.light), 0, 0.02, mz));
  staticBox(0, -0.5, mz, ap.width / 2 + 0.6, 0.5, len / 2);
  for (const sx of [-1, 1]) box(sx * (ap.width / 2 + 0.3), mz, 0.6, len, 5, S.dark);
  for (const z of [ap.from - 10, ap.from - 28, ap.from - 46]) {
    solid.push(place(gateGeo(ap.width, 8, 1.8, 2, S.shadow, shade(S.shadow, 1.3)), 0, 0, z));
  }

  // ---- 3. the arena: an octagon with a parapet (a gap south for the way in, north for the way on) and tall columns
  const R = A.radius;
  const oct = new THREE.CylinderGeometry(R, R, 1, 8, 1).rotateY(Math.PI / 8);
  let decks: Decks | null = null;
  if (tower) {
    // The Tower's top floor: timber decks over the storm (a grid laid over the octagon), on a few stilts.
    const tile = 3;
    const n = Math.round((2 * R) / tile);
    const t = (2 * R) / n;
    const apo = R * Math.cos(Math.PI / 8);
    const holes: number[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = -R + (c + 0.5) * t;
        const z = -R + (r + 0.5) * t;
        // Inside the octagon: within the apothem along each of its eight face normals.
        let inside = true;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          if (x * Math.sin(a) + z * Math.cos(a) > apo - 0.5) inside = false;
        }
        if (!inside) holes.push(r * n + c);
      }
    }
    decks = new Decks([{ node: -1, x0: -R, z0: cz - R, y: 0, cols: n, rows: n, tx: t, tz: t, rotten: [], holes }], physics, P0);
    group.add(decks.group);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      far.push(place(block(0.8, FOUNDATION, 0.8, S.dark, 0.06), Math.sin(a) * R * 0.6, -1 - FOUNDATION, cz + Math.cos(a) * R * 0.6));
    }
  } else {
  far.push(place(facet(oct.clone().scale(1.02, FOUNDATION, 1.02).translate(0, -FOUNDATION / 2, 0), S.dark, 0.06), 0, 0, cz));
  physics.addStatic(RAPIER.ColliderDesc.cylinder(1, R).setTranslation(0, -1, cz));
  // Concentric chalk rings on a slate bed: the floor reads as a target, centred on her.
  flat.push(
    place(
      paintBy(prep(new THREE.CircleGeometry(R, 8, Math.PI / 8).rotateX(-Math.PI / 2), true), (p, out) => {
        const r = Math.hypot(p.x, p.z);
        out.setHex(Math.floor(r / 3.5) % 2 === 0 ? S.light : shade(S.light, 0.9));
      }),
      0,
      0.025,
      cz,
    ),
  );
  }
  const apothem = R * Math.cos(Math.PI / 8);
  const side = 2 * R * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.sin(a) * (apothem - 0.3);
    const z = cz + Math.cos(a) * (apothem - 0.3);
    const southOrNorth = i === 0 || i === 4;
    if (southOrNorth) {
      // A gap in the middle for the way in (south) and the way on (north).
      const half = (side - 8) / 2;
      for (const s of [-1, 1]) box(x + s * (4 + half / 2), z, half, 0.6, 1.1, S.mid, 0, 0);
    } else box(x, z, side, 0.6, 1.1, S.mid, 0, a);
    // Columns at the corners (none on the Tower's top floor, nor on the Moon's island: open sky).
    if (tower || moon) continue;
    const ca = a + Math.PI / 8;
    const colX = Math.sin(ca) * (R - 1.6);
    const colZ = cz + Math.cos(ca) * (R - 1.6);
    solid.push(place(columnGeo(1.6, 14, S.mid, S.light), colX, 0, colZ));
    staticBox(colX, 7, colZ, 1, 7, 1);
    // The Devil's pillars are chained to each other: heavy iron swags from column to column.
    if (devil) {
      const na = a + Math.PI / 8 + Math.PI / 4;
      const nx = Math.sin(na) * (R - 1.6);
      const nz = cz + Math.cos(na) * (R - 1.6);
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8;
        const t1 = (k + 1) / 8;
        const sag = (t: number) => 12 - 4 * 4 * t * (1 - t);
        solid.push(bar(new THREE.Vector3(colX + (nx - colX) * t0, sag(t0), colZ + (nz - colZ) * t0), new THREE.Vector3(colX + (nx - colX) * t1, sag(t1), colZ + (nz - colZ) * t1), 0.22, DEVIL_FOES.iron));
      }
    }
  }
  // The connector from the approach onto the arena.
  const joinZ0 = ap.to;
  const joinZ1 = cz + apothem;
  if (joinZ0 > joinZ1) {
    const jl = joinZ0 - joinZ1;
    solid.push(place(block(ap.width + 1.2, 1, jl, S.mid, 0.05), 0, -1, (joinZ0 + joinZ1) / 2));
    staticBox(0, -0.5, (joinZ0 + joinZ1) / 2, ap.width / 2 + 0.6, 0.5, jl / 2);
  }

  // ---- the way on: a veiled gate north, open once she falls
  const exitZ = cz - apothem;
  solid.push(place(gateGeo(7, 9, 1.8, 2.4, S.dark, shade(S.dark, 1.3)), 0, 0, exitZ));
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 9),
    new THREE.MeshBasicMaterial({ color: GEAR.lantern, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  veil.position.set(0, 4.5, exitZ);
  group.add(veil);
  staticBox(0, 4.5, exitZ, 3.5, 4.5, 0.3);
  for (const s of [-1, 1]) staticBox(s * 4.7, 4.5, exitZ, 1.2, 4.5, 0.9);

  // ---- the landmark, close at last: the great scales over Justice's arena, the Devil's pedestal beyond his pit
  const lmZ = cz - R - 70;
  let moonDisc: THREE.Mesh | null = null;
  if (moon) {
    // The marsh: dark water just under the island, and the two towers with the Moon low between them, close now.
    flat.push(place(paint(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2), shade(S.dark, 0.85)), 0, -1.2, cz));
    const h = 150;
    far.push(place(moonTowersGeo(h, S.dark, S.shadow), 0, -40, lmZ - 40));
    moonDisc = new THREE.Mesh(new THREE.CircleGeometry(h * MOON_R, 40), new THREE.MeshBasicMaterial({ color: P0.accent, fog: false }));
    moonDisc.position.set(0, -40 + h, lmZ - 44);
    group.add(moonDisc);
  } else if (tower) {
    // The top floor of the Tower itself: the storm hangs right over it, lightning in its eye.
    // High enough to read as sky, not a ceiling: the fog takes most of it.
    far.push(place(facet(new THREE.TorusGeometry(110, 26, 4, 16).rotateX(Math.PI / 2), S.dark, 0.1), 0, 150, cz));
    const eye = new THREE.Mesh(flameGeo(22, 0xe8e4ff), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    eye.position.set(0, 140, cz);
    eye.rotation.x = Math.PI;
    group.add(eye);
  } else if (devil) {
    far.push(place(pedestalGeo(175, S.mid, S.dark, P0.accent, P0.accentShade), 0, -150, lmZ));
    const flame = new THREE.Mesh(flameGeo(175 * 0.07, GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    flame.position.set(0, -150 + 175 * PEDESTAL_FLAME, lmZ + 175 * PEDESTAL_BRAZIER_Z);
    group.add(flame);
  } else far.push(place(scalesGeo(175, S.dark, S.shadow, JUSTICE.accent, JUSTICE.accentShade), 0, -62, lmZ));

  // ---- the two pans that come down in phase 2 (brass: the accent motif), hanging on chains into the fog
  const P = A.pans;
  const pans: THREE.Group[] = [];
  for (const sx of devil || tower || moon ? [] : [-1, 1]) {
    const g = new THREE.Group();
    const pan = facet(new THREE.CylinderGeometry(P.r, P.r * 0.8, 0.7, 10).translate(0, -0.35, 0), JUSTICE.accentShade, 0.04);
    const rim = facet(new THREE.CylinderGeometry(P.r + 0.15, P.r + 0.15, 0.18, 10, 1, true), JUSTICE.accent, 0.03);
    const chains: THREE.BufferGeometry[] = [];
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) chains.push(bar(new THREE.Vector3(Math.cos(a) * P.r * 0.95, 0, Math.sin(a) * P.r * 0.95), new THREE.Vector3(0, 140, 0), 0.12, S.shadow));
    g.add(meshOf(merge([pan, rim, ...chains]), mat));
    g.position.set(sx * P.x, P.high, cz);
    group.add(g);
    pans.push(g);
  }
  let panState: 'up' | 'lowering' | 'down' = 'up';
  let panT = 0;
  const panColliders: RAPIER.Collider[] = [];
  const setPans = (y: number) => {
    for (const g of pans) {
      g.position.y = y;
      // The level's matrices are frozen after building: update this one by hand.
      g.updateMatrix();
      g.updateMatrixWorld(true);
    }
  };

  // ---- distance: fog floor, hills, a few great swords
  if (!moon) far.push(place(paint(new THREE.CircleGeometry(900, 24).rotateX(-Math.PI / 2), S.dark), 0, -FOUNDATION - 12, cz));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng.range(-0.15, 0.15);
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.25) continue;
    const r = rng.range(180, 420);
    far.push(place(hillGeo(rng, rng.range(60, 120), rng.range(30, 90), i % 2 ? S.dark : S.mid), Math.sin(a) * r, -58, cz + Math.cos(a) * r));
  }
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(70, 160);
    if (devil || tower || moon) far.push(place(pitPillarGeo(rng.range(50, 85), S.mid, S.dark, P0.accentShade), Math.sin(a) * r, -60, cz + Math.cos(a) * r, 0, rng.range(0, 6.28), 0));
    else far.push(place(swordGeo(rng.range(40, 70), S.mid, S.dark), Math.sin(a) * r, -36, cz + Math.cos(a) * r, rng.range(-0.3, 0.3), rng.range(0, 6.28), 0.05));
  }

  group.add(meshOf(merge(solid), mat));
  group.add(meshOf(merge(flat), mat, false));
  const distant = meshOf(merge(far), mat, false);
  distant.receiveShadow = false;
  group.add(distant);

  const restPoints: RestPoint[] = [{ pos: lantern.clone(), rest: new THREE.Vector3(lantern.x - 1.6, 0.05, lantern.z - 1.2), restYaw: 0 }];
  const world = {
    boss: kind,
    exited: false,
    exitOpen: undefined as (() => boolean) | undefined,
  } as Partial<BossWorld> & { exited: boolean };
  const interactables: Interactable[] = [
    {
      pos: new THREE.Vector3(0, 0, exitZ),
      radius: 3.6,
      prompt: () => (world.exitOpen?.() ?? true ? (moon ? 'E: take off the blindfold' : 'E: go on, unbound') : `The way on is veiled while ${devil ? 'the Devil' : tower ? 'the Crowned Tower' : moon ? 'her Shadow' : 'Justice'} stands`),
      usable: () => world.exitOpen?.() ?? true,
      use: () => {
        world.exited = true;
        return null;
      },
    },
  ];
  Object.assign(world, {
    group,
    spawn: new THREE.Vector3(0, 0.05, 7),
    spawnYaw: 0,
    dummySpots: [],
    enemySpots: [],
    foeSpots: [{ id: tower ? 'crownedTower' : moon ? 'shadow' : kind, pos: new THREE.Vector3(0, 0, cz - 6), yaw: Math.PI, idle: 'throne' as const }],
    decks,
    checkpoint: lantern.clone(),
    restLabel: 'the lantern',
    restPoints,
    interactables,
    bounds: { minX: -R, maxX: R, minZ: cz - R, maxZ: startW / 2 },
    onBossPhase(phase: number) {
      if (moonDisc) {
        // The Moon is eclipsed a step at each phase (and full again after a rest).
        (moonDisc.material as THREE.MeshBasicMaterial).color.setHex(P0.accent).lerp(new THREE.Color(S.shadow), Math.min(2, phase) * 0.3);
        return;
      }
      // The Tower's top floor falls away ring by ring (with warning: the decks pulse before they go), down to a last
      // platform under open sky. A rest or a rise brings it back.
      if (tower) {
        if (phase === 0) decks?.reset();
        else {
          const keep = phase === 1 ? 18 : 9;
          decks?.crackWhere((x, z) => Math.hypot(x, z - cz) > keep, 1.6);
        }
        return;
      }
      // Justice's arena changes with her phase; the Devil's changes come from him (the pact, the coin).
      if (devil) return;
      if (phase >= 1 && panState === 'up') {
        panState = 'lowering';
        panT = 0;
      } else if (phase === 0) {
        // Rested or died: the scales rise again.
        panState = 'up';
        for (const c of panColliders) physics.removeCollider(c);
        panColliders.length = 0;
        setPans(P.high);
      }
    },
    pansDown: () => panState === 'down',
    onReset() {
      (world as BossWorld).onBossPhase(0);
    },
    update(dt: number) {
      if (panState !== 'lowering') return;
      panT = Math.min(1, panT + dt / P.lowerTime);
      // Ease in: heavy things settle.
      const k = 1 - (1 - panT) ** 3;
      setPans(THREE.MathUtils.lerp(P.high, P.top, k));
      if (panT >= 1) {
        panState = 'down';
        for (const sx of [-1, 1]) panColliders.push(physics.addStatic(RAPIER.ColliderDesc.cylinder(P.top / 2, P.r).setTranslation(sx * P.x, P.top / 2, cz)));
      }
    },
  });
  return world as BossWorld;
}

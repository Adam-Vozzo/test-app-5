// The hub: The World (XXI) (DESIGN.md → The hub). A circular stone plaza over the fog, held inside a great laurel
// wreath tied with blue ribbons. Four gates, each watched by one of the card's creatures (angel, bull, lion, eagle);
// a creature is upright and lit when its gate is open, slumped and dark while it sleeps. The Magician keeps his
// table east, the High Priestess sits between her pillars west, and the Hermit's lantern burns by the spawn.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { merge, meshOf, paint, paintBy, place, prep, toonMat } from '../render/geo';
import { GEAR, WORLD } from '../render/palette';
import type { BuiltWorld, Interactable, RestPoint } from './arena';
import { glowPool } from './courtyard';
import { block, columnGeo, facet, gateGeo, hillGeo, LANTERN_GLASS, lanternGlassGeo, lanternPostGeo, shade } from './kit';

const S = WORLD.surfaces;
const FOUNDATION = 34;
export const HUB = { radius: 24, wreath: 28 };

export type Creature = 'angel' | 'bull' | 'lion' | 'eagle';

/** Gate layout: the angel (Swords, Justice) faces the spawn down the plaza's axis. */
export const GATES: { dim: string; creature: Creature; angle: number; name: string }[] = [
  { dim: 'justice', creature: 'angel', angle: Math.PI, name: 'the angel' },
  { dim: 'devil', creature: 'bull', angle: Math.PI / 2, name: 'the bull' },
  { dim: 'tower', creature: 'lion', angle: -Math.PI / 2, name: 'the lion' },
  { dim: 'moon', creature: 'eagle', angle: 0, name: 'the eagle' },
];

export interface HubHooks {
  gateOpen(dim: string): boolean;
  enter(dim: string): void;
  shop(): void;
  priestess(): string;
  gateLabel(dim: string): string;
  /** Is there a road to walk beyond this gate (its dimension built)? */
  built(dim: string): boolean;
  /** Has the Star come (after the Tower)? And her menu (heal upgrades). */
  starHere(): boolean;
  star(): void;
}

export interface HubWorld extends BuiltWorld {
  hub: true;
}

/** A creature statue: upright and pale when awake, slumped and dark asleep. Base at y = 0, facing -Z. */
function creatureGeo(kind: Creature, awake: boolean) {
  const c = awake ? S.light : S.dark;
  const d = awake ? S.mid : S.shadow;
  const parts: THREE.BufferGeometry[] = [block(2.4, 0.8, 2.4, d)];
  const rise = awake ? 1 : 0.55;
  if (kind === 'angel') {
    parts.push(place(facet(new THREE.CylinderGeometry(0.35, 0.7, 2.6 * rise, 6), c), 0, 0.8 + 1.3 * rise, 0));
    parts.push(place(facet(new THREE.IcosahedronGeometry(0.32, 0), c), 0, 0.8 + 2.75 * rise, 0));
    for (const s of [-1, 1]) parts.push(place(block(0.18, 2.6 * rise, 1.2, c), s * 0.6, 0.8 + 0.6 * rise, 0.3, 0.25, 0, s * (awake ? 0.5 : 0.15)));
  } else if (kind === 'bull') {
    parts.push(place(block(1.4, 1.1 * rise, 2.0, c), 0, 0.8, 0));
    parts.push(place(block(0.8, 0.7, 0.7, c), 0, 0.8 + 0.7 * rise, -1.1));
    for (const s of [-1, 1]) parts.push(place(facet(new THREE.ConeGeometry(0.1, 0.6, 4).rotateZ(s * -1.1), c), s * 0.5, 0.8 + 1.1 * rise, -1.1));
  } else if (kind === 'lion') {
    parts.push(place(block(1.2, 1.0 * rise, 1.9, c), 0, 0.8, 0.1));
    parts.push(place(facet(new THREE.IcosahedronGeometry(0.75, 0), d), 0, 0.8 + 1.1 * rise, -0.8));
    parts.push(place(block(0.5, 0.5, 0.6, c), 0, 0.8 + 0.95 * rise, -1.25));
  } else {
    parts.push(place(facet(new THREE.CylinderGeometry(0.3, 0.55, 1.6 * rise, 5), c), 0, 0.8 + 0.8 * rise, 0));
    parts.push(place(facet(new THREE.ConeGeometry(0.22, 0.5, 4).rotateX(-Math.PI / 2), d), 0, 0.8 + 1.7 * rise, -0.35));
    for (const s of [-1, 1]) parts.push(place(block(1.6, 0.12, 0.9, c), s * 0.95, 0.8 + 1.4 * rise, 0, 0, 0, s * (awake ? -0.4 : 0.6)));
  }
  return merge(parts);
}

export function buildHub(physics: Physics, rng: Rng, hooks: HubHooks): HubWorld {
  const group = new THREE.Group();
  const mat = toonMat();
  const solid: THREE.BufferGeometry[] = [];
  const flat: THREE.BufferGeometry[] = [];
  const far: THREE.BufferGeometry[] = [];
  const R = HUB.radius;
  const staticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, rotY = 0) => {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
    if (rotY) d.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY));
    physics.addStatic(d);
  };

  // ---- the plaza: a round platform over the fog, its floor a compass of warm stone rings
  far.push(facet(new THREE.CylinderGeometry(R + 0.6, R + 2, FOUNDATION, 24).translate(0, -FOUNDATION / 2, 0), S.dark, 0.06));
  physics.addStatic(RAPIER.ColliderDesc.cylinder(1, R).setTranslation(0, -1, 0));
  flat.push(
    paintBy(prep(new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2), true), (p, out) => {
      const r = Math.hypot(p.x, p.z);
      const a = Math.atan2(p.x, p.z);
      const ring = Math.floor(r / 3) % 2 === 0;
      const spoke = Math.abs(Math.sin(a * 4)) < 0.08 && r > 4;
      out.setHex(spoke ? S.mid : ring ? S.light : shade(S.light, 0.92));
    }).translate(0, 0.02, 0),
  );

  // ---- the wreath: laurel lumps in a ring just outside the plaza, tied with ribbons; a wall behind it holds you in
  const W = HUB.wreath;
  const gap = 0.16;
  const near = (a: number) => GATES.some((g) => Math.abs(Math.atan2(Math.sin(a - g.angle), Math.cos(a - g.angle))) < gap);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    if (near(a)) continue;
    const r = W + rng.range(-1, 1);
    const s = rng.range(1.6, 2.6);
    far.push(place(facet(new THREE.IcosahedronGeometry(s, 0).scale(1, 0.7 + rng() * 0.5, 0.8), rng() < 0.5 ? S.growth : shade(S.growth, 0.82), 0.08), Math.sin(a) * r, rng.range(0.5, 3.5), Math.cos(a) * r));
  }
  // Ribbons where the wreath is tied, beside each gate (the accent motif).
  for (const g of GATES) {
    for (const s of [-1, 1]) {
      const a = g.angle + s * (gap + 0.05);
      far.push(place(block(0.5, 5, 0.15, WORLD.accent, 0.04), Math.sin(a) * (W - 1.5), 0.5, Math.cos(a) * (W - 1.5), 0, a, s * 0.2));
    }
  }
  // The edge: a low parapet ring (gaps at the gates).
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    const a = ((i + 0.5) / segs) * Math.PI * 2;
    if (near(a)) continue;
    const len = (2 * Math.PI * (R - 0.3)) / segs;
    const x = Math.sin(a) * (R - 0.3);
    const z = Math.cos(a) * (R - 0.3);
    solid.push(place(block(len + 0.1, 1.1, 0.6, S.mid), x, 0, z, 0, a, 0));
    staticBox(x, 0.55, z, len / 2 + 0.05, 0.55, 0.3, a);
  }

  const interactables: Interactable[] = [];

  // ---- the gates and their creatures
  for (const g of GATES) {
    const open = hooks.gateOpen(g.dim);
    const x = Math.sin(g.angle) * (R - 0.2);
    const z = Math.cos(g.angle) * (R - 0.2);
    // The gate faces the centre.
    solid.push(place(gateGeo(6, 8, 1.8, 2, open ? S.mid : S.shadow, shade(open ? S.mid : S.shadow, 1.25)), x, 0, z, 0, g.angle, 0));
    staticBox(x, 4, z, 3.2, 4, 0.4, g.angle);
    if (open) {
      const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 8),
        new THREE.MeshBasicMaterial({ color: GEAR.lantern, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      veil.position.set(x, 4, z);
      veil.rotation.y = g.angle;
      group.add(veil);
    }
    // The creature sits beside the gate, facing in.
    const side = g.angle + 0.3;
    const cx = Math.sin(side) * (R - 4);
    const cz = Math.cos(side) * (R - 4);
    solid.push(place(creatureGeo(g.creature, open), cx, 0, cz, 0, g.angle, 0));
    staticBox(cx, 1.2, cz, 1.2, 1.2, 1.2, g.angle);
    interactables.push({
      pos: new THREE.Vector3(x * 0.94, 0, z * 0.94),
      radius: 3.6,
      prompt: () => hooks.gateLabel(g.dim),
      usable: () => hooks.gateOpen(g.dim) && hooks.built(g.dim),
      use: () => {
        hooks.enter(g.dim);
        return null;
      },
    });
  }

  // ---- the Magician's table (east of the axis): a cup, a pentacle, a sword and a wand; he stands behind it
  const mx = 9;
  const mz = 2;
  solid.push(place(block(3.2, 1.0, 1.4, S.dark), mx, 0, mz));
  staticBox(mx, 0.5, mz, 1.6, 0.5, 0.7);
  solid.push(place(facet(new THREE.CylinderGeometry(0.16, 0.1, 0.32, 6), S.mid), mx - 1.1, 1.0, mz));
  solid.push(place(facet(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 10), GEAR.metalLight), mx - 0.4, 1.0, mz));
  solid.push(place(block(0.08, 0.06, 0.9, GEAR.metalLight), mx + 0.35, 1.0, mz, 0, 0.4, 0));
  solid.push(place(block(0.07, 0.07, 0.8, GEAR.grip), mx + 1.1, 1.0, mz, 0, -0.3, 0));
  const magician = merge([
    facet(new THREE.CylinderGeometry(0.22, 0.42, 1.5, 6).translate(0, 0.75, 0), 0x6a4a3e),
    place(facet(new THREE.IcosahedronGeometry(0.17, 1), 0x6a4a3e), 0, 1.66, 0),
    // His raised wand: one hand up, as on the card.
    place(block(0.06, 0.9, 0.06, S.light), 0.32, 1.6, 0, 0, 0, -0.15),
  ]);
  // An arcana: large (STYLE.md → Characters), looming over his table.
  const ARCANA = 1.9;
  solid.push(place(magician, mx, 0, mz + 1.6, 0, 0, 0, ARCANA));
  staticBox(mx, 1.6, mz + 1.6, 0.8, 1.6, 0.8);
  interactables.push({
    pos: new THREE.Vector3(mx, 0, mz - 1),
    radius: 2.8,
    prompt: () => 'E: the Magician',
    usable: () => true,
    use: () => {
      hooks.shop();
      return null;
    },
  });

  // ---- the High Priestess (west): seated between a dark and a pale pillar, a veil behind her
  const px = -9;
  const pz = 2;
  for (const [sx, col] of [
    [-2.6, S.shadow],
    [2.6, S.light],
  ] as const) {
    solid.push(place(columnGeo(1.1, 7, col, shade(col, 1.1)), px + sx, 0, pz + 1.8));
    staticBox(px + sx, 3.5, pz + 1.8, 0.7, 3.5, 0.7);
  }
  solid.push(place(block(4.4, 6, 0.08, WORLD.accentShade, 0.03), px, 0.4, pz + 2.3));
  const priestess = merge([
    block(1.0, 0.6, 0.8, S.mid),
    place(facet(new THREE.CylinderGeometry(0.2, 0.5, 1.3, 6).translate(0, 0.65, 0), 0x3f4b66), 0, 0.6, 0),
    place(facet(new THREE.IcosahedronGeometry(0.16, 1), 0x3f4b66), 0, 2.05, 0),
    place(facet(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), S.light), 0, 2.28, 0),
  ]);
  solid.push(place(priestess, px, 0, pz + 0.9, 0, 0, 0, ARCANA));
  staticBox(px, 1.6, pz + 0.9, 1.0, 1.6, 0.8);
  interactables.push({
    pos: new THREE.Vector3(px, 0, pz - 0.8),
    radius: 3.2,
    prompt: () => 'E: the High Priestess',
    usable: () => true,
    use: () => hooks.priestess(),
  });

  // ---- the Star (south-west), once the Tower has fallen: kneeling at a pool, pouring from two jugs (hope after
  // collapse). She keeps the heal upgrades.
  if (hooks.starHere()) {
    const sx = -8;
    const sz = 10;
    flat.push(place(facet(new THREE.CircleGeometry(2.4, 10).rotateX(-Math.PI / 2), 0x6f8fa6, 0.04), sx, 0.03, sz));
    const star = merge([
      // Kneeling: a low robe, the body leaning to the pool.
      facet(new THREE.CylinderGeometry(0.3, 0.55, 0.8, 6).translate(0, 0.4, 0), 0xd8d6dc),
      place(facet(new THREE.CylinderGeometry(0.16, 0.24, 0.6, 6).translate(0, 0.3, 0), 0xd8d6dc), 0, 0.75, 0, 0.3, 0, 0),
      place(facet(new THREE.IcosahedronGeometry(0.15, 1), 0xd8d6dc), 0, 1.5, -0.15),
      // Her two jugs, tipped.
      ...[-1, 1].map((s) => place(facet(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 6), 0x9a7e66), s * 0.42, 0.95, -0.3, 0.9, 0, s * 0.3)),
      // The great star over her: eight points.
      ...[0, 1, 2, 3].map((i) => place(block(0.08, 0.9, 0.08, S.light), 0, 2.6, 0, 0, 0, (i * Math.PI) / 4)),
    ]);
    solid.push(place(star, sx, 0, sz - 1.6, 0, Math.PI * 0.85, 0, ARCANA));
    staticBox(sx, 1.2, sz - 1.6, 0.9, 1.2, 0.9);
    interactables.push({
      pos: new THREE.Vector3(sx + 1.6, 0, sz),
      radius: 3,
      prompt: () => 'E: the Star',
      usable: () => true,
      use: () => {
        hooks.star();
        return null;
      },
    });
  }

  // ---- the Hermit's lantern by the spawn
  const lantern = new THREE.Vector3(3, 0, 12);
  solid.push(place(lanternPostGeo(S.shadow, GEAR.metalDark), lantern.x, 0, lantern.z, 0, Math.PI, 0));
  staticBox(lantern.x, 1.2, lantern.z, 0.25, 1.2, 0.25);
  const glass = new THREE.Mesh(lanternGlassGeo(GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true }));
  glass.position.copy(lantern).add(new THREE.Vector3().copy(LANTERN_GLASS).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI));
  group.add(glass, glowPool(glass.position, 3.2, GEAR.lantern));

  // ---- distance: a fog floor and hills all round (no landmark: the hub is outside the dimensions)
  far.push(place(paint(new THREE.CircleGeometry(900, 24).rotateX(-Math.PI / 2), S.dark), 0, -FOUNDATION - 12, 0));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const r = rng.range(150, 380);
    far.push(place(hillGeo(rng, rng.range(60, 120), rng.range(30, 80), i % 2 ? S.dark : S.mid), Math.sin(a) * r, -58, Math.cos(a) * r));
  }

  group.add(meshOf(merge(solid), mat));
  group.add(meshOf(merge(flat), mat, false));
  const distant = meshOf(merge(far), mat, false);
  distant.receiveShadow = false;
  group.add(distant);

  const restPoints: RestPoint[] = [{ pos: lantern.clone(), rest: new THREE.Vector3(lantern.x - 1.6, 0.05, lantern.z - 1), restYaw: 0 }];
  return {
    hub: true,
    group,
    spawn: new THREE.Vector3(0, 0.05, 15),
    spawnYaw: 0,
    dummySpots: [],
    enemySpots: [],
    checkpoint: lantern.clone(),
    restLabel: 'the lantern',
    restPoints,
    interactables,
    bounds: { minX: -W - 3, maxX: W + 3, minZ: -W - 3, maxZ: W + 3 },
  };
}

// Builds a generated level (src/world/gen-level.ts) into meshes and colliders with the faceted kit. Everything the
// generator decided arrives as plain records; this file only turns them into stone. Rooms are platforms over a
// fog-filled drop, joined by causeways and stairs; parapets and walls bound them.
import * as THREE from 'three';
import { makeRng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { landmarkMat, merge, meshOf, paint, paintBy, place, prep, toonMat } from '../render/geo';
import { AREAS, GEAR, JUSTICE } from '../render/palette';
import type { BuiltWorld, Interactable, RestPoint } from './arena';
import { glowPool } from './courtyard';
import type { DimensionDef } from './dimensions';
import { COVER, EDGE, PAN, type Box, type Hoard, type Key } from './gen-dress';
import { TOWER, towerOffset } from './gen-sight';
import { Decks } from './decks';
import { tuning } from '../tuning';
import { DEVIL_FOES } from '../render/palette';
import type { LevelLayout, LevelReport } from './gen-level';
import { fwdOf, landingFlat, landingRadius, rightOf, segmentsOf, toWorld, type Connector, type Room } from './gen-space';
import { block, columnGeo, facet, flameGeo, gateGeo, gateTowerGeo, hungChainGeo, panDishGeo, panPostGeo, weightGeo, grassTuftGeo, hillGeo, hoardGeo, hoardTellGeo, MOON_R, moonTowersGeo, reedGeo, rubbleGeo, TOWER_GLOW, towerGeo, LANTERN_GLASS, lanternGlassGeo, lanternPostGeo, PEDESTAL_BRAZIER_Z, PEDESTAL_FLAME, pedestalGeo, pitPillarGeo, scalesGeo, shade, swordGeo } from './kit';

/** The surfaces of the dimension being built (set at the top of buildLevel; the helpers below read it). */
let S = JUSTICE.surfaces;
/** How far the platforms' foundations reach down into the fog. */
const FOUNDATION = 34;

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
/** How far a hidden stone's shadow caster stands above the drawn boardwalk (its shadow falls on the lie). */
const STONE_SHADE = 0.35;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
/** A turn about the vertical (as a Three object's rotation.y). */
const yawQ = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(_Y, yaw);

export interface LevelWorld extends BuiltWorld {
  generated: LevelLayout;
  report: LevelReport;
  dim: DimensionDef;
  /** Set when the player passes through the exit gate. */
  exited: boolean;
  /** Has the shortcut door been opened? */
  shortcutOpen: () => boolean;
  /** What a branch cache gives (set by the game); returns the toast. */
  onCache?: () => string;
  /** A reflected cache reached (the Moon): nothing there (set by the game); returns the toast. */
  onReflection?: (at: THREE.Vector3) => string;
  /** A hoard taken: the game pays it and makes it cost (set by the game); returns the toast. */
  onHoard?: (h: Hoard, at: THREE.Vector3) => string | null;
  /** The way on opens once the court card has fallen (set by the game). */
  exitOpen?: () => boolean;
  /** The Tower's timber decks (collapse), if this level has scaffold rooms. */
  decks: Decks | null;
  /** Justice: which pans are weighted (left, right). The axis gate opens when both are. */
  weighted: [boolean, boolean];
  /** A weight set (set by the game): the toast. */
  onWeight?: (k: Key, count: number) => string;
  /** The pan ridden back to the mid lantern (set by the game, which carries her). */
  onRide?: (k: Key) => string | null;
  /** Justice: each pan's dish and chains (left, right), carried with her on the ride; `home` is where it hangs. */
  pans: { dish: THREE.Object3D; home: THREE.Vector3 }[];
}

export function buildLevel(layout: LevelLayout, report: LevelReport, dim: DimensionDef, physics: Physics): LevelWorld {
  const rng = makeRng(layout.seed).fork(`build-${layout.dimension}-${layout.level}`);
  const P = AREAS[dim.id] ?? JUSTICE;
  S = P.surfaces;
  const hoards = dim.props.strewn === 'hoard';
  const rubble = dim.props.strewn === 'rubble';
  const group = new THREE.Group();
  const mat = toonMat();
  const solid: THREE.BufferGeometry[] = [];
  const flat: THREE.BufferGeometry[] = [];
  const far: THREE.BufferGeometry[] = [];
  const mark: THREE.BufferGeometry[] = [];
  const { space, furn, dressing: dr } = layout;

  const staticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, q?: THREE.Quaternion) => {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
    if (q) d.setRotation(q);
    physics.addStatic(d);
  };
  const staticHull: StaticHull = (pts) => {
    const d = RAPIER.ColliderDesc.convexHull(pts);
    if (d) physics.addStatic(d);
  };
  /** A box standing on y, turned `yaw`, with a collider. */
  const box = (x: number, z: number, y: number, sx: number, sz: number, h: number, color: number, list = solid, yaw = 0) => {
    list.push(place(block(sx, h, sz, color, 0.05, x * 7 + z), x, y, z, 0, yaw, 0));
    staticBox(x, y + h / 2, z, sx / 2, h / 2, sz / 2, yawQ(yaw));
  };

  // ---- rooms: a platform (stone foundation into the fog) with a paved or earth top, turned to the room's heading
  for (const r of space.rooms) {
    const kit = dim.kits[r.kit];
    if (kit.scaffold) {
      // Timber decks over the drop (the decks themselves are built below): a frame of beams and stilts into the fog.
      for (const [u, v, sx, sz] of [[0, -r.d / 2, r.w + 0.6, 0.5], [0, r.d / 2, r.w + 0.6, 0.5], [-r.w / 2, 0, 0.5, r.d], [r.w / 2, 0, 0.5, r.d]] as const) {
        const [x, z] = toWorld(r, u, v);
        solid.push(place(block(sx, 0.5, sz, S.dark, 0.05), x, r.y - 0.8, z, 0, r.yaw, 0));
      }
      for (let i = 0; i <= 2; i++)
        for (let j = 0; j <= 2; j++) {
          const [x, z] = toWorld(r, -r.w / 2 + (r.w * i) / 2, -r.d / 2 + (r.d * j) / 2);
          far.push(place(block(0.5, FOUNDATION, 0.5, S.dark, 0.06), x, r.y - 0.8 - FOUNDATION, z, 0, r.yaw, 0));
        }
      continue;
    }
    far.push(place(facet(new THREE.BoxGeometry(r.w + 1.2, FOUNDATION, r.d + 1.2).translate(0, -FOUNDATION / 2, 0), S.dark, 0.06, r.node), r.x, r.y - 0.02, r.z, 0, r.yaw, 0));
    staticBox(r.x, r.y - 1, r.z, r.w / 2, 1, r.d / 2, yawQ(r.yaw));
    const top = kit.ground === 'earth' ? [earthTop(r)] : flagTop(r, rng);
    for (const g of top) flat.push(place(g, r.x, r.y, r.z, 0, r.yaw, 0));
  }
  // The Tower's decks: one instanced draw per scaffold room, a collider per deck.
  const decks = dr.scaffolds.length ? new Decks(dr.scaffolds, physics, P) : null;
  if (decks) group.add(decks.group);

  // ---- connectors: causeway decks on piers, or stairs; parapets both sides unless walled
  // The Moon's false paths: the boardwalk is drawn, but it casts no shadow on the water and nothing holds you up. It
  // does take shadows: the stones under it lay theirs across it, so the way over shows on the lie itself.
  const noBox: StaticBox = () => {};
  const noHull: StaticHull = () => {};
  const staticCylinder: StaticCylinder = (x, y, z, hh, r) => physics.addStatic(RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(x, y, z));
  const noCylinder: StaticCylinder = () => {};
  space.connectors.forEach((c, i) => (dr.falsePaths.includes(i) ? connectorGeo(c, flat, far, noBox, noHull, noCylinder) : connectorGeo(c, solid, far, staticBox, staticHull, staticCylinder)));
  // ...and under it, the way that is there: stepping stones no one can see, which cast their shadows on the water and
  // on the drawn boardwalk (their shadow casters stand a little proud of it; after the first playtest the shadows
  // fell only on the water, under the boardwalk, where no one could see them).
  if (dr.stones.length) {
    const casters = dr.stones.map((st) => place(new THREE.BoxGeometry(st.size, 0.4 + STONE_SHADE, st.size), st.x, st.y - 0.2 + STONE_SHADE / 2, st.z, 0, st.yaw, 0));
    for (const st of dr.stones) staticBox(st.x, st.y - 0.2, st.z, st.size / 2, 0.2, st.size / 2, yawQ(st.yaw));
    // Drawn into the shadow map only: no colour, no depth in the view.
    // Front faces into the shadow map: the default (back faces) put each stone's underside there, below the boardwalk,
    // so the boardwalk took only the outlines of its sides.
    const hidden = new THREE.Mesh(merge(casters), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: THREE.FrontSide }));
    hidden.castShadow = true;
    hidden.receiveShadow = false;
    group.add(hidden);
  }

  // ---- kit structure: edges, cover, tiers, dividers, connector walls
  for (const b of furn.boxes) {
    if (b.kind === 'edge') edgeGeo(b, solid, staticBox);
    else box(b.x, b.z, b.y, b.sx, b.sz, b.h, boxColor(b), solid, b.yaw);
    if (b.kind === 'plinth') {
      if (hoards) solid.push(place(hoardGeo(1.1, P.accent, P.accentShade, S.dark, b.x), b.x, b.y + b.h, b.z, 0, rng.range(0, Math.PI), 0));
      else solid.push(place(swordGeo(3.2, S.light, S.shadow), b.x, b.y + b.h, b.z, 0.06, rng.range(0, Math.PI), 0.05));
    }
  }
  for (const rp of furn.ramps) rampGeo(rp.x0, rp.z0, rp.y0, rp.x1, rp.z1, rp.y1, rp.width, S.light, solid, staticBox, false, staticHull);
  // Columns, with an entablature over neighbours in the same row.
  for (const c of furn.columns) {
    solid.push(place(columnGeo(1.0, c.h, S.mid, S.light), c.x, c.y, c.z));
    staticBox(c.x, c.y + c.h / 2, c.z, 0.62, c.h / 2, 0.62);
  }
  // Lintels join each column to the next along its colonnade.
  const cols = furn.columns;
  for (let i = 0; i < cols.length; i++) {
    const a = cols[i];
    const b = cols.find((k) => k.node === a.node && k.row === a.row && k.seq > a.seq && !cols.some((m) => m.node === a.node && m.row === a.row && m.seq > a.seq && m.seq < k.seq));
    if (!b) continue;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > 9) continue;
    solid.push(place(block(1.3, 0.7, d + 1.3, S.light), (a.x + b.x) / 2, a.y + a.h, (a.z + b.z) / 2, 0, Math.atan2(b.x - a.x, b.z - a.z), 0));
  }

  // ---- arches: the dark foreground frames of compression connectors (turned to face along the way)
  for (const a of dr.arches) {
    solid.push(place(gateGeo(a.width, a.height, 1.6, 2, S.shadow, shade(S.shadow, 1.3)), a.x, a.y, a.z, 0, a.yaw, 0));
    const [rx, rz] = rightOf(a.yaw);
    for (const s of [-1, 1]) {
      const off = a.width / 2 + 1;
      staticBox(a.x + rx * s * off, a.y + a.height / 2, a.z + rz * s * off, 1, a.height / 2, 0.8, yawQ(a.yaw));
    }
  }
  // ---- the Moon's gateways: two towers either side of every true way (the card's), never a false one
  for (const t of dr.towers) {
    const [rx, rz] = rightOf(t.yaw);
    for (const s of [-1, 1]) {
      const x = t.x + rx * s * towerOffset(t);
      const z = t.z + rz * s * towerOffset(t);
      solid.push(place(gateTowerGeo(t.height, TOWER.base, TOWER.cap, S.mid, S.dark), x, t.y, z, 0, t.yaw, 0));
      staticBox(x, t.y + t.height / 2, z, TOWER.base / 2, t.height / 2, TOWER.base / 2, yawQ(t.yaw));
    }
  }

  // ---- strewn props (Justice: planted swords on the sword field; the Devil: coin hoards), and hero props in the fog
  for (const s of dr.swords) {
    if (dim.props.strewn === 'reed') {
      // Reed beds in the shallows: low cover you can see over.
      solid.push(place(reedGeo(s.len * 0.6, S.growth, S.mid, s.x + s.z), s.x, s.y, s.z, 0, s.yaw, 0));
      staticBox(s.x, s.y + 0.5, s.z, 0.6, 0.5, 0.6);
      continue;
    }
    if (rubble) {
      const size = s.len * 0.55;
      solid.push(place(rubbleGeo(size, S.mid, S.light, s.x + s.z), s.x, s.y, s.z, 0, s.yaw, 0));
      staticBox(s.x, s.y + size * 0.3, s.z, size * 0.55, size * 0.3, size * 0.55);
      continue;
    }
    if (hoards) {
      // A hoard is low cover: its size follows the planted length the generator rolled.
      const size = s.len * 0.5;
      solid.push(place(hoardGeo(size, P.accent, P.accentShade, S.dark, s.x + s.z), s.x, s.y, s.z, 0, s.yaw, 0));
      staticBox(s.x, s.y + size * 0.4, s.z, size * 0.6, size * 0.4, size * 0.6);
      continue;
    }
    solid.push(place(swordGeo(s.len, shade(S.mid, 1.05), S.dark), s.x, s.y, s.z, s.tilt, s.yaw, 0.04));
    _q.setFromEuler(_e.set(s.tilt, s.yaw, 0.04));
    staticBox(s.x, s.y + s.len * 0.35, s.z, 0.12, s.len * 0.35, 0.12, _q.clone());
  }
  for (const s of dr.heroSwords) {
    if (dim.props.hero === 'pillar') far.push(place(pitPillarGeo(s.len, S.mid, S.dark, P.accentShade), s.x, s.y - 10, s.z, 0, s.yaw, 0));
    else far.push(place(swordGeo(s.len, S.mid, S.dark), s.x, s.y, s.z, s.tilt, s.yaw, 0.04));
  }

  // ---- lanterns: the Hermit's light at every rest point
  const restPoints: RestPoint[] = [];
  for (const l of dr.lanterns) {
    const at = new THREE.Vector3(l.x, l.y, l.z);
    solid.push(place(lanternPostGeo(S.shadow, GEAR.metalDark), l.x, l.y, l.z, 0, Math.PI, 0));
    staticBox(l.x, l.y + 1.2, l.z, 0.25, 1.2, 0.25);
    const glass = new THREE.Mesh(lanternGlassGeo(GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true }));
    glass.position.copy(at).add(_p.copy(LANTERN_GLASS).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI));
    group.add(glass);
    const glow = glowPool(glass.position, 3.2, GEAR.lantern);
    glow.position.y = l.y + 0.06;
    group.add(glow);
    restPoints.push({ pos: at, rest: new THREE.Vector3(l.rest.x, l.rest.y + 0.05, l.rest.z), restYaw: l.rest.yaw });
  }

  const interactables: Interactable[] = [];

  // ---- the shortcut: a portcullis in the gate-side arch, lifted only from the gate's side. Justice's is the axis
  // gate at the mid lantern's far edge, lifted when both pans of the scales are weighted.
  const door = dr.door;
  const [fdx, fdz] = fwdOf(door.yaw);
  const bars = new THREE.Group();
  const barGeo: THREE.BufferGeometry[] = [];
  const doorH = 6;
  for (let t = -door.width / 2 + 0.35; t < door.width / 2; t += 0.7) barGeo.push(place(block(0.14, doorH, 0.14, GEAR.metalDark, 0.04), t, 0, 0));
  for (const y of [1.2, 3.4, 5.4]) barGeo.push(place(block(door.width, 0.16, 0.16, GEAR.metalDark, 0.04), 0, y, 0));
  bars.add(meshOf(merge(barGeo), mat));
  bars.position.set(door.x, door.y, door.z);
  bars.rotation.y = door.yaw;
  group.add(bars);
  const doorCol = physics.addStatic(RAPIER.ColliderDesc.cuboid(door.width / 2, doorH / 2, 0.3).setTranslation(door.x, door.y + doorH / 2, door.z).setRotation(yawQ(door.yaw)));
  let open = false;
  let lift = 0;
  const doorPos = new THREE.Vector3(door.x, door.y, door.z);
  const gateSide = (p: THREE.Vector3) => (p.x - door.x) * fdx + (p.z - door.z) * fdz > 0.2;
  const weighted: [boolean, boolean] = [false, false];
  const keyed = door.opens === 'keys';
  const lifted = () => {
    open = true;
    physics.removeCollider(doorCol);
  };
  interactables.push({
    pos: doorPos,
    radius: 3.6,
    prompt: (p) => {
      if (open) return null;
      if (keyed) return `Barred until the scales are weighed (${weighted.filter(Boolean).length} of 2 pans)`;
      return gateSide(p) ? 'E: lift the bars (a shortcut)' : 'Barred from the other side';
    },
    usable: (p) => !open && !keyed && gateSide(p),
    use: () => {
      lifted();
      return 'The bars lift. A way back to the lantern.';
    },
    update: (dt) => {
      if (keyed && !open && weighted[0] && weighted[1]) lifted();
      if (!open || lift >= 1) return;
      lift = Math.min(1, lift + dt / 1.4);
      bars.position.y = door.y + (1 - (1 - lift) ** 3) * (doorH - 0.6);
      bars.updateMatrix();
    },
  });

  // ---- the exit: a tall gate in the far edge, veiled in warm light, toward the landmark
  const ex = dr.exit;
  solid.push(place(gateGeo(ex.width, 8, 1.8, 2.2, S.dark, shade(S.dark, 1.3)), ex.x, ex.y, ex.z, 0, ex.yaw, 0));
  const [erx, erz] = rightOf(ex.yaw);
  for (const s of [-1, 1]) {
    const off = ex.width / 2 + 1.1;
    staticBox(ex.x + erx * s * off, ex.y + 4, ex.z + erz * s * off, 1.1, 4, 0.9, yawQ(ex.yaw));
  }
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(ex.width, 8),
    new THREE.MeshBasicMaterial({ color: GEAR.lantern, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  veil.position.set(ex.x, ex.y + 4, ex.z);
  veil.rotation.y = ex.yaw;
  group.add(veil);
  staticBox(ex.x, ex.y + 4, ex.z, ex.width / 2, 4, 0.3, yawQ(ex.yaw));
  const exitPos = new THREE.Vector3(ex.x, ex.y, ex.z);
  const world: Partial<LevelWorld> = { exited: false };
  interactables.push({
    pos: exitPos,
    radius: 3.4,
    prompt: () => (world.exitOpen?.() ?? true ? `E: walk on ${dim.seat.way}` : `The way on is sealed while the ${layout.script.minibossName} stands`),
    usable: () => world.exitOpen?.() ?? true,
    use: () => {
      world.exited = true;
      return null;
    },
  });

  // ---- caches at the end of branches: a lit reward (a placeholder until pentacles and the Magician exist)
  for (const c of dr.caches) {
    // A reflected cache (the Moon) casts no shadow, and taking it takes nothing.
    const into = c.reflection ? far : solid;
    into.push(place(block(1.6, 0.9, 1.0, S.mid), c.x, c.y, c.z));
    if (hoards) into.push(place(hoardGeo(0.5, P.accent, P.accentShade, S.dark), c.x, c.y + 0.9, c.z, 0, 0.3, 0));
    else into.push(place(swordGeo(1.6, S.light, S.shadow), c.x, c.y + 0.9, c.z, 0, 0.3, 0.6));
    if (!c.reflection) staticBox(c.x, c.y + 0.45, c.z, 0.8, 0.45, 0.5);
    const glow = glowPool(new THREE.Vector3(c.x, c.y, c.z), 2.4, GEAR.lantern);
    glow.position.y = c.y + 0.06;
    group.add(glow);
    let taken = false;
    interactables.push({
      pos: new THREE.Vector3(c.x, c.y, c.z),
      radius: 2.6,
      prompt: () => (taken ? null : 'E: take what was left here'),
      usable: () => !taken,
      use: () => {
        taken = true;
        glow.visible = false;
        if (c.reflection) return world.onReflection?.(new THREE.Vector3(c.x, c.y, c.z)) ?? 'It was a reflection.';
        return world.onCache?.() ?? null;
      },
    });
  }

  // ---- Justice's weights and pans: set the weight in its pan, and the pan carries her back to the mid lantern
  const PAN_R = PAN.r;
  const panLabel = ['left', 'right'];
  const pans: LevelWorld['pans'] = [];
  for (const k of dr.keys) {
    const at = new THREE.Vector3(k.x, k.y + 1.0, k.z);
    const weight = meshOf(weightGeo(P.accent, S.dark), mat);
    weight.position.copy(at);
    group.add(weight);
    // The pan faces the room's middle, its post on the outside. The post stays; the dish and its chains ride.
    const toMid = Math.atan2(k.x - k.pan.x, k.z - k.pan.z);
    solid.push(place(panPostGeo(PAN_R, S.mid), k.pan.x, k.pan.y, k.pan.z, 0, toMid + Math.PI / 2, 0));
    const dish = new THREE.Group();
    dish.add(meshOf(panDishGeo(PAN_R, P.accent, GEAR.metalDark), mat));
    dish.position.set(k.pan.x, k.pan.y, k.pan.z);
    dish.rotation.y = toMid + Math.PI / 2;
    group.add(dish);
    pans[k.wing] = { dish, home: dish.position.clone() };
    staticCylinder(k.pan.x, k.pan.y + 0.35, k.pan.z, 0.15, PAN_R);
    const glow = glowPool(new THREE.Vector3(k.x, k.y, k.z), 2.6, P.accent);
    glow.position.y = k.y + 0.06;
    group.add(glow);
    interactables.push({
      pos: at,
      radius: 2.8,
      prompt: () => (weighted[k.wing] ? null : `E: set the weight in the ${panLabel[k.wing]} pan`),
      usable: () => !weighted[k.wing],
      use: () => {
        weighted[k.wing] = true;
        // Into the dish: it rides with it from now on.
        dish.add(weight);
        weight.position.set(0, 0.5, 0);
        weight.updateMatrix();
        glow.visible = false;
        const n = weighted.filter(Boolean).length;
        return world.onWeight?.(k, n) ?? (n === 2 ? 'Both pans are weighted: the axis gate lifts.' : `The ${panLabel[k.wing]} pan is weighted (${n} of 2).`);
      },
    });
    interactables.push({
      pos: new THREE.Vector3(k.pan.x, k.pan.y, k.pan.z),
      radius: PAN_R + 1.2,
      prompt: () => (weighted[k.wing] ? 'E: ride the pan back to the beam' : null),
      usable: () => weighted[k.wing],
      use: () => world.onRide?.(k) ?? null,
    });
  }

  // ---- the Devil's hoards: in plain sight, each with the tell of what it costs (taking one hides its coin)
  const HOARD_TELL: Record<Hoard['cost'], string> = {
    bell: 'a bell hangs over it',
    weight: 'it is chained down: it will weigh on you',
    ambush: 'the floor around it is broken',
  };
  for (const h of dr.hoards) {
    const size = h.branch ? 1.5 : 1.1;
    const at = new THREE.Vector3(h.x, h.y, h.z);
    const yaw = rng.range(0, Math.PI * 2);
    solid.push(place(hoardTellGeo(h.cost, size, S.dark, DEVIL_FOES.iron, S.shadow), h.x, h.y, h.z, 0, yaw, 0));
    const coin = meshOf(place(hoardGeo(size, P.accent, P.accentShade, S.dark, h.x + h.z), 0, 0, 0, 0, yaw, 0), mat);
    coin.position.copy(at);
    group.add(coin);
    const glow = glowPool(at, size * 2, P.accent);
    glow.position.y = h.y + 0.05;
    group.add(glow);
    const col = physics.addStatic(RAPIER.ColliderDesc.cuboid(size * 0.6, size * 0.4, size * 0.6).setTranslation(h.x, h.y + size * 0.4, h.z));
    let taken = false;
    const value = () => Math.round(tuning.foes.hoard.pentacles[h.cost] * (h.branch ? tuning.foes.hoard.branchMul : 1));
    interactables.push({
      pos: at,
      radius: size + 1.6,
      prompt: () => (taken ? null : `E: take the hoard (✪ ${value()}): ${HOARD_TELL[h.cost]}`),
      usable: () => !taken,
      use: () => {
        taken = true;
        coin.visible = false;
        glow.visible = false;
        physics.removeCollider(col);
        return world.onHoard?.(h, at) ?? null;
      },
    });
  }

  // ---- grass tufts (instanced, one draw call)
  if (dr.grass.length) {
    const grass = new THREE.InstancedMesh(grassTuftGeo(0xffffff), mat, dr.grass.length);
    const col = new THREE.Color();
    const light = new THREE.Color(S.light);
    dr.grass.forEach(([x, z, y], i) => {
      const s = rng.range(0.3, 0.6);
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, rng.range(-0.25, 0.25), 0)), _s.set(s, s * rng.range(0.8, 1.2), s));
      grass.setMatrixAt(i, _m);
      grass.setColorAt(i, col.setHex(S.growth).lerp(light, rng.range(0.15, 0.45)));
    });
    grass.receiveShadow = true;
    grass.computeBoundingSphere();
    group.add(grass);
  }

  // ---- distance: the fog floor, hills in rings around the level, great swords far out, and the landmark
  const b = layout.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  if (dim.water) {
    // The Moon's marsh: dark water just under the islands, which takes the shadows (the false paths cast none).
    const waterY = Math.min(...space.rooms.map((r) => r.y)) - 1.2;
    flat.push(place(paint(new THREE.CircleGeometry(span + 700, 32).rotateX(-Math.PI / 2), shade(S.dark, 0.85)), cx, waterY, cz));
  } else far.push(place(paint(new THREE.CircleGeometry(span + 700, 24).rotateX(-Math.PI / 2), S.dark), cx, -FOUNDATION - 12, cz));
  const lm = dr.landmark;
  const toLm = Math.atan2(lm.x - cx, lm.z - cz);
  for (const [r0, r1, n, y, hMin, hMax, color] of [
    [span + 120, span + 220, 18, -60, 30, 65, S.dark],
    [span + 280, span + 460, 16, -55, 45, 95, S.mid],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
      // Keep the view toward the landmark open.
      if (Math.abs(Math.atan2(Math.sin(a - toLm), Math.cos(a - toLm))) < 0.2) continue;
      const r = rng.range(r0, r1);
      far.push(place(hillGeo(rng, rng.range(60, 120), rng.range(hMin, hMax), color), cx + Math.sin(a) * r, y, cz + Math.cos(a) * r));
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rng.range(-0.2, 0.2);
    if (Math.abs(Math.atan2(Math.sin(a - toLm), Math.cos(a - toLm))) < 0.25) continue;
    const r = span + rng.range(90, 220);
    if (dim.props.hero === 'pillar') far.push(place(pitPillarGeo(rng.range(50, 90), S.mid, S.dark, P.accentShade), cx + Math.sin(a) * r, -60 + rng.range(0, 12), cz + Math.cos(a) * r, 0, rng.range(0, 6.28), 0));
    else far.push(place(swordGeo(rng.range(40, 80), S.mid, S.dark), cx + Math.sin(a) * r, -40 + rng.range(0, 12), cz + Math.cos(a) * r, rng.range(-0.35, 0.35), rng.range(0, 6.28), rng.range(-0.2, 0.2)));
  }
  if (dim.landmark.kind === 'moon') {
    // The two towers, and the Moon low between them: unfogged, the light that leads on.
    mark.push(place(moonTowersGeo(lm.h, S.dark, S.shadow), lm.x, lm.y, lm.z));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(lm.h * MOON_R, 32), new THREE.MeshBasicMaterial({ color: P.accent, fog: false }));
    moon.position.set(lm.x, lm.y + lm.h, lm.z - 4);
    group.add(moon);
  } else if (dim.landmark.kind === 'tower') {
    mark.push(place(towerGeo(lm.h, S.light, S.dark, P.accent), lm.x, lm.y, lm.z));
    // Lightning in the storm over the break: an unfogged glow, the way up.
    const glow = new THREE.Mesh(flameGeo(lm.h * 0.05, 0xe8e4ff), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    glow.position.set(lm.x, lm.y + lm.h * (TOWER_GLOW - 0.17), lm.z);
    group.add(glow);
  } else if (dim.landmark.kind === 'pedestal') {
    // The Devil's pedestal rises out of the pit; its brazier burns with the lantern's warm light, the way down.
    mark.push(place(pedestalGeo(lm.h, S.mid, S.dark, P.accent, P.accentShade), lm.x, lm.y, lm.z));
    // The card's chains: great chains from the pedestal's crown out to the pit's rim beyond the rooms, sagging
    // into the fog. Every gallery of the descent is tethered to it.
    const rim = Math.max(...space.rooms.map((r) => Math.hypot(r.x - lm.x, r.z - lm.z))) + 70;
    const top = new THREE.Vector3(lm.x, lm.y + lm.h * 0.86, lm.z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const end = new THREE.Vector3(lm.x + Math.cos(a) * rim, lm.y + lm.h * rng.range(0.95, 1.1), lm.z + Math.sin(a) * rim);
      far.push(hungChainGeo(top, end, 7, 0.12, S.dark));
    }
    // The flame is a glow (FX), so it opts out of the fog: the warm point that leads down reads from every vista.
    const flame = new THREE.Mesh(flameGeo(lm.h * 0.07, GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    flame.position.set(lm.x, lm.y + lm.h * PEDESTAL_FLAME, lm.z + lm.h * PEDESTAL_BRAZIER_Z);
    group.add(flame);
  } else mark.push(place(scalesGeo(lm.h, S.dark, S.shadow, P.accent, P.accentShade), lm.x, lm.y, lm.z));

  // ---- merge into a few meshes: shadow casters, ground (receives only), far scenery (no shadows)
  group.add(meshOf(merge(solid), mat));
  const ground = meshOf(merge(flat), mat, false);
  group.add(ground);
  const distant = meshOf(merge(far), mat, false);
  distant.receiveShadow = false;
  group.add(distant);
  // The landmark: its own mesh, fogged lightly, so the shape (not just its glow) reads from every vista.
  const landmark = meshOf(merge(mark), landmarkMat(), false);
  landmark.receiveShadow = false;
  group.add(landmark);

  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const sp = dr.spawn;
  Object.assign(world, {
    generated: layout,
    report,
    dim,
    group,
    spawn: V(sp.x, sp.y + 0.05, sp.z),
    spawnYaw: sp.yaw,
    // Justice's enemies stand on the encounter sockets; the level's court card holds the throne room.
    foeSpots: layout.sockets.map((s) =>
      s.foe === 'miniboss'
        ? { id: dim.levels[layout.level]?.court ?? layout.script.miniboss, pos: V(s.x, s.y, s.z), yaw: s.yaw, idle: 'throne' as const }
        : { id: s.foe, pos: V(s.x, s.y, s.z), yaw: s.yaw, idle: s.template === 'ambush' ? ('ambush' as const) : s.kind === 'patrol' ? ('patrol' as const) : ('stand' as const), illusion: s.illusion },
    ),
    dummySpots: [],
    enemySpots: [],
    checkpoint: restPoints[0]?.pos ?? null,
    restLabel: 'the lantern',
    restPoints,
    interactables,
    bounds: b,
    decks,
    shortcutOpen: () => open,
    weighted,
    pans,
  });
  return world as LevelWorld;
}

function boxColor(b: Box) {
  switch (b.kind) {
    case 'half':
      return S.light;
    case 'full':
    case 'plinth':
    case 'weight':
      return S.mid;
    case 'tier':
      return shade(S.light, 0.95);
    default:
      return S.dark;
  }
}

/** A parapet (stone with a pale cap) or a wall (dark slate), turned to its room. */
function edgeGeo(b: Box, out: THREE.BufferGeometry[], staticBox: StaticBox) {
  if (b.h > COVER.full) {
    out.push(place(block(b.sx, b.h, b.sz, S.dark, 0.06, b.x + b.z), b.x, b.y, b.z, 0, b.yaw, 0));
  } else {
    out.push(place(block(b.sx, b.h - 0.16, b.sz, S.mid, 0.05, b.x + b.z), b.x, b.y, b.z, 0, b.yaw, 0));
    out.push(place(block(b.sx + 0.12, 0.16, b.sz + 0.12, S.light, 0.03), b.x, b.y + b.h - 0.16, b.z, 0, b.yaw, 0));
  }
  staticBox(b.x, b.y + b.h / 2, b.z, b.sx / 2, b.h / 2, b.sz / 2, yawQ(b.yaw));
}

/** Paved top: a slate bed with chalk flagstones (3 m), a few darker. In the room's own frame (centred, floor at 0). */
function flagTop(r: Room, rng: ReturnType<typeof makeRng>) {
  const out: THREE.BufferGeometry[] = [place(paint(new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2), S.dark), 0, 0.015, 0)];
  const T = 3;
  const nx = Math.max(1, Math.round(r.w / T));
  const nz = Math.max(1, Math.round(r.d / T));
  const tx = r.w / nx;
  const tz = r.d / nz;
  const light = new THREE.Color();
  const mid = new THREE.Color(S.mid);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const k = 0.92 + rng() * 0.1;
      const c = light.setHex(S.light).lerp(mid, rng() < 0.12 ? 0.35 : 0).multiplyScalar(k).getHex();
      out.push(place(paint(new THREE.PlaneGeometry(tx - 0.14, tz - 0.14).rotateX(-Math.PI / 2), c), -r.w / 2 + (i + 0.5) * tx, 0.03, -r.d / 2 + (j + 0.5) * tz));
    }
  }
  return out;
}

/** Earth top: wind-flattened grass in blotchy patches. In the room's own frame. */
function earthTop(r: Room) {
  const g = new THREE.PlaneGeometry(r.w, r.d, Math.max(1, Math.round(r.w / 3)), Math.max(1, Math.round(r.d / 3))).rotateX(-Math.PI / 2);
  return place(
    paintBy(prep(g, true), (p, out) => {
      const x = p.x + r.x;
      const z = p.z + r.z;
      const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.061);
      out.setHex(n > 0.5 ? S.light : S.growth).multiplyScalar(0.94 + (Math.abs(x * 13 + z * 7) % 1) * 0.08);
    }),
    0,
    0.02,
    0,
  );
}

type StaticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, q?: THREE.Quaternion) => void;
type StaticHull = (points: Float32Array) => void;

type StaticCylinder = (x: number, y: number, z: number, halfH: number, r: number) => void;

/**
 * A connector: each straight run a causeway (a deck with a slate rim on piers fading into the fog) or stairs, with
 * parapets both sides unless walled; where it turns, a round landing with a parapet ring broken where the runs meet
 * it.
 */
function connectorGeo(c: Connector, solid: THREE.BufferGeometry[], far: THREE.BufferGeometry[], staticBox: StaticBox, hull: StaticHull, cylinder: StaticCylinder) {
  const segs = segmentsOf(c);
  const R = landingRadius(c);
  const off = c.width / 2 + EDGE.thick / 2;
  // Where a run's parapet line meets the landing's ring: trim it back to there.
  const trim = Math.sqrt(Math.max(0, R * R - off * off));
  segs.forEach((g) => {
    const yaw = Math.atan2(g.bx - g.ax, g.bz - g.az);
    const q = yawQ(yaw);
    const mx = (g.ax + g.bx) / 2;
    const mz = (g.az + g.bz) / 2;
    const [ux, uz] = [(g.bx - g.ax) / g.len, (g.bz - g.az) / g.len];
    // The level stretch on a landing's disc: only its parapets, up to where they meet the ring.
    const t0 = g.landing === 'start' ? trim : 0;
    const t1 = g.landing === 'end' ? trim : 0;
    if (!g.landing && Math.abs(g.by - g.ay) > 0.05) {
      rampGeo(g.ax, g.az, g.ay, g.bx, g.bz, g.by, c.width, S.light, solid, staticBox, !c.walled, hull);
      far.push(place(block(c.width, FOUNDATION, g.len, S.dark, 0.06), mx, Math.min(g.ay, g.by) - FOUNDATION, mz, 0, yaw, 0));
      return;
    }
    const y = g.ay;
    if (!g.landing) {
      // Causeway: a deck with a slate rim, on piers that fade down into the fog.
      solid.push(place(block(c.width + 1.2, 1.0, g.len, S.mid, 0.05), mx, y - 1.0, mz, 0, yaw, 0));
      solid.push(place(paint(new THREE.PlaneGeometry(c.width, g.len).rotateX(-Math.PI / 2), S.light), mx, y + 0.02, mz, 0, yaw, 0));
      staticBox(mx, y - 0.5, mz, c.width / 2 + 0.6, 0.5, g.len / 2, q);
      const piers = Math.max(1, Math.floor(g.len / 12));
      for (let i = 0; i < piers; i++) {
        const t = (i + 0.5) / piers - 0.5;
        far.push(place(block(c.width * 0.7, FOUNDATION, 1.8, S.dark, 0.06), mx + ux * t * g.len, y - 1 - FOUNDATION, mz + uz * t * g.len, 0, yaw, 0));
      }
    }
    if (c.walled) return;
    const len = g.len - t0 - t1;
    if (len < 0.1) return;
    const cx = mx + (ux * (t0 - t1)) / 2;
    const cz = mz + (uz * (t0 - t1)) / 2;
    for (const s of [-1, 1]) {
      // Right of the run is (uz, -ux) in this frame (yaw from +Z).
      const px = cx + uz * s * off;
      const pz = cz - ux * s * off;
      solid.push(place(block(EDGE.thick, EDGE.parapet - 0.16, len, S.mid, 0.05), px, y, pz, 0, yaw, 0));
      solid.push(place(block(EDGE.thick + 0.12, 0.16, len + 0.12, S.light, 0.03), px, y + EDGE.parapet - 0.16, pz, 0, yaw, 0));
      staticBox(px, y + EDGE.parapet / 2, pz, EDGE.thick / 2, EDGE.parapet / 2, len / 2, q);
    }
  });
  // Landings: a round level platform where the way turns, its parapet ring open toward the runs either side.
  const F = landingFlat(c);
  const into = segs.filter((g) => g.landing === 'end');
  const outOf = segs.filter((g) => g.landing === 'start');
  c.bends.forEach((b, k) => {
    const a = into[k];
    const o = outOf[k];
    const y = a.by;
    solid.push(place(facet(new THREE.CylinderGeometry(F, F, 1.0, 12).translate(0, -0.5, 0), S.mid, 0.05), b.x, y, b.z));
    solid.push(place(paint(new THREE.CircleGeometry(F - 0.05, 12).rotateX(-Math.PI / 2), S.light), b.x, y + 0.025, b.z));
    cylinder(b.x, y - 0.5, b.z, 0.5, F);
    // Each run's deck carried in to the middle: the disc is round and the runs end square, which left a notch with
    // no floor beside the parapet where they met (she caught in it, cutting the corner).
    for (const g of [a, o]) {
      const gy = Math.atan2(g.bx - g.ax, g.bz - g.az);
      const mx = (g.ax + g.bx) / 2;
      const mz = (g.az + g.bz) / 2;
      solid.push(place(block(c.width, 1.0, g.len, S.mid, 0.05), mx, y - 1.0, mz, 0, gy, 0));
      staticBox(mx, y - 0.5, mz, c.width / 2, 0.5, g.len / 2, yawQ(gy));
    }
    far.push(place(block(R * 1.2, FOUNDATION, R * 1.2, S.dark, 0.06), b.x, y - 1 - FOUNDATION, b.z));
    // The openings: back along the run in, and along the run out (angles round the landing, in x/z).
    const opens = [Math.atan2(a.az - a.bz, a.ax - a.bx), Math.atan2(o.bz - o.az, o.bx - o.ax)];
    const gap = Math.asin(Math.min(1, (c.width / 2 + EDGE.thick) / R));
    const N = 14;
    for (let i = 0; i < N; i++) {
      const th = ((i + 0.5) / N) * Math.PI * 2;
      if (opens.some((op) => Math.abs(Math.atan2(Math.sin(th - op), Math.cos(th - op))) < gap + Math.PI / N)) continue;
      const rr = R - EDGE.thick / 2;
      const px = b.x + Math.cos(th) * rr;
      const pz = b.z + Math.sin(th) * rr;
      const chord = 2 * R * Math.sin(Math.PI / N) + 0.1;
      const ry = -th - Math.PI / 2;
      solid.push(place(block(chord, EDGE.parapet - 0.16, EDGE.thick, S.mid, 0.05), px, y, pz, 0, ry, 0));
      solid.push(place(block(chord + 0.12, 0.16, EDGE.thick + 0.12, S.light, 0.03), px, y + EDGE.parapet - 0.16, pz, 0, ry, 0));
      staticBox(px, y + EDGE.parapet / 2, pz, chord / 2, EDGE.parapet / 2, EDGE.thick / 2, yawQ(ry));
    }
  });
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The stairs' collider: a solid wedge from below the floor up to a smooth slope that runs from (x0, y0, z0) to
 * (x1, y1, z1). Solid like the stepped treads drawn over it: a thin tilted slab hung in the air above a gap near its
 * foot, and coming at it from the side, her feet slid under it and she wedged. Returns the hull's points.
 */
export function rampWedge(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, width: number) {
  const run = Math.hypot(x1 - x0, z1 - z0);
  const ux = (x1 - x0) / run;
  const uz = (z1 - z0) / run;
  // Across the stairs (either way: the hull doesn't care).
  const rx = -uz * (width / 2);
  const rz = ux * (width / 2);
  const lo = Math.min(y0, y1) - 0.4;
  const pts: number[] = [];
  for (const [x, z, y] of [
    [x0, z0, y0],
    [x1, z1, y1],
  ]) {
    for (const s of [-1, 1]) pts.push(x + rx * s, y, z + rz * s, x + rx * s, lo, z + rz * s);
  }
  return new Float32Array(pts);
}

/** Stairs: a smooth ramp collider under stepped treads, with sloped parapets (trimmed `t0`/`t1` short of landings). */
function rampGeo(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, width: number, color: number, solid: THREE.BufferGeometry[], staticBox: StaticBox, parapets: boolean, hull: StaticHull, t0 = 0, t1 = 0) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dy = y1 - y0;
  const run = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, run);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
  const up = UP.clone().applyQuaternion(q);
  hull(rampWedge(x0, z0, y0, x1, z1, y1, width));
  const steps = Math.max(2, Math.ceil(Math.abs(dy) / 0.3));
  const ux = dx / run;
  const uz = dz / run;
  const tread = run / steps;
  const lo = Math.min(y0, y1);
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const top = y0 + dy * t;
    const h = top - lo + 0.6;
    solid.push(place(block(width, h, tread + 0.02, shade(color, i % 2 ? 0.97 : 1), 0.03), x0 + ux * run * t, lo - 0.6, z0 + uz * run * t, 0, yaw, 0));
  }
  if (!parapets) return;
  // Trimmed along the run at either end (where it meets a landing's ring).
  const a = t0 / run;
  const b = 1 - t1 / run;
  if (b - a <= 0.01) return;
  const len = Math.hypot(run * (b - a), dy * (b - a));
  for (const s of [-1, 1]) {
    const off = width / 2 + EDGE.thick / 2;
    const m = (a + b) / 2;
    const px = x0 + dx * m + uz * s * off;
    const pz = z0 + dz * m - ux * s * off;
    const g = facet(new THREE.BoxGeometry(EDGE.thick, EDGE.parapet, len).translate(0, EDGE.parapet / 2, 0), S.mid, 0.05);
    const py = y0 + dy * m;
    _m.compose(_p.set(px, py, pz), q, _s.set(1, 1, 1));
    solid.push(place(g.applyMatrix4(_m), 0, 0, 0));
    const cc = new THREE.Vector3(px, py, pz).addScaledVector(up, EDGE.parapet / 2);
    staticBox(cc.x, cc.y, cc.z, EDGE.thick / 2, EDGE.parapet / 2, len / 2, q);
  }
}

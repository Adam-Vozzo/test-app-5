// Builds a generated level (src/world/gen-level.ts) into meshes and colliders with the faceted kit. Everything the
// generator decided arrives as plain records; this file only turns them into stone. Rooms are platforms over a
// fog-filled drop, joined by causeways and stairs; parapets and walls bound them.
import * as THREE from 'three';
import { makeRng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { merge, meshOf, paint, paintBy, place, prep, toonMat } from '../render/geo';
import { AREAS, GEAR, JUSTICE } from '../render/palette';
import type { BuiltWorld, Interactable, RestPoint } from './arena';
import { glowPool } from './courtyard';
import type { DimensionDef } from './dimensions';
import { COVER, EDGE, type Box, type Hoard } from './gen-dress';
import { Decks } from './decks';
import { tuning } from '../tuning';
import { DEVIL_FOES } from '../render/palette';
import type { LevelLayout, LevelReport } from './gen-level';
import { connLength, DX, DZ, type Connector, type Room } from './gen-space';
import { block, columnGeo, facet, flameGeo, gateGeo, grassTuftGeo, hillGeo, hoardGeo, hoardTellGeo, MOON_R, moonTowersGeo, reedGeo, rubbleGeo, TOWER_GLOW, towerGeo, LANTERN_GLASS, lanternGlassGeo, lanternPostGeo, PEDESTAL_BRAZIER_Z, PEDESTAL_FLAME, pedestalGeo, pitPillarGeo, scalesGeo, shade, swordGeo } from './kit';

/** The surfaces of the dimension being built (set at the top of buildLevel; the helpers below read it). */
let S = JUSTICE.surfaces;
/** How far the platforms' foundations reach down into the fog. */
const FOUNDATION = 34;

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

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
  const { space, furn, dressing: dr } = layout;

  const staticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, q?: THREE.Quaternion) => {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
    if (q) d.setRotation(q);
    physics.addStatic(d);
  };
  /** A world-aligned box standing on y, with a collider. */
  const box = (x: number, z: number, y: number, sx: number, sz: number, h: number, color: number, list = solid) => {
    list.push(place(block(sx, h, sz, color, 0.05, x * 7 + z), x, y, z));
    staticBox(x, y + h / 2, z, sx / 2, h / 2, sz / 2);
  };

  // ---- rooms: a platform (stone foundation into the fog) with a paved or earth top
  for (const r of space.rooms) {
    const kit = dim.kits[r.kit];
    if (kit.scaffold) {
      // Timber decks over the drop (the decks themselves are built below): a frame of beams and stilts into the fog.
      for (const [dx, dz, sx, sz] of [[0, -r.sz / 2, r.sx + 0.6, 0.5], [0, r.sz / 2, r.sx + 0.6, 0.5], [-r.sx / 2, 0, 0.5, r.sz], [r.sx / 2, 0, 0.5, r.sz]] as const) {
        solid.push(place(block(sx, 0.5, sz, S.dark, 0.05), r.x + dx, r.y - 0.8, r.z + dz));
      }
      for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) far.push(place(block(0.5, FOUNDATION, 0.5, S.dark, 0.06), r.x - r.sx / 2 + (r.sx * i) / 2, r.y - 0.8 - FOUNDATION, r.z - r.sz / 2 + (r.sz * j) / 2));
      continue;
    }
    far.push(place(facet(new THREE.BoxGeometry(r.sx + 1.2, FOUNDATION, r.sz + 1.2).translate(0, -FOUNDATION / 2, 0), S.dark, 0.06, r.node), r.x, r.y - 0.02, r.z));
    staticBox(r.x, r.y - 1, r.z, r.sx / 2, 1, r.sz / 2);
    if (kit.ground === 'earth') flat.push(earthTop(r));
    else flat.push(...flagTop(r, rng));
  }
  // The Tower's decks: one instanced draw per scaffold room, a collider per deck.
  const decks = dr.scaffolds.length ? new Decks(dr.scaffolds, physics, P) : null;
  if (decks) group.add(decks.group);

  // ---- connectors: causeway decks on piers, or stairs; parapets both sides unless walled
  // The Moon's false paths: the boardwalk is drawn, but it casts no shadow on the water and nothing holds you up.
  const noBox: StaticBox = () => {};
  space.connectors.forEach((c, i) => (dr.falsePaths.includes(i) ? connectorGeo(c, far, far, noBox) : connectorGeo(c, solid, far, staticBox)));

  // ---- kit structure: edges, cover, tiers, dividers, connector walls
  for (const b of furn.boxes) {
    if (b.kind === 'edge') edgeGeo(b, solid, staticBox);
    else box(b.x, b.z, b.y, b.sx, b.sz, b.h, boxColor(b));
    if (b.kind === 'plinth') {
      if (hoards) solid.push(place(hoardGeo(1.1, P.accent, P.accentShade, S.dark, b.x), b.x, b.y + b.h, b.z, 0, rng.range(0, Math.PI), 0));
      else solid.push(place(swordGeo(3.2, S.light, S.shadow), b.x, b.y + b.h, b.z, 0.06, rng.range(0, Math.PI), 0.05));
    }
  }
  for (const rp of furn.ramps) rampGeo(rp.x0, rp.z0, rp.y0, rp.x1, rp.z1, rp.y1, rp.width, S.light, solid, staticBox, false);
  // Columns, with an entablature over neighbours in the same row.
  for (const c of furn.columns) {
    solid.push(place(columnGeo(1.0, c.h, S.mid, S.light), c.x, c.y, c.z));
    staticBox(c.x, c.y + c.h / 2, c.z, 0.62, c.h / 2, 0.62);
  }
  const cols = furn.columns;
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i];
      const b = cols[j];
      if (a.node !== b.node) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      // Only the next column along the same row (shared x or z), close enough to span.
      if (d > 9 || (Math.abs(dx) > 0.01 && Math.abs(dz) > 0.01)) continue;
      const between = cols.some((k, n) => n !== i && n !== j && k.node === a.node && Math.hypot(k.x - a.x, k.z - a.z) < d && Math.hypot(k.x - b.x, k.z - b.z) < d && (Math.abs(k.x - a.x) < 0.01 || Math.abs(k.z - a.z) < 0.01));
      if (between) continue;
      const along = Math.abs(dx) > 0.01;
      solid.push(place(block(along ? d + 1.3 : 1.3, 0.7, along ? 1.3 : d + 1.3, S.light), (a.x + b.x) / 2, a.y + a.h, (a.z + b.z) / 2));
    }
  }

  // ---- arches: the dark foreground frames of compression connectors
  for (const a of dr.arches) {
    const rotY = a.dir % 2 === 0 ? 0 : Math.PI / 2;
    solid.push(place(gateGeo(a.width, a.height, 1.6, 2, S.shadow, shade(S.shadow, 1.3)), a.x, a.y, a.z, 0, rotY, 0));
    for (const s of [-1, 1]) {
      const off = a.width / 2 + 1;
      staticBox(a.x + (a.dir % 2 === 0 ? s * off : 0), a.y + a.height / 2, a.z + (a.dir % 2 === 0 ? 0 : s * off), a.dir % 2 === 0 ? 1 : 0.8, a.height / 2, a.dir % 2 === 0 ? 0.8 : 1);
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

  // ---- the shortcut: a portcullis in the gate-side arch, lifted only from the gate's side
  const door = dr.door;
  const dirX = DX[door.opensFrom];
  const dirZ = DZ[door.opensFrom];
  const ns = door.dir % 2 === 0;
  const bars = new THREE.Group();
  const barGeo: THREE.BufferGeometry[] = [];
  const doorH = 6;
  for (let t = -door.width / 2 + 0.35; t < door.width / 2; t += 0.7) barGeo.push(place(block(0.14, doorH, 0.14, GEAR.metalDark, 0.04), ns ? t : 0, 0, ns ? 0 : t));
  for (const y of [1.2, 3.4, 5.4]) barGeo.push(place(block(ns ? door.width : 0.16, 0.16, ns ? 0.16 : door.width, GEAR.metalDark, 0.04), 0, y, 0));
  bars.add(meshOf(merge(barGeo), mat));
  bars.position.set(door.x, door.y, door.z);
  group.add(bars);
  const doorCol = physics.addStatic(RAPIER.ColliderDesc.cuboid(ns ? door.width / 2 : 0.3, doorH / 2, ns ? 0.3 : door.width / 2).setTranslation(door.x, door.y + doorH / 2, door.z));
  let open = false;
  let lift = 0;
  const doorPos = new THREE.Vector3(door.x, door.y, door.z);
  const gateSide = (p: THREE.Vector3) => (p.x - door.x) * dirX + (p.z - door.z) * dirZ > 0.2;
  interactables.push({
    pos: doorPos,
    radius: 3.6,
    prompt: (p) => (open ? null : gateSide(p) ? 'E: lift the bars (a shortcut)' : 'Barred from the other side'),
    usable: (p) => !open && gateSide(p),
    use: () => {
      open = true;
      physics.removeCollider(doorCol);
      return 'The bars lift. A way back to the lantern.';
    },
    update: (dt) => {
      if (!open || lift >= 1) return;
      lift = Math.min(1, lift + dt / 1.4);
      bars.position.y = door.y + (1 - (1 - lift) ** 3) * (doorH - 0.6);
      bars.updateMatrix();
    },
  });

  // ---- the exit: a tall gate in the far edge, veiled in warm light, toward the landmark
  const ex = dr.exit;
  const exRot = ex.dir % 2 === 0 ? 0 : Math.PI / 2;
  solid.push(place(gateGeo(ex.width, 8, 1.8, 2.2, S.dark, shade(S.dark, 1.3)), ex.x, ex.y, ex.z, 0, exRot, 0));
  for (const s of [-1, 1]) {
    const off = ex.width / 2 + 1.1;
    staticBox(ex.x + (ex.dir % 2 === 0 ? s * off : 0), ex.y + 4, ex.z + (ex.dir % 2 === 0 ? 0 : s * off), ex.dir % 2 === 0 ? 1.1 : 0.9, 4, ex.dir % 2 === 0 ? 0.9 : 1.1);
  }
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(ex.width, 8),
    new THREE.MeshBasicMaterial({ color: GEAR.lantern, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  veil.position.set(ex.x, ex.y + 4, ex.z);
  veil.rotation.y = exRot;
  group.add(veil);
  staticBox(ex.x, ex.y + 4, ex.z, ex.dir % 2 === 0 ? ex.width / 2 : 0.3, 4, ex.dir % 2 === 0 ? 0.3 : ex.width / 2);
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
    far.push(place(moonTowersGeo(lm.h, S.dark, S.shadow), lm.x, lm.y, lm.z));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(lm.h * MOON_R, 32), new THREE.MeshBasicMaterial({ color: P.accent, fog: false }));
    moon.position.set(lm.x, lm.y + lm.h, lm.z - 4);
    group.add(moon);
  } else if (dim.landmark.kind === 'tower') {
    far.push(place(towerGeo(lm.h, S.light, S.dark, P.accent), lm.x, lm.y, lm.z));
    // Lightning in the storm over the break: an unfogged glow, the way up.
    const glow = new THREE.Mesh(flameGeo(lm.h * 0.05, 0xe8e4ff), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    glow.position.set(lm.x, lm.y + lm.h * (TOWER_GLOW - 0.17), lm.z);
    group.add(glow);
  } else if (dim.landmark.kind === 'pedestal') {
    // The Devil's pedestal rises out of the pit; its brazier burns with the lantern's warm light, the way down.
    far.push(place(pedestalGeo(lm.h, S.mid, S.dark, P.accent, P.accentShade), lm.x, lm.y, lm.z));
    // The flame is a glow (FX), so it opts out of the fog: the warm point that leads down reads from every vista.
    const flame = new THREE.Mesh(flameGeo(lm.h * 0.07, GEAR.lantern), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    flame.position.set(lm.x, lm.y + lm.h * PEDESTAL_FLAME, lm.z + lm.h * PEDESTAL_BRAZIER_Z);
    group.add(flame);
  } else far.push(place(scalesGeo(lm.h, S.dark, S.shadow, P.accent, P.accentShade), lm.x, lm.y, lm.z));

  // ---- merge into a few meshes: shadow casters, ground (receives only), far scenery (no shadows)
  group.add(meshOf(merge(solid), mat));
  const ground = meshOf(merge(flat), mat, false);
  group.add(ground);
  const distant = meshOf(merge(far), mat, false);
  distant.receiveShadow = false;
  group.add(distant);

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
  });
  return world as LevelWorld;
}

function boxColor(b: Box) {
  switch (b.kind) {
    case 'half':
      return S.light;
    case 'full':
    case 'plinth':
      return S.mid;
    case 'tier':
      return shade(S.light, 0.95);
    default:
      return S.dark;
  }
}

/** A parapet (stone with a pale cap) or a wall (dark slate). */
function edgeGeo(b: Box, out: THREE.BufferGeometry[], staticBox: (x: number, y: number, z: number, hx: number, hy: number, hz: number) => void) {
  if (b.h > COVER.full) {
    out.push(place(block(b.sx, b.h, b.sz, S.dark, 0.06, b.x + b.z), b.x, b.y, b.z));
  } else {
    out.push(place(block(b.sx, b.h - 0.16, b.sz, S.mid, 0.05, b.x + b.z), b.x, b.y, b.z));
    out.push(place(block(b.sx + 0.12, 0.16, b.sz + 0.12, S.light, 0.03), b.x, b.y + b.h - 0.16, b.z));
  }
  staticBox(b.x, b.y + b.h / 2, b.z, b.sx / 2, b.h / 2, b.sz / 2);
}

/** Paved top: a slate bed with chalk flagstones (3 m), a few darker. */
function flagTop(r: Room, rng: ReturnType<typeof makeRng>) {
  const out: THREE.BufferGeometry[] = [place(paint(new THREE.PlaneGeometry(r.sx, r.sz).rotateX(-Math.PI / 2), S.dark), r.x, r.y + 0.015, r.z)];
  const T = 3;
  const nx = Math.max(1, Math.round(r.sx / T));
  const nz = Math.max(1, Math.round(r.sz / T));
  const tx = r.sx / nx;
  const tz = r.sz / nz;
  const light = new THREE.Color();
  const mid = new THREE.Color(S.mid);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const k = 0.92 + rng() * 0.1;
      const c = light.setHex(S.light).lerp(mid, rng() < 0.12 ? 0.35 : 0).multiplyScalar(k).getHex();
      out.push(place(paint(new THREE.PlaneGeometry(tx - 0.14, tz - 0.14).rotateX(-Math.PI / 2), c), r.x - r.sx / 2 + (i + 0.5) * tx, r.y + 0.03, r.z - r.sz / 2 + (j + 0.5) * tz));
    }
  }
  return out;
}

/** Earth top: wind-flattened grass in blotchy patches. */
function earthTop(r: Room) {
  const g = new THREE.PlaneGeometry(r.sx, r.sz, Math.max(1, Math.round(r.sx / 3)), Math.max(1, Math.round(r.sz / 3))).rotateX(-Math.PI / 2);
  return place(
    paintBy(prep(g, true), (p, out) => {
      const x = p.x + r.x;
      const z = p.z + r.z;
      const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.061);
      out.setHex(n > 0.5 ? S.light : S.growth).multiplyScalar(0.94 + (Math.abs(x * 13 + z * 7) % 1) * 0.08);
    }),
    r.x,
    r.y + 0.02,
    r.z,
  );
}

type StaticBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, q?: THREE.Quaternion) => void;

function connectorGeo(c: Connector, solid: THREE.BufferGeometry[], far: THREE.BufferGeometry[], staticBox: StaticBox) {
  const len = connLength(c);
  const ns = c.dir % 2 === 0;
  const mx = (c.ax + c.bx) / 2;
  const mz = (c.az + c.bz) / 2;
  if (Math.abs(c.y1 - c.y0) > 0.05) {
    rampGeo(c.ax, c.az, c.y0, c.bx, c.bz, c.y1, c.width, S.light, solid, staticBox, !c.walled);
    far.push(place(block(ns ? c.width : len, FOUNDATION, ns ? len : c.width, S.dark, 0.06), mx, Math.min(c.y0, c.y1) - FOUNDATION, mz));
    return;
  }
  // Causeway: a deck with a slate rim, on piers that fade down into the fog.
  const y = c.y0;
  solid.push(place(block(ns ? c.width + 1.2 : len, 1.0, ns ? len : c.width + 1.2, S.mid, 0.05), mx, y - 1.0, mz));
  solid.push(place(paint(new THREE.PlaneGeometry(ns ? c.width : len, ns ? len : c.width).rotateX(-Math.PI / 2), S.light), mx, y + 0.02, mz));
  staticBox(mx, y - 0.5, mz, ns ? c.width / 2 + 0.6 : len / 2, 0.5, ns ? len / 2 : c.width / 2 + 0.6);
  const piers = Math.max(1, Math.floor(len / 12));
  for (let i = 0; i < piers; i++) {
    const t = (i + 0.5) / piers - 0.5;
    far.push(place(block(ns ? c.width * 0.7 : 1.8, FOUNDATION, ns ? 1.8 : c.width * 0.7, S.dark, 0.06), mx + (ns ? 0 : t * len), y - 1 - FOUNDATION, mz + (ns ? t * len : 0)));
  }
  if (c.walled) return;
  for (const s of [-1, 1]) {
    const off = c.width / 2 + EDGE.thick / 2;
    const px = mx + (ns ? s * off : 0);
    const pz = mz + (ns ? 0 : s * off);
    const sx = ns ? EDGE.thick : len;
    const sz = ns ? len : EDGE.thick;
    solid.push(place(block(sx, EDGE.parapet - 0.16, sz, S.mid, 0.05), px, y, pz));
    solid.push(place(block(sx + 0.12, 0.16, sz + 0.12, S.light, 0.03), px, y + EDGE.parapet - 0.16, pz));
    staticBox(px, y + EDGE.parapet / 2, pz, sx / 2, EDGE.parapet / 2, sz / 2);
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/** Stairs: a smooth ramp collider under stepped treads, with sloped parapets. */
function rampGeo(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, width: number, color: number, solid: THREE.BufferGeometry[], staticBox: StaticBox, parapets: boolean) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dy = y1 - y0;
  const run = Math.hypot(dx, dz);
  const len = Math.hypot(run, dy);
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, run);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
  const up = UP.clone().applyQuaternion(q);
  // The collider's top face lies on the line from start to end; it reaches a little into the rooms.
  const c = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).addScaledVector(up, -0.2);
  staticBox(c.x, c.y, c.z, width / 2, 0.2, len / 2 + 0.3, q);
  const steps = Math.max(2, Math.ceil(Math.abs(dy) / 0.3));
  const ux = dx / run;
  const uz = dz / run;
  const tread = run / steps;
  const lo = Math.min(y0, y1);
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const top = y0 + dy * t;
    const h = top - lo + 0.6;
    const ns = Math.abs(uz) > Math.abs(ux);
    solid.push(place(block(ns ? width : tread + 0.02, h, ns ? tread + 0.02 : width, shade(color, i % 2 ? 0.97 : 1), 0.03), x0 + ux * run * t, lo - 0.6, z0 + uz * run * t));
  }
  if (!parapets) return;
  for (const s of [-1, 1]) {
    const off = width / 2 + EDGE.thick / 2;
    const px = (x0 + x1) / 2 + uz * s * off;
    const pz = (z0 + z1) / 2 - ux * s * off;
    const g = facet(new THREE.BoxGeometry(EDGE.thick, EDGE.parapet, len).translate(0, EDGE.parapet / 2, 0), S.mid, 0.05);
    const py = (y0 + y1) / 2;
    _m.compose(_p.set(px, py, pz), q, _s.set(1, 1, 1));
    solid.push(place(g.applyMatrix4(_m), 0, 0, 0));
    const cc = new THREE.Vector3(px, py, pz).addScaledVector(up, EDGE.parapet / 2);
    staticBox(cc.x, cc.y, cc.z, EDGE.thick / 2, EDGE.parapet / 2, len / 2, q);
  }
}

// Procedural bug-scale props. Each generator returns geometry (vertex-coloured) plus collider shapes.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { jitter, merge, paint, paintBy, place, prep, stripe } from '../render/geo';
import { PROPS, type BiomePalette } from '../render/palette';

/** Grass blade "tree": tapered, gently bent, striped, with a dark root collar. Unit height, base radius 1. */
/** `rows` trades detail for triangles: walls far from the path use the low-detail version. */
export function grassBladeGeo(p: BiomePalette, rng: Rng, rows = 20): THREE.BufferGeometry {
  const h = 1;
  const g = new THREE.CylinderGeometry(0.28, 1, h, rows > 12 ? 6 : 5, rows, true).translate(0, h / 2, 0);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const bend = rng.range(0.6, 1.8);
  const bendDir = rng.range(0, Math.PI * 2);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = y * y * bend;
    pos.setX(i, pos.getX(i) + Math.cos(bendDir) * k);
    pos.setZ(i, pos.getZ(i) + Math.sin(bendDir) * k);
  }
  // One stripe band per two rows (high detail) or per row (low detail) keeps bands crisp either way.
  const stalk = stripe(g, p.stalk, p.stalkStripe, rows > 12 ? 0.1 : 1 / rows, { wobble: rows > 12 ? 0.35 : 0.15, phase: rng.range(0, 6), freq: 2 });
  const collar = paint(new THREE.CylinderGeometry(1.15, 1.45, 0.06, 7, 1).translate(0, 0.03, 0), p.collar);
  return merge([stalk, collar]);
}

/** Pebble "boulder": jittered icosahedron, flat-shaded, lighter on top. Unit radius. */
export function pebbleGeo(p: BiomePalette, rng: Rng): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  jitter(g, rng, 0.14);
  const flat = prep(g, true);
  const a = new THREE.Color(p.pebbleA);
  const b = new THREE.Color(p.pebbleB);
  const t = rng.range(0.1, 0.45);
  return paintBy(flat, (v, out) => out.copy(v.y > t ? b : a));
}

/** Matchstick: long box with a red head. Length along X, centred, bottom at y=0. */
export function matchstickGeo(len: number, w: number): THREE.BufferGeometry {
  const stick = stripe(new THREE.BoxGeometry(len, w, w * 1.1, 24, 1, 1).translate(0, w / 2, 0), PROPS.wood, PROPS.woodDark, 0.9, {
    axis: 'x',
    wobble: 0.15,
  });
  const head = paint(new THREE.IcosahedronGeometry(w * 0.95, 1).scale(1.5, 1, 1.1).translate(len / 2 + w * 0.6, w * 0.55, 0), PROPS.matchHead);
  return merge([stick, prep(head, true)]);
}

/** Sewing button: a short cylinder with four holes suggested by dark dots. Unit radius, given height. */
export function buttonGeo(color: number, rim: number, h: number): THREE.BufferGeometry {
  const body = paint(new THREE.CylinderGeometry(1, 1, h, 18, 1).translate(0, h / 2, 0), color);
  const lip = paint(new THREE.TorusGeometry(0.92, 0.07, 4, 18).rotateX(Math.PI / 2).translate(0, h, 0), rim);
  const holes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    holes.push(place(paint(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 6), rim), Math.cos(a) * 0.28, h + 0.005, Math.sin(a) * 0.28));
  }
  return merge([body, lip, ...holes]);
}

/** Fallen leaf: flattened, cupped ellipse with vein stripes. Length along X. */
export function leafGeo(p: BiomePalette, len: number, wid: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(1, 20, 0, Math.PI * 2).rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // pointed tip at +x, cupped edges
    const taper = 1 - Math.max(0, x) * 0.45;
    pos.setXYZ(i, x * len * 0.5, (z * z) * 0.35 + Math.abs(x) * 0.08, z * wid * 0.5 * taper);
  }
  const top = paintBy(prep(g), (v, out) => {
    const vein = Math.abs(v.z) < 0.18 || Math.floor((v.x * 0.9 + Math.abs(v.z) * 1.2) / 0.9) % 2 === 0;
    out.setHex(vein ? p.leafB : p.leafA);
  });
  const thick = paint(g.clone().translate(0, -0.08, 0), p.leafB);
  // flip winding of the underside so it is visible from below
  const idx = thick.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < idx.count; i += 3) {
    const x = idx.getX(i + 1), y = idx.getY(i + 1), z = idx.getZ(i + 1);
    idx.setXYZ(i + 1, idx.getX(i + 2), idx.getY(i + 2), idx.getZ(i + 2));
    idx.setXYZ(i + 2, x, y, z);
  }
  thick.computeVertexNormals();
  return merge([top, thick]);
}

/** Bottle cap arena: a crimped rim of segments with a gap for an entrance. Returns geo + segment transforms. */
export function bottleCapGeo(radius: number, height: number, segments: number, gapSegs: number) {
  const parts: THREE.BufferGeometry[] = [];
  const walls: { x: number; z: number; rot: number; w: number; d: number; h: number }[] = [];
  const thick = 0.7;
  const segW = ((Math.PI * 2 * radius) / segments) * 1.02;
  for (let i = 0; i < segments; i++) {
    if (i < gapSegs) continue;
    const a = (i / segments) * Math.PI * 2;
    const crimp = i % 2 === 0 ? 1 : 0.88;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const col = i % 2 === 0 ? 0xc2463f : 0xa8393a;
    parts.push(place(paint(new THREE.BoxGeometry(thick, height * crimp, segW), col), x, (height * crimp) / 2, z, 0, -a, 0));
    walls.push({ x, z, rot: -a, w: thick, d: segW, h: height * crimp });
  }
  const floor = stripe(new THREE.CylinderGeometry(radius, radius, 0.12, 40, 1).translate(0, 0.06, 0), PROPS.metal, PROPS.metalDark, 3.5, {
    axis: 'x',
    wobble: 0.6,
    freq: 0.2,
  });
  parts.push(floor);
  return { geo: merge(parts), walls };
}

/** Sugar cube: slightly bevelled-looking cube with a shaded side. Unit size, bottom at 0. */
export function sugarCubeGeo(rng: Rng): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3).translate(0, 0.5, 0);
  jitter(g, rng, 0.03);
  const a = new THREE.Color(PROPS.sugar);
  const b = new THREE.Color(PROPS.sugarShade);
  return paintBy(prep(g, true), (v, out) => out.copy((Math.floor(v.x * 6) + Math.floor(v.y * 6) + Math.floor(v.z * 6)) % 3 === 0 ? b : a));
}

/** Bread crumb: chunky jittered lump, crust outside and pale crumb on the broken face. Unit size. */
export function crumbGeo(rng: Rng): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0).scale(1.2, 0.75, 0.9);
  jitter(g, rng, 0.22);
  const crust = new THREE.Color(0xb5834f);
  const inner = new THREE.Color(0xfcd985);
  const cut = rng.range(-0.2, 0.3);
  return paintBy(prep(g, true), (v, out) => out.copy(v.y > cut && v.x > -0.2 ? inner : crust));
}

/** Cardboard box with a printed band: a wall block for the kitchen. Unit cube, bottom at 0. */
export function boxGeo(rng: Rng): THREE.BufferGeometry {
  const card = 0xb48a5a;
  const band = rng.pick([0x5a7fa8, 0xc9a24e, 0x7a9a5a]);
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 6, 1).translate(0, 0.5, 0);
  const a = new THREE.Color(card);
  const b = new THREE.Color(band);
  const lo = rng.range(0.3, 0.5);
  return paintBy(prep(g, true), (v, out) => out.copy(v.y > lo && v.y < lo + 0.25 ? b : a));
}

/** Chair / table leg: a tall wooden post rising into the dark, with a felt foot. Unit radius, given height. */
export function chairLegGeo(h: number): THREE.BufferGeometry {
  const post = stripe(new THREE.CylinderGeometry(0.85, 1, h, 10, Math.max(2, Math.round(h / 3))).translate(0, h / 2, 0), PROPS.woodDark, 0x93613a, 2.2, {
    wobble: 0.1,
  });
  const foot = paint(new THREE.CylinderGeometry(1.15, 1.2, 0.35, 12).translate(0, 0.17, 0), 0x4f4a58);
  return merge([post, foot]);
}

/** A dropped garden trowel: steel blade with a raised spine and a wooden handle. Length along +X. */
export function trowelGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -4.2);
  shape.quadraticCurveTo(9, -4.6, 17, 0);
  shape.quadraticCurveTo(9, 4.6, 0, 4.2);
  shape.lineTo(0, -4.2);
  const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false, curveSegments: 8 }).rotateX(Math.PI / 2).translate(0, 0.35, 0);
  const steel = paintBy(prep(blade, true), (v, out) => out.setHex(Math.floor(v.x / 2.2) % 2 === 0 ? PROPS.metal : 0xc2c8bd));
  const spine = paint(new THREE.BoxGeometry(15, 0.5, 0.7).translate(7.5, 0.55, 0), PROPS.metalDark);
  const neck = paint(new THREE.CylinderGeometry(0.45, 0.6, 3, 8).rotateZ(Math.PI / 2).translate(-1.5, 0.7, 0), PROPS.metalDark);
  const handle = stripe(new THREE.CylinderGeometry(1.1, 1.3, 11, 10, 6).rotateZ(Math.PI / 2).translate(-8.5, 1.2, 0), PROPS.wood, PROPS.woodDark, 1.8, {
    axis: 'x',
  });
  return merge([steel, spine, neck, handle]);
}

/** A fallen fork: flat handle and four tines, lying on the tiles. Length along +X, ~52 units. */
export function forkGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const steel = (g: THREE.BufferGeometry) => stripe(g, PROPS.metal, 0xc2c8bd, 2.5, { axis: 'x' });
  parts.push(steel(new THREE.BoxGeometry(30, 0.8, 3.2, 12, 1, 1).translate(-15, 0.4, 0)));
  parts.push(steel(new THREE.BoxGeometry(6, 0.8, 4.4, 3, 1, 1).translate(3, 0.4, 0)));
  for (let i = 0; i < 4; i++) {
    const z = -1.65 + i * 1.1;
    parts.push(steel(new THREE.BoxGeometry(15, 0.8, 0.6, 6, 1, 1).translate(13.5, 0.4, z)));
  }
  return merge(parts);
}

/** Pollen cache: a closed bud that blooms open; returns petals + gold centre separately. */
export function flowerParts(): { petals: THREE.BufferGeometry; heart: THREE.BufferGeometry; stem: THREE.BufferGeometry } {
  const petal = new THREE.SphereGeometry(1, 8, 6).scale(0.7, 0.15, 1.6).translate(0, 0, 1.4);
  const petals: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const g = paint(petal.clone(), i % 2 ? 0xf3c6d9 : 0xf7d9e6);
    petals.push(transformedRot(g, (i / 7) * Math.PI * 2));
  }
  const heart = paint(new THREE.IcosahedronGeometry(0.9, 1), 0xffe14d);
  const stem = paint(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6).translate(0, 1.1, 0), 0x7fa65a);
  return { petals: merge(petals), heart: prep(heart), stem };
}

function transformedRot(g: THREE.BufferGeometry, yaw: number) {
  return place(g, 0, 0, 0, 0, yaw, 0);
}

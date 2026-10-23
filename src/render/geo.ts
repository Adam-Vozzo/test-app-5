// Geometry helpers: primitives with vertex colours, stripes, merging. All props are built here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../core/rng';

const _c = new THREE.Color();
const _v = new THREE.Vector3();

/** Strip to position/normal/color, non-indexed, so everything merges. */
export function prep(geo: THREE.BufferGeometry, flat = false): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (flat) g.computeVertexNormals();
  if (!g.getAttribute('color')) {
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  return g;
}

/** Fill a geometry's vertex colours with one colour. */
export function paint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = prep(geo);
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  _c.setHex(color);
  for (let i = 0; i < col.count; i++) col.setXYZ(i, _c.r, _c.g, _c.b);
  return g;
}

/** Per-vertex paint from a function of the (local) vertex position. */
export function paintBy(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3, out: THREE.Color) => void) {
  const g = prep(geo);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  // Colour per triangle (using the centroid) so stripes stay crisp and flat like the reference.
  for (let i = 0; i < pos.count; i += 3) {
    _v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) _v.x += pos.getX(i + k) / 3;
    for (let k = 0; k < 3; k++) _v.y += pos.getY(i + k) / 3;
    for (let k = 0; k < 3; k++) _v.z += pos.getZ(i + k) / 3;
    fn(_v, _c);
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, _c.r, _c.g, _c.b);
  }
  return g;
}

/** Wobbly horizontal bands of two colours along an axis: the reference's signature stripe. */
export function stripe(
  geo: THREE.BufferGeometry,
  a: number,
  b: number,
  band: number,
  opts: { axis?: 'x' | 'y' | 'z'; wobble?: number; phase?: number; freq?: number } = {},
) {
  const axis = opts.axis ?? 'y';
  const wob = opts.wobble ?? 0;
  const phase = opts.phase ?? 0;
  const freq = opts.freq ?? 3;
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return paintBy(geo, (p, out) => {
    const across = axis === 'y' ? Math.atan2(p.z, p.x) : p.y;
    const t = p[axis] / band + Math.sin(across * freq + phase) * wob;
    out.copy(Math.floor(t) % 2 === 0 ? ca : cb);
  });
}

export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(geos.map((x) => prep(x)), false);
  if (!g) throw new Error('mergeGeometries failed');
  return g;
}

/** Returns a transformed copy. Never mutates `geo` (callers reuse a part via `place(part.clone(), …)`). */
export function transformed(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = prep(geo);
  return (g === geo ? g.clone() : g).applyMatrix4(m);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
export function place(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = sx,
  sz = sx,
): THREE.BufferGeometry {
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  return transformed(geo, _m);
}

/** Jitter vertices of a low-poly rock so instances don't look identical. Keeps faces flat. */
export function jitter(g: THREE.BufferGeometry, rng: Rng, amount: number) {
  // Displacement is keyed by position, so coincident vertices move together and the mesh stays watertight.
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = seen.get(key);
    if (!d) {
      d = [rng.signed() * amount, rng.signed() * amount, rng.signed() * amount];
      seen.set(key, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  return g;
}

let gradient: THREE.DataTexture | null = null;
/** Generated 4-step toon ramp (the posterised banding in STYLE.md). */
export function toonRamp(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([70, 140, 205, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMat(opts: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), ...opts });
}

export function meshOf(geo: THREE.BufferGeometry, mat: THREE.Material, shadows = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

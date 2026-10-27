// v2 faceted prop kit (STYLE.md → blocky, faceted forms): boxes, low-segment cylinders and lumps with flat
// faces and a little per-face value jitter, so surfaces read as hewn rather than smooth. All sizes in metres.
// Each function returns geometry in its own local frame (base at y = 0 unless noted).
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { merge, paint, paintBy, place, prep, transformed } from '../render/geo';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

/** A thin bar from `from` to `to` (chains, rods). */
export function bar(from: THREE.Vector3, to: THREE.Vector3, thick: number, color: number) {
  _d.subVectors(to, from);
  const len = _d.length();
  _q.setFromUnitVectors(_up, _d.normalize());
  _m.compose(_a.copy(from), _q, _one);
  return transformed(block(thick, len, thick, color, 0), _m);
}

/** Flat colour with a per-face value wobble keyed by face position, so merged copies don't all match. */
export function facet(geo: THREE.BufferGeometry, color: number, wobble = 0.05, seed = 0): THREE.BufferGeometry {
  const base = new THREE.Color(color);
  return paintBy(prep(geo, true), (p, out) => {
    const h = Math.sin(p.x * 12.9898 + p.y * 78.233 + p.z * 37.719 + seed * 3.17) * 43758.5453;
    const k = 1 + (h - Math.floor(h) - 0.5) * 2 * wobble;
    out.copy(base).multiplyScalar(k);
  });
}

/** Box with its base at y = 0. */
export function block(w: number, h: number, d: number, color: number, wobble = 0.05, seed = 0) {
  return facet(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), color, wobble, seed);
}

/** Square column with a plinth and a capital, base at y = 0. */
export function columnGeo(w: number, h: number, shaft: number, trim: number) {
  const plinth = block(w * 1.35, 0.35, w * 1.35, trim);
  const cap = block(w * 1.3, 0.3, w * 1.3, trim);
  const body = block(w, h - 0.65, w, shaft, 0.06);
  return merge([plinth, place(body, 0, 0.35, 0), place(cap, 0, h - 0.3, 0)]);
}

/** Blocky gate: two piers and a stepped lintel. Opening `w` × `h`, depth `d`, piers `t` thick. Base at y = 0. */
export function gateGeo(w: number, h: number, d: number, t: number, color: number, trim: number) {
  const pierL = block(t, h, d, color, 0.06, 1);
  const pierR = block(t, h, d, color, 0.06, 2);
  const lintel = block(w + t * 2 + 0.6, 1.1, d + 0.4, trim, 0.05, 3);
  const crown = block(w * 0.6, 0.8, d * 0.8, color, 0.05, 4);
  const x = w / 2 + t / 2;
  return merge([place(pierL, -x, 0, 0), place(pierR, x, 0, 0), place(lintel, 0, h, 0), place(crown, 0, h + 1.1, 0)]);
}

/**
 * A sword planted point-down, hilt up. `len` is the whole sword. Local origin at the point of entry (y = 0);
 * the blade's buried tip is below ground. Faceted: four-sided blade, boxy guard and grip.
 */
export function swordGeo(len: number, blade: number, hilt: number) {
  const bladeLen = len * 0.72;
  const w = len * 0.07;
  const bladeGeo = facet(new THREE.CylinderGeometry(w * 0.7, w * 0.7, bladeLen, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.22).translate(0, bladeLen / 2 - len * 0.08, 0), blade, 0.03);
  const fuller = facet(new THREE.BoxGeometry(w * 0.18, bladeLen * 0.8, w * 0.2), hilt, 0);
  const guard = block(w * 3.4, len * 0.035, w * 0.6, hilt, 0.04);
  const grip = block(w * 0.45, len * 0.16, w * 0.45, hilt, 0.04);
  const pommel = facet(new THREE.IcosahedronGeometry(w * 0.45, 0), hilt, 0.04);
  const top = bladeLen - len * 0.08;
  return merge([bladeGeo, place(fuller, 0, top * 0.5, 0), place(guard, 0, top, 0), place(grip, 0, top + len * 0.035, 0), place(pommel, 0, top + len * 0.2, 0)]);
}

/** Low-poly hill: a jittered, flattened icosahedron. `r` radius, `h` height, base at y = 0. */
export function hillGeo(rng: Rng, r: number, h: number, color: number) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 + rng.signed() * 0.12;
    pos.setXYZ(i, pos.getX(i) * r * k, Math.max(0, y) * h * k, pos.getZ(i) * r * k);
  }
  return facet(g, color, 0.04, rng.int(0, 999));
}

/** One wind-flattened grass tuft: three thin boxes leaning downwind (+x). Base at y = 0, ~1 unit tall. */
export function grassTuftGeo(color: number) {
  const blade = (x: number, z: number, lean: number, h: number) =>
    place(paint(new THREE.BoxGeometry(0.12, h, 0.04).translate(0, h / 2, 0), color), x, 0, z, 0, x * 2, -lean);
  return merge([blade(-0.05, 0.02, 0.45, 1), blade(0.04, -0.03, 0.6, 0.8), blade(0.0, 0.05, 0.35, 0.9)]);
}

/** The great scales of Justice: a pillar, a crossbeam, chains and two pans. Base at y = 0. ~`h` tall. */
export function scalesGeo(h: number, stone: number, dark: number, brass: number, brassShade: number) {
  const pillarW = h * 0.08;
  const beamW = h * 0.75;
  const pillar = block(pillarW, h, pillarW, stone, 0.05);
  const base = block(pillarW * 3, h * 0.06, pillarW * 3, dark, 0.05);
  const beam = block(beamW, h * 0.04, pillarW * 0.7, brass, 0.04);
  const fulcrum = facet(new THREE.ConeGeometry(pillarW * 0.9, h * 0.08, 4).translate(0, h * 0.04, 0), brass, 0.04);
  const parts = [base, pillar, place(fulcrum, 0, h, 0), place(beam, 0, h + h * 0.06, 0)];
  const drop = h * 0.32;
  for (const side of [-1, 1]) {
    const x = side * beamW * 0.47;
    const top = h + h * 0.06;
    // Three chains converge from the pan's rim to the beam end.
    const hang = new THREE.Vector3(x, top, 0);
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const rim = new THREE.Vector3(x + Math.cos(a) * h * 0.12, top - drop, Math.sin(a) * h * 0.12);
      parts.push(bar(rim, hang, h * 0.008, dark));
    }
    const pan = facet(new THREE.CylinderGeometry(h * 0.14, h * 0.08, h * 0.035, 8).translate(0, -h * 0.0175, 0), brassShade, 0.04);
    parts.push(place(pan, x, top - drop, 0));
  }
  return merge(parts);
}

/**
 * The Devil's throne-pedestal (the landmark): a stepped stone column rising out of the pit, a half-cube block on top
 * with a gilt band, the iron ring the card's figures are chained to (chains hanging into the fog), and the throne's
 * horned back. Base at y = 0; the brazier's flame sits at `PEDESTAL_FLAME × h` (a separate unlit mesh).
 */
export const PEDESTAL_FLAME = 1.06;
/** The brazier stands this far in front of the column's axis (× h), toward +Z: the side that faces the levels. */
export const PEDESTAL_BRAZIER_Z = 0.03;
export function pedestalGeo(h: number, stone: number, dark: number, gilt: number, giltShade: number) {
  const w = h * 0.2;
  const parts: THREE.BufferGeometry[] = [];
  // The column: three stepped drums, narrowing upward.
  let y = 0;
  for (const [k, f] of [[1.5, 0.3], [1.2, 0.32], [1.0, 0.26]] as const) {
    parts.push(place(block(w * k, h * f, w * k, k > 1.3 ? dark : stone, 0.05, k), 0, y, 0));
    y += h * f;
  }
  // The half-cube and its gilt band.
  parts.push(place(block(w * 1.35, h * 0.07, w * 1.35, stone, 0.04), 0, y, 0));
  parts.push(place(block(w * 1.4, h * 0.018, w * 1.4, gilt, 0.03), 0, y + h * 0.03, 0));
  y += h * 0.07;
  // The ring on its face, and two chains falling from it into the pit.
  const ring = facet(new THREE.TorusGeometry(h * 0.035, h * 0.007, 4, 8), giltShade, 0.03);
  parts.push(place(ring, 0, y - h * 0.1, w * 0.68));
  for (const side of [-1, 1]) {
    const from = new THREE.Vector3(side * h * 0.02, y - h * 0.13, w * 0.7);
    parts.push(bar(from, new THREE.Vector3(side * w * 0.9, y - h * 0.42, w * 0.95), h * 0.006, dark));
  }
  // The throne's back with two horns, and the brazier bowl on a short post before it.
  parts.push(place(block(w * 0.7, h * 0.12, w * 0.16, dark, 0.04), 0, y, -w * 0.3));
  for (const side of [-1, 1]) {
    const horn = facet(new THREE.ConeGeometry(h * 0.014, h * 0.07, 4).translate(0, h * 0.035, 0), dark, 0.04);
    parts.push(place(horn, side * w * 0.3, y + h * 0.12, -w * 0.3, 0, 0, -side * 0.45));
  }
  const bz = h * PEDESTAL_BRAZIER_Z;
  parts.push(place(block(h * 0.012, h * (PEDESTAL_FLAME - 0.04) - y, h * 0.012, dark, 0.03), 0, y, bz));
  parts.push(place(facet(new THREE.CylinderGeometry(h * 0.035, h * 0.018, h * 0.02, 6), gilt, 0.04), 0, h * (PEDESTAL_FLAME - 0.04), bz));
  return merge(parts);
}

/** The brazier's flame: unlit, so it glows through the fog (the warm light leads down). Base at y = 0. */
export function flameGeo(size: number, color: number) {
  return paint(new THREE.ConeGeometry(size * 0.5, size, 5).translate(0, size / 2, 0), color);
}

/** A hoard: a heap of old coin with a few spilled stacks and a strongbox (cover, about 1.1 m). Base at y = 0. */
export function hoardGeo(size: number, gilt: number, giltShade: number, wood: number, seed = 0) {
  const heap = facet(new THREE.ConeGeometry(size * 0.9, size * 0.8, 6, 1).translate(0, size * 0.4, 0), giltShade, 0.1, seed);
  const box = place(block(size * 0.9, size * 0.6, size * 0.6, wood, 0.05, seed), size * 0.35, 0, -size * 0.25, 0, 0.4, 0);
  const lid = place(block(size * 0.94, size * 0.12, size * 0.64, gilt, 0.04, seed), size * 0.35, size * 0.6, -size * 0.25, 0, 0.4, 0);
  const stacks = [0, 1, 2].map((i) => place(facet(new THREE.CylinderGeometry(size * 0.16, size * 0.16, size * (0.18 + i * 0.1), 6).translate(0, size * (0.09 + i * 0.05), 0), gilt, 0.06, seed + i), Math.cos(i * 2.1 + seed) * size * 0.95, 0, Math.sin(i * 2.1 + seed) * size * 0.95));
  return merge([heap, box, lid, ...stacks]);
}

/**
 * A hoard's tell (the Devil's rule must be learnable): a bell hung over it on a crooked post (it rings), chains wound
 * round the heap (heavy), or a ring of cracked, broken floor around it (something waits below). Base at y = 0.
 */
export function hoardTellGeo(cost: 'bell' | 'weight' | 'ambush', size: number, post: number, iron: number, crack: number) {
  if (cost === 'bell') {
    const pole = place(block(0.12, size * 2.2, 0.12, post, 0.04), size * 0.9, 0, 0);
    const arm = place(block(size * 0.95, 0.1, 0.1, post, 0.04), size * 0.45, size * 2.2, 0);
    const bell = place(facet(new THREE.CylinderGeometry(size * 0.12, size * 0.26, size * 0.34, 6), iron, 0.04), 0, size * 1.75, 0);
    const cap = place(block(0.08, size * 0.2, 0.08, iron, 0.03), 0, size * 2.05, 0);
    return merge([pole, arm, bell, cap]);
  }
  if (cost === 'weight') {
    // Two chains looped over the heap and staked into the floor.
    const parts: THREE.BufferGeometry[] = [];
    for (const a of [0.5, 2.1]) {
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      for (let i = 0; i < 9; i++) {
        const t = i / 8 - 0.5;
        const x = dx * t * size * 2.2;
        const z = dz * t * size * 2.2;
        const y = Math.max(0.05, size * 0.8 * (1 - 4 * t * t));
        parts.push(place(block(0.12, 0.08, 0.2, iron, 0.03), x, y, z, 0, -a, i % 2 ? Math.PI / 2 : 0));
      }
      for (const s of [-1, 1]) parts.push(place(block(0.14, 0.3, 0.14, iron, 0.03), dx * s * size * 1.15, 0, dz * s * size * 1.15));
    }
    return merge(parts);
  }
  // Ambush: a broken ring of floor slabs, tilted, with dark cracks between.
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = size * 1.9;
    parts.push(place(block(size * 0.9, 0.08, 0.16, crack, 0.06, i), Math.cos(a) * r, 0.02, Math.sin(a) * r, 0, -a + Math.PI / 2, 0));
    parts.push(place(block(size * 0.6, 0.12, size * 0.5, post, 0.08, i), Math.cos(a + 0.3) * r * 0.82, 0.04, Math.sin(a + 0.3) * r * 0.82, (i % 3) * 0.12 - 0.12, -a, 0.1));
  }
  return merge(parts);
}

/** A great pillar of the pit standing out of the fog, a gilt band near its top (Devil hero prop). Base at y = 0. */
export function pitPillarGeo(h: number, stone: number, dark: number, gilt: number) {
  const w = Math.max(3, h * 0.11);
  return merge([
    block(w, h, w, dark, 0.06),
    place(block(w * 1.25, h * 0.04, w * 1.25, gilt, 0.04), 0, h * 0.82, 0),
    place(block(w * 1.4, h * 0.05, w * 1.4, stone, 0.05), 0, h, 0),
  ]);
}

/** Hermit's lantern on a post (the checkpoint): post and frame only; the glowing glass is separate. */
export function lanternPostGeo(post: number, metal: number) {
  const p = block(0.14, 2.2, 0.14, post, 0.05);
  const arm = block(0.6, 0.08, 0.08, post, 0.05);
  const cap = facet(new THREE.ConeGeometry(0.2, 0.18, 4).rotateY(Math.PI / 4), metal, 0.04);
  const frame = block(0.26, 0.04, 0.26, metal, 0.04);
  const foot = block(0.5, 0.2, 0.5, post, 0.05);
  return merge([foot, place(p, 0, 0.2, 0), place(arm, 0.24, 2.25, 0), place(frame, 0.48, 1.86, 0), place(cap, 0.48, 2.25, 0)]);
}

/** Lantern glass: unlit so it glows in any light. Centre of the glass relative to the lantern post origin. */
export const LANTERN_GLASS = new THREE.Vector3(0.48, 2.05, 0);
export function lanternGlassGeo(color: number) {
  return paint(new THREE.BoxGeometry(0.22, 0.32, 0.22), color);
}

/** Paint a hex as a THREE colour multiplied by k (shade helper for callers). */
export function shade(hex: number, k: number) {
  return _c.setHex(hex).multiplyScalar(k).getHex();
}

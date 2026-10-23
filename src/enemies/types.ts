// Enemy body plans: procedural body geometry, leg layout, hitboxes and weak spots per type.
// Body space: x right, y up, z back (forward is -Z). Silhouettes per STYLE.md: skitterer low and wide,
// spitter tall with a raised bulbous abdomen, brute huge with a domed armoured front.
import * as THREE from 'three';
import { merge, paint, place, prep, stripe } from '../render/geo';
import { SIGNAL } from '../render/palette';
import type { RigSpec } from './rig';

export type EnemyKind = 'skitterer' | 'spitter' | 'brute';

export interface HitboxSpec {
  part: 'body' | 'weak' | 'armor';
  at: [number, number, number];
  r: number;
}

export interface BodyPlan {
  kind: EnemyKind;
  rig: RigSpec;
  /** Mover collider radius (ball), centred this high above the ground. */
  radius: number;
  hitboxes: HitboxSpec[];
  /** Body geometry (vertex coloured). */
  geo: () => THREE.BufferGeometry;
  /** Glowing weak-spot geometry, drawn unlit in SIGNAL.weakSpot. */
  weakGeo: () => THREE.BufferGeometry | null;
  /** Mouth/eye point (for spit origin and line of sight). */
  mouth: [number, number, number];
  elite: boolean;
}

const C = {
  plumA: 0x7a5a7e,
  plumB: 0x8f6f92,
  belly: 0xd9b35c,
  bellyB: 0xc29a48,
  dark: 0x2a2028,
  carapaceA: 0x4a3a5c,
  carapaceB: 0x5e4a73,
  horn: 0x2e2433,
  ochreA: 0xc9a24e,
  ochreB: 0xa8843c,
  eye: 0x120d0c,
};

function legs(hips: [number, number, number][], rests: [number, number, number][], femur: number, tibia: number) {
  // Order: L0, R0, L1, R1, L2, R2 (front → back), matching TRIPOD_GROUPS.
  const out = [];
  for (let row = 0; row < 3; row++) {
    for (let side = 0; side < 2; side++) {
      const h = hips[row];
      const r = rests[row];
      const sx = side === 0 ? -1 : 1;
      out.push({ hip: [h[0] * sx, h[1], h[2]] as [number, number, number], rest: [r[0] * sx, r[1], r[2]] as [number, number, number], femur, tibia });
    }
  }
  return out;
}

export const SKITTERER: BodyPlan = {
  kind: 'skitterer',
  elite: false,
  radius: 0.36,
  rig: {
    legs: legs(
      [
        [0.2, -0.03, -0.24],
        [0.24, -0.04, 0],
        [0.2, -0.03, 0.24],
      ],
      [
        [0.72, 0, -0.66],
        [0.85, 0, 0],
        [0.72, 0, 0.64],
      ],
      0.46,
      0.56,
    ),
    ride: 0.34,
    stepThreshold: 0.3,
    stepHeight: 0.16,
    stepTime: 0.2,
    velocityLead: 0.1,
    limbRadius: 0.028,
    limbColor: C.dark,
  },
  hitboxes: [
    { part: 'body', at: [0, 0, 0.06], r: 0.38 },
    { part: 'weak', at: [0, 0.03, -0.48], r: 0.17 },
  ],
  mouth: [0, 0.03, -0.62],
  geo: () => {
    const shell = stripe(new THREE.SphereGeometry(1, 14, 10).scale(0.34, 0.2, 0.46), C.plumA, C.plumB, 0.05, { axis: 'z' });
    const belly = paint(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.3, 0.12, 0.4), C.belly);
    const head = paint(new THREE.SphereGeometry(0.17, 10, 8), C.plumB);
    const eye = paint(new THREE.SphereGeometry(0.045, 6, 4), C.eye);
    const mand = paint(new THREE.ConeGeometry(0.035, 0.16, 5).rotateX(-Math.PI / 2), C.dark);
    return merge([
      shell,
      place(belly, 0, -0.04, 0),
      place(head, 0, 0.03, -0.48),
      place(eye, -0.08, 0.09, -0.58),
      place(eye.clone(), 0.08, 0.09, -0.58),
      place(mand, -0.06, -0.02, -0.66, 0, 0.35, 0),
      place(mand.clone(), 0.06, -0.02, -0.66, 0, -0.35, 0),
    ]);
  },
  weakGeo: () => null,
};

export const SPITTER: BodyPlan = {
  kind: 'spitter',
  elite: false,
  radius: 0.42,
  rig: {
    legs: legs(
      [
        [0.14, -0.06, -0.26],
        [0.17, -0.07, -0.08],
        [0.15, -0.06, 0.1],
      ],
      [
        [0.8, 0, -0.95],
        [1.0, 0, -0.1],
        [0.85, 0, 0.75],
      ],
      0.66,
      0.86,
    ),
    ride: 0.72,
    stepThreshold: 0.34,
    stepHeight: 0.2,
    stepTime: 0.26,
    velocityLead: 0.12,
    limbRadius: 0.026,
    limbColor: C.dark,
  },
  hitboxes: [
    { part: 'body', at: [0, 0, -0.12], r: 0.3 },
    { part: 'body', at: [0, 0.32, 0.5], r: 0.44 },
    { part: 'weak', at: [0, 0.66, 0.52], r: 0.22 },
  ],
  mouth: [0, 0.08, -0.56],
  geo: () => {
    const thorax = stripe(new THREE.SphereGeometry(1, 12, 8).scale(0.24, 0.21, 0.3), C.plumA, C.plumB, 0.05, { axis: 'z' });
    const abdomen = stripe(new THREE.SphereGeometry(1, 14, 12).scale(0.46, 0.42, 0.5).rotateX(-0.5), C.ochreA, C.ochreB, 0.07);
    const head = paint(new THREE.SphereGeometry(0.15, 10, 8), C.plumB);
    const nozzle = paint(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 8).rotateX(Math.PI / 2), C.dark);
    const eye = paint(new THREE.SphereGeometry(0.04, 6, 4), C.eye);
    return merge([
      place(thorax, 0, 0, -0.12),
      place(abdomen, 0, 0.32, 0.5),
      place(head, 0, 0.06, -0.42),
      place(nozzle, 0, 0.04, -0.56),
      place(eye, -0.07, 0.13, -0.5),
      place(eye.clone(), 0.07, 0.13, -0.5),
    ]);
  },
  weakGeo: () => prep(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.7, 1.2).translate(0, 0.66, 0.52)),
};

export const BRUTE: BodyPlan = {
  kind: 'brute',
  elite: true,
  radius: 1.15,
  rig: {
    legs: legs(
      [
        [0.7, -0.25, -0.6],
        [0.8, -0.3, 0.1],
        [0.7, -0.25, 0.8],
      ],
      [
        [1.9, 0, -1.6],
        [2.2, 0, 0.1],
        [1.9, 0, 1.8],
      ],
      1.35,
      1.65,
    ),
    ride: 1.3,
    stepThreshold: 0.5,
    stepHeight: 0.4,
    stepTime: 0.32,
    velocityLead: 0.15,
    limbRadius: 0.16,
    limbColor: C.dark,
  },
  hitboxes: [
    { part: 'armor', at: [0, 0.15, -0.5], r: 1.0 },
    { part: 'armor', at: [0, -0.05, -1.3], r: 0.48 },
    { part: 'body', at: [0, 0.0, 0.8], r: 0.82 },
    { part: 'weak', at: [0, 0.58, 1.0], r: 0.38 },
  ],
  mouth: [0, -0.05, -1.6],
  geo: () => {
    const dome = stripe(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.15, 0.95, 1.05), C.carapaceA, C.carapaceB, 0.16, {
      axis: 'z',
      wobble: 0.2,
    });
    const rim = paint(new THREE.TorusGeometry(1.0, 0.1, 5, 18).rotateX(Math.PI / 2).scale(1.1, 1, 1.0), C.horn);
    const abdomen = stripe(new THREE.SphereGeometry(1, 14, 10).scale(0.85, 0.6, 0.9), C.plumA, C.plumB, 0.12, { axis: 'z' });
    const head = paint(new THREE.SphereGeometry(0.45, 12, 10), C.carapaceB);
    const horn = paint(new THREE.ConeGeometry(0.22, 1.1, 8).rotateX(-Math.PI * 0.62), C.horn);
    const hornTip = paint(new THREE.ConeGeometry(0.1, 0.45, 6), C.horn);
    const eye = paint(new THREE.SphereGeometry(0.09, 6, 4), C.eye);
    return merge([
      place(dome, 0, -0.15, -0.5),
      place(rim, 0, -0.15, -0.5),
      place(abdomen, 0, 0, 0.85),
      place(head, 0, -0.1, -1.3),
      place(horn, 0, 0.25, -1.75),
      place(hornTip, 0, 0.75, -2.05, -0.3, 0, 0),
      place(eye, -0.25, 0.05, -1.66),
      place(eye.clone(), 0.25, 0.05, -1.66),
    ]);
  },
  // A glowing seam across the top of the abdomen: the weak spot you have to get behind.
  weakGeo: () =>
    merge([
      prep(new THREE.SphereGeometry(0.34, 12, 8).scale(1.3, 0.45, 1).translate(0, 0.56, 1.0)),
      prep(new THREE.TorusGeometry(0.42, 0.05, 4, 16).rotateX(Math.PI / 2).translate(0, 0.52, 1.0)),
    ]),
};

export const PLANS: Record<EnemyKind, BodyPlan> = { skitterer: SKITTERER, spitter: SPITTER, brute: BRUTE };

export const WEAK_COLOR = SIGNAL.weakSpot;

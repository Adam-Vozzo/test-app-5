import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { paint, place } from '../src/render/geo';

describe('place()', () => {
  it('does not mutate its input (regression: second eye floated in front of the head)', () => {
    const eye = paint(new THREE.SphereGeometry(0.035, 6, 4), 0x000000);
    const before = eye.getAttribute('position').getZ(0);
    const left = place(eye, -0.07, 0.03, -0.12);
    const right = place(eye.clone(), 0.07, 0.03, -0.12);
    expect(eye.getAttribute('position').getZ(0)).toBe(before);
    left.computeBoundingBox();
    right.computeBoundingBox();
    const cl = left.boundingBox!.getCenter(new THREE.Vector3());
    const cr = right.boundingBox!.getCenter(new THREE.Vector3());
    expect(cl.z).toBeCloseTo(-0.12, 3);
    expect(cr.z).toBeCloseTo(-0.12, 3);
    expect(cr.x).toBeCloseTo(0.07, 3);
  });
});

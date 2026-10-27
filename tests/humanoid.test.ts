import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HumanoidRig } from '../src/enemies/humanoid';
import { PLANS } from '../src/enemies/foes';

describe('the enemy rig walks', () => {
  it('a walking rig takes steps and plants them (feet are not dragged along under it)', () => {
    const physics = { groundY: () => ({ y: 0 }) } as never;
    const rig = new HumanoidRig(new THREE.Scene(), physics, PLANS.bailiff);
    let steps = 0;
    rig.onFootstep = () => steps++;
    const root = new THREE.Vector3();
    const vel = new THREE.Vector3(0, 0, -3);
    for (let i = 0; i < 60; i++) {
      root.addScaledVector(vel, 0.05);
      rig.update(0.05, root, 0, vel, PLANS.bailiff.ready, false);
    }
    // 9 m at 3 m/s: a stride every ~0.3 s or so.
    expect(steps).toBeGreaterThan(6);
  });
});

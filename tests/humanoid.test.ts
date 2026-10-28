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

describe('the enemy rig dies', () => {
  it('a corpse falls away from the blow and stays in one piece (body, head and hands together)', () => {
    const physics = { groundY: () => ({ y: 0 }) } as never;
    const rig = new HumanoidRig(new THREE.Scene(), physics, PLANS.bailiff);
    const root = new THREE.Vector3(10, 0, -20);
    const still = new THREE.Vector3();
    rig.update(0.05, root, 0, still, PLANS.bailiff.ready, false);
    // Killed by a shot travelling +X.
    rig.setFallDir(new THREE.Vector3(1, 0, 0));
    for (let i = 0; i < 40; i++) rig.update(0.05, root, 0, still, PLANS.bailiff.ready, true);
    // Lying down: the chest is low and on the far side of the blow.
    expect(rig.chest.y - root.y).toBeLessThan(0.6);
    expect(rig.chest.x).toBeGreaterThan(root.x + 0.3);
    // Every part stays within a body length of where it fell.
    for (const p of [rig.chest, rig.hips, rig.handR, rig.handL]) expect(p.distanceTo(root)).toBeLessThan(1.8);
    // Sinking moves the whole body down together.
    const sunk = root.clone().setY(-1);
    const before = rig.chest.clone();
    rig.update(0.05, sunk, 0, still, PLANS.bailiff.ready, true);
    expect(rig.chest.y).toBeCloseTo(before.y - 1, 1);
    expect(Math.hypot(rig.chest.x - before.x, rig.chest.z - before.z)).toBeLessThan(0.05);
  });
});

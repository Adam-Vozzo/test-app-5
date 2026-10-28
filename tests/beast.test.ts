import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BeastRig } from '../src/enemies/beast';
import { MOON_PLANS } from '../src/enemies/moon-foes';
import { TOWER_PLANS } from '../src/enemies/tower-foes';

const physics = { groundY: () => ({ y: 0 }) } as never;
const make = (plan: (typeof MOON_PLANS)['dog']) => new BeastRig(new THREE.Scene(), physics, plan, plan.beast!);
type Feet = { feet: { pos: THREE.Vector3; stepping: boolean }[] };

describe('beasts have their own bodies', () => {
  it('the Dog, the Wolf, the cat, the Crayfish and the fish are beasts, not crouched people', () => {
    for (const p of [MOON_PLANS.dog, MOON_PLANS.wolf, MOON_PLANS.crayfish, MOON_PLANS.fish, TOWER_PLANS.cat]) expect(p.beast, p.id).toBeDefined();
    expect(MOON_PLANS.dog.beast!.legs.length).toBe(4);
    expect(MOON_PLANS.crayfish.beast!.legs.length).toBe(8);
    expect(MOON_PLANS.crayfish.beast!.arms).toBeDefined();
    expect(MOON_PLANS.fish.beast!.kind).toBe('swim');
  });

  it('a trotting dog steps its legs in diagonal pairs, feet planted on the ground', () => {
    const rig = make(MOON_PLANS.dog);
    const root = new THREE.Vector3();
    const vel = new THREE.Vector3(0, 0, -3);
    let steps = 0;
    rig.onFootstep = () => steps++;
    const pairs = new Set<string>();
    for (let i = 0; i < 90; i++) {
      root.addScaledVector(vel, 1 / 30);
      rig.update(1 / 30, root, 0, vel, MOON_PLANS.dog.ready, false);
      const f = (rig as unknown as Feet).feet;
      const moving = f.map((x, j) => (x.stepping ? j : -1)).filter((j) => j >= 0);
      // (from a standing start every foot is out of place and all four may scramble: judge the trot once it's going)
      if (i > 20 && moving.length) pairs.add(moving.join(','));
      // Planted feet are on the ground; none sink below it.
      for (const x of f) expect(x.pos.y).toBeGreaterThan(-0.01);
    }
    expect(steps).toBeGreaterThan(4);
    // Only the diagonal pairs ever step together (front-left with hind-right, front-right with hind-left).
    for (const p of pairs) expect(['0,3', '1,2', '0', '3', '1', '2']).toContain(p);
    // The body rides above its feet, nose forward.
    expect(rig.body.y).toBeGreaterThan(0.35);
    expect(rig.chest.z).toBeLessThan(rig.body.z);
  });

  it('a fish swims at its height with no legs, and its body waves', () => {
    const rig = make(MOON_PLANS.fish);
    const root = new THREE.Vector3();
    const q0 = new THREE.Quaternion();
    let waved = 0;
    for (let i = 0; i < 60; i++) {
      rig.update(1 / 30, root, 0, new THREE.Vector3(), MOON_PLANS.fish.ready, false);
      if (i === 10) q0.copy(rig.bodyQuat);
      if (i > 10) waved = Math.max(waved, rig.bodyQuat.angleTo(q0));
      expect(rig.body.y).toBeGreaterThan(0.55);
    }
    expect(waved).toBeGreaterThan(0.05);
  });

  it("the Crayfish's pincers reach forward from its arms, and a dead beast lies down in one piece", () => {
    const rig = make(MOON_PLANS.crayfish);
    const root = new THREE.Vector3(3, 0, -4);
    rig.update(1 / 30, root, 0, new THREE.Vector3(), MOON_PLANS.crayfish.ready, false);
    // Ahead of the body (-Z), to either side.
    expect(rig.handR.z).toBeLessThan(rig.body.z - 0.6);
    expect(rig.handR.x).toBeGreaterThan(rig.body.x);
    const alive = rig.body.y;
    rig.setFallDir(new THREE.Vector3(1, 0, 0));
    for (let i = 0; i < 30; i++) rig.update(1 / 30, root, 0, new THREE.Vector3(), MOON_PLANS.crayfish.ready, true);
    expect(rig.body.y).toBeLessThan(alive);
    for (const p of [rig.chest, rig.handR, rig.handL]) expect(p.distanceTo(root)).toBeLessThan(2.5);
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Physics, RAPIER } from '../src/physics/world';
import { Controller } from '../src/player/controller';
import { rampWedge } from '../src/world/level';

let ready: Promise<void> | null = null;
async function world() {
  ready ??= Physics.init();
  await ready;
  return new Physics();
}
const box = (p: Physics, x: number, y: number, z: number, hx: number, hy: number, hz: number, q?: THREE.Quaternion) => {
  const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
  if (q) d.setRotation(q);
  p.addStatic(d);
};

/** Walk toward `yaw` (0 = -Z) for `t` seconds; returns where she ended up and the slowest second of progress. */
function walk(p: Physics, c: Controller, camYaw: number, t: number, x = 0) {
  let worst = Infinity;
  let mark = c.pos.clone();
  let since = 0;
  for (let s = 0; s < t; s += 1 / 60) {
    c.update(1 / 60, { x, y: 1, sprint: false, rollPressed: false, combat: false, speedMul: 1, camYaw });
    p.step();
    since += 1 / 60;
    if (since >= 1) {
      worst = Math.min(worst, c.pos.distanceTo(mark));
      mark = c.pos.clone();
      since = 0;
    }
  }
  return worst;
}

describe('stairs between platforms', () => {
  // A lower room, stairs up 4 m over 12 m (the steepest connectors), an upper room: built as level.ts builds them.
  async function stairs(width = 5) {
    const p = await world();
    box(p, 0, -1, 10, 10, 1, 10); // lower floor: z 0..20, top y 0
    box(p, 0, 3, -22, 10, 1, 10); // upper floor: z -32..-12, top y 4
    p.addStatic(RAPIER.ColliderDesc.convexHull(rampWedge(0, 0, 0, 0, -12, 4, width))!);
    return p;
  }
  for (const [label, x0, drift] of [
    ['straight up the middle', 0, 0],
    ['along one side', 1.8, 0],
  ] as const) {
    it(`she walks up them without catching (${label})`, async () => {
      const p = await stairs();
      const c = new Controller(p, new THREE.Vector3(x0, 0.05, 4), 0);
      const worst = walk(p, c, 0, 7, drift);
      expect(c.pos.y).toBeGreaterThan(3.9);
      expect(worst).toBeGreaterThan(1.5);
    });
    it(`she walks down them without catching (${label})`, async () => {
      const p = await stairs();
      const c = new Controller(p, new THREE.Vector3(x0, 4.05, -16), Math.PI);
      const worst = walk(p, c, Math.PI, 7, drift);
      expect(c.pos.y).toBeLessThan(0.2);
      expect(worst).toBeGreaterThan(1.5);
    });
  }
  it("coming at a tier ramp's open side near its foot, she steps up onto it instead of wedging under it", async () => {
    const p = await stairs(3);
    // From beside the ramp near its foot (where it's still low enough to step onto), walking across it (+X). The old
    // thin slab stopped or wedged her at each of these.
    for (const z of [-1.25, -1.5, -1.75]) {
      const c = new Controller(p, new THREE.Vector3(-4, 0.05, z), -Math.PI / 2);
      walk(p, c, -Math.PI / 2, 3);
      expect(c.pos.x, `from z ${z}`).toBeGreaterThan(1.6);
    }
  });
  it('she crosses a floor of deck tiles (the Tower) without catching on the seams', async () => {
    const p = await world();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) box(p, -12 + i * 3 + 1.5, -0.15, -12 + j * 3 + 1.5, 1.5, 0.15, 1.5);
    const c = new Controller(p, new THREE.Vector3(-10, 0.05, 10), 0);
    const worst = walk(p, c, Math.PI / 4, 5);
    expect(worst).toBeGreaterThan(1.5);
  });
});

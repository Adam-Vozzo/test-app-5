// The pollen you dropped on death: a bobbing gold puff with a faint beam so you can find your way back.
// Touch it to recover; die again first and it's gone (replaced by the new drop).
import * as THREE from 'three';
import { SIGNAL } from '../render/palette';

export class PollenDrop {
  readonly group = new THREE.Group();
  amount = 0;
  /** Only collectible once the player has been away from it (you rise elsewhere and walk back). */
  private armed = false;
  private t = 0;
  private puffs: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial({ color: SIGNAL.crit, fog: false });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + (i % 3) * 0.025, 1), mat);
      this.puffs.push(m);
      this.group.add(m);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.12, 6, 8, 1, true).translate(0, 3, 0),
      new THREE.MeshBasicMaterial({ color: SIGNAL.crit, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.group.add(beam);
    this.group.visible = false;
    scene.add(this.group);
  }

  get active() {
    return this.group.visible && this.amount > 0;
  }

  place(at: THREE.Vector3, amount: number) {
    this.amount = amount;
    this.armed = false;
    this.group.position.copy(at);
    this.group.visible = amount > 0;
  }

  /** Returns the amount recovered if the player touched it this frame. */
  update(dt: number, player: THREE.Vector3, radius: number): number {
    if (!this.active) return 0;
    this.t += dt;
    this.puffs.forEach((p, i) => {
      const a = this.t * 1.6 + i * 0.9;
      p.position.set(Math.cos(a) * 0.22, 0.45 + Math.sin(this.t * 2.2 + i) * 0.12 + (i % 3) * 0.08, Math.sin(a) * 0.22);
    });
    const d = player.distanceTo(this.group.position);
    if (!this.armed) {
      if (d > radius * 1.6) this.armed = true;
      return 0;
    }
    if (d < radius) {
      const got = this.amount;
      this.clear();
      return got;
    }
    return 0;
  }

  clear() {
    this.amount = 0;
    this.group.visible = false;
  }
}

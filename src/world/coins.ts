// Coin on the floor (V2-10): what the King of Pentacles' coin rain (and the Devil's) leaves where it strikes. Walk
// over a pile to take it: it pays, and it weighs like a chained hoard (the Devil's rule, mid-fight). Pooled meshes;
// gone when you rest or rise.
import * as THREE from 'three';
import { meshOf, toonMat } from '../render/geo';
import { DEVIL } from '../render/palette';
import { hoardGeo } from './kit';

interface Pile {
  at: THREE.Vector3;
  mesh: THREE.Mesh;
  /** Coin that lands under you isn't taken by standing still: it arms once you've been clear of it. */
  armed: boolean;
}

export class CoinPiles {
  private piles: Pile[] = [];
  private pool: THREE.Mesh[] = [];
  private geo = hoardGeo(0.32, DEVIL.accent, DEVIL.accentShade, DEVIL.surfaces.dark);
  private mat = toonMat();

  constructor(private scene: THREE.Scene) {}

  get count() {
    return this.piles.length;
  }

  /** Scatter `n` piles around `at`. */
  drop(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const mesh = this.pool.pop() ?? this.make();
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const r = n > 1 ? 0.9 : 0;
      mesh.position.set(at.x + Math.cos(a) * r, at.y + 0.02, at.z + Math.sin(a) * r);
      mesh.rotation.y = a * 1.7;
      mesh.visible = true;
      this.piles.push({ at: mesh.position, mesh, armed: false });
    }
  }

  /** Piles within `radius` of the player are taken (once she's stepped clear of where they landed); returns how many. */
  update(playerPos: THREE.Vector3, radius: number): number {
    let taken = 0;
    for (let i = this.piles.length - 1; i >= 0; i--) {
      const p = this.piles[i];
      const near = Math.hypot(p.at.x - playerPos.x, p.at.z - playerPos.z) <= radius && Math.abs(p.at.y - playerPos.y) <= 1.6;
      if (!p.armed) {
        p.armed = !near;
        continue;
      }
      if (!near) continue;
      p.mesh.visible = false;
      this.pool.push(p.mesh);
      this.piles.splice(i, 1);
      taken++;
    }
    return taken;
  }

  clear() {
    for (const p of this.piles) {
      p.mesh.visible = false;
      this.pool.push(p.mesh);
    }
    this.piles.length = 0;
  }

  private make() {
    const m = meshOf(this.geo, this.mat);
    this.scene.add(m);
    return m;
  }
}

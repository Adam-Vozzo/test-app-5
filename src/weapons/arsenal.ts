// The three carried weapons and the committed swap between them (lower → switch → raise; no firing meanwhile).
import { DEG, smoothstep } from '../core/math';
import type { Player } from '../player/player';
import { tuning } from '../tuning';
import { WEAPONS, type WeaponDef } from './defs';
import { Gun, type GunContext } from './gun';
import { buildModel } from './model';

export class Arsenal {
  readonly guns: Gun[];
  index = 0;
  private swapping = false;
  private swapT = 0;
  private target = 0;
  private switched = false;

  constructor(
    private player: Player,
    infiniteReserve: boolean,
  ) {
    const defs = tuning.weapons as Record<string, WeaponDef>;
    this.guns = WEAPONS.map((w) => new Gun(defs[w.id] ?? w, buildModel(w.id), infiniteReserve));
    player.setWeapon(this.guns[0].model);
  }

  get current() {
    return this.guns[this.index];
  }
  get isSwapping() {
    return this.swapping;
  }

  /** Ask for a weapon by index; ignored if already held. Re-targets a swap in progress. */
  request(i: number) {
    const n = this.guns.length;
    const idx = ((i % n) + n) % n;
    if (this.swapping) {
      if (!this.switched) this.target = idx;
      return;
    }
    if (idx === this.index) return;
    this.swapping = true;
    this.swapT = 0;
    this.target = idx;
    this.switched = false;
  }

  cycle(dir: number) {
    this.request((this.swapping ? this.target : this.index) + dir);
  }

  refillAll() {
    for (const g of this.guns) g.refill();
  }

  /** @param canAct false while healing, stunned or dead (no fire, reload or swap). */
  update(dt: number, ctx: GunContext, fireHeld: boolean, firePressed: boolean, reloadPressed: boolean, canAct = true) {
    const s = tuning.swap;
    let lowered = 0;
    if (this.swapping) {
      this.swapT += dt;
      if (!this.switched && this.swapT >= s.lowerTime) {
        // Swapping away loses any reload in progress.
        this.current.cancelReload(false);
        this.index = this.target;
        this.player.setWeapon(this.current.model);
        this.switched = true;
        ctx.synth.reload('pouch');
      }
      lowered = this.switched
        ? 1 - smoothstep(s.lowerTime, s.lowerTime + s.raiseTime, this.swapT)
        : smoothstep(0, s.lowerTime, this.swapT);
      if (this.swapT >= s.lowerTime + s.raiseTime) this.swapping = false;
    }
    const gun = this.current;
    gun.update(dt, ctx, fireHeld, firePressed, reloadPressed, canAct && !this.swapping);
    gun.pose.drop += lowered * s.dropDistance;
    gun.pose.tilt += lowered * s.tiltDeg * DEG;
  }
}

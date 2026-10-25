// The carried weapons and the committed swap between them (lower → switch → raise; no firing meanwhile).
// The SwordRifle's slot has a SwordRifle controller on top of its Gun (modes, swings, charges).
import { DEG, smoothstep } from '../core/math';
import type { Player } from '../player/player';
import { tuning } from '../tuning';
import { LOADOUT, type WeaponDef } from './defs';
import { Gun, type GunContext } from './gun';
import { buildModel } from './model';
import { SwordRifle, type SwordInput } from './swordrifle';

export class Arsenal {
  readonly guns: Gun[];
  /** One controller per SwordRifle slot (null elsewhere). */
  readonly swords: (SwordRifle | null)[];
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
    this.guns = LOADOUT.map((w) => new Gun(defs[w.id] ?? w, buildModel(w.id), infiniteReserve));
    this.swords = this.guns.map((g) => (g.model.sword ? new SwordRifle(g) : null));
    player.setWeapon(this.guns[0].model);
  }

  get current() {
    return this.guns[this.index];
  }
  /** The SwordRifle controller if it's the weapon in hand. */
  get sword() {
    return this.swords[this.index];
  }
  get isSwapping() {
    return this.swapping;
  }
  /** Swinging, charging, transforming or swapping: no heal, no swap. */
  get busy() {
    return this.swapping || !!this.sword?.busy;
  }
  get blocksRoll() {
    return !!this.sword?.blocksRoll;
  }
  get allowsAim() {
    return this.sword ? this.sword.allowsAim : true;
  }
  get moveMul() {
    return this.sword?.moveMul ?? 1;
  }

  /** Ask for a weapon by index; ignored if already held. Re-targets a swap in progress. */
  request(i: number) {
    const n = this.guns.length;
    const idx = ((i % n) + n) % n;
    if (this.sword?.busy) return;
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

  onRoll() {
    this.sword?.onRoll();
  }

  cancelActions() {
    for (const s of this.swords) s?.cancelActions();
  }

  /** @param canAct false while healing, stunned or dead (no fire, reload, swing or swap). */
  update(dt: number, ctx: GunContext, inp: SwordInput, canAct = true) {
    const s = tuning.swap;
    let lowered = 0;
    if (this.swapping) {
      this.swapT += dt;
      if (!this.switched && this.swapT >= s.lowerTime) {
        // Swapping away loses any reload in progress.
        this.current.cancelReload(false);
        this.sword?.cancelActions();
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
    const sword = this.sword;
    if (sword) sword.update(dt, ctx, inp, canAct && !this.swapping);
    else gun.update(dt, ctx, inp.fireHeld, inp.firePressed, inp.reloadPressed, canAct && !this.swapping);
    gun.pose.drop += lowered * s.dropDistance;
    gun.pose.tilt += lowered * s.tiltDeg * DEG;
    this.player.swordPose = sword ? sword.pose : null;
  }

  /** After the rig is animated: blade hit sweeps. */
  afterAnimate(ctx: GunContext) {
    this.sword?.afterAnimate(ctx);
  }
}

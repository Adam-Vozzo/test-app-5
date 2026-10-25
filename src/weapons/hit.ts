// Hit resolution shared by hitscan rays and projectiles, plus per-shot feedback aggregation
// (a 9-pellet blast gives one marker and one confirm sound, at the best result any pellet got).
import * as THREE from 'three';
import { clamp } from '../core/math';
import type { RayHit } from '../physics/world';
import { activeBiome, SIGNAL } from '../render/palette';
import { tuning } from '../tuning';
import type { HitKind } from '../ui/hud';
import type { WeaponDef } from './defs';
import type { GunContext } from './gun';

const RANK: Record<HitKind, number> = { hit: 1, crit: 2, kill: 3 };

/** Collects the outcome of one trigger pull and plays confirm feedback once. */
export class ShotFeedback {
  best: HitKind | null = null;
  constructor(readonly shotId: number) {}
  add(kind: HitKind) {
    if (!this.best || RANK[kind] > RANK[this.best]) this.best = kind;
  }
  flush(ctx: GunContext) {
    if (!this.best) return;
    ctx.hud.hit(this.best);
    ctx.synth.hit(this.best);
    const f = tuning.feel;
    const stop = this.best === 'kill' ? f.hitstopKill : this.best === 'crit' ? f.hitstopCrit : 0;
    if (stop > 0) ctx.clock.addHitstop(stop);
    this.best = null;
  }
}

/** Damage multiplier from distance: 1 inside falloffStart, easing to falloffMinMul at falloffEnd. */
export function falloffMul(d: WeaponDef, dist: number): number {
  const t = clamp((dist - d.falloffStart) / Math.max(0.01, d.falloffEnd - d.falloffStart), 0, 1);
  return THREE.MathUtils.lerp(1, d.falloffMinMul, t);
}

/**
 * Apply one ray/projectile hit. Returns true if it struck a live target (so pierce can continue).
 * World hits get dust + a decal; target hits get sparks, damage, stagger and knockback (scaled by falloff,
 * so shotguns stagger up close and barely nudge at range).
 */
export function resolveHit(ctx: GunContext, d: WeaponDef, hit: RayHit, dir: THREE.Vector3, fb: ShotFeedback, damageMul = 1): boolean {
  const dist = hit.point.distanceTo(ctx.player.pos);
  const t = hit.target;
  if (t && t.owner.alive && t.owner.blocks?.(dir)) {
    blockFeedback(ctx, hit.point, dir);
    return false;
  }
  if (t && t.owner.alive) {
    const crit = t.part === 'weak';
    const fall = falloffMul(d, dist);
    let dmg = d.damage * damageMul * fall * (crit ? d.critMultiplier : 1);
    const armor = t.part === 'armor';
    if (armor) {
      dmg *= t.owner.armorMul ?? 0.2;
      ctx.synth.sfx('armor', 0.8);
    }
    const killed = t.owner.takeDamage({
      amount: dmg,
      crit,
      point: hit.point,
      dir,
      knockback: d.knockback * fall,
      stagger: d.stagger * fall * (crit ? 1.5 : 1),
    });
    const kind: HitKind = killed ? 'kill' : crit ? 'crit' : 'hit';
    fb.add(kind);
    // Armour throws dull sparks: you can see you're wasting shots.
    ctx.fx.sparksAt(hit.point, dir, crit || killed ? SIGNAL.crit : armor ? 0x9a9aa8 : 0xffffff, crit ? 10 : 5, crit ? 6 : 4);
    ctx.onHit({ damage: dmg, kind, distance: dist, owner: t.owner, shotId: fb.shotId });
    return true;
  }
  if (!t) {
    ctx.fx.impact(hit.point, hit.normal, activeBiome.dust, d.impactParticles, d.impactSpeed);
    ctx.fx.decal(hit.point, hit.normal, 0.07, activeBiome.decal);
  }
  return false;
}

/** A guard took the blow: bright sparks off the shield and a clang, no damage. */
export function blockFeedback(ctx: GunContext, point: THREE.Vector3, dir: THREE.Vector3) {
  _back.copy(dir).negate();
  ctx.fx.sparksAt(point, _back, 0xffffff, 14, 7);
  ctx.synth.sfx('block');
  ctx.onBlocked?.();
}
const _back = new THREE.Vector3();

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Foe } from '../src/enemies/foe';
import { PLANS } from '../src/enemies/foes';
import { makeRng } from '../src/core/rng';
import { makeArena } from './support/arena';
import { tuning } from '../src/tuning';
import { CourtCard, COURT_PLANS } from '../src/enemies/court';
import { ShadowBoss } from '../src/enemies/court-cups';

describe('foes in a real fight', () => {
  it('a Blindfold that lost you and finds you again attacks (it does not stand there)', async () => {
    const a = await makeArena();
    const foe = new Foe(PLANS.blindfold, a.scene, a.physics, new THREE.Vector3(0, 0, -6), 0, 'stand', makeRng(1));
    a.enemies.push(foe);
    a.player.set(0, 0, 0);
    // It heard you, searched, and arrived where you stand.
    foe.alert(a.player);
    // Six metres off: it should be cutting at her within a couple of seconds, not standing beside her searching.
    a.run(2.5);
    expect(a.log.hurt).toBeGreaterThan(0);
  });
  it('a Bailiff that lost sight of you for a while comes back to the fight when it sees you', async () => {
    const a = await makeArena();
    const foe = new Foe(PLANS.bailiff, a.scene, a.physics, new THREE.Vector3(0, 0, -4), Math.PI, 'stand', makeRng(2));
    a.enemies.push(foe);
    a.player.set(0, 0, 0);
    a.run(0.2);
    // Force a search (as if it had lost you), then let it find you.
    (foe as unknown as { set(s: string): void }).set('search');
    foe.searchTarget.set(0, 0, -1);
    // (searching, it used to walk up beside her and wait out its search before fighting again)
    a.run(1.8);
    expect(a.log.hurt).toBeGreaterThan(0);
  });
  it("a Bailiff's shield swings open while it's open to a shot (after its thrust)", async () => {
    const a = await makeArena();
    const foe = new Foe(PLANS.bailiff, a.scene, a.physics, new THREE.Vector3(0, 0, -2.5), Math.PI, 'stand', makeRng(3));
    a.enemies.push(foe);
    const fromFront = new THREE.Vector3(0, 0, -1);
    let guarded = false;
    let open: number[] | null = null;
    a.run(6, () => {
      const pose = (foe as unknown as { pose: { handL: number[] } }).pose;
      if (foe.attack === 'thrust' && foe.phase === 'windup') guarded ||= foe.blocks(fromFront);
      if (!open && foe.attack === 'thrust' && foe.phase === 'recover' && !foe.blocks(fromFront)) open = [...pose.handL];
    });
    expect(guarded).toBe(true);
    expect(open).not.toBeNull();
    // Swung wide to the side, away from the ready guard in front of it.
    expect(open![0]).toBeLessThan(-0.35);
    expect(PLANS.bailiff.ready.handL[0]).toBeGreaterThan(-0.25);
  });
  it('a common enemy that falls off the stage dies of it; a court card is set back on solid ground, not dropped forever', async () => {
    const a = await makeArena(20);
    // Off the edge of the floor (nothing under it).
    const grunt = new Foe(PLANS.bailiff, a.scene, a.physics, new THREE.Vector3(40, 0, 0), 0, 'stand', makeRng(4));
    const queen = new CourtCard(COURT_PLANS.queen, a.scene, a.physics, new THREE.Vector3(-40, 0, 0), 0, makeRng(5));
    a.enemies.push(grunt, queen);
    a.w.safeGround = () => new THREE.Vector3(5, 0, 5);
    a.player.set(0, 0, 0);
    let lowest = Infinity;
    a.run(6, () => (lowest = Math.min(lowest, queen.ground.y)));
    expect(grunt.alive).toBe(false);
    expect(queen.alive).toBe(true);
    // She was caught after one short fall (not falling ever faster), set down where the world said was safe, and is
    // back on the floor (she may have walked toward you since).
    expect(lowest).toBeGreaterThan(-15);
    expect(Math.abs(queen.ground.y)).toBeLessThan(0.3);
    expect(Math.hypot(queen.ground.x, queen.ground.z)).toBeLessThan(15);
  });
  it('an enemy standing on a floor stays on it (the controller sometimes missed the floor and let it sink through)', async () => {
    const a = await makeArena(20);
    a.player.set(0, 0, 18);
    const foes = [[5, 5], [0, -5], [-7, 3], [12, -9]].map(([x, z], i) => new Foe(PLANS.bailiff, a.scene, a.physics, new THREE.Vector3(x, 0, z), 0, 'stand', makeRng(10 + i)));
    a.enemies.push(...foes);
    let lowest = 0;
    a.run(5, () => {
      for (const f of foes) lowest = Math.min(lowest, f.ground.y);
    });
    expect(lowest).toBeGreaterThan(-0.08);
  });
  it("the Shadow's rifle fires a real bolt down its lane: standing in it, you're hit", async () => {
    const a = await makeArena(30);
    const shadow = new ShadowBoss(a.scene, a.physics, new THREE.Vector3(0, 0, -15), 0, makeRng(6));
    a.enemies.push(shadow);
    a.player.set(0, 0, 0);
    a.run(0.2);
    (shadow as unknown as { begin(n: string, w: unknown): void }).begin('rifle', a.w);
    a.run(2);
    expect(a.log.hurt).toBe(1);
    expect(a.log.damage).toBe(tuning.foes.shadow.attacks.rifle.damage);
  });
  it("a volley's gap moves from one volley to the next (it was stuck on the first lane)", async () => {
    const a = await makeArena(30);
    const queen = new CourtCard(COURT_PLANS.queen, a.scene, a.physics, new THREE.Vector3(0, 0, -12), 0, makeRng(7));
    a.enemies.push(queen);
    const gaps = new Set<number>();
    for (let i = 0; i < 8; i++) {
      (queen as unknown as { begin(n: string, w: unknown): void }).begin('volley', a.w);
      a.run(0.3);
      gaps.add((queen as unknown as { gapIdx: number }).gapIdx);
      a.run(2.5);
    }
    expect(gaps.size).toBeGreaterThan(2);
    expect(gaps.has(0)).toBe(false);
  });
});

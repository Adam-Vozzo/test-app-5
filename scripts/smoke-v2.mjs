// V2-1 scenario: the auto-pistol in the Justice courtyard. Burst, crit the head band, empty the magazine and
// reload from the infinite reserve, roll-cancel a reload, then a long ADS shot at the dais dummy.
export async function pistolScenario({ g, hold, release, wait, shot }) {
  const tap = async (code) => {
    await g((c) => window.__game.input.press(c), code);
    await wait(40);
    await g((c) => window.__game.input.release(c), code);
  };
  const state = () =>
    g(() => {
      const gm = window.__game;
      return {
        gun: gm.gun.def.id,
        mag: gm.gun.mag,
        infinite: gm.gun.reserve === Infinity,
        reloading: gm.gun.reloading,
        dummies: gm.dummies.map((d) => Math.round(d.health)),
        pitch: +gm.camera.pitch.toFixed(3),
      };
    });
  const aim = async (p) => {
    for (let i = 0; i < 4; i++) {
      await g((pt) => window.__game.aimAt(pt), p);
      await wait(100);
    }
  };
  // SwiftShader frames are slow and clamped, so game time lags wall time: wait on game state instead.
  const until = async (fn, timeout = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn)) return true;
      await wait(100);
    }
    return false;
  };

  // Firing line just inside the gate (load the courtyard: other scenarios may have left a v1 scene up).
  await g(() => window.__game.start('justice'));
  await wait(1200);
  await g(() => {
    const gm = window.__game;
    gm.player.controller.teleport({ x: 0, y: 0.05, z: 1 }, 0);
    gm.camera.snap(gm.player.pos, 0);
    gm.arsenal.refillAll();
  });
  await wait(600);

  // Body shots on the left 8 m dummy (torso at 1.2 m).
  await aim([-1.5, 1.2, -8]);
  const before = await state();
  if (before.gun !== 'pistol') throw new Error(`expected the auto-pistol, got ${before.gun}`);
  if (!before.infinite) throw new Error('auto-pistol reserve is not infinite');
  await hold('Mouse0');
  await wait(150);
  await shot('20-pistol-firing');
  await wait(450);
  await release('Mouse0');
  await until(() => window.__game.dummies[0].health < 220, 8000);
  const after = await state();
  console.log('  pistol burst', JSON.stringify({ before, after }));
  if (after.mag >= before.mag) throw new Error('firing did not consume ammo');
  if (after.dummies[0] >= before.dummies[0]) throw new Error('burst did not damage the 8 m dummy');
  if (after.pitch <= before.pitch) throw new Error('recoil did not climb');

  // Head band (weak spot, 1.72 m) on the right dummy, in slow-mo.
  await hold('Mouse2');
  await wait(500);
  await g(() => window.__game.input.onKey('KeyT'));
  await aim([1.5, 1.72, -8]);
  await tap('Mouse0');
  await wait(60);
  await shot('21-pistol-crit-slowmo');
  // The pistol fires visible rounds now (not hitscan): wait for one to land.
  await until(() => window.__game.dummies[1].health < 220, 8000);
  await g(() => window.__game.input.onKey('KeyT'));
  await release('Mouse2');
  const crit = await state();
  console.log('  pistol crit', JSON.stringify(crit));
  if (crit.dummies[1] >= before.dummies[1]) throw new Error('head band shot missed the right dummy');

  // Empty the magazine, then reload from the infinite reserve.
  await aim([-1.5, 1.2, -8]);
  await hold('Mouse0');
  await until(() => window.__game.gun.mag === 0 || window.__game.gun.reloading);
  await release('Mouse0');
  await tap('KeyR');
  const reloaded = await until(() => !window.__game.gun.reloading && window.__game.gun.mag === window.__game.gun.def.magSize);
  const full = await state();
  console.log('  pistol reloaded', reloaded, JSON.stringify(full));
  if (!reloaded || !full.infinite) throw new Error('pistol did not reload from its infinite reserve');

  // Roll cancels a reload (committed body).
  await hold('Mouse0');
  await wait(300);
  await release('Mouse0');
  await tap('KeyR');
  await until(() => window.__game.gun.reloading);
  await tap('Space');
  await until(() => window.__game.player.controller.state !== 'move', 4000);
  const cancelled = await state();
  console.log('  pistol roll-cancel', JSON.stringify(cancelled));
  if (cancelled.reloading) throw new Error('roll did not cancel the reload');

  // Long shot: ADS on the dais dummy (47 m, raised 0.9 m).
  await until(() => window.__game.player.controller.state === 'move');
  await aim([0, 2.1, -47]);
  await hold('Mouse2');
  await wait(600);
  await shot('22-pistol-ads-47m');
  await release('Mouse2');
}

// V2-2 scenario: the SwordRifle. Rifle shot spends a charge; empty trigger is dry; F switches to the sword; the
// combo lands and refills a charge; the charged strike spends two; a guard dummy blocks from the front but not the
// flank; the restored blade hits harder than the rusted one; a swing's windup can't be rolled out of.
export async function swordScenario({ g, wait, shot }) {
  const tap = async (code) => {
    await g((c) => window.__game.input.press(c), code);
    await wait(60);
    await g((c) => window.__game.input.release(c), code);
  };
  const until = async (fn, timeout = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn)) return true;
      await wait(60);
    }
    return false;
  };
  const state = () =>
    g(() => {
      const gm = window.__game;
      const s = gm.arsenal.sword;
      return {
        gun: gm.gun.def.id,
        charges: gm.gun.mag,
        reloading: gm.gun.reloading,
        mode: s?.mode,
        phase: s?.swing.phase,
        dummies: gm.dummies.map((d) => Math.round(d.health)),
      };
    });
  /** Stand at (x, z) facing yaw, camera behind. */
  const stand = (x, z, yaw) =>
    g(([x, z, yaw]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = -0.05;
    }, [x, z, yaw]);
  const aim = async (p) => {
    for (let i = 0; i < 4; i++) {
      await g((pt) => window.__game.aimAt(pt), p);
      await wait(80);
    }
  };

  await g(() => window.__game.start('justice'));
  await wait(1200);
  await stand(0, 1, 0);
  await tap('Digit2');
  await g(() => window.__game.input.onKey('Digit2'));
  const swapped = await until(() => window.__game.arsenal.index === 1 && !window.__game.arsenal.isSwapping);
  if (!swapped) throw new Error('could not swap to the SwordRifle');
  await wait(300);
  await shot('30-swordrifle-rifle');

  // ---- rifle: one heavy bolt spends one charge and hurts the 8 m dummy.
  // The heavy rifle is wild from the hip (2.6°) and precise aimed (0.04°): aim down the sights first.
  await g(() => window.__game.input.press('Mouse2'));
  await until(() => window.__game.camera.adsAmount > 0.99, 5000);
  // aimAt works from the current camera, which shifts as it settles: re-aim until the crosshair is on the torso.
  for (let i = 0; i < 12; i++) {
    await aim([-1.5, 1.2, -8]);
    if (await g(() => window.__game.aimPoint.distanceTo({ x: -1.5, y: 1.2, z: -8 }) < 0.5)) break;
  }
  const r0 = await state();
  if (r0.charges !== 6 || r0.mode !== 'rifle') throw new Error(`expected a full rifle, got ${JSON.stringify(r0)}`);
  await tap('Mouse0');
  await until(() => window.__game.dummies[0].health < 220, 8000);
  await shot('31-swordrifle-bolt');
  await g(() => window.__game.input.release('Mouse2'));
  const r1 = await state();
  console.log('  rifle shot', JSON.stringify({ r0, r1 }));
  if (r1.charges !== 5) throw new Error('a rifle shot should spend exactly one charge');
  if (r1.dummies[0] >= 220) throw new Error('the bolt missed the 8 m dummy');

  // ---- empty: the trigger is dry and the count stays at zero (no reload).
  await until(() => window.__game.gun.cycleT >= 1, 8000);
  await g(() => { window.__game.gun.mag = 0; });
  await tap('Mouse0');
  await tap('KeyR');
  await wait(400);
  const dry = await state();
  if (dry.charges !== 0 || dry.reloading) throw new Error('an empty SwordRifle should stay empty');

  // ---- F: switch to the sword (committed transform).
  await tap('KeyF');
  const switched = await until(() => { const s = window.__game.arsenal.sword; return s.mode === 'sword' && !s.switching; });
  if (!switched) throw new Error('F did not switch to sword mode');
  await shot('32-sword-guard');

  // ---- combo on the left 8 m dummy: blade hits land and refill a charge.
  await g(() => { window.__tuning.swordRifle.repairStage = 4; window.__game.dummies.forEach((d) => (d.health = 220)); });
  await stand(-1.5, -6.5, 0);
  await wait(300);
  const c0 = await state();
  await tap('Mouse0');
  await until(() => window.__game.arsenal.sword.swing.phase === 'active', 4000);
  await shot('33-sword-swing');
  await until(() => window.__game.arsenal.sword.swing.phase === 'idle', 6000);
  const c1 = await state();
  console.log('  sword swing', JSON.stringify({ c0, c1 }));
  if (c1.dummies[0] >= c0.dummies[0]) throw new Error('the swing missed the dummy in front of her');
  if (c1.charges !== c0.charges + 1) throw new Error('a blade hit should refill one charge');
  const restoredHit = c0.dummies[0] - c1.dummies[0];

  // ---- the same swing, rusted: weaker (from the same spot: the first swing's lunge carried her forward).
  await g(() => { window.__tuning.swordRifle.repairStage = 0; window.__game.dummies[0].health = 220; });
  await stand(-1.5, -6.5, 0);
  await wait(300);
  await tap('Mouse0');
  await until(() => window.__game.arsenal.sword.swing.phase === 'recover', 4000);
  await until(() => window.__game.arsenal.sword.swing.phase === 'idle', 6000);
  const rusted = 220 - (await state()).dummies[0];
  console.log('  swing damage restored vs rusted', restoredHit, rusted);
  if (!(rusted > 0 && rusted < restoredHit)) throw new Error(`the rusted blade should hit softer than the restored one (${rusted} vs ${restoredHit})`);

  // ---- committed: during the windup, Space does not roll.
  await tap('Mouse0');
  await until(() => window.__game.arsenal.sword.swing.phase === 'windup', 2000);
  await tap('Space');
  const rolled = await g(() => window.__game.player.controller.state === 'roll');
  if (rolled) throw new Error('rolled out of a swing windup (should be committed)');
  await until(() => window.__game.arsenal.sword.swing.phase === 'idle', 6000);

  // ---- charged strike (hold RMB): spends two charges, hits hard.
  await g(() => { window.__game.gun.mag = 6; window.__game.dummies[0].health = 220; window.__tuning.swordRifle.repairStage = 4; });
  await g(() => window.__game.input.press('Mouse2'));
  const ready = await until(() => window.__game.arsenal.sword.swing.chargeReady, 6000);
  await shot('34-sword-charging');
  await g(() => window.__game.input.release('Mouse2'));
  await until(() => window.__game.arsenal.sword.swing.phase === 'active', 4000);
  await shot('35-sword-charged-strike');
  await until(() => window.__game.arsenal.sword.swing.phase === 'idle', 8000);
  const ch = await state();
  console.log('  charged strike', ready, JSON.stringify(ch));
  if (!ready) throw new Error('the charged strike never became ready');
  if (ch.charges !== 5) throw new Error(`charged strike should spend 2 and refill 1 on the hit (expected 5, got ${ch.charges})`);
  if (220 - ch.dummies[0] < 100) throw new Error('the charged strike should hit far harder than a swing');

  // ---- guard dummy (index 5, at (-6, -4), shield toward +Z): blocked from the front, hurt from the flank.
  await stand(-6, -2.4, 0);
  await wait(300);
  await tap('Mouse0');
  await until(() => window.__game.arsenal.sword.swing.phase === 'recover', 4000);
  await shot('36-sword-blocked');
  // A blocked blade rebounds (index 99 marks the rebound recovery): proof the swing reached the shield.
  const rebounded = await g(() => window.__game.arsenal.sword.swing.index === 99);
  if (!rebounded) throw new Error('the front swing never reached the guard (no rebound)');
  await until(() => window.__game.arsenal.sword.swing.phase === 'idle', 8000);
  const front = (await state()).dummies[5];
  await stand(-7.6, -4, -Math.PI / 2);
  await wait(300);
  await tap('Mouse0');
  // Wait for the swing to start before waiting for it to finish (idle-before-start would read too early).
  await until(() => window.__game.arsenal.sword.swing.phase !== 'idle', 4000);
  await until(() => window.__game.arsenal.sword.swing.phase === 'idle', 8000);
  const flank = (await state()).dummies[5];
  console.log('  guard dummy front / flank', front, flank);
  if (front !== 220) throw new Error('the guard should block a blow from the front');
  if (flank >= 220) throw new Error('the guard should be hurt from the flank');

  // ---- back to rifle mode.
  await tap('KeyF');
  await until(() => { const s = window.__game.arsenal.sword; return s.mode === 'rifle' && !s.switching; });
  await shot('37-swordrifle-back-to-rifle');
}

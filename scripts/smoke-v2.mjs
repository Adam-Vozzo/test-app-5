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
  await wait(300);
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
  await wait(200);
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

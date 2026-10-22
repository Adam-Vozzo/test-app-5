// M2 scenario: target range. Fire bursts, crit the head, slow-mo frame of the juice, reload, roll-cancel.
export async function rangeScenario({ g, hold, release, wait, shot }) {
  // A real key/button tap: down for one frame, then up.
  const tap = async (code) => {
    await g((c) => window.__game.input.press(c), code);
    await wait(40);
    await g((c) => window.__game.input.release(c), code);
  };
  const state = () =>
    g(() => {
      const gm = window.__game;
      return {
        mag: gm.gun.mag,
        reloading: gm.gun.reloading,
        reloadT: +gm.gun.reloadT.toFixed(2),
        spread: +gm.gun.spread.toFixed(2),
        dummies: gm.dummies.map((d) => Math.round(d.health)),
        pitch: +gm.camera.pitch.toFixed(3),
      };
    });
  // aimAt twice: the camera position depends on yaw (shoulder offset), so converge in two frames.
  const aim = async (p) => {
    for (let i = 0; i < 4; i++) {
      await g((pt) => window.__game.aimAt(pt), p);
      await wait(100);
    }
  };
  // SwiftShader frames are slow and clamped, so game time lags wall time: wait on game state instead.
  const until = async (fn, timeout = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn)) return true;
      await wait(100);
    }
    return false;
  };

  await g(() => window.__game.start('range'));
  await wait(1200);
  await shot('10-range-spawn');

  // Body shots on the 10u dummy.
  await aim([-1.5, 0.85, -10]);
  await wait(200);
  const before = await state();
  await hold('Mouse0');
  await wait(120);
  await shot('11-range-firing');
  await wait(500);
  await release('Mouse0');
  const after = await state();
  console.log('  burst', JSON.stringify({ before, after }));
  if (after.mag >= before.mag) throw new Error('firing did not consume ammo');
  if (after.dummies[1] >= before.dummies[1]) throw new Error('burst did not damage the 10u dummy');
  if (after.pitch <= before.pitch) throw new Error('recoil did not climb');

  // Headshot (weak spot) on the 5u dummy, captured in slow-mo.
  await hold('Mouse2');
  await wait(600);
  await g(() => { window.__game.input.onKey('KeyT'); });
  await aim([1.5, 1.44, -5]);
  await wait(150);
  await tap('Mouse0');
  await wait(60);
  await shot('12-range-crit-slowmo');
  await wait(400);
  await g(() => { window.__game.input.onKey('KeyT'); });
  await release('Mouse2');
  const crit = await state();
  console.log('  after crit', JSON.stringify(crit));
  if (crit.dummies[0] >= 220) throw new Error('headshot missed the 5u dummy');

  // ADS on the 40u dummy.
  await aim([0, 0.85, -40]);
  await hold('Mouse2');
  await wait(500);
  await shot('13-range-ads-40');
  await hold('Mouse0');
  await wait(400);
  await release('Mouse0');
  await release('Mouse2');

  // Reload, then cancel one by rolling.
  await tap('KeyR');
  await wait(450);
  const mid = await state();
  await shot('14-range-reload');
  console.log('  reload mid', JSON.stringify(mid));
  if (!mid.reloading) throw new Error('reload did not start');
  await until(() => !window.__game.gun.reloading);
  const done = await state();
  if (done.reloading || done.mag !== 32) throw new Error(`reload did not finish: ${JSON.stringify(done)}`);
  await hold('Mouse0');
  await wait(300);
  await release('Mouse0');
  await tap('KeyR');
  await wait(300);
  await tap('Space');
  const rolled = await until(() => window.__game.player.controller.state !== 'move', 3000);
  const cancelled = { ...(await state()), rolled };
  console.log('  roll-cancel', JSON.stringify(cancelled));
  if (cancelled.reloading) throw new Error('roll did not cancel reload');
  await wait(900);

  // Kill a dummy to exercise the kill path.
  // Short bursts with re-aim between them, like a player pulling down against the climb.
  let killed = false;
  for (let i = 0; i < 30 && !killed; i++) {
    await aim([1.5, 1.42, -5]);
    await hold('Mouse0');
    await wait(450);
    await release('Mouse0');
    killed = await g(() => !window.__game.dummies[0].alive);
    if (!killed && (await g(() => window.__game.gun.mag === 0))) {
      await tap('KeyR');
      await until(() => !window.__game.gun.reloading);
    }
  }
  await shot('15-range-kill');
  console.log('  final', JSON.stringify(await state()));
  if (!killed) throw new Error('could not kill the 5u dummy');
}

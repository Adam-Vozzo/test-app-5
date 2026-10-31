// Touch controls (V2-18) on a phone-sized screen: real touches through Chrome's DevTools protocol (so the browser's
// own touch → pointer conversion runs), multi-touch included. The stick moves her and runs at the rim, a drag looks,
// Fire fires (and looks while held), Aim toggles, Roll rolls, Swap swaps, pause pauses, and the HUD and menus fit a
// landscape and a portrait phone.
export async function touchScenario({ browser, port, errors }) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`touch console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`touch pageerror: ${e.message}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => {
    await page.screenshot({ path: `screenshots/${name}.png` });
    console.log(`  screenshot screenshots/${name}.png`);
  };
  const until = async (fn, timeout = 6000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(100);
    }
    return false;
  };
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })) });
  const centre = (sel) => g((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, sel);
  const tap = async (sel) => {
    const [x, y] = await centre(sel);
    await touch('touchStart', [[x, y, 7]]);
    await wait(120);
    await touch('touchEnd', []);
    await wait(120);
  };

  await page.goto(`http://localhost:${port}/?seed=42&touch=1`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  const legend = await g(() => ({ touch: document.body.classList.contains('touch-on'), keys: document.querySelector('.overlay .keys b')?.textContent }));
  console.log(`  touch: on ${legend.touch}, legend "${legend.keys}"`);
  if (!legend.touch || legend.keys !== 'Left thumb') throw new Error('?touch=1 should turn the touch controls and their legend on');
  await shot('120-touch-menu');

  await g(() => window.__game.start('justice'));
  await wait(1500);
  const shown = await g(() => {
    const vis = (v) => {
      const b = document.querySelector(`.touch .tb.${v}`);
      return !!b && getComputedStyle(b).display !== 'none';
    };
    return { layer: getComputedStyle(document.querySelector('.touch')).display !== 'none', fire: vis('fire'), mode: vis('mode'), parry: vis('parry'), use: vis('use'), locked: window.__game.input.locked };
  });
  console.log(`  touch layer: ${JSON.stringify(shown)}`);
  if (!shown.layer || !shown.fire || shown.mode || shown.use || !shown.locked) throw new Error('playing on touch, the controls should be up (no mode button with the pistol, no Use with nothing near)');
  await shot('121-touch-courtyard');

  // The stick: a thumb on the left, pushed up to the rim: she runs forward.
  const from = await g(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  await touch('touchStart', [[150, 290, 1]]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [[150, 290 - i * 12, 1]]);
    await wait(30);
  }
  const ran = await until(() => window.__game.player.controller.sprinting, 4000);
  await wait(1200);
  await shot('122-touch-running');
  // A second thumb looks while the first still runs.
  const yaw0 = await g(() => window.__game.camera.yaw);
  await touch('touchStart', [[150, 194, 1], [560, 170, 2]]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [[150, 194, 1], [560 + i * 20, 170, 2]]);
    await wait(30);
  }
  await touch('touchEnd', []);
  await wait(300);
  const moved = await g((f) => Math.hypot(window.__game.player.pos.x - f.x, window.__game.player.pos.z - f.z), from);
  const turned = await g((y) => Math.abs(window.__game.camera.yaw - y), yaw0);
  const stopped = await g(() => window.__game.input.stickX === 0 && window.__game.input.stickY === 0);
  console.log(`  stick: ran ${ran}, moved ${moved.toFixed(1)} m; look turned ${turned.toFixed(2)} rad; let go ${stopped}`);
  if (!ran || moved < 1.5 || turned < 0.05 || !stopped) throw new Error('the stick should run her forward, a second thumb should look, and letting go should stop her');

  // Fire: held, it fires; Aim toggles; Roll rolls.
  const shots0 = await g(() => window.__game.stats.shots);
  const [fx, fy] = await centre('.touch .tb.fire');
  await touch('touchStart', [[fx, fy, 3]]);
  await wait(600);
  await touch('touchEnd', []);
  const fired = await until((s) => window.__game.stats.shots > s, 3000, shots0);
  await tap('.touch .tb.aim');
  const aiming = await until(() => window.__game.player.aiming, 3000);
  await tap('.touch .tb.aim');
  const unaimed = await until(() => !window.__game.player.aiming, 3000);
  await tap('.touch .tb.roll');
  const rolled = await until(() => window.__game.player.controller.state !== 'move', 3000);
  console.log(`  buttons: fired ${fired}, aim on ${aiming} and off ${unaimed}, rolled ${rolled}`);
  if (!fired || !aiming || !unaimed || !rolled) throw new Error('Fire should fire, Aim toggle, and Roll roll');

  // Swap: the SwordRifle, and its mode button appears.
  await wait(800);
  await tap('.touch .tb.swap');
  const swapped = await until(() => window.__game.arsenal.state.index === 1 && !window.__game.arsenal.isSwapping, 5000);
  const modeShown = await until(() => getComputedStyle(document.querySelector('.touch .tb.mode')).display !== 'none', 2000);
  console.log(`  swap: SwordRifle ${swapped}, mode button ${modeShown}`);
  if (!swapped || !modeShown) throw new Error('Swap should take up the SwordRifle and show its mode button');

  // Pause, and back.
  await tap('.touch .tb.pause');
  const paused = await until(() => window.__game.mode === 'paused', 3000);
  // (the controls hide on the next frame)
  const hidden = await until(() => getComputedStyle(document.querySelector('.touch')).display === 'none', 2000);
  await shot('123-touch-paused');
  await page.touchscreen.tap(...(await centre('.overlay:not(.hidden) button[data-a="resume"]')));
  const resumed = await until(() => window.__game.mode === 'playing', 3000);
  console.log(`  pause: paused ${paused} (controls hidden ${hidden}), resumed ${resumed}`);
  if (!paused || !hidden || !resumed) throw new Error('the pause button should pause (hiding the controls), and Resume resume');

  // Portrait: the same game, the cluster smaller, the HUD on screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(900);
  const fits = await g(() =>
    [...document.querySelectorAll('.touch .tb:not(.off), .vitals, .ammo')].every((el) => {
      const r = el.getBoundingClientRect();
      return r.width === 0 || (r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1);
    }),
  );
  await shot('124-touch-portrait');
  console.log(`  portrait: everything on screen ${fits}`);
  if (!fits) throw new Error('in portrait every control and the HUD should stay on screen');
  await ctx.close();
}

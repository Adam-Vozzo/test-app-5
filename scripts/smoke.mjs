// Smoke test: build, serve, load in headless Chromium (SwiftShader WebGL), drive a scripted session,
// capture screenshots. Any console error or page error fails the run.
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4179;
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

if (!process.argv.includes('--no-build')) execSync('npx vite build', { stdio: 'inherit' });
const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
await new Promise((res) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  setTimeout(res, 5000);
});

const errors = [];
const browser = await chromium.launch({
  // CHROMIUM_PATH: use a pre-installed browser when it doesn't match the pinned Playwright version.
  executablePath: process.env.CHROMIUM_PATH || undefined,
  // Autoplay allowed so the WebAudio synth actually runs (and can throw) headless.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  if (m.type() === 'warning') console.log('  warn:', m.text().slice(0, 200));
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  screenshot ${OUT}/${name}.png`);
};
const g = (fn, arg) => page.evaluate(fn, arg);
const hold = (code) => g((c) => window.__game.input.virtual.add(c), code);
const release = (code) => g((c) => window.__game.input.virtual.delete(c), code);
const press = async (code) => {
  await g((c) => window.__game.input.press(c), code);
  await wait(40);
  await g((c) => window.__game.input.release(c), code);
};
const look = (dx, dy) => g(([x, y]) => window.__game.camera.look(x, y), [dx, dy]);

try {
  await page.goto(`http://localhost:${PORT}/?seed=42`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  await wait(500);
  await shot('00-menu');

  // ---- Justice courtyard (v2): walk, look around, roll, IK debug. Pixel mode is on by default.
  await g(() => window.__game.start('justice'));
  await wait(1500);
  await shot('01-justice-spawn');
  const body = await g(() => {
    const b = window.__game.player.biped;
    return { hips: +b.hips.y.toFixed(2), head: +b.head.position.y.toFixed(2), chest: +b.chest.y.toFixed(2) };
  });
  console.log('  body heights (m)', JSON.stringify(body));
  if (body.head < 1.2 || body.head > 1.7) throw new Error(`head height ${body.head} m is not humanoid scale`);
  await hold('KeyW');
  await wait(900);
  await shot('02-justice-walking');
  await release('KeyW');
  await look(-500, 40);
  await hold('KeyW');
  await hold('ShiftLeft');
  await wait(1500);
  await release('ShiftLeft');
  await release('KeyW');
  await wait(300);
  await shot('03-justice-sprint-turn');
  await press('Space');
  await wait(180);
  await shot('04-justice-roll');
  await wait(800);
  await g(() => { window.__game.input.press('KeyI'); window.__game.input.onKey('KeyI'); });
  await hold('Mouse2');
  await wait(500);
  await shot('05-justice-ads-ik');
  await release('Mouse2');
  await g(() => { window.__game.input.onKey('KeyI'); window.__game.input.onKey('KeyH'); });
  await wait(300);
  await shot('06-justice-colliders');
  await g(() => window.__game.input.onKey('KeyH'));
  // Pixel mode with a thick, eager outline (a shader compile error logs a console error and fails the run).
  await g(() => { const p = window.__tuning.pixel; p.edgeWidth = 2; p.edgeThreshold = 0.05; p.outline = 0.8; });
  await wait(800);
  await shot('08-justice-pixel-thick-outline');
  const pixelDraws = await g(() => window.__game.renderer.renderer.info.render.calls);
  console.log('  pixel-mode draws/frame', pixelDraws);
  if (pixelDraws < 5) throw new Error('frame stats only counted the pixel pass');
  await g(() => { const p = window.__tuning.pixel; p.edgeWidth = 1; p.edgeThreshold = 0.3; p.outline = 0.3; p.enabled = false; });
  await wait(700);
  await shot('09-justice-no-pixel');
  await g(() => { window.__tuning.pixel.enabled = true; });

  // Tuning panel open, with the pistol folder expanded.
  await g(() => {
    const gm = window.__game;
    gm.input.onKey('Backquote');
    const f = gm.panel.gui.foldersRecursive().find((x) => x._title === 'weapons');
    f?.open();
    f?.folders[0]?.open();
    f?.folders[0]?.folders.find((x) => x._title === 'recoil')?.open();
  });
  await wait(300);
  await shot('07-tuning-panel');
  await g(() => window.__game.input.onKey('Backquote'));
  // Regression: dragging walkSpeed / roll duration to 0 once made the beetle vanish for good (NaN state).
  await g(() => { const tu = window.__tuning; tu.player.walkSpeed = 0; tu.roll.duration = 0; });
  await press('Space');
  await hold('KeyW');
  await wait(500);
  await release('KeyW');
  await g(() => { const tu = window.__tuning; tu.player.walkSpeed = 4.5; tu.roll.duration = 0.5; });
  await wait(600);
  const finiteRig = await g(() => {
    const p = window.__game.player;
    const v = [...p.biped.hips.toArray(), ...p.pos.toArray(), ...p.biped.chest.toArray()];
    return v.every(Number.isFinite);
  });
  console.log('  rig finite after zeroed tuning:', finiteRig);
  if (!finiteRig) throw new Error('player rig went NaN after zeroed tuning values');
  const audio = await g(() => window.__game.synth.ctx?.state ?? 'none');
  console.log('  audio context', audio);
  const stats = await g(() => {
    const gm = window.__game;
    return { pos: gm.player.pos.toArray().map((v) => +v.toFixed(2)), draws: gm.renderer.renderer.info.render.calls };
  });
  console.log('  justice stats', JSON.stringify(stats));

  // ---- The look: back to the spawn, then the scales down the axis, the player from the front, and wide.
  await g(() => {
    const gm = window.__game;
    gm.player.controller.teleport(gm.world.spawn, 0);
    gm.camera.snap(gm.world.spawn, 0);
  });
  await wait(900);
  await shot('10-justice-gate-frame');
  await g(() => { const gm = window.__game; gm.player.controller.teleport({ x: 0, y: 0.05, z: -40 }, 0); gm.camera.snap(gm.player.pos, 0); gm.camera.pitch = 0.12; });
  await wait(900);
  await shot('11-justice-scales');
  // Face the camera: she turns to +Z while the camera keeps looking -Z.
  await g(() => { const gm = window.__game; gm.player.combatTimer = 0; gm.player.controller.teleport(gm.player.pos.clone(), Math.PI); gm.camera.pitch = -0.05; });
  await wait(500);
  await shot('12-justice-player-front');
  await g(() => { const gm = window.__game; gm.player.controller.teleport({ x: -30, y: 0.05, z: 20 }, 2.4); gm.camera.snap(gm.player.pos, 2.4); gm.camera.pitch = 0.05; });
  await wait(900);
  await shot('13-justice-graveyard');
  const draws = await g(() => window.__game.renderer.renderer.info.render.calls);
  console.log('  justice draws/frame', draws);

  if (process.argv.includes('--zones')) {
    const { zonesScenario } = await import('./smoke-m5.mjs');
    await zonesScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--enemies')) {
    const { enemiesScenario } = await import('./smoke-m4.mjs');
    await enemiesScenario({ page, g, hold, release, press, look, wait, shot });
  }

  if (process.argv.includes('--sword')) {
    const { holsterScenario } = await import('./smoke-v2.mjs');
    await holsterScenario({ page, g, hold, release, press, look, wait, shot });
    const { swordScenario } = await import('./smoke-v2.mjs');
    await swordScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--level')) {
    const { levelScenario } = await import('./smoke-v2.mjs');
    await levelScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--foes')) {
    const { foesScenario } = await import('./smoke-v2.mjs');
    await foesScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--court')) {
    const { courtScenario } = await import('./smoke-v2.mjs');
    await courtScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--boss')) {
    const { bossScenario } = await import('./smoke-v2.mjs');
    await bossScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--hub')) {
    const { hubScenario } = await import('./smoke-v2.mjs');
    await hubScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--devil')) {
    const { devilScenario, devilFoesScenario, devilCourtScenario } = await import('./smoke-v2.mjs');
    await devilScenario({ page, g, hold, release, press, look, wait, shot });
    await devilFoesScenario({ page, g, hold, release, press, look, wait, shot });
    await devilCourtScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--tower')) {
    const { towerScenario } = await import('./smoke-v2.mjs');
    await towerScenario({ page, g, hold, release, press, look, wait, shot });
  }
  if (process.argv.includes('--pistol')) {
    const { pistolScenario } = await import('./smoke-v2.mjs');
    await pistolScenario({ page, g, hold, release, press, look, wait, shot });
  }
  // --enemies and --zones (above) drive v1's legacy bug-scale scenes, reachable by URL only until v2 replaces them.
} catch (e) {
  errors.push(`script: ${e.message}`);
} finally {
  await browser.close().catch(() => {});
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill();
  }
}

if (errors.length) {
  console.error('\nSMOKE FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nSMOKE OK');
process.exit(0);

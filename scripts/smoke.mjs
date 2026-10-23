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

  // ---- Arena: walk, look around, roll, IK debug
  await g(() => window.__game.start('arena'));
  await wait(1200);
  await shot('01-arena-spawn');
  await hold('KeyW');
  await wait(900);
  await shot('02-arena-walking');
  await release('KeyW');
  await look(-500, 40);
  await hold('KeyW');
  await hold('ShiftLeft');
  await wait(1500);
  await release('ShiftLeft');
  await release('KeyW');
  await wait(300);
  await shot('03-arena-sprint-turn');
  await press('Space');
  await wait(180);
  await shot('04-arena-roll');
  await wait(800);
  await g(() => { window.__game.input.press('KeyI'); window.__game.input.onKey('KeyI'); });
  await hold('Mouse2');
  await wait(500);
  await shot('05-arena-ads-ik');
  await release('Mouse2');
  await g(() => { window.__game.input.onKey('KeyI'); window.__game.input.onKey('KeyH'); });
  await wait(300);
  await shot('06-arena-colliders');
  await g(() => window.__game.input.onKey('KeyH'));
  // Tuning panel open, with the repeater folder expanded.
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
  await g(() => { const tu = window.__tuning; tu.player.walkSpeed = 3; tu.roll.duration = 0.5; });
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
  console.log('  arena stats', JSON.stringify(stats));

  // Optional milestone-specific scenario
  if (process.argv.includes('--range')) {
    const { rangeScenario, weaponsScenario } = await import('./smoke-range.mjs');
    await rangeScenario({ page, g, hold, release, press, look, wait, shot });
    await weaponsScenario({ page, g, hold, release, press, look, wait, shot });
  }
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

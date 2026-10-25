// M5 scenario: both zone themes build, N regenerates, pollen cache pays once, rest respawns non-elites,
// a slain brute stays dead.
export async function zonesScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn)) return true;
      await wait(100);
    }
    return false;
  };
  for (const theme of ['garden', 'kitchen']) {
    await g((t) => window.__game.start(t), theme);
    await wait(1500);
    await shot(`50-${theme}-spawn`);
    await g(() => { window.__tuning.pixel.enabled = false; });
    await wait(700);
    await shot(`50-${theme}-spawn-no-pixel`);
    await g(() => { window.__tuning.pixel.enabled = true; });
    await g(() => { window.__tuning.debug.overview = true; window.__tuning.debug.showGraph = true; });
    await wait(900);
    await shot(`51-${theme}-overview`);
    await g(() => { window.__tuning.debug.overview = false; window.__tuning.debug.showGraph = false; });
    const info = await g(() => {
      const gm = window.__game;
      const z = gm.zone;
      return { seed: gm.zoneSeed, nodes: z.layout.nodes.length, enemies: gm.enemies.enemies.length, brute: gm.enemies.enemies.filter((e) => e.kind === 'brute').length };
    });
    console.log(`  ${theme}`, JSON.stringify(info));
    if (!info.nodes || info.brute !== 1) throw new Error(`${theme} zone malformed`);
  }

  // N: new seed, new layout.
  const before = await g(() => JSON.stringify(window.__game.zone.layout.nodes.map((n) => [Math.round(n.x), Math.round(n.z)])));
  await g(() => window.__game.input.onKey('KeyN'));
  await wait(1200);
  const after = await g(() => ({ seed: window.__game.zoneSeed, nodes: JSON.stringify(window.__game.zone.layout.nodes.map((n) => [Math.round(n.x), Math.round(n.z)])) }));
  console.log('  regenerated → seed', after.seed);
  if (after.nodes === before) throw new Error('N did not change the zone');

  // Pollen cache: walk onto it.
  await g(() => { window.__tuning.debug.godMode = true; const gm = window.__game; const c = gm.zone.cache.at; gm.player.controller.teleport(c.clone().setY(c.y + 0.1).setX(c.x + 1), 0); });
  const cached = await until(() => window.__game.vitals.currency >= 40, 6000);
  await wait(600);
  await shot('52-pollen-cache');
  console.log('  cache pollen', await g(() => window.__game.vitals.currency));
  if (!cached) throw new Error('pollen cache did not pay out');

  // Slay the brute, kill a normal enemy, rest: the normal one returns, the brute does not.
  const res = await g(() => {
    const gm = window.__game;
    const V = gm.player.pos.constructor;
    const brute = gm.enemies.enemies.find((e) => e.kind === 'brute');
    const grunt = gm.enemies.enemies.find((e) => e.kind !== 'brute');
    const hit = (e) => e.takeDamage({ amount: 1e6, crit: false, point: e.center.clone(), dir: new V(0, 0, -1), knockback: 0, stagger: 0 });
    hit(brute);
    hit(grunt);
    const cp = gm.world.checkpoint;
    gm.player.controller.teleport(cp.clone().add(new V(1.5, 0.1, 0)), 0);
    return { bruteDead: !brute.alive, gruntDead: !grunt.alive };
  });
  await wait(300);
  await g(() => { window.__game.input.press('KeyE'); });
  await wait(300);
  await g(() => { window.__game.input.release('KeyE'); });
  const afterRest = await g(() => {
    const gm = window.__game;
    return { brute: gm.enemies.enemies.find((e) => e.kind === 'brute').alive, grunt: gm.enemies.enemies.find((e) => e.kind !== 'brute').alive, cacheOpen: gm.zone.cache.opened };
  });
  console.log('  slain', JSON.stringify(res), 'after rest', JSON.stringify(afterRest));
  if (!afterRest.grunt) throw new Error('rest did not respawn the normal enemy');
  if (afterRest.brute) throw new Error('slain elite respawned on rest');
  if (!afterRest.cacheOpen) throw new Error('cache should stay collected');
}

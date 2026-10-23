// M4 scenario: enemies, damage, heal, i-frames, kill + corpse, death screen, rise, pollen recovery, glob marker.
export async function enemiesScenario({ g, hold, release, wait, shot }) {
  const tap = async (code) => {
    await g((c) => window.__game.input.press(c), code);
    await wait(40);
    await g((c) => window.__game.input.release(c), code);
  };
  const until = async (fn, timeout = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn)) return true;
      await wait(100);
    }
    return false;
  };
  // Move enemies by kind+index to [x, z, yaw]; everyone else parks far away and asleep.
  const stage = (spots, player = [0, 2, 0]) =>
    g(([spots, player]) => {
      const gm = window.__game;
      const V = gm.player.pos.constructor;
      gm.player.controller.teleport(new V(player[0], 0.05, player[1]), player[2]);
      gm.camera.snap(gm.player.pos, player[2]);
      gm.enemies.enemies.forEach((e, i) => {
        const s = spots[e.kind + i];
        if (s) {
          e.home.set(s[0], 0.02, s[1]);
          e.homeYaw = s[2] ?? Math.PI;
        } else e.home.set(70 + i * 4, 0.02, 70);
        e.slain = false;
        e.respawn();
      });
    }, [spots, player]);
  const st = () =>
    g(() => {
      const gm = window.__game;
      return {
        hp: Math.round(gm.vitals.health),
        stamina: Math.round(gm.vitals.stamina),
        heals: gm.vitals.healCharges,
        pollen: gm.vitals.pollen,
        dead: gm.vitals.dead,
        enemies: gm.enemies.enemies.filter((e) => e.home.x < 60).map((e) => `${e.kind}:${e.state}:${Math.round(e.health)}`),
      };
    });

  await g(() => window.__game.start('arena'));
  await wait(1200);
  await g(() => { window.__tuning.debug.godMode = false; });

  // Head close-up: both eyes on the face (regression for the floating eye).
  await g(() => { const gm = window.__game; gm.camera.yaw = Math.PI; gm.camera.pitch = -0.05; window.__tuning.camera.distance = 1.2; });
  await wait(600);
  await shot('40-beetle-face');
  await g(() => { window.__tuning.camera.distance = 2.7; window.__game.camera.yaw = 0; });

  // ---- A skitterer bites us.
  await stage({ skitterer0: [0, -2.5] });
  const bitten = await until(() => window.__game.vitals.health < 100, 15000);
  await shot('41-bitten');
  console.log('  bitten', bitten, JSON.stringify(await st()));
  if (!bitten) throw new Error('skitterer never landed a bite');

  // ---- i-frames: a hit during the roll's i-frame window misses.
  const dodged = await g(() => {
    const gm = window.__game;
    const c = gm.player.controller;
    c.state = 'roll';
    c.stateTime = 0;
    const r = gm.hurtPlayer(25, gm.player.pos.clone().add({ x: 0, y: 0, z: -1 }), 2);
    c.state = 'move';
    return r;
  });
  if (dodged) throw new Error('i-frames did not prevent damage');

  // ---- Kill the skitterer (crit the head) and check the pollen reward.
  await g(() => { window.__game.enemies.enemies.forEach((e) => { if (e.kind === 'skitterer') e.cfg.speed = 0; }); });
  for (let i = 0; i < 20; i++) {
    const done = await g(() => !window.__game.enemies.enemies[0].alive);
    if (done) break;
    await g(() => { const gm = window.__game; const e = gm.enemies.enemies[0]; gm.aimAt(e.rig.pos.toArray()); });
    await wait(80);
    await g(() => { const gm = window.__game; const e = gm.enemies.enemies[0]; gm.aimAt(e.rig.pos.toArray()); });
    await hold('Mouse0');
    await wait(300);
    await release('Mouse0');
  }
  await g(() => { window.__tuning.enemies.skitterer.speed = 6.2; });
  const afterKill = await st();
  console.log('  after kill', JSON.stringify(afterKill));
  if (afterKill.pollen < 1) throw new Error('kill gave no pollen');
  await wait(700);
  await shot('42-corpse-flipped');

  // ---- Heal: Q, committed, restores health and spends a charge.
  const hpBefore = (await st()).hp;
  await tap('KeyQ');
  await wait(200);
  await shot('43-healing');
  await until(() => !window.__game.vitals.healing, 8000);
  const healed = await st();
  console.log('  healed', hpBefore, '->', healed.hp, 'charges', healed.heals);
  if (healed.hp <= hpBefore || healed.heals !== 2) throw new Error('heal did not work');

  // ---- Spitter glob + ground marker.
  await stage({ spitter4: [0, -9] });
  const lobbed = await until(() => window.__game.hazards.globs.length > 0, 15000);
  await g(() => { window.__tuning.debug.slowmo = true; });
  await wait(250);
  await shot('44-glob-marker');
  await g(() => { window.__tuning.debug.slowmo = false; });
  if (!lobbed) throw new Error('spitter never lobbed a glob');

  // ---- Death: the pollen drops where we fell; death screen; rise; recover the pollen.
  await stage({ skitterer0: [0, -2.5] }, [3, 3, 0]);
  await g(() => { window.__game.vitals.health = 1; });
  const died = await until(() => window.__game.vitals.dead, 15000);
  if (!died) throw new Error('player never died');
  const dropAt = await g(() => window.__game.pollenDrop.group.position.toArray());
  await until(() => !document.querySelector('.overlay.death').classList.contains('hidden'), 8000);
  await shot('45-death-screen');
  await g(() => window.__game.rise());
  await wait(400);
  const risen = await st();
  console.log('  risen', JSON.stringify(risen), 'drop at', dropAt.map((x) => +x.toFixed(1)));
  if (risen.dead || risen.hp !== 100 || risen.heals !== 3) throw new Error('rise did not restore the player');
  if (risen.pollen !== 0) throw new Error(`pollen should be on the ground after death, not carried: ${risen.pollen}`);
  await g((p) => { const gm = window.__game; gm.player.controller.teleport(new gm.player.pos.constructor(p[0], 0.05, p[2]), 0); }, dropAt);
  const got = await until(() => window.__game.vitals.pollen > 0, 5000);
  console.log('  pollen recovered', got, (await st()).pollen);
  if (!got) throw new Error('could not recover dropped pollen');
}

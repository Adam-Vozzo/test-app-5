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

// V2-3 scenario: a generated Justice level. Validation report, the spawn view, the overview with the mission graph,
// every vista, stairs, parapets, the shortcut (barred from the near side, lifted from the gate side), resting and
// rising at a later lantern, and the exit into level 2.
export async function levelScenario({ g, hold, release, press, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(100);
    }
    return false;
  };
  /** Teleport and face `yaw` (0 = -Z), camera behind. */
  const put = (x, y, z, yaw) =>
    g(([x, y, z, yaw]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: y + 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = 0;
    }, [x, y, z, yaw]);
  const pos = () => g(() => window.__game.player.pos.toArray().map((v) => +v.toFixed(2)));

  await g(() => {
    const gm = window.__game;
    gm.levelIndex = 0;
    gm.zoneSeed = 42;
    gm.start('level');
    // Real enemies now: the walkthrough checks the level, not the fights.
    window.__tuning.debug.godMode = true;
  });
  await wait(1500);
  const info = await g(() => {
    const gm = window.__game;
    const L = gm.level.generated;
    return {
      ok: gm.level.report.ok,
      attempts: gm.level.report.attempts,
      ms: +gm.level.report.ms.toFixed(1),
      setPiece: L.script.setPiece.id,
      path: L.graph.critical.map((id) => L.graph.nodes[id].kind).join(' → '),
      rooms: L.space.rooms.length,
      sockets: L.sockets.length,
      dummies: gm.dummies.length + gm.enemies.enemies.length,
      vistas: L.dressing.vistas.length,
    };
  });
  console.log('  level 1', JSON.stringify(info));
  if (!info.ok) throw new Error('level 1 failed validation');
  if (info.dummies !== info.sockets) throw new Error('every encounter socket should hold an enemy (or the miniboss stand-in)');
  await shot('30-level-spawn');
  const draws = await g(() => window.__game.renderer.renderer.info.render.calls);
  console.log('  level draws/frame', draws);
  if (draws > 150) throw new Error(`level draws ${draws} over the 150 budget`);

  await g(() => { window.__tuning.debug.overview = true; window.__tuning.debug.showGraph = true; });
  await wait(900);
  await shot('31-level-overview');
  await g(() => { window.__tuning.debug.overview = false; });
  await wait(300);
  await shot('32-level-kit-labels');
  await g(() => { window.__tuning.debug.showGraph = false; });
  for (let i = 0; i < info.vistas; i++) {
    await g((i) => window.__game.gotoVista(i), i);
    await wait(900);
    await shot(`33-level-vista-${i}`);
  }

  // Stairs: walk up the first connector that climbs.
  const stairs = await g(() => window.__game.level.generated.space.connectors.find((c) => c.kind === 'stairs' && Math.abs(c.y1 - c.y0) > 1));
  if (stairs) {
    const [x0, z0, y0, x1, z1, y1] = stairs.y1 > stairs.y0 ? [stairs.ax, stairs.az, stairs.y0, stairs.bx, stairs.bz, stairs.y1] : [stairs.bx, stairs.bz, stairs.y1, stairs.ax, stairs.az, stairs.y0];
    const yaw = Math.atan2(-(x1 - x0), -(z1 - z0));
    const back = 2.5;
    const len = Math.hypot(x1 - x0, z1 - z0);
    await put(x0 - ((x1 - x0) / len) * back, y0, z0 - ((z1 - z0) / len) * back, yaw);
    await wait(300);
    await hold('KeyW');
    const climbed = await until((top) => window.__game.player.pos.y > top - 0.3, 25000, y1);
    await release('KeyW');
    console.log(`  stairs ${y0}→${y1} m: climbed ${climbed}, at`, JSON.stringify(await pos()));
    if (!climbed) throw new Error('could not climb a stair connector');
  }

  // Parapets: run at a room's edge for a while and stay on the platform.
  const room = await g(() => window.__game.level.generated.space.rooms[0]);
  await put(room.x, room.y, room.z, Math.PI / 2);
  await hold('KeyW');
  await hold('ShiftLeft');
  // Reach the west parapet (game time lags wall time headless), then keep pushing into it.
  const reached = await until((edgeX) => window.__game.player.pos.x < edgeX, 15000, room.x - room.sx / 2 + 1.6);
  await wait(1200);
  await release('ShiftLeft');
  await release('KeyW');
  const edge = await pos();
  console.log(`  ran at the start room edge: reached ${reached}, at`, JSON.stringify(edge));
  if (!reached) throw new Error('never reached the start room edge');
  if (edge[1] < room.y - 0.5 || edge[0] < room.x - room.sx / 2) throw new Error('left the platform: the parapet leaked');

  // Shortcut: barred from the lantern side, lifted from the gate side, then walk back through it.
  const door = await g(() => window.__game.level.generated.dressing.door);
  const sx = door.opensFrom === 0 ? 0 : door.opensFrom === 1 ? 1 : door.opensFrom === 2 ? 0 : -1;
  const sz = door.opensFrom === 0 ? -1 : door.opensFrom === 2 ? 1 : 0;
  const faceGate = Math.atan2(-sx, -sz);
  await put(door.x - sx * 2.2, door.y, door.z - sz * 2.2, faceGate);
  await wait(400);
  await press('KeyE');
  await wait(400);
  const barred = await g(() => !window.__game.level.shortcutOpen());
  await shot('34-level-shortcut-barred');
  await put(door.x + sx * 2.2, door.y, door.z + sz * 2.2, faceGate + Math.PI);
  await wait(400);
  await press('KeyE');
  const lifted = await until(() => window.__game.level.shortcutOpen(), 5000);
  await wait(1500);
  await shot('35-level-shortcut-open');
  await hold('KeyW');
  const through = await until(([x, z, sx, sz]) => {
    const p = window.__game.player.pos;
    return (p.x - x) * sx + (p.z - z) * sz < -3;
  }, 15000, [door.x, door.z, sx, sz]);
  await release('KeyW');
  console.log(`  shortcut: barred from the near side ${barred}, lifted ${lifted}, walked back through ${through}`);
  if (!barred || !lifted || !through) throw new Error('the shortcut should open only from the gate side, then let you through');

  // Rest at the pre-miniboss lantern, die, and rise there.
  const lantern = await g(() => {
    const ls = window.__game.level.generated.dressing.lanterns;
    return ls[ls.length - 1];
  });
  await put(lantern.rest.x, lantern.rest.y, lantern.rest.z, 0);
  await wait(300);
  await press('KeyE');
  await wait(300);
  await g(() => {
    const gm = window.__game;
    window.__tuning.debug.godMode = false;
    gm.hurtPlayer(99999, gm.player.pos.clone().add({ x: 1, y: 0, z: 0 }), 0);
    window.__tuning.debug.godMode = true;
  });
  await wait(300);
  await g(() => window.__game.rise());
  await wait(500);
  const risen = await pos();
  const d = Math.hypot(risen[0] - lantern.rest.x, risen[2] - lantern.rest.z);
  console.log(`  rose ${d.toFixed(2)} m from the last lantern rested at`);
  if (d > 1.5) throw new Error('should rise at the last lantern rested at');

  // The exit: through the veiled gate into level 2.
  const exit = await g(() => window.__game.level.generated.dressing.exit);
  await put(exit.x, exit.y, exit.z + 2.5, 0);
  await wait(400);
  // Sealed while the Knight of Swords stands.
  await press('KeyE');
  await wait(600);
  const sealed = await g(() => window.__game.levelIndex === 0 && document.querySelector('.prompt')?.textContent?.includes('sealed'));
  await g(() => {
    const k = window.__game.enemies.enemies.find((e) => e.bar);
    k.takeDamage({ amount: 99999, crit: false, point: k.center, dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 });
  });
  await put(exit.x, exit.y, exit.z + 2.5, 0);
  await wait(400);
  console.log(`  exit sealed while the court card stands: ${sealed}`);
  if (!sealed) throw new Error('the exit should stay sealed until the court card falls');
  await press('KeyE');
  const next = await until(() => window.__game.levelIndex === 1 && !!window.__game.level, 15000);
  await wait(1500);
  const info2 = await g(() => {
    const gm = window.__game;
    return { ok: gm.level.report.ok, attempts: gm.level.report.attempts, setPiece: gm.level.generated.script.setPiece.id, beat: gm.level.generated.script.beat };
  });
  console.log('  level 2', JSON.stringify(info2));
  if (!next || !info2.ok) throw new Error('the exit should lead to a valid level 2');
  await shot('36-level2-spawn');
  await g(() => { window.__game.levelIndex = 2; window.__game.regenerate(42); });
  await wait(1500);
  const info3 = await g(() => ({ ok: window.__game.level.report.ok, beat: window.__game.level.generated.script.beat, draws: window.__game.renderer.renderer.info.render.calls }));
  console.log('  level 3', JSON.stringify(info3));
  if (!info3.ok) throw new Error('level 3 failed validation');
  await shot('37-level3-spawn');
  await g(() => { window.__tuning.debug.godMode = false; });
}

// The SwordRifle rides on her back while the pistol is out, and the swap reaches over the shoulder for it.
export async function holsterScenario({ g, wait, shot }) {
  await g(() => window.__game.start('justice'));
  await wait(1200);
  const slung = await g(() => !!window.__game.player.backModel && window.__game.arsenal.current.def.id === 'pistol');
  await g(() => window.__game.arsenal.request(1));
  let peak = 0;
  for (let i = 0; i < 400 && (await g(() => window.__game.arsenal.isSwapping)); i++) {
    peak = Math.max(peak, await g(() => window.__game.player.holster));
    await wait(20);
  }
  const drawn = await g(() => window.__game.arsenal.current.def.id === 'swordRifle' && !window.__game.player.backModel && window.__game.player.holster === 0);
  await g(() => window.__game.arsenal.request(0));
  for (let i = 0; i < 400 && (await g(() => window.__game.arsenal.isSwapping)); i++) await wait(20);
  const back = await g(() => !!window.__game.player.backModel);
  await shot('39-holster-slung');
  console.log(`  holster: slung at start ${slung}, drawn over the shoulder (peak ${peak.toFixed(2)}) ${drawn}, back on her back ${back}`);
  if (!slung || !drawn || !back || peak < 0.5) throw new Error('the SwordRifle should ride on her back and be drawn from it');
}

// V2-4 scenario: Justice's enemies in the training courtyard. The Bailiff's shield turns shots from the front but
// not during its recovery; the Gavel's slam hurts whoever stands in its ring; the Blindfold ignores footsteps and
// comes for gunfire; the Page throws a blade. Kills pay out.
export async function foesScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(60);
    }
    return false;
  };
  const put = (x, z, yaw) =>
    g(([x, z, yaw]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = 0;
    }, [x, z, yaw]);
  const spawn = (id, x, z, yaw, idle = 'stand') =>
    g(([id, x, z, yaw, idle]) => {
      const gm = window.__game;
      gm.enemies.spawnFoes([{ id, pos: { x, y: 0, z }, yaw, idle }], gm.physics, gm.rng.fork(`smoke-${id}`));
      return gm.enemies.enemies.length - 1;
    }, [id, x, z, yaw, idle]);
  const foe = (i) =>
    g((i) => {
      const f = window.__game.enemies.enemies[i];
      return { state: f.state, attack: f.attack, phase: f.phase, health: Math.round(f.health), max: f.maxHealth, x: f.ground.x, z: f.ground.z };
    }, i);
  const fire = async (n, gap = 120) => {
    for (let k = 0; k < n; k++) {
      await g(() => window.__game.input.press('Mouse0'));
      await wait(40);
      await g(() => window.__game.input.release('Mouse0'));
      await wait(gap);
    }
  };
  // Re-aim until the crosshair ray actually lands on the target (the camera settles after a teleport).
  const aimAt = async (i, h) => {
    for (let k = 0; k < 30; k++) {
      const err = await g(([i, h]) => {
        const gm = window.__game;
        const f = gm.enemies.enemies[i];
        gm.aimAt([f.ground.x, f.ground.y + h, f.ground.z]);
        return Math.hypot(gm.aimPoint.x - f.ground.x, gm.aimPoint.z - f.ground.z);
      }, [i, h]);
      if (err < 0.6) return true;
      await wait(60);
    }
    return false;
  };

  await g(() => window.__game.start('justice'));
  await wait(1200);
  await g(() => {
    const gm = window.__game;
    window.__tuning.debug.godMode = true;
    window.__tuning.debug.showAI = true;
    gm.arsenal.request(0);
    // Clear the dummies out of the way: they'd soak up shots.
    for (const d of gm.dummies) d.dispose(gm.renderer.scene);
    gm.dummies.length = 0;
  });

  // ---- Bailiff: blocked from the front, open in its recovery.
  const b = await spawn('bailiff', 4, -21, Math.PI);
  await put(4, -12.5, 0);
  await wait(500);
  if (!(await aimAt(b, 1.15))) throw new Error('could not aim at the Bailiff');
  await fire(4);
  await wait(300);
  const front = await foe(b);
  const sparks = await g(() => window.__game.stats.blocked);
  await shot('40-foe-bailiff-guard');
  // A longer recovery (live tuning) so the headless frame rate can step back and fire inside it.
  await g(() => { window.__tuning.foes.bailiff.attacks.thrust.recover = 3; window.__tuning.foes.bailiff.attacks.bash.recover = 3; });
  const recovering = await until((i) => window.__game.enemies.enemies[i].phase === 'recover', 20000, b);
  await g((i) => {
    const gm = window.__game;
    const f = gm.enemies.enemies[i];
    const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
    gm.player.controller.teleport({ x: f.ground.x + fx * 6, y: 0.05, z: f.ground.z + fz * 6 }, f.yaw + Math.PI);
    gm.camera.snap(gm.player.pos, f.yaw + Math.PI);
  }, b);
  await aimAt(b, 1.15);
  await fire(3, 60);
  await wait(300);
  const punished = await foe(b);
  await g(() => { window.__tuning.foes.bailiff.attacks.thrust.recover = 0.85; window.__tuning.foes.bailiff.attacks.bash.recover = 0.55; });
  console.log(`  bailiff: front shots ${front.health}/${front.max} (${sparks} turned by the shield), after its swing ${punished.health} (recovery seen ${recovering})`);
  if (front.health !== front.max || sparks < 1) throw new Error('the Bailiff should block shots from the front');
  if (!recovering || punished.health >= front.max) throw new Error('the Bailiff should be open during its recovery');
  await g((i) => window.__game.enemies.enemies[i].despawn(), b);

  // ---- Gavel: stand in front and take the slam.
  const v = await spawn('gavel', 9, -30, Math.PI);
  await put(9, -27.5, 0);
  await g(() => { window.__tuning.debug.godMode = false; window.__game.vitals.health = window.__game.vitals.maxHealth; });
  const wound = await until((i) => { const f = window.__game.enemies.enemies[i]; return f.attack === 'slam' && f.phase === 'windup' && f.tl.k > 0.6; }, 20000, v);
  await shot('41-foe-gavel-slam');
  const hp0 = await g(() => window.__game.vitals.health);
  const landed = await until(([i, hp]) => window.__game.vitals.health < hp || window.__game.enemies.enemies[i].phase === 'recover', 10000, [v, hp0]);
  const hp1 = await g(() => window.__game.vitals.health);
  await g(() => { window.__tuning.debug.godMode = true; window.__game.vitals.health = window.__game.vitals.maxHealth; });
  console.log(`  gavel: slam wound up ${wound}, landed ${landed}, player ${hp0} → ${hp1}`);
  if (!wound || hp1 >= hp0) throw new Error('the Gavel slam should hurt a player standing in its ring');
  await g((i) => window.__game.enemies.enemies[i].despawn(), v);

  // ---- Blindfold: deaf to footsteps, hunts gunfire.
  const bl = await spawn('blindfold', -9, -34, Math.PI);
  await put(-9, -29.5, 0);
  await wait(1500);
  const quiet = await foe(bl);
  await shot('42-foe-blindfold-listening');
  await g(() => window.__game.aimAt([-9, 30, -60]));
  await fire(1);
  const heard = await until((i) => ['alert', 'search', 'approach', 'attack'].includes(window.__game.enemies.enemies[i].state), 8000, bl);
  console.log(`  blindfold: after walking up ${quiet.state}, after a shot heard ${heard}`);
  if (quiet.state !== 'idle' || !heard) throw new Error('the Blindfold should ignore walking and come for gunfire');
  await g((i) => window.__game.enemies.enemies[i].despawn(), bl);

  // ---- Page: throws a blade from range.
  const pg = await spawn('page', 0, -46, Math.PI);
  await put(0, -28, Math.PI);
  await g(() => window.__game.camera.snap(window.__game.player.pos, 0));
  const threw = await until(() => window.__game.hazards.knives.length > 0, 20000);
  await shot('43-foe-page-throw');
  console.log(`  page: threw a blade ${threw}`);
  if (!threw) throw new Error('the Page should throw from range');

  // ---- Kills pay out.
  const before = await g(() => window.__game.vitals.pollen);
  await g((i) => window.__game.enemies.enemies[i].takeDamage({ amount: 9999, crit: false, point: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 }), pg);
  await wait(400);
  const after = await g(() => window.__game.vitals.pollen);
  const dead = await foe(pg);
  console.log(`  page killed: ${dead.state}, currency ${before} → ${after}`);
  if (dead.state !== 'dead' || after <= before) throw new Error('a kill should pay out');
  await shot('44-foe-page-dead');
  await g(() => { window.__tuning.debug.showAI = false; });
}

// V2-5 scenario: the court cards in the training courtyard. The Knight charges down a lane it shows first; the Queen
// throws lines of blades with a gap; the King marks verdicts that strike later and calls Bailiffs at a phase. Each
// holds the boss bar and stays dead once slain.
export async function courtScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(60);
    }
    return false;
  };
  const put = (x, z, yaw) =>
    g(([x, z, yaw]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = 0.04;
    }, [x, z, yaw]);
  const spawn = (id, x, z) =>
    g(([id, x, z]) => {
      const gm = window.__game;
      gm.enemies.spawnFoes([{ id, pos: { x, y: 0, z }, yaw: Math.PI, idle: 'throne' }], gm.physics, gm.rng.fork(`smoke-${id}`));
      return gm.enemies.enemies.length - 1;
    }, [id, x, z]);
  const hurt = (i, frac) =>
    g(([i, frac]) => {
      const f = window.__game.enemies.enemies[i];
      f.takeDamage({ amount: f.maxHealth * frac, crit: false, point: f.center, dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 });
      return { phase: f.phaseIdx, alive: f.alive, slain: f.slain };
    }, [i, frac]);

  await g(() => window.__game.start('justice'));
  await wait(1200);
  await g(() => {
    const gm = window.__game;
    window.__tuning.debug.godMode = true;
    window.__tuning.debug.showAI = true;
    for (const d of gm.dummies) d.dispose(gm.renderer.scene);
    gm.dummies.length = 0;
  });

  // ---- Knight of Swords: the lane, then the charge.
  const k = await spawn('knight', 2, -34);
  await put(2, -20, 0);
  const laned = await until((i) => { const f = window.__game.enemies.enemies[i]; return f.attack?.includes('charge') && f.phase === 'windup' && f.tl.k > 0.55; }, 25000, k);
  const z0 = await g((i) => window.__game.enemies.enemies[i].ground.z, k);
  await shot('45-court-knight-lane');
  const ran = await until(([i, z0]) => Math.abs(window.__game.enemies.enemies[i].ground.z - z0) > 4, 6000, [k, z0]);
  const bar = await g(() => document.querySelector('.boss')?.textContent ?? '');
  const ph = await hurt(k, 0.55);
  console.log(`  knight: lane shown ${laned}, charged ${ran}, boss bar "${bar.trim()}", phase after half its health ${ph.phase}`);
  if (!laned || !ran || !bar.includes('Knight of Swords') || ph.phase !== 1) throw new Error('the Knight should show its lane, charge, hold the bar, and reach phase 2');
  const dead = await hurt(k, 1);
  if (!dead.slain) throw new Error('a court card stays dead once slain');
  await g(() => window.__game.enemies.reset());
  const stays = await g((i) => window.__game.enemies.enemies[i].alive, k);
  if (stays) throw new Error('a slain court card should not come back when you rest');

  // ---- Queen of Swords: lines of blades with a gap.
  const q = await spawn('queen', 2, -40);
  await put(2, -26, 0);
  const drawn = await until((i) => { const f = window.__game.enemies.enemies[i]; return f.attack && window.__tuning.foes.queen.attacks[f.attack].kind === 'volley' && f.phase === 'windup' && f.tl.k > 0.6; }, 25000, q);
  await shot('46-court-queen-lanes');
  const blades = await until(() => window.__game.hazards.knives.length >= 6, 6000);
  const n = await g(() => window.__game.hazards.knives.length);
  console.log(`  queen: lanes drawn ${drawn}, blades thrown ${n}`);
  if (!drawn || !blades) throw new Error('the Queen should draw her lanes and throw a line of blades');
  await hurt(q, 1);

  // ---- King of Swords: verdicts, then his squad at the first threshold.
  const kg = await spawn('king', 0, -36);
  await put(0, -21, 0);
  const marked = await until(() => window.__game.hazards.verdicts.length > 0, 25000);
  await shot('47-court-king-verdict');
  const before = await g(() => window.__game.enemies.enemies.filter((e) => e.alive).length);
  const p1 = await hurt(kg, 0.4);
  const called = await until((b) => window.__game.enemies.enemies.filter((e) => e.alive).length >= b + 2, 6000, before);
  await wait(800);
  await shot('48-court-king-squad');
  await g(() => window.__game.enemies.reset());
  const after = await g(() => window.__game.enemies.enemies.filter((e) => e.summoned).length);
  console.log(`  king: verdict marked ${marked}, phase ${p1.phase}, squad called ${called}, summoned after a rest ${after}`);
  if (!marked || p1.phase !== 1 || !called || after !== 0) throw new Error('the King should mark verdicts, call his squad at a phase, and the squad should go when you rest');
  await g(() => { window.__tuning.debug.showAI = false; window.__tuning.debug.godMode = false; });
}

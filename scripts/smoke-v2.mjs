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
  const stairs = await g(() => window.__game.level.generated.space.connectors.find((c) => c.kind === 'stairs' && !c.bends.length && Math.abs(c.y1 - c.y0) > 1));
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

  // The weighing: the axis gate is barred until both pans are weighted. Set the left weight, ride its pan back to the
  // mid lantern, set the right one, and the axis lifts.
  const door = await g(() => window.__game.level.generated.dressing.door);
  const fwd = [-Math.sin(door.yaw), -Math.cos(door.yaw)];
  await put(door.x - fwd[0] * 2.2, door.y, door.z - fwd[1] * 2.2, door.yaw);
  await wait(400);
  await press('KeyE');
  await wait(400);
  const barred = await g(() => !window.__game.level.shortcutOpen() && (document.querySelector('.prompt')?.textContent ?? '').includes('weighed'));
  await shot('34-level-axis-barred');
  const keys = await g(() => window.__game.level.generated.dressing.keys);
  const weigh = async (k) => {
    // Stand by the weight, facing it, and set it in the pan.
    const yaw = Math.atan2(-(k.x - k.pan.x), -(k.z - k.pan.z));
    const d = Math.hypot(k.x - k.pan.x, k.z - k.pan.z);
    await put(k.x + ((k.pan.x - k.x) / d) * 1.6, k.y, k.z + ((k.pan.z - k.z) / d) * 1.6, yaw);
    await wait(400);
    await press('KeyE');
    return until((w) => window.__game.level.weighted[w], 5000, k.wing);
  };
  const left = await weigh(keys.find((k) => k.wing === 0));
  await shot('35-level-left-pan-weighted');
  // Ride the pan back to the beam.
  const lk = keys.find((k) => k.wing === 0);
  // Beside the pan, on the weight's side.
  const ld = Math.hypot(lk.x - lk.pan.x, lk.z - lk.pan.z);
  await put(lk.pan.x + ((lk.x - lk.pan.x) / ld) * 2.5, lk.y, lk.pan.z + ((lk.z - lk.pan.z) / ld) * 2.5, 0);
  await wait(400);
  await press('KeyE');
  const riding = await until(() => !!window.__game.ride, 4000);
  await wait(700);
  await shot('35b-level-pan-ride');
  const landed = await until(([x, z]) => !window.__game.ride && Math.hypot(window.__game.player.pos.x - x, window.__game.player.pos.z - z) < 1.5, 15000, [lk.ride.x, lk.ride.z]);
  const right = await weigh(keys.find((k) => k.wing === 1));
  const lifted = await until(() => window.__game.level.shortcutOpen(), 5000);
  await put(door.x - fwd[0] * 2.2, door.y, door.z - fwd[1] * 2.2, door.yaw);
  await wait(1500);
  await shot('35c-level-axis-open');
  await hold('KeyW');
  const through = await until(([x, z, fx, fz]) => {
    const p = window.__game.player.pos;
    return (p.x - x) * fx + (p.z - z) * fz > 3;
  }, 15000, [door.x, door.z, fwd[0], fwd[1]]);
  await release('KeyW');
  console.log(`  weighing: axis barred ${barred}, left weighted ${left}, rode back ${riding && landed}, right weighted ${right}, axis lifted ${lifted}, walked through ${through}`);
  if (!barred || !left || !riding || !landed || !right || !lifted || !through) throw new Error('the axis should stay barred until both pans are weighted, and each pan should carry her back to the beam');

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
  const before = await g(() => window.__game.vitals.currency);
  await g((i) => window.__game.enemies.enemies[i].takeDamage({ amount: 9999, crit: false, point: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 }), pg);
  await wait(400);
  const after = await g(() => window.__game.vitals.currency);
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

// V2-6 scenario: Justice's arena. She rises when you walk in; at half health the scales come down and her strikes
// echo across the arena; dying drops your pentacles where you fell and you rise at the lantern to recover them; when
// she falls the way on opens and the dimension is done.
export async function bossScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(60);
    }
    return false;
  };
  const put = (x, z, yaw, pitch = 0.05) =>
    g(([x, z, yaw, pitch]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = pitch;
    }, [x, z, yaw, pitch]);

  await g(() => {
    const gm = window.__game;
    gm.levelIndex = 3;
    gm.start('level');
    window.__tuning.debug.godMode = true;
  });
  await wait(1500);
  await shot('50-boss-approach');
  await put(0, -64, 0, 0.12);
  await wait(900);
  await shot('51-boss-reveal');
  await put(0, -80, 0, 0.16);
  const woke = await until(() => window.__game.enemies.enemies[0].state !== 'idle', 20000);
  const bar = await g(() => document.querySelector('.boss')?.textContent ?? '');
  await wait(1500);
  await shot('52-boss-justice');

  // Death drop: carry pentacles, fall, rise at the lantern, walk back for them.
  await g(() => { window.__game.vitals.currency = 50; window.__tuning.debug.godMode = false; window.__game.hurtPlayer(99999, window.__game.player.pos.clone(), 0); window.__tuning.debug.godMode = true; });
  await wait(300);
  const dropped = await g(() => ({ carried: window.__game.vitals.currency, drop: window.__game.pollenDrop.amount, at: window.__game.pollenDrop.group.position.toArray() }));
  await g(() => window.__game.rise());
  await wait(600);
  const atLantern = await g(() => window.__game.player.pos.z > -2);
  const reset = await g(() => window.__game.enemies.enemies[0].state === 'idle');
  await put(dropped.at[0], dropped.at[2] + 4, 0);
  await wait(400);
  await put(dropped.at[0], dropped.at[2], 0);
  const recovered = await until(() => window.__game.vitals.currency === 50, 8000);
  console.log(`  boss: woke ${woke}, bar "${bar.trim()}", drop ${JSON.stringify(dropped)}, rose at the lantern ${atLantern}, she reset ${reset}, recovered ${recovered}`);
  if (!woke || !bar.includes('Justice') || dropped.carried !== 0 || dropped.drop !== 50 || !atLantern || !recovered) throw new Error('Justice should wake and hold the bar; death should drop the pentacles for recovery');

  // Phase 2: the scales come down, and her strikes echo.
  await put(0, -80, 0, 0.16);
  await until(() => window.__game.enemies.enemies[0].state !== 'idle', 20000);
  await g(() => { const e = window.__game.enemies.enemies[0]; e.takeDamage({ amount: e.maxHealth * 0.55, crit: false, point: e.center, dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 }); });
  const down = await until(() => window.__game.bossWorld.pansDown(), 30000);
  const echoed = await until(() => window.__game.hazards.verdicts.length >= 2, 40000);
  await put(-15, -84, -0.5, 0.15);
  await wait(800);
  await shot('53-boss-scales-down');
  console.log(`  boss phase 2: pans down ${down}, strikes echoed (two rings at once) ${echoed}`);
  if (!down || !echoed) throw new Error('in phase 2 the pans should come down and her strikes should echo');

  // She falls: the way on opens and the dimension is done.
  await g(() => { const e = window.__game.enemies.enemies[0]; e.takeDamage({ amount: 99999, crit: false, point: e.center, dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 }); });
  await put(0, -96 + 26.5, Math.PI);
  await g(() => { const gm = window.__game; gm.player.controller.teleport({ x: 0, y: 0.05, z: -96 - 26 + 2.2 }, 0); gm.camera.snap(gm.player.pos, 0); });
  await wait(500);
  await g(() => { window.__game.input.press('KeyE'); });
  await wait(60);
  await g(() => { window.__game.input.release('KeyE'); });
  const done = await until(() => window.__game.layout === 'hub' && window.__game.save.cleared.includes('justice'), 15000);
  console.log(`  dimension complete: home to the hub ${done}`);
  if (!done) throw new Error('walking on after Justice should complete the dimension');
  await g(() => { window.__tuning.debug.godMode = false; });
}

// V2-7 scenario: the hub. A new game starts in The World; the Priestess speaks; the Magician sells a flask for
// pentacles; the angel's gate leads into Justice; clearing Justice frees the parry and wakes the bull; the parry
// turns a Bailiff's thrust; and the save survives a reload.
export async function hubScenario({ page, g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(60);
    }
    return false;
  };
  const put = (x, z, yaw, pitch = 0.05) =>
    g(([x, z, yaw, pitch]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = pitch;
    }, [x, z, yaw, pitch]);
  const tapE = async () => {
    await g(() => window.__game.input.press('KeyE'));
    await wait(60);
    await g(() => window.__game.input.release('KeyE'));
    await wait(200);
  };
  const toast = () => g(() => document.querySelector('.toast')?.textContent ?? '');

  await g(() => { localStorage.clear(); window.__game.quitToMenu(); });
  // Let the pointer-lock release land before starting (it would pause the new game otherwise).
  await wait(400);
  await g(() => window.__game.menus.onPlay('new'));
  await wait(1500);
  await shot('60-hub-spawn');
  const fresh = await g(() => ({ layout: window.__game.layout, purse: document.querySelector('.pollen')?.textContent, parry: window.__game.save.unbound.includes('parry') }));

  // The High Priestess (west).
  await put(-9, 0.6, Math.PI / 2, 0.1);
  await wait(300);
  await tapE();
  const line = await toast();
  await shot('61-hub-priestess');

  // The Magician (east): buy a flask.
  await g(() => { window.__game.vitals.currency = 500; });
  await put(9, 0.4, -Math.PI / 2, 0.1);
  await wait(300);
  await tapE();
  const opened = await until(() => window.__game.mode === 'shop', 4000);
  await shot('62-hub-shop');
  await g(() => document.querySelector('.overlay.shop button[data-item="flask"]').click());
  await wait(200);
  const bought = await g(() => ({ upgrades: window.__game.save.upgrades, purse: window.__game.vitals.currency, flasks: window.__game.vitals.maxCharges }));
  await g(() => window.__game.input.onKey('Escape'));
  const closed = await until(() => window.__game.mode === 'playing', 3000);
  console.log(`  hub: fresh ${JSON.stringify(fresh)}, priestess "${line}", shop opened ${opened}, bought ${JSON.stringify(bought)}, closed ${closed}`);
  if (fresh.layout !== 'hub' || !fresh.purse?.includes('✪') || fresh.parry) throw new Error('a new game should start in the hub with pentacles and no parry');
  if (!line.includes('bound') || !opened || !bought.upgrades.includes('flask') || bought.purse !== 200 || bought.flasks !== 4 || !closed) throw new Error('the Priestess should speak and the Magician should sell a flask');

  // The angel's gate into Justice.
  await put(0, -20.5, 0, 0.1);
  await wait(300);
  await tapE();
  const entered = await until(() => window.__game.layout === 'level' && window.__game.levelIndex === 0 && !!window.__game.level, 15000);
  await wait(800);

  // Clear Justice (as if she fell): home to the hub, the parry freed, the bull awake.
  await g(() => window.__game.completeDimension());
  await wait(1200);
  const cleared = await g(() => ({ layout: window.__game.layout, parry: window.__game.save.unbound.includes('parry'), cleared: window.__game.save.cleared }));
  await put(14, 0, -Math.PI / 2, 0.1);
  await wait(800);
  await shot('63-hub-after-justice');
  console.log(`  hub: entered Justice ${entered}, after clearing ${JSON.stringify(cleared)}`);
  if (!entered || cleared.layout !== 'hub' || !cleared.parry) throw new Error("the gate should lead into Justice, and clearing her should free the parry");

  // The parry turns a Bailiff's thrust (a wider window so headless timing can catch it).
  await g(() => window.__game.start('justice'));
  await wait(1200);
  await g(() => {
    const gm = window.__game;
    for (const d of gm.dummies) d.dispose(gm.renderer.scene);
    gm.dummies.length = 0;
    window.__tuning.parry.window = 0.7;
    gm.enemies.spawnFoes([{ id: 'bailiff', pos: { x: 4, y: 0, z: -14 }, yaw: Math.PI, idle: 'stand' }], gm.physics, gm.rng.fork('parry'));
    gm.player.controller.teleport({ x: 4, y: 0.05, z: -12 }, 0);
    gm.camera.snap(gm.player.pos, 0);
  });
  const winding = await until(() => { const f = window.__game.enemies.enemies[0]; return f.attack === 'thrust' && f.phase === 'windup' && f.tl.k > 0.15; }, 25000);
  const hp0 = await g(() => window.__game.vitals.health);
  await g(() => window.__game.input.press('KeyV'));
  await wait(50);
  await g(() => window.__game.input.release('KeyV'));
  const turned = await until(() => window.__game.stats.parries > 0, 4000);
  const after = await g(() => ({ hp: window.__game.vitals.health, state: window.__game.enemies.enemies[0].state }));
  await shot('64-parry');
  await g(() => { window.__tuning.parry.window = 0.2; });
  console.log(`  parry: wound up ${winding}, turned ${turned}, health ${hp0} → ${after.hp}, the Bailiff ${after.state}`);
  if (!winding || !turned || after.hp !== hp0 || after.state !== 'stagger') throw new Error('the parry should turn the thrust and stagger the Bailiff');

  // The save survives a reload.
  await page.reload();
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  await wait(600);
  const kept = await g(() => ({ parry: window.__game.save.unbound.includes('parry'), upgrades: window.__game.save.upgrades, play: document.querySelector('button[data-a="hub"]')?.textContent }));
  console.log(`  save after reload: ${JSON.stringify(kept)}`);
  if (!kept.parry || !kept.upgrades.includes('flask') || kept.play !== 'Continue') throw new Error('the save should survive a reload');
}

/** V2-8: the Devil's descent. Through the bull's gate once Justice is cleared; three descending levels; home. */
export async function devilScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(100);
    }
    return false;
  };
  // A save that has cleared Justice: the bull is awake.
  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, seed: 42, cleared: ['justice'], unbound: ['parry'], progress: { justice: 0 } };
    window.__tuning.debug.godMode = true;
    gm.start('hub');
  });
  await wait(1200);
  const gate = await g(() => {
    const gm = window.__game;
    const it = gm.world.interactables.find((i) => (i.prompt(gm.player.pos) ?? '').includes('bull'));
    if (!it) return null;
    gm.player.controller.teleport({ x: it.pos.x * 0.95, y: 0.05, z: it.pos.z * 0.95 }, Math.atan2(-it.pos.x, -it.pos.z) + Math.PI);
    return it.prompt(gm.player.pos);
  });
  await wait(400);
  await g(() => window.__game.input.press('KeyE'));
  await wait(60);
  await g(() => window.__game.input.release('KeyE'));
  const entered = await until(() => window.__game.layout === 'level' && window.__game.dimension === 'devil' && !!window.__game.level, 15000);
  console.log(`  devil: bull's gate "${gate}", entered ${entered}`);
  if (!gate?.startsWith('E: through the bull') || !entered) throw new Error("the bull's gate should open into the Devil's levels once Justice is cleared");

  for (let lv = 0; lv < 3; lv++) {
    await wait(1200);
    const info = await g(() => {
      const gm = window.__game;
      const L = gm.level.generated;
      const crit = L.graph.critical.map((id) => L.space.rooms.find((r) => r.node === id));
      return {
        level: gm.levelIndex + 1,
        ok: gm.level.report.ok,
        setPiece: L.script.setPiece.id,
        drop: +(crit[0].y - crit[crit.length - 1].y).toFixed(1),
        climbs: crit.some((r, i) => i > 0 && r.y > crit[i - 1].y + 0.05 && r.kit !== 'stair' && crit[i - 1].kit !== 'stair' && crit[i - 1].kit !== 'chainShaft'),
        sockets: L.sockets.length,
        foes: gm.enemies.enemies.length,
        area: gm.area.name,
        draws: gm.renderer.renderer.info.render.calls,
      };
    });
    console.log('  devil', JSON.stringify(info));
    // A Thrall socket holds a chained pair, so there can be more enemies than sockets.
    if (!info.ok || info.area !== 'The Devil' || info.foes < info.sockets) throw new Error(`devil level ${lv + 1} should build valid, in its palette, with every socket held`);
    if (info.drop < 6) throw new Error(`devil level ${lv + 1} should descend (dropped ${info.drop} m)`);
    if (info.draws > 150) throw new Error(`devil draws ${info.draws} over the 150 budget`);
    await shot(`70-devil-l${lv + 1}-spawn`);
    if (lv === 0) {
      await g(() => { window.__tuning.debug.overview = true; });
      await wait(900);
      await shot('71-devil-overview');
      await g(() => { window.__tuning.debug.overview = false; });
    }
    await g(() => window.__game.gotoVista(0));
    await wait(900);
    await shot(`72-devil-l${lv + 1}-vista`);
    await g(() => window.__game.nextLevel());
  }
  // After the third level, the way on leads down into his arena (V2-10).
  await until(() => window.__game.bossWorld?.boss === 'devil', 15000);
  await wait(800);
  const arena = await g(() => ({ layout: window.__game.layout, level: window.__game.levelIndex, progress: window.__game.save.progress.devil, boss: window.__game.enemies.enemies[0]?.id }));
  console.log(`  devil: on to the arena ${JSON.stringify(arena)}`);
  if (arena.level !== 3 || arena.progress !== 3 || arena.boss !== 'devil') throw new Error("after the Devil's third level the way on should lead to his arena");
  await g(() => { window.__tuning.debug.godMode = false; });
}

/** V2-9: the Devil's enemies and rule. Thralls bind (a roll breaks it, waiting gets you struck), the chain can be shot
 * through (one flees, one fights), the Imp hits and runs, the Page of Pentacles runs, the Miser hugs its chest, and
 * each hoard costs what its tell says. */
export async function devilFoesScenario({ g, wait, shot }) {
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
      const made = gm.enemies.spawnFoes([{ id, pos: { x, y: 0, z }, yaw, idle }], gm.physics, gm.rng.fork(`smoke-${id}-${gm.enemies.enemies.length}`));
      return made.length;
    }, [id, x, z, yaw, idle]);
  const clearFoes = () => g(() => { const gm = window.__game; gm.enemies.clear(); });
  const tapSpace = async () => {
    await g(() => window.__game.input.press('Space'));
    await wait(60);
    await g(() => window.__game.input.release('Space'));
  };

  // The fights happen in the Devil's arena: an open octagon (centre z = -96) with nothing in the way.
  const Z = -96;
  await g(() => {
    const gm = window.__game;
    gm.dimension = 'devil';
    gm.levelIndex = 3;
    gm.zoneSeed = 42;
    gm.start('level');
    window.__tuning.debug.godMode = false;
    window.__tuning.debug.showAI = true;
  });
  await wait(1500);
  await clearFoes();

  // 1. The binding, alone: waiting gets you struck; one roll breaks it (stamina or not).
  await put(0, Z + 6, 0);
  await wait(400);
  const hp0 = await g(() => window.__game.vitals.health);
  await g(() => window.__game.bindPlayer(0.8, 30, 4, window.__game.player.pos.clone().add({ x: 0, y: 0, z: -2 })));
  const held = await g(() => window.__game.binding.active);
  await until(() => !window.__game.binding.active, 8000);
  const hp1 = await g(() => window.__game.vitals.health);
  await g(() => { window.__game.vitals.stamina = 0; window.__game.bindPlayer(3, 30, 4, window.__game.player.pos.clone()); });
  await wait(300);
  const moved0 = await g(() => window.__game.player.pos.toArray());
  await tapSpace();
  const broke = await until(() => !window.__game.binding.active && window.__game.binding.broken > 0, 3000);
  await wait(600);
  const hp2 = await g(() => window.__game.vitals.health);
  const moved1 = await g(() => window.__game.player.pos.toArray());
  console.log(`  binding: held ${held}, struck ${hp0} → ${hp1}; broken by a roll at 0 stamina ${broke}, health ${hp2}, rolled ${Math.hypot(moved1[0] - moved0[0], moved1[2] - moved0[2]).toFixed(2)} m`);
  if (!held || hp1 !== hp0 - 30 || !broke || hp2 !== hp1) throw new Error('a binding should strike when it runs out, and one roll should always break it');

  // 2. A Thrall pair: they wind up (the chain glows), run either side and snap it across her.
  await g(() => { window.__tuning.debug.godMode = true; window.__game.vitals.restore(); });
  await clearFoes();
  await put(0, Z + 8, 0);
  const pair = await spawn('thrall', 0, Z - 2, Math.PI);
  const wound = await until(() => { const e = window.__game.enemies.enemies; return e[0].attack === 'bind' && e[0].phase === 'windup' && e[0].tl.k > 0.55; }, 25000);
  await shot('80-thralls-bind-windup');
  const bound = await until(() => window.__game.binding.active, 6000);
  await wait(250);
  await shot('81-thralls-bound');
  await tapSpace();
  const freed = await until(() => !window.__game.binding.active, 3000);
  console.log(`  thralls: pair spawned ${pair}, bind wound up ${wound}, bound ${bound}, rolled free ${freed}`);
  if (pair !== 2 || !wound || !bound || !freed) throw new Error('a Thrall pair should bind her across their chain, and a roll should break it');

  // 3. Shoot the chain through: both are freed, the nearer fights (faster), the other flees and is gone.
  await g(() => {
    const e = window.__game.enemies.enemies;
    e[0].chain.takeDamage({ amount: 999, crit: false, point: e[0].center.clone(), dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 });
  });
  const split = await until(() => { const e = window.__game.enemies.enemies; return e[0].role !== 'chained' && e[1].role !== 'chained'; }, 4000);
  const roles = await g(() => window.__game.enemies.enemies.map((e) => e.role).sort().join(','));
  const fled = await until(() => window.__game.enemies.enemies.some((e) => e.role === 'flee' && !e.alive), 15000);
  console.log(`  chain shot through: split ${split} (${roles}), the freed one ran off ${fled}`);
  if (!split || roles !== 'fight,flee' || !fled) throw new Error('shooting the chain should free both: one fights, one flees');

  // 4. The Imp hits and runs; the Page of Pentacles runs; the Miser hugs its chest (front blocked, back open).
  await clearFoes();
  await put(0, Z + 8, 0);
  await spawn('imp', 0, Z + 2, Math.PI);
  const raked = await until(() => window.__game.enemies.enemies[0].fallBackT > 0, 15000);
  console.log(`  imp: struck and fell back ${raked}`);
  if (!raked) throw new Error('the Imp should fall back after a rake');
  await clearFoes();
  await spawn('pagePentacles', 0, Z, Math.PI);
  await put(0, Z + 7, 0);
  await wait(300);
  const d0 = await g(() => { const f = window.__game.enemies.enemies[0]; return Math.hypot(f.ground.x - window.__game.player.pos.x, f.ground.z - window.__game.player.pos.z); });
  await until(() => window.__game.enemies.enemies[0].state === 'approach', 8000);
  await wait(2500);
  const d1 = await g(() => { const f = window.__game.enemies.enemies[0]; return Math.hypot(f.ground.x - window.__game.player.pos.x, f.ground.z - window.__game.player.pos.z); });
  console.log(`  page of pentacles: ${d0.toFixed(1)} m → ${d1.toFixed(1)} m (it runs)`);
  if (!(d1 > d0 + 3)) throw new Error('the Page of Pentacles should run from her');
  await clearFoes();
  await spawn('miser', 0, Z + 2, Math.PI);
  const guard = await g(() => {
    const f = window.__game.enemies.enemies[0];
    return { front: f.blocks({ x: 0, y: 0, z: -1 }), back: f.blocks({ x: 0, y: 0, z: 1 }) };
  });
  console.log(`  miser: front blocked ${guard.front}, back open ${!guard.back}`);
  if (!guard.front || guard.back) throw new Error('the Miser should turn blows from the front, not the back');

  // 5. The look: all four in a Devil level's first room.
  await g(() => {
    const gm = window.__game;
    gm.dimension = 'devil';
    gm.levelIndex = 0;
    gm.zoneSeed = 42;
    gm.start('level');
  });
  await wait(1500);
  await clearFoes();
  const sp = await g(() => { const s = window.__game.level.generated.dressing.spawn; return [s.x, s.y, s.z]; });
  await g(([x, y, z]) => {
    const gm = window.__game;
    window.__tuning.debug.showAI = false;
    const at = (dx, dz) => ({ x: x + dx, y, z: z + dz });
    gm.enemies.spawnFoes(
      [
        { id: 'miser', pos: at(-3, -8), yaw: Math.PI, idle: 'stand' },
        { id: 'imp', pos: at(-0.8, -6.5), yaw: Math.PI, idle: 'stand' },
        { id: 'pagePentacles', pos: at(1.8, -8), yaw: Math.PI, idle: 'stand' },
        { id: 'thrall', pos: at(0, -12.5), yaw: Math.PI, idle: 'stand' },
      ],
      gm.physics,
      gm.rng.fork('lineup'),
    );
    gm.player.controller.teleport({ x, y: y + 0.05, z: z + 1 }, 0);
    gm.camera.snap(gm.player.pos, 0);
    gm.camera.pitch = -0.05;
  }, sp);
  await wait(900);
  await shot('82-devil-foes-lineup');

  // 6. The hoards: each costs what its tell says.
  await clearFoes();
  const costs = await g(() => {
    const gm = window.__game;
    const at = gm.player.pos.clone();
    const n0 = gm.enemies.enemies.length;
    const purse0 = gm.vitals.currency;
    gm.enemies.spawnFoes([{ id: 'miser', pos: { x: at.x + 8, y: at.y, z: at.z - 20 }, yaw: 0, idle: 'stand' }], gm.physics, gm.rng.fork('bell'));
    gm.takeHoard({ node: 0, x: at.x, z: at.z, y: at.y, cost: 'bell', branch: false }, at);
    const woke = gm.enemies.enemies[n0].state !== 'idle';
    gm.takeHoard({ node: 0, x: at.x, z: at.z, y: at.y, cost: 'weight', branch: false }, at);
    const burden = gm.burden;
    const n1 = gm.enemies.enemies.length;
    gm.takeHoard({ node: 0, x: at.x, z: at.z, y: at.y, cost: 'ambush', branch: true }, at);
    const imps = gm.enemies.enemies.slice(n1).filter((e) => e.id === 'imp').length;
    return { woke, burden, imps, paid: gm.vitals.currency - purse0 };
  });
  console.log(`  hoards: bell woke the room ${costs.woke}, weight ×${costs.burden}, ambush brought ${costs.imps} imps, paid ${costs.paid}`);
  if (!costs.woke || costs.burden !== 1 || costs.imps !== 3 || costs.paid !== 40 + 60 + 160) throw new Error('each hoard should pay and cost what its tell says');
  // A real hoard in the level, through its interactable (the builder's wiring), and its tell on screen.
  await clearFoes();
  const real = await g(() => {
    const gm = window.__game;
    const h = gm.level.generated.dressing.hoards.find((x) => !x.branch);
    if (!h) return null;
    gm.player.controller.teleport({ x: h.x, y: h.y + 0.05, z: h.z + 4.5 }, 0);
    gm.camera.snap(gm.player.pos, 0);
    gm.camera.pitch = -0.15;
    return h.cost;
  });
  await wait(900);
  await shot('83-devil-hoard-tell');
  const took = await g(() => {
    const gm = window.__game;
    const hoards = gm.world.interactables.filter((i) => (i.prompt(gm.player.pos) ?? '').startsWith('E: take the hoard'));
    const it = hoards.sort((a, b) => a.pos.distanceTo(gm.player.pos) - b.pos.distanceTo(gm.player.pos))[0];
    if (!it) return null;
    const prompt = it.prompt(gm.player.pos);
    const before = gm.stats.hoards;
    it.use(gm.player.pos);
    return { prompt, took: gm.stats.hoards === before + 1, again: it.usable(gm.player.pos) };
  });
  console.log(`  hoard in the level (${real}): ${JSON.stringify(took)}`);
  if (!took || !took.took || took.again) throw new Error('a hoard in the level should be taken once through its prompt');
  await g(() => { window.__tuning.debug.godMode = false; });
}

/** V2-10: the Pentacles court, the Devil and his pact, home to the hub, and the chain-break dash. */
export async function devilCourtScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(60);
    }
    return false;
  };
  const put = (x, z, yaw, pitch = 0.05) =>
    g(([x, z, yaw, pitch]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = pitch;
    }, [x, z, yaw, pitch]);
  const spawn = (id, x, z, yaw) =>
    g(([id, x, z, yaw]) => {
      const gm = window.__game;
      gm.enemies.spawnFoes([{ id, pos: { x, y: 0, z }, yaw, idle: 'throne' }], gm.physics, gm.rng.fork(`smoke-${id}`));
    }, [id, x, z, yaw]);
  const clearFoes = () => g(() => window.__game.enemies.clear());
  const tap = async (code) => {
    await g((code) => window.__game.input.press(code), code);
    await wait(60);
    await g((code) => window.__game.input.release(code), code);
  };
  const hurtBoss = (frac) =>
    g((frac) => {
      const e = window.__game.enemies.enemies[0];
      const want = e.maxHealth * frac;
      e.takeDamage({ amount: Math.max(1, e.health - want), crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 0 });
    }, frac);

  // The court fights in the Devil's arena: an open octagon (centre z = -96), nothing in the way of a charge.
  const Z = -96;
  await g(() => {
    const gm = window.__game;
    gm.dimension = 'devil';
    gm.levelIndex = 3;
    gm.zoneSeed = 42;
    gm.start('level');
    window.__tuning.debug.godMode = true;
    window.__tuning.debug.showAI = true;
  });
  await wait(1500);

  // 1. The Knight of Pentacles: a slow lane charge that pins you (bound), and shots don't stagger it.
  await clearFoes();
  await put(0, Z + 10, 0);
  await spawn('knightPentacles', 0, Z - 6, 0);
  const lane = await until(() => { const e = window.__game.enemies.enemies[0]; return e.attack?.includes('charge') && e.phase === 'windup' && e.tl.k > 0.5; }, 25000);
  await shot('84-knight-pentacles-charge');
  const pinned = await until(() => window.__game.binding.active, 8000);
  await tap('Space');
  const unpinned = await until(() => !window.__game.binding.active, 3000);
  const poise = await g(() => { const e = window.__game.enemies.enemies[0]; const s0 = e.state; e.takeDamage({ amount: 50, crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 500 }); return { before: s0, after: e.state }; });
  console.log(`  knight of pentacles: lane ${lane}, pinned ${pinned}, rolled free ${unpinned}, a 500-stagger shot: ${poise.before} → ${poise.after}`);
  if (!lane || !pinned || !unpinned || poise.after === 'stagger') throw new Error("the Knight of Pentacles' charge should bind, and shots shouldn't stagger it");

  // 2. The Queen of Pentacles: gilt seeds around you; trample one, let one ripen into an Imp.
  await clearFoes();
  await g(() => { window.__game.binding.cancel(); });
  await put(0, Z + 6, 0);
  await spawn('queenPentacles', 0, Z - 8, 0);
  const sown = await until(() => window.__game.hazards.verdicts.filter((v) => v.kind === 'seed').length >= 2, 30000);
  await wait(300);
  await shot('85-queen-pentacles-seeds');
  const seed = await g(() => { const v = window.__game.hazards.verdicts.find((v) => v.kind === 'seed'); return [v.at.x, v.at.z]; });
  await put(seed[0], seed[1], 0);
  const crushed = await until(() => window.__game.hazards.verdicts.filter((v) => v.kind === 'seed').length <= 1, 3000);
  await put(0, Z + 14, 0);
  const sprouted = await until(() => window.__game.enemies.enemies.some((e) => e.id === 'imp' && e.summoned), 8000);
  console.log(`  queen of pentacles: sowed ${sown}, trampled one ${crushed}, one sprouted an imp ${sprouted}`);
  if (!sown || !crushed || !sprouted) throw new Error("the Queen's seeds should sprout Imps unless trampled");

  // 3. The King of Pentacles: coin rain leaves coin (taking it weighs); his phases hire Misers.
  await clearFoes();
  await put(0, Z + 6, 0);
  await spawn('kingPentacles', 0, Z - 8, 0);
  const coined = await until(() => window.__game.coins.count > 0, 30000);
  await shot('86-king-pentacles-coin');
  const pile = await g(() => { const p = window.__game.coins.piles[0]; return [p.at.x, p.at.z]; });
  const b0 = await g(() => window.__game.burden);
  // It landed under her: step clear first (standing still never takes it), then walk back onto it.
  await put(pile[0] + 4, pile[1] + 4, 0);
  await wait(400);
  const stillThere = await g(() => window.__game.coins.count > 0);
  await put(pile[0], pile[1], 0);
  const took = await until((b0) => window.__game.burden > b0, 3000, b0);
  await hurtBoss(0.6);
  const hired = await until(() => window.__game.enemies.enemies.filter((e) => e.id === 'miser' && e.summoned).length >= 2, 6000);
  console.log(`  king of pentacles: coin on the floor ${coined} (still there after standing on it ${stillThere}), took it (heavy) ${took}, hired misers ${hired}`);
  if (!coined || !stillThere || !took || !hired) throw new Error('the King should leave coin that weighs, and hire Misers at his phase');

  // 4. The Devil: the arena, the pact, the shackles, his fall.
  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, cleared: ['justice'], unbound: ['parry'], progress: { justice: 0, devil: 3 } };
    gm.dimension = 'devil';
    gm.levelIndex = 3;
    gm.zoneSeed = 42;
    gm.start('level');
    window.__tuning.debug.showAI = false;
  });
  await wait(1500);
  const arena = await g(() => ({ boss: window.__game.bossWorld?.boss, area: window.__game.area.name, id: window.__game.enemies.enemies[0]?.id }));
  await shot('87-devil-approach');
  await put(0, -64, 0, 0.14);
  await wait(900);
  await shot('88-devil-reveal');
  await put(0, -80, 0, 0.18);
  const woke = await until(() => window.__game.enemies.enemies[0].state !== 'idle', 20000);
  await wait(1200);
  await shot('89-devil');
  const shackled = await until(() => window.__game.binding.active, 30000);
  await tap('Space');
  await until(() => !window.__game.binding.active, 3000);
  await hurtBoss(0.49);
  const offered = await until(() => window.__game.pact === 'offered', 5000);
  await wait(500);
  await shot('90-devil-pact');
  const immune = await g(() => { const e = window.__game.enemies.enemies[0]; const h = e.health; e.takeDamage({ amount: 100, crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 0 }); return h === e.health; });
  // The fight waits for her answer: the overlay is up and the game is paused.
  const paused = await g(() => window.__game.menus.pactShown && window.__game.mode === 'shop');
  if (!paused) throw new Error("the Devil's pact should pause the fight behind its overlay");
  await g(() => window.__game.answerPact(true));
  const accepted = await until(() => window.__game.pact === 'accepted' && !window.__game.menus.pactShown, 3000);
  await wait(300);
  const doubled = await g(() => { const e = window.__game.enemies.enemies[0]; const h = e.health; e.takeDamage({ amount: 100, crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 0 }); return Math.round(h - e.health); });
  const hurtMore = await g(() => {
    const gm = window.__game;
    window.__tuning.debug.godMode = false;
    gm.vitals.restore();
    const h0 = gm.vitals.health;
    gm.player.controller.state = 'move';
    gm.hurtPlayer(10, gm.player.pos.clone().add({ x: 0, y: 0, z: -3 }), 0);
    window.__tuning.debug.godMode = true;
    return h0 - gm.vitals.health;
  });
  console.log(`  devil: arena ${JSON.stringify(arena)}, woke ${woke}, shackled ${shackled}, pact offered ${offered} (he takes nothing while offering: ${immune}), accepted ${accepted}: he takes ${doubled} for 100, she takes ${hurtMore} for 10`);
  if (arena.boss !== 'devil' || arena.area !== 'The Devil' || arena.id !== 'devil' || !woke || !shackled || !offered || !immune || !accepted || doubled !== 200 || hurtMore !== 20) throw new Error('the Devil should shackle, offer his pact at half health, and the pact should double damage both ways');
  await hurtBoss(0);
  const open = await until(() => window.__game.bossWorld?.exitOpen?.() === true, 5000);
  await g(() => window.__game.nextLevel());
  await until(() => window.__game.layout === 'hub', 10000);
  await wait(800);
  const home = await g(() => {
    const gm = window.__game;
    const lion = gm.world.interactables.find((i) => (i.prompt(gm.player.pos) ?? '').toLowerCase().includes('lion'));
    return { cleared: gm.save.cleared, dash: gm.save.unbound.includes('dash'), lion: lion?.prompt(gm.player.pos) };
  });
  console.log(`  devil fallen: way on ${open}, home ${JSON.stringify(home)}`);
  // (The lion's road is built since V2-11: its gate is open to walk through.)
  if (!open || !home.cleared.includes('devil') || !home.dash || !home.lion?.startsWith("E: through the lion's gate")) throw new Error('the Devil falling should clear the dimension, free the dash and wake the lion');

  // 5. The dash: X, fast and short; through a Thrall chain it breaks the chain.
  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, unbound: ['parry', 'dash'] };
    gm.dimension = 'devil';
    gm.levelIndex = 3;
    gm.start('level');
  });
  await wait(1500);
  await clearFoes();
  await put(0, Z + 10, 0);
  await wait(300);
  const p0 = await g(() => window.__game.player.pos.toArray());
  await tap('KeyX');
  const dashed = await until(() => window.__game.player.controller.dashing, 2000);
  await wait(700);
  const p1 = await g(() => window.__game.player.pos.toArray());
  await g(() => {
    const gm = window.__game;
    gm.enemies.spawnFoes([{ id: 'thrall', pos: { x: 0, y: 0, z: -98 }, yaw: 0, idle: 'stand' }], gm.physics, gm.rng.fork('dash-thralls'));
  });
  // (The dash has a cooldown, and game time runs behind wall time here: wait it out.)
  await until(() => window.__game.dashCd <= 0 && window.__game.player.controller.state === 'move', 5000);
  await put(0, Z, 0);
  await wait(150);
  await tap('KeyX');
  const again = await until(() => window.__game.player.controller.dashing, 2000);
  const snapped = await until(() => window.__game.stats.chainsBroken > 0, 3000);
  console.log(`  dash: started ${dashed}, covered ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2)} m, dashed again ${again}, broke a chain ${snapped}`);
  if (!dashed || !again || !snapped) throw new Error('the dash should go, and break a Thrall chain it passes through');
  await g(() => { window.__tuning.debug.godMode = false; });
}


/** V2-11: the Tower's climb. Through the lion's gate; decks crack and fall; lightning sets them alight; falls cost. */
export async function towerScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(100);
    }
    return false;
  };
  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, seed: 42, cleared: ['justice', 'devil'], unbound: ['parry', 'dash'], progress: { justice: 0, devil: 0 } };
    window.__tuning.debug.godMode = true;
    gm.start('hub');
  });
  await wait(1200);
  const gate = await g(() => {
    const gm = window.__game;
    const it = gm.world.interactables.find((i) => (i.prompt(gm.player.pos) ?? '').includes('lion'));
    if (!it) return null;
    gm.player.controller.teleport({ x: it.pos.x * 0.95, y: 0.05, z: it.pos.z * 0.95 }, 0);
    return it.prompt(gm.player.pos);
  });
  await wait(300);
  await g(() => window.__game.input.press('KeyE'));
  await wait(60);
  await g(() => window.__game.input.release('KeyE'));
  const entered = await until(() => window.__game.layout === 'level' && window.__game.dimension === 'tower' && !!window.__game.level, 15000);
  console.log(`  tower: lion's gate "${gate}", entered ${entered}`);
  if (!gate?.startsWith("E: through the lion") || !entered) throw new Error("the lion's gate should open into the Tower once the Devil is cleared");
  await wait(1200);

  for (let lv = 0; lv < 3; lv++) {
    if (lv > 0) {
      await g(() => window.__game.nextLevel());
      await wait(1500);
    }
    const info = await g(() => {
      const gm = window.__game;
      const L = gm.level.generated;
      const crit = L.graph.critical.map((id) => L.space.rooms.find((r) => r.node === id));
      return { level: gm.levelIndex + 1, ok: gm.level.report.ok, setPiece: L.script.setPiece.id, climb: +(crit[crit.length - 1].y - crit[0].y).toFixed(1), decks: gm.level.decks?.counts, area: gm.area.name, draws: gm.renderer.renderer.info.render.calls };
    });
    console.log('  tower', JSON.stringify(info));
    if (!info.ok || info.area !== 'The Tower' || info.climb < 8 || !info.decks?.total) throw new Error(`tower level ${lv + 1} should build valid, climbing, on timber decks`);
    if (info.draws > 150) throw new Error(`tower draws ${info.draws} over the 150 budget`);
    await shot(`91-tower-l${lv + 1}-spawn`);
    if (lv === 0) {
      await g(() => { window.__tuning.debug.overview = true; });
      await wait(900);
      await shot('92-tower-overview');
      await g(() => { window.__tuning.debug.overview = false; });
      await g(() => window.__game.gotoVista(0));
      await wait(900);
      await shot('93-tower-vista');

      // A rotten deck: it cracks under her (magenta), falls, and so does she; she's put back on stone, hurt.
      const deck = await g(() => {
        const gm = window.__game;
        const s = gm.level.generated.dressing.scaffolds.find((x) => x.rotten.length);
        const i = s.rotten[0];
        const [x, z] = gm.deckAt(s, i);
        window.__tuning.debug.godMode = false;
        gm.vitals.restore();
        gm.enemies.clear();
        gm.player.controller.teleport({ x, y: s.y + 0.1, z }, 0);
        gm.camera.snap(gm.player.pos, 0);
        gm.camera.pitch = -0.5;
        return { x, z, y: s.y, hp: gm.vitals.health };
      });
      const cracked = await until(() => window.__game.stats.decksCracked > 0, 4000);
      await shot('94-tower-deck-cracking');
      const fell = await until(() => window.__game.stats.falls > 0, 12000);
      await wait(300);
      const after = await g(() => ({ hp: window.__game.vitals.health, y: window.__game.player.pos.y, gone: window.__game.level.decks.counts.gone }));
      console.log(`  tower deck: cracked ${cracked}, fell ${fell}, health ${deck.hp} → ${after.hp}, back at y ${after.y.toFixed(1)} (decks gone ${after.gone})`);
      if (!cracked || !fell || after.hp >= deck.hp || after.y < deck.y - 6) throw new Error('a rotten deck should crack and drop her, and the fall should cost health and put her back on stone');

      // Lightning: a mark where she stands, a strike, and the timber there catches and spreads.
      const sound = await g(() => {
        const gm = window.__game;
        window.__tuning.debug.godMode = true;
        const s = gm.level.generated.dressing.scaffolds[0];
        let i = Math.floor((s.cols * s.rows) / 2);
        while (s.rotten.includes(i)) i++;
        const [x, z] = gm.deckAt(s, i);
        gm.player.controller.teleport({ x, y: s.y + 0.1, z }, 0);
        gm.camera.snap(gm.player.pos, 0);
        gm.camera.pitch = -0.35;
        gm.stormT = 0;
        return true;
      });
      const marked = await until(() => window.__game.hazards.verdicts.length > 0, 3000);
      await shot('95-tower-lightning-mark');
      const struck = await until(() => window.__game.stats.strikes > 0, 6000);
      await wait(1500);
      const burning = await g(() => window.__game.level.decks.counts.burning);
      await shot('96-tower-fire');
      console.log(`  tower lightning: marked ${marked}, struck ${struck}, decks alight ${burning}`);
      if (!sound || !marked || !struck || burning < 1) throw new Error('lightning should mark, strike and set the decks alight');
      // A rest brings it all back.
      await g(() => window.__game.rest());
      const restored = await g(() => window.__game.level.decks.counts);
      console.log(`  tower rest: ${JSON.stringify(restored)}`);
      if (restored.gone !== 0 || restored.burning !== 0) throw new Error('resting should bring every deck back');
    }
  }
  // After the third level, up to the top floor: the Crowned Tower (V2-12).
  await g(() => window.__game.nextLevel());
  await until(() => window.__game.bossWorld?.boss === 'tower', 15000);
  const top = await g(() => ({ level: window.__game.levelIndex, progress: window.__game.save.progress.tower, boss: window.__game.enemies.enemies[0]?.id, decks: window.__game.decks?.counts }));
  console.log(`  tower: up to the top floor ${JSON.stringify(top)}`);
  if (top.level !== 3 || top.progress !== 3 || top.boss !== 'crownedTower' || !top.decks?.total) throw new Error("after the Tower's third level the way on should lead up to the Crowned Tower");
  await g(() => { window.__tuning.debug.godMode = false; });
}

/** V2-12: the Tower's own (Firebrand, Faller, Builder, Page of Wands), the Wands court, the Crowned Tower, the safe
 * fall and the Star. Fought on the Tower's top floor (all decks), so fire and falls are live. */
export async function towerFoesScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(80);
    }
    return false;
  };
  const Z = -96;
  const put = (x, z, yaw, pitch = 0.05) =>
    g(([x, z, yaw, pitch]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = pitch;
    }, [x, z, yaw, pitch]);
  const spawn = (id, x, z, yaw, idle = 'stand') =>
    g(([id, x, z, yaw, idle]) => {
      const gm = window.__game;
      gm.enemies.spawnFoes([{ id, pos: { x, y: 0, z }, yaw, idle }], gm.physics, gm.rng.fork(`smoke-${id}-${gm.enemies.enemies.length}`));
      return gm.enemies.enemies.length - 1;
    }, [id, x, z, yaw, idle]);
  const fresh = async () => {
    await g(() => {
      const gm = window.__game;
      gm.enemies.clear();
      gm.decks?.reset();
      gm.vitals.restore();
    });
  };
  const hurt = (i, frac) =>
    g(([i, frac]) => {
      const e = window.__game.enemies.enemies[i];
      e.takeDamage({ amount: Math.max(1, e.health - e.maxHealth * frac), crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 0 });
    }, [i, frac]);
  const burning = () => g(() => window.__game.decks.counts.burning + window.__game.decks.counts.gone);

  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, seed: 42, cleared: ['justice', 'devil'], unbound: ['parry', 'dash'], progress: { tower: 3 } };
    gm.dimension = 'tower';
    gm.levelIndex = 3;
    gm.zoneSeed = 42;
    gm.start('level');
    window.__tuning.debug.godMode = true;
    window.__tuning.debug.showAI = true;
  });
  await wait(1500);

  // 1. The Firebrand's pot lands burning.
  await fresh();
  await put(0, Z + 6, 0);
  await spawn('firebrand', 0, Z - 8, Math.PI);
  const lit = await until(() => window.__game.decks.counts.burning > 0, 25000);
  await shot('97-firebrand-fire');
  console.log(`  firebrand: its pot set the decks alight ${lit}`);
  if (!lit) throw new Error("the Firebrand's pot should set the timber alight");

  // 2. The Faller: perched, unseen; come near and its shadow grows where you stand; it lands and fights.
  await fresh();
  await put(0, Z + 14, 0);
  const fi = await spawn('faller', 0, Z, 0);
  const hidden = await g((i) => !window.__game.enemies.enemies[i].group.visible, fi);
  await put(0, Z + 5, 0, -0.2);
  const dropping = await until((i) => window.__game.enemies.enemies[i].perch === 'falling', 4000, fi);
  await wait(500);
  await shot('98-faller-shadow');
  const landed = await until((i) => { const e = window.__game.enemies.enemies[i]; return e.perch === 'down' && e.group.visible; }, 6000, fi);
  console.log(`  faller: hidden on its perch ${hidden}, dropped ${dropping}, landed ${landed}`);
  if (!hidden || !dropping || !landed) throw new Error('a Faller should wait unseen, drop where she stands (its shadow first), and land');

  // 3. The Builder hammers up a barricade.
  await fresh();
  await put(0, Z + 6, 0);
  const bi = await spawn('builder', 0, Z - 6, Math.PI);
  const walled = await until((i) => window.__game.enemies.enemies[i].barricadeCount > 0, 20000, bi);
  await shot('99-builder-barricade');
  console.log(`  builder: raised a barricade ${walled}`);
  if (!walled) throw new Error('the Builder should raise a barricade');

  // 4. The Page of Wands: its signal fire calls Firebrands, unless it's staggered first.
  await fresh();
  await put(0, Z + 8, 0);
  const pi = await spawn('pageWands', 0, Z - 6, Math.PI);
  const signalling = await until((i) => window.__game.enemies.enemies[i].attack === 'signal', 10000, pi);
  const called = await until((i) => window.__game.enemies.enemies[i].signalLit && window.__game.enemies.enemies.filter((e) => e.id === 'firebrand' && e.summoned).length >= 2, 15000, pi);
  await fresh();
  const qi = await spawn('pageWands', 0, Z - 6, Math.PI);
  await until((i) => window.__game.enemies.enemies[i].attack === 'signal', 10000, qi);
  await g((i) => { const e = window.__game.enemies.enemies[i]; e.takeDamage({ amount: 1, crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 999 }); }, qi);
  await wait(4000);
  const stopped = await g((i) => !window.__game.enemies.enemies[i].signalLit && !window.__game.enemies.enemies.some((e) => e.summoned), qi);
  console.log(`  page of wands: signalling ${signalling}, lit and called ${called}; staggered mid-signal, stopped ${stopped}`);
  if (!signalling || !called || !stopped) throw new Error("the Page of Wands' signal should call Firebrands, and a stagger should stop it");

  // 5. The Wands court: the Knight's charge leaves fire; the Queen calls her cat; the King calls Firebrands and burns.
  await fresh();
  await put(0, Z + 10, 0);
  await spawn('knightWands', 0, Z - 6, 0, 'throne');
  const trail = await until(() => window.__game.decks.counts.burning > 0 && window.__game.enemies.enemies[0].attack === 'charge', 25000);
  await shot('100-knight-wands-trail');
  await fresh();
  await put(0, Z + 6, 0);
  await spawn('queenWands', 0, Z - 8, 0, 'throne');
  await until(() => window.__game.enemies.enemies[0].state !== 'idle', 8000);
  await hurt(0, 0.6);
  const cat = await until(() => window.__game.enemies.enemies.some((e) => e.id === 'cat' && e.summoned), 6000);
  await fresh();
  await put(0, Z + 6, 0);
  await spawn('kingWands', 0, Z - 8, 0, 'throne');
  await until(() => window.__game.enemies.enemies[0].state !== 'idle', 8000);
  const b0 = await burning();
  await hurt(0, 0.6);
  const fireSquad = await until(() => window.__game.enemies.enemies.filter((e) => e.id === 'firebrand' && e.summoned).length >= 2, 6000);
  const burnt = await until((b0) => window.__game.decks.counts.burning + window.__game.decks.counts.gone > b0, 6000, b0);
  console.log(`  wands court: the knight's trail burns ${trail}, the queen's cat ${cat}, the king's firebrands ${fireSquad} and burning floor ${burnt}`);
  if (!trail || !cat || !fireSquad || !burnt) throw new Error('the Wands court should feed the fire: trail, cat, firebrands, a burning floor');

  // 6. The Crowned Tower: its floor falls ring by ring, down to a last platform; it falls and the floor holds.
  await g(() => { const gm = window.__game; gm.start('level'); });
  await wait(1500);
  await put(0, Z + 8, 0, 0.18);
  const woke = await until(() => window.__game.enemies.enemies[0].state !== 'idle', 20000);
  await wait(800);
  await shot('101-crowned-tower');
  await put(0, Z + 3, 0, 0.1);
  await hurt(0, 0.6);
  const ring1 = await until(() => window.__game.decks.counts.gone > 60, 12000);
  // (the floor before: every deck standing)
  await wait(500);
  await shot('102-crowned-tower-ring');
  const g1 = await g(() => window.__game.decks.counts.gone);
  await hurt(0, 0.3);
  const ring2 = await until((g1) => window.__game.decks.counts.gone > g1 + 20, 12000, g1);
  await wait(400);
  await shot('103-crowned-tower-last-platform');
  const g2 = await g(() => window.__game.decks.counts);
  await hurt(0, 0);
  const held = await until(() => window.__game.decks.counts.gone === 0 && window.__game.bossWorld.exitOpen(), 5000);
  console.log(`  crowned tower: woke ${woke}, first ring fell ${ring1} (${g1} gone), second ${ring2} (${JSON.stringify(g2)}), fell and the floor holds ${held}`);
  if (!woke || !ring1 || !ring2 || !held) throw new Error("the Crowned Tower's floor should fall ring by ring, and hold again when it falls");
  await g(() => window.__game.nextLevel());
  await until(() => window.__game.layout === 'hub', 10000);
  await wait(800);
  const home = await g(() => {
    const gm = window.__game;
    const p = (s) => gm.world.interactables.find((i) => (i.prompt(gm.player.pos) ?? '').includes(s))?.prompt(gm.player.pos);
    return { cleared: gm.save.cleared, fall: gm.save.unbound.includes('fall'), star: p('the Star'), eagle: p('eagle') };
  });
  await g(() => { const gm = window.__game; gm.player.controller.teleport({ x: -6, y: 0.05, z: 13 }, 2.4); gm.camera.snap(gm.player.pos, 2.4); gm.camera.pitch = 0.05; });
  await wait(800);
  await shot('104-hub-star');
  console.log(`  tower fallen: ${JSON.stringify(home)}`);
  // (The eagle's road is built since V2-13: its gate is open.)
  if (!home.cleared.includes('tower') || !home.fall || !home.star || !home.eagle?.startsWith("E: through the eagle's gate")) throw new Error('the Crowned Tower falling should free the safe fall, bring the Star and wake the eagle');

  // 7. The Star's pool sells heal upgrades.
  const bought = await g(() => {
    const gm = window.__game;
    gm.vitals.currency = 1000;
    gm.openShop('star');
    const before = gm.vitals.maxCharges;
    gm.buyItem({ id: 'starFlask', name: 'A third jug', blurb: '', price: 450, effect: { healBonus: 1 } });
    const after = gm.vitals.maxCharges;
    gm.shop.close();
    return { before, after, title: document.querySelector('.shop h1')?.textContent };
  });
  console.log(`  the star: ${JSON.stringify(bought)}`);
  if (bought.after !== bought.before + 1 || bought.title !== 'The Star') throw new Error("the Star's pool should sell a heal flask");

  // 8. The safe fall: unbound, a fall into the drop costs nothing and knocks back whoever is near.
  await g(() => {
    const gm = window.__game;
    gm.dimension = 'tower';
    gm.levelIndex = 0;
    gm.start('level');
  });
  await wait(1500);
  const fall = await g(() => {
    const gm = window.__game;
    window.__tuning.debug.godMode = false;
    gm.vitals.restore();
    gm.enemies.clear();
    const s = gm.level.generated.dressing.scaffolds.find((x) => x.rotten.length);
    const i = s.rotten[0];
    const [x, z] = gm.deckAt(s, i);
    gm.player.controller.teleport({ x, y: s.y + 0.1, z }, 0);
    return gm.vitals.health;
  });
  const fell = await until(() => window.__game.stats.falls > 0, 12000);
  await wait(300);
  const hp = await g(() => window.__game.vitals.health);
  console.log(`  safe fall: fell ${fell}, health ${fall} → ${hp}`);
  if (!fell || hp !== fall) throw new Error('once the Tower has fallen, a fall should cost nothing');
  await g(() => { window.__tuning.debug.godMode = false; window.__tuning.debug.showAI = false; });
}

/** V2-13: the Moon's marsh. Through the eagle's gate; reflections cast no shadow, make no footsteps, can't hurt, and
 * one hit dispels them; a false path drops you into the water; a reflected cache holds nothing. */
export async function moonScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(80);
    }
    return false;
  };
  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, seed: 42, cleared: ['justice', 'devil', 'tower'], unbound: ['parry', 'dash', 'fall'], progress: {} };
    window.__tuning.debug.godMode = true;
    gm.start('hub');
  });
  await wait(1200);
  const gate = await g(() => {
    const gm = window.__game;
    const it = gm.world.interactables.find((i) => (i.prompt(gm.player.pos) ?? '').includes('eagle'));
    if (!it) return null;
    gm.player.controller.teleport({ x: it.pos.x * 0.95, y: 0.05, z: it.pos.z * 0.95 }, 0);
    return it.prompt(gm.player.pos);
  });
  await wait(300);
  await g(() => window.__game.input.press('KeyE'));
  await wait(60);
  await g(() => window.__game.input.release('KeyE'));
  const entered = await until(() => window.__game.layout === 'level' && window.__game.dimension === 'moon' && !!window.__game.level, 15000);
  console.log(`  moon: eagle's gate "${gate}", entered ${entered}`);
  if (!gate?.startsWith("E: through the eagle") || !entered) throw new Error("the eagle's gate should open into the Moon once the Tower is cleared");
  await wait(1200);

  for (let lv = 0; lv < 3; lv++) {
    if (lv > 0) {
      await g(() => window.__game.nextLevel());
      await wait(1500);
    }
    const info = await g(() => {
      const gm = window.__game;
      const L = gm.level.generated;
      return {
        level: gm.levelIndex + 1,
        ok: gm.level.report.ok,
        setPiece: L.script.setPiece.id,
        foes: gm.enemies.enemies.length,
        reflections: gm.enemies.enemies.filter((e) => e.illusion).length,
        falsePaths: L.dressing.falsePaths.length,
        area: gm.area.name,
        draws: gm.renderer.renderer.info.render.calls,
      };
    });
    console.log('  moon', JSON.stringify(info));
    if (!info.ok || info.area !== 'The Moon' || info.reflections < 1) throw new Error(`moon level ${lv + 1} should build valid, with reflections among its enemies`);
    if (info.draws > 150) throw new Error(`moon draws ${info.draws} over the 150 budget`);
    await shot(`105-moon-l${lv + 1}-spawn`);
    if (lv === 0) {
      await g(() => window.__game.gotoVista(0));
      await wait(900);
      await shot('106-moon-vista');

      // A reflection and the real thing side by side: one casts a shadow, one doesn't; the real one has footsteps.
      const seen = await g(() => {
        const gm = window.__game;
        gm.enemies.clear();
        const s = gm.level.generated.dressing.spawn;
        const steps = { n: 0 };
        const sfx = gm.sfxAt.bind(gm);
        gm.sfxAt = (name, at) => {
          if (name === 'foeStep') steps.n++;
          return sfx(name, at);
        };
        window.__steps = steps;
        gm.enemies.spawnFoes(
          [
            { id: 'bailiff', pos: { x: s.x - 2, y: s.y, z: s.z - 9 }, yaw: Math.PI, idle: 'patrol' },
            { id: 'bailiff', pos: { x: s.x + 2, y: s.y, z: s.z - 9 }, yaw: Math.PI, idle: 'patrol', illusion: true },
          ],
          gm.physics,
          gm.rng.fork('moon-pair'),
        );
        gm.player.controller.teleport({ x: s.x, y: s.y + 0.05, z: s.z }, 0);
        gm.camera.snap(gm.player.pos, 0);
        gm.camera.pitch = -0.1;
        window.__tuning.debug.showAI = true;
        const [real, ghost] = gm.enemies.enemies;
        let realShadow = false;
        let ghostShadow = false;
        real.group.traverse((o) => (realShadow ||= o.castShadow));
        ghost.group.traverse((o) => (ghostShadow ||= o.castShadow));
        return { realShadow, ghostShadow };
      });
      await wait(2500);
      await shot('107-moon-reflection');
      const steps = await g(() => window.__steps.n);
      // The reflection's swings touch nothing; one hit dispels it, for nothing.
      const harmless = await g(() => {
        const gm = window.__game;
        window.__tuning.debug.godMode = false;
        gm.vitals.restore();
        gm.enemies.enemies[0].despawn();
        const ghost = gm.enemies.enemies[1];
        gm.player.controller.teleport({ x: ghost.ground.x, y: ghost.ground.y + 0.05, z: ghost.ground.z + 2.2 }, 0);
        ghost.alert(gm.player.pos);
        return gm.vitals.health;
      });
      const swung = await until(() => { const e = window.__game.enemies.enemies[1]; return e.attack && e.phase === 'recover'; }, 15000);
      const after = await g(() => window.__game.vitals.health);
      const dispelled = await g(() => {
        const gm = window.__game;
        const e = gm.enemies.enemies[1];
        const purse = gm.vitals.currency;
        e.takeDamage({ amount: 1, crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: -1 }, knockback: 0, stagger: 0 });
        window.__tuning.debug.godMode = true;
        return { gone: !e.alive, paid: gm.vitals.currency - purse, count: gm.stats.dispelled };
      });
      console.log(`  reflection: shadow real ${seen.realShadow} / reflection ${seen.ghostShadow}, footsteps heard ${steps}, it swung ${swung} and health ${harmless} → ${after}, one hit dispels ${JSON.stringify(dispelled)}`);
      if (!seen.realShadow || seen.ghostShadow || steps < 1 || !swung || after !== harmless || !dispelled.gone || dispelled.paid !== 0) throw new Error('a reflection should cast no shadow, make no footsteps, touch nothing, and go at one hit for nothing');

      // A false path: the boardwalk is drawn but nothing holds you; you sink and come up on the last stone.
      const fp = await g(() => {
        const gm = window.__game;
        const L = gm.level.generated;
        const i = L.dressing.falsePaths[0];
        if (i === undefined) return null;
        const c = L.space.connectors[i];
        // On the drawn boardwalk's middle line, between its hidden stones (on one, she'd stand: that's the secret way).
        const len = Math.hypot(c.bx - c.ax, c.bz - c.az);
        for (let t = 0.2; t < 0.8; t += 0.02) {
          const x = c.ax + (c.bx - c.ax) * t;
          const z = c.az + (c.bz - c.az) * t;
          // Each stone is turned square to its path: measure in its own frame.
          const held = L.dressing.stones.some((st) => {
            const dx = x - st.x;
            const dz = z - st.z;
            const u = dx * Math.cos(st.yaw) - dz * Math.sin(st.yaw);
            const v = dx * Math.sin(st.yaw) + dz * Math.cos(st.yaw);
            return Math.max(0, Math.abs(u) - st.size / 2) ** 2 + Math.max(0, Math.abs(v) - st.size / 2) ** 2 < 0.5 ** 2;
          });
          if (held) continue;
          gm.player.controller.teleport({ x, y: c.y0 + 0.3, z }, 0);
          return { at: +(t * len).toFixed(1) };
        }
        return null;
      });
      const sank = fp ? await until(() => window.__game.stats.falls > 0, 8000) : true;
      // And its cache is a reflection.
      const cache = await g(() => {
        const gm = window.__game;
        const k = gm.level.generated.dressing.caches.find((x) => x.reflection);
        if (!k) return null;
        const it = gm.world.interactables.find((i) => i.pos.distanceTo({ x: k.x, y: k.y, z: k.z }) < 0.1);
        const purse = gm.vitals.currency;
        const toast = it.use(gm.player.pos);
        return { toast, paid: gm.vitals.currency - purse };
      });
      console.log(`  false path: sank ${sank}; reflected cache ${JSON.stringify(cache)}`);
      if (!sank || (cache && (cache.paid !== 0 || !cache.toast?.includes('reflection')))) throw new Error('a false path should drop you, and a reflected cache hold nothing');
    }
  }
  await g(() => window.__game.nextLevel());
  const arena = await until(() => window.__game.levelIndex === 3 && window.__game.bossWorld?.boss === 'moon', 15000);
  console.log(`  moon: on to the Shadow's island ${arena}`);
  if (!arena) throw new Error("after the Moon's third level the road should lead to its arena (V2-14)");
  await g(() => { window.__tuning.debug.godMode = false; window.__tuning.debug.showAI = false; });
}

/** V2-14: the Moon's own (Dog and Wolf, the Crayfish, Phantoms, the Page of Cups), the Cups court, the Shadow, and
 * the ending (the blindfold, then the Sun). Runs in the Moon's arena (centre z −96). */
export async function moonFoesScenario({ g, wait, shot }) {
  const until = async (fn, timeout = 20000, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await g(fn, arg)) return true;
      await wait(80);
    }
    return false;
  };
  const Z = -96;
  const put = (x, z, yaw, pitch = 0.05) =>
    g(([x, z, yaw, pitch]) => {
      const gm = window.__game;
      gm.player.controller.teleport({ x, y: 0.05, z }, yaw);
      gm.camera.snap(gm.player.pos, yaw);
      gm.camera.pitch = pitch;
    }, [x, z, yaw, pitch]);
  const spawn = (id, x, z, yaw, idle = 'stand') =>
    g(([id, x, z, yaw, idle]) => {
      const gm = window.__game;
      gm.enemies.spawnFoes([{ id, pos: { x, y: 0, z }, yaw, idle }], gm.physics, gm.rng.fork(`smoke-${id}-${gm.enemies.enemies.length}`));
      return gm.enemies.enemies.length - 1;
    }, [id, x, z, yaw, idle]);
  const fresh = () =>
    g(() => {
      const gm = window.__game;
      gm.enemies.clear();
      gm.vitals.restore();
    });
  const hurt = (i, frac) =>
    g(([i, frac]) => {
      const e = window.__game.enemies.enemies[i];
      e.takeDamage({ amount: Math.max(1, e.health - e.maxHealth * frac), crit: false, point: e.center.clone(), dir: { x: 0, y: 0, z: 1 }, knockback: 0, stagger: 0 });
    }, [i, frac]);

  await g(() => {
    const gm = window.__game;
    gm.save = { ...gm.save, seed: 42, cleared: ['justice', 'devil', 'tower'], unbound: ['parry', 'dash', 'fall'], progress: { moon: 3 } };
    gm.dimension = 'moon';
    gm.levelIndex = 3;
    gm.zoneSeed = 42;
    gm.start('level');
    window.__tuning.debug.godMode = true;
    window.__tuning.debug.showAI = true;
  });
  await wait(1500);

  // 0. The sword reaches low things (playtest: cats and fish were under the blade). A cat at her feet; three swings.
  await fresh();
  await put(0, Z + 8, 0);
  await g(() => window.__game.arsenal.request(1));
  await until(() => window.__game.arsenal.index === 1 && !window.__game.arsenal.isSwapping, 6000);
  await g(() => window.__game.input.press('KeyF'));
  await wait(60);
  await g(() => window.__game.input.release('KeyF'));
  await until(() => window.__game.arsenal.sword.mode === 'sword' && !window.__game.arsenal.sword.switching, 6000);
  const ci0 = await spawn('cat', 0, Z + 6.6, Math.PI);
  await g((i) => { const e = window.__game.enemies.enemies[i]; e.update = () => {}; }, ci0);
  for (let k = 0; k < 6; k++) {
    await g(() => window.__game.input.press('Mouse0'));
    await wait(60);
    await g(() => window.__game.input.release('Mouse0'));
    await wait(350);
  }
  const cut = await until((i) => !window.__game.enemies.enemies[i].alive || window.__game.enemies.enemies[i].health < window.__game.enemies.enemies[i].maxHealth, 4000, ci0);
  await shot('107b-sword-cuts-low');
  console.log(`  the sword reaches a cat at her feet: ${cut}`);
  if (!cut) throw new Error('the sword should cut low things (a cat at her feet)');
  await g(() => window.__game.arsenal.request(0));
  await until(() => window.__game.arsenal.index === 0 && !window.__game.arsenal.isSwapping, 6000);

  // 1. The Dog and the Wolf: one howls, the other is maddened.
  await fresh();
  await put(0, Z + 10, 0);
  const di = await spawn('dog', -2, Z - 4, Math.PI);
  const wi = await spawn('wolf', 2, Z - 4, Math.PI);
  const howled = await until(([a, b]) => { const es = window.__game.enemies.enemies; return es[a].maddened || es[b].maddened; }, 30000, [di, wi]);
  await shot('108-moon-dog-wolf');
  console.log(`  dog and wolf: a howl maddened the other ${howled}`);
  if (!howled) throw new Error('the Dog and the Wolf should howl for each other');

  // 2. The Crayfish: under the water until you're near; ripples where you stand, then it surges up.
  await fresh();
  await put(0, Z + 14, 0);
  const ci = await spawn('crayfish', 0, Z, 0);
  const under = await g((i) => !window.__game.enemies.enemies[i].group.visible, ci);
  await put(0, Z + 4, 0, -0.2);
  const rising = await until((i) => window.__game.enemies.enemies[i].lurk === 'rising', 4000, ci);
  await wait(500);
  await shot('109-moon-crayfish-ripples');
  const up = await until((i) => { const e = window.__game.enemies.enemies[i]; return e.lurk === 'up' && e.group.visible; }, 6000, ci);
  console.log(`  crayfish: unseen ${under}, ripples ${rising}, surged up ${up}`);
  if (!under || !rising || !up) throw new Error('the Crayfish should wait unseen, ripple where she stands, and surge up');

  // 3. A Phantom is a reflection wherever it stands; the Page of Cups pours fish.
  await fresh();
  await put(0, Z + 8, 0);
  const ph = await spawn('phantom', -4, Z - 2, Math.PI);
  const phantom = await g((i) => window.__game.enemies.enemies[i].illusion, ph);
  const pi = await spawn('pageCups', 3, Z - 4, Math.PI);
  const fish = await until(() => window.__game.enemies.enemies.some((e) => e.id === 'fish' && e.summoned), 25000);
  await wait(400);
  await shot('110-moon-page-cups');
  console.log(`  phantom is a reflection ${phantom}; page of cups (${pi}) poured fish ${fish}`);
  if (!phantom || !fish) throw new Error('a Phantom should be a reflection, and the Page of Cups should pour fish');

  // 4. The Knight of Cups sets down a cup: drink it (moonlight heals, the dark one poisons).
  await fresh();
  // (far enough that the cup is all that reaches: it's offered only with room between you)
  await put(0, Z + 10, 0);
  await spawn('knightCups', 0, Z - 12, Math.PI, 'throne');
  const offered = await until(() => window.__game.hazards.cups.length > 0, 40000);
  await wait(300);
  await shot('111-moon-knight-cup');
  const drink = await g(() => {
    const gm = window.__game;
    window.__tuning.debug.godMode = false;
    const c = gm.hazards.cups[0];
    if (!c) return null;
    gm.enemies.enemies[0].despawn();
    gm.vitals.health = 60;
    gm.vitals.hurtStun = 0;
    gm.player.controller.teleport({ x: c.at.x, y: c.at.y + 0.05, z: c.at.z }, 0);
    return { good: c.good, before: 60 };
  });
  await wait(400);
  const drank = await g(() => ({ hp: window.__game.vitals.health, left: window.__game.hazards.cups.length }));
  await g(() => { window.__tuning.debug.godMode = true; });
  const fair = drink && drank.left === 0 && (drink.good ? drank.hp > drink.before : drank.hp < drink.before);
  console.log(`  knight of cups: offered ${offered}, drank ${JSON.stringify(drink)} → ${JSON.stringify(drank)}`);
  if (!offered || !fair) throw new Error("the Knight of Cups' cup should heal when it's moonlight and poison when it's dark");

  // 5. The Queen of Cups: two copies of her, and she trades places with one (only she casts a shadow).
  await fresh();
  await put(0, Z + 6, 0);
  await spawn('queenCups', 0, Z - 6, Math.PI, 'throne');
  const mirrored = await until(() => window.__game.enemies.enemies[0].reflections?.length >= 2, 45000);
  await wait(300);
  await shot('112-moon-queen-mirror');
  const copies = await g(() => window.__game.enemies.enemies.filter((e) => e.id === 'queenCups').map((e) => ({ illusion: e.illusion, bar: e.bar })));
  console.log(`  queen of cups: mirrored ${mirrored}, ${JSON.stringify(copies)}`);
  if (!mirrored || copies.filter((c) => c.bar).length !== 1) throw new Error('the Queen of Cups should make copies of herself, and only she holds the bar');

  // 6. The King of Cups: tidal waves with a gap; his wolves at each phase.
  await fresh();
  await put(0, Z + 10, 0);
  await spawn('kingCups', 0, Z - 6, Math.PI, 'throne');
  const waved = await until(() => window.__game.hazards.waves.length > 0, 40000);
  await wait(250);
  await shot('113-moon-king-wave');
  await hurt(0, 0.6);
  const wolves = await until(() => window.__game.enemies.enemies.filter((e) => e.id === 'wolf' && e.summoned).length >= 2, 6000);
  console.log(`  king of cups: a wave ${waved}, wolves ${wolves}`);
  if (!waved || !wolves) throw new Error('the King of Cups should send waves and call wolves');

  // 7. The Shadow: her own moves; at its phases the Moon is eclipsed and it splits into reflections.
  await g(() => { const gm = window.__game; gm.start('level'); });
  await wait(1500);
  await put(0, Z + 10, 0, 0.12);
  const woke = await until(() => window.__game.enemies.enemies[0].state !== 'idle', 20000);
  await wait(1500);
  await shot('114-moon-shadow');
  const blind0 = await g(() => window.__game.player.biped.wearsBlindfold);
  await hurt(0, 0.55);
  const split = await until(() => window.__game.enemies.enemies.filter((e) => e.id === 'shadow' && e.illusion && e.alive).length >= 2, 8000);
  await wait(600);
  await shot('115-moon-shadow-split');
  await hurt(0, 0);
  const open = await until(() => window.__game.bossWorld.exitOpen(), 5000);
  console.log(`  the shadow: woke ${woke}, split ${split}, falls and the way opens ${open}`);
  if (!woke || !split || !open) throw new Error('the Shadow should wake, split into reflections at its phase, and fall');

  // 8. The ending: the blindfold comes off, and the Sun.
  await g(() => window.__game.nextLevel());
  const sun = await until(() => window.__game.menus.sunShown && window.__game.layout === 'hub', 10000);
  await wait(600);
  await shot('116-the-sun');
  const end = await g(() => {
    const gm = window.__game;
    return { cleared: gm.save.cleared, unbound: gm.save.unbound, blindfold: gm.player.biped.wearsBlindfold, line: document.querySelector('.overlay.sun .line')?.textContent };
  });
  await g(() => window.__game.closeSun());
  await wait(800);
  const back = await g(() => !window.__game.menus.sunShown && window.__game.mode === 'playing');
  await shot('117-hub-unbound');
  console.log(`  the sun: shown ${sun}, ${JSON.stringify(end)}, closed ${back} (blindfold before ${blind0})`);
  if (!sun || !end.unbound.includes('blindfold') || end.blindfold || !blind0 || !end.line || !back) throw new Error('the Moon should free the blindfold, and the Sun should follow');
  await g(() => { window.__tuning.debug.godMode = false; window.__tuning.debug.showAI = false; });
}

# CLAUDE.md: *Eight* (v2)

A playable web game: a souls-like third-person shooter set in a world built from the tarot. The protagonist is
the Eight of Swords. v2 is an iteration of the v1 bug-scale prototype (frozen docs in `archive/v1/`), not a new
project: the code carried over, and the v2 milestones in `PLAN.md` migrate it.

**Read first:** `DESIGN.md` (structure, dimensions, characters; items are tagged Decided / Proposed / Open),
`LEVELS.md` (level design principles + procedural generation), `STYLE.md` (look), `PLAN.md` (milestones).
Only build on **Decided** items. If work needs a **Proposed** one, ask, or say plainly that you're assuming it.
When a decision is made, propagate it to every planning doc it touches.

The current slice exists to answer:

> **Does one tarot dimension's meaning come across through how it plays? Does the SwordRifle's two-mode loop earn
> its place next to the auto-pistol? Do generated levels feel designed?**

Anything that doesn't serve that question is out of scope for now. Depth over breadth: one excellent dimension beats
four thin ones.

> **Code status (V2-6):** the player, camera, weapons, look, the Justice training courtyard, the generated Justice
> levels (`src/world/gen-*.ts`, `level.ts`), Justice's enemies (`src/enemies/foe*.ts`, `humanoid.ts`), the Swords
> court cards (`court.ts`), and Justice and her arena (`justice.ts`, `src/world/boss.ts`) are v2, in
> metres. The v1 bug enemies (`enemy.ts`, `types.ts`, `rig.ts`), v1 zones (`src/world/gen.ts`, `zone.ts`,
> `themes.ts`), the test arena and the pollen economy are still v1 bug-scale content in beetle units, reachable only
> through `?mode=arena|range|garden|kitchen`. Comments that mention bugs, pollen or beetles describe that v1 content.

## Pillars (check every decision against these)

1. **Responsive trigger, committed body.** Shooting is instant and juicy. Rolling, healing, reloading, swinging
   and switching SwordRifle modes lock you in.
2. **Everything is readable.** Every enemy attack is telegraphed by pose, colour and sound. Telegraph colours must
   stand out in every area palette (see `STYLE.md → Reserved signal colours`). Illusions (the Moon) have consistent,
   learnable tells, so they test reading instead of breaking it.
3. **Procedural over authored.** Geometry, animation, levels and audio are generated in code. No downloaded assets.
   Levels are *authored rules, procedural arrangement* (`LEVELS.md`).
4. **The cards become the rules.** Each dimension's mechanics, spaces and enemies express the meaning of its arcana.
   If a feature would fit any fantasy game equally well, question it.
5. **Small and finished.** 4 dimensions × 3 levels is the cap (the dev-only trial grounds don't count). Rank is the verb, suit is the flavour; kits over
   bespoke content.

## Out of scope

Loot, rarity, crafting, survival meters, skill trees and buildcraft systems; branching dialogue, voice and
cutscenes; multiplayer and co-op; touch controls; more than 4 dimensions; menus beyond start / death / pause / hub shop.

**Allowed, but keep it minimal:**
- a progress save in `localStorage` (gates, upgrades, repair stage, seed)
- the Magician's one upgrade menu
- short state-based NPC lines in the hub

## Stack

Three.js + Vite + TypeScript, Rapier (`@dimforge/rapier3d-compat`) and lil-gui. Vitest handles unit tests, and Playwright
(preinstalled Chromium) runs the smoke tests and screenshots.

## Commands

- `npm run dev`: dev server
- `npm run build`: typecheck and production build (relative `base`, so it deploys to GitHub Pages)
- `npm test`: unit tests (pure logic: IK, gait, RNG, generation)
- `npm run smoke`: builds, serves, and loads the page in headless Chromium. Any console error fails the run.
  Writes screenshots to `screenshots/`. The main run walks the Justice courtyard and shoots the look. Add scenarios
  with `npm run smoke -- --level --foes --court --boss --pistol --sword --enemies --zones` (`--level`, `--foes`, `--court`, `--boss`, `--pistol` and `--sword` are v2; `--enemies` and
  `--zones` drive the legacy v1 scenes). If the pinned Playwright's browser isn't installed, point `CHROMIUM_PATH` at a Chromium binary.
  Headless runs on SwiftShader at ~20fps and game time lags wall time, so scenarios wait on game state, not on timers.

## Conventions

- **Units**: **1 world unit = 1 metre**; the player is 1.6 m (`src/anim/body.ts` holds her proportions; lengths in the
  rig, weapon placement and reloads come from `BODY`, never literals). `tuning.foes` (v2 enemies) is in metres;
  `tuning.enemies` is the v1 bugs, still in beetle units. Y is up. Time is in seconds, angles in radians (the tuning panel shows degrees where noted).
- **Seeded RNG everywhere**: never call `Math.random()` in game code. Use `rng()` from `src/core/rng.ts`, seeded
  from `?seed=` (shown in the debug overlay). FX jitter uses a separate stream so gameplay generation stays
  deterministic regardless of what effects ran.
- **Tuning**: every feel number lives in `src/tuning.ts` as plain data. `src/ui/panel.ts` builds the lil-gui panel (backtick) from it automatically, so a new number appears in the panel without extra code.
  Never hard-code a feel number in a system. Read it from the tuning object each frame so live edits apply.
- **Weapons are data** (`src/weapons/defs.ts`). Systems read from the def, and new weapons must not need new code
  paths unless they add a genuinely new verb. SwordRifle melee is one such verb (V2-2); upgrades and repair stages
  are data applied to a def, not new code.
- **Content is data**: dimensions, beats, room kits, encounter templates, enemy body plans and court-rank
  behaviours are data tables read by systems. Adding the second dimension should mean mostly new data.
- **Pure logic in `src/anim/*`, `src/core/*` and `src/world/gen*`** must stay free of Three/DOM imports where practical,
  so it can be unit-tested.
- **Geometry** is built from primitives with vertex colours and merged per prop type (`src/render/geo.ts`). Repeated
  props use `InstancedMesh`. One shadow-casting light. Keep draw calls low and check the debug overlay.
- **Pools, not allocations**, in hot paths: tracers, impacts, decals, casings and audio voices. Reuse scratch vectors.
- **Changing light count recompiles shaders.** The muzzle point light always exists; toggle its intensity. Warm
  lights in levels (lanterns) are unlit emissive meshes plus an additive ground glow, never extra lights.
- **Fog** is a shader-chunk override (`src/render/atmosphere.ts`): soft-exponent distance fog with height falloff,
  driven by `tuning.look` through one shared uniform object. Don't create materials that opt out of fog unless
  they're FX or the sky.
- **Colours**: area and signal colours live in `src/render/palette.ts`. Signal colours (telegraph magenta, weak-spot
  cyan, crit gold, kill red, UI white) are never used on props, characters or accent motifs. Each area has one
  accent motif colour, used only on that motif.
- **Milestones** end with a playable build, a commit, and a `PLAYTEST.md` entry (what to try, what I'm unsure of).
  Feel and difficulty can only be judged by playing, so say so instead of claiming they're good.
- **Verification**: `npm run typecheck && npm test && npm run smoke`, then read the screenshots against `STYLE.md`
  (its screenshot checklist).
- **Planning docs**: decisions propagate to every doc they touch (`DESIGN.md`, `LEVELS.md`, `STYLE.md`, `PLAN.md`,
  this file). `archive/v1/` is frozen and is never edited.

## Layout

```
src/
  main.ts          bootstrap, menus, game loop
  game.ts          modes + per-frame system order
  tuning.ts        all feel numbers (weapons reference src/weapons/defs.ts)
  core/            rng, math/springs, input, time (slow-mo, hitstop)
  physics/         Rapier world wrapper, collision groups
  render/          renderer, palette, geometry helpers, toon materials, atmosphere (fog + sky), pixel mode
                   (low-res blocks + distance-faded depth outline)
  anim/            pure IK + gait logic, BODY proportions, verlet ribbon (blindfold tails), biped rig
  player/          controller, camera, vitals (health/stamina/heal), player rig + weapon placement
  weapons/         weapon defs, firing, recoil, projectiles; SwordRifle (swing.ts: pure melee timing/pose/charges;
                   swordrifle.ts: modes, blade sweep, charge cells)
  fx/              muzzle flash, tracers, impacts, decals, casings, screen shake
  audio/           WebAudio synth
  ui/              HUD, crosshair, hit markers, menus, tuning panel (presets, Copy JSON)
  enemies/         v2: humanoid rig (humanoid.ts), archetypes as data (foes.ts), pure AI decisions (foe-ai.ts), the
                   Foe state machine (foe.ts), court-card minibosses (court.ts: CourtCard extends Foe), the Justice
                   boss (justice.ts: JusticeBoss extends CourtCard). Shared: hazards (slam rings, thrown blades, globs, charge lanes) and the
                   manager (any Hostile). v1: multi-legged IK rig, bug body plans and AI (enemy.ts)
  world/           v2: dimension data + room kits (dimensions.ts), the pure level generator (gen-graph: script +
                   mission graph; gen-space: rooms, loop, shortcut; gen-dress: kit structure, sockets, dressing;
                   gen-validate; gen-level: pipeline + reseed), the level builder (level.ts), the boss arena
                   (boss.ts), faceted prop kit,
                   Justice courtyard, training dummies. v1: arenas, props, pollen drop, zone generator. (Coming: hub)
tests/             vitest unit tests
scripts/           smoke test (Playwright)
archive/v1/        frozen v1 planning docs
```

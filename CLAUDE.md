# CLAUDE.md: A bugs death

A playable web prototype of a cute, bug-scale, souls-like third-person shooter.
It exists to answer one question:

> **Is a cute, bug-scale, souls-like third-person shooter satisfying for 10 minutes? Does each weapon feel distinct
> within three shots, and can the player read and dodge everything that kills them?**

Anything that doesn't serve that question is out of scope. Depth over breadth: one excellent weapon beats three mediocre ones.

## Pillars (check every decision against these)

1. **Responsive trigger, committed body.** Shooting is instant and juicy. Rolling, healing and reloading lock you in.
2. **Everything is readable.** Every enemy attack is telegraphed by pose, colour and sound. Telegraph colours must
   stand out in every biome palette (see `STYLE.md → Reserved signal colours`).
3. **Procedural over authored.** Geometry, animation, levels and audio are generated in code. No downloaded assets.
4. **The world is huge because you are tiny.** Props are everyday objects and plants at bug scale.

## Out of scope

Inventory, loot, rarity, crafting, survival meters, skill trees, dialogue, story, save system, multiplayer, touch
controls, and any menus beyond start / death / pause.

## Stack

Three.js + Vite + TypeScript, Rapier (`@dimforge/rapier3d-compat`) and lil-gui. Vitest handles unit tests, and Playwright
(preinstalled Chromium) runs the smoke tests and screenshots.

## Commands

- `npm run dev`: dev server
- `npm run build`: typecheck and production build (relative `base`, so it deploys to GitHub Pages)
- `npm test`: unit tests (pure logic: IK, gait, RNG, generation)
- `npm run smoke`: builds, serves, and loads the page in headless Chromium. Any console error fails the run.
  Writes screenshots to `screenshots/`. Add scenarios with `npm run smoke -- --range --enemies --zones`
  (weapons/range, M4 combat loop, M5 zones). Headless runs on SwiftShader at ~20fps and game time lags wall time,
  so scenarios wait on game state, not on timers.

## Conventions

- **Units**: 1 world unit ≈ the player beetle's height. Y is up. Time is in seconds, angles in radians (the tuning
  panel shows degrees where noted).
- **Seeded RNG everywhere**: never call `Math.random()` in game code. Use `rng()` from `src/core/rng.ts`, seeded
  from `?seed=` (shown in the debug overlay). FX jitter uses a separate stream so gameplay generation stays
  deterministic regardless of what effects ran.
- **Tuning**: every feel number lives in `src/tuning.ts` as plain data. `src/ui/panel.ts` builds the lil-gui panel (backtick) from it automatically, so a new number appears in the panel without extra code.
  Never hard-code a feel number in a system. Read it from the tuning object each frame so live edits apply.
- **Weapons are data** (`src/weapons/defs.ts`). Systems read from the def, and new weapons must not need new code
  paths unless they add a genuinely new verb.
- **Pure logic in `src/anim/*`, `src/core/*` and `src/world/gen*`** must stay free of Three/DOM imports where practical,
  so it can be unit-tested.
- **Geometry** is built from primitives with vertex colours and merged per prop type (`src/render/geo.ts`). Repeated
  props use `InstancedMesh`. One shadow-casting light. Keep draw calls low and check the debug overlay.
- **Pools, not allocations**, in hot paths: tracers, impacts, decals, casings and audio voices. Reuse scratch vectors.
- **Changing light count recompiles shaders.** The muzzle point light always exists; toggle its intensity.
- **Colours**: biome and signal colours live in `src/render/palette.ts`. Signal colours (telegraph magenta, weak-spot
  cyan, crit gold, kill red, UI white) are never used on props.
- **Milestones** end with a playable build, a commit, and a `PLAYTEST.md` entry (what to try, what I'm unsure of).
  Feel and difficulty can only be judged by playing, so say so instead of claiming they're good.
- **Verification**: `npm run typecheck && npm test && npm run smoke`, then read the screenshots against `STYLE.md`.

## Layout

```
src/
  main.ts          bootstrap, menus, game loop
  game.ts          modes + per-frame system order
  tuning.ts        all feel numbers (weapons reference src/weapons/defs.ts)
  core/            rng, math/springs, input, time (slow-mo, hitstop)
  physics/         Rapier world wrapper, collision groups
  render/          renderer, palette, geometry helpers, toon materials
  anim/            pure IK + gait logic, biped rig
  player/          controller, camera, vitals (health/stamina/heal), player rig + weapon placement
  weapons/         weapon defs, firing, recoil
  fx/              muzzle flash, tracers, impacts, decals, casings, screen shake
  audio/           WebAudio synth
  ui/              HUD, crosshair, hit markers, menus, tuning panel (presets, Copy JSON)
  enemies/         multi-legged IK rig, body plans, AI state machine, hazards (globs, charge lanes), manager
  world/           arenas, dummy range, props, pollen drop, (later) zone generator
tests/             vitest unit tests
scripts/           smoke test (Playwright)
```

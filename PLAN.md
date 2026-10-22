# PLAN.md

The question we're answering: **is a cute, bug-scale, souls-like TPS satisfying for 10 minutes; does each weapon feel
distinct within three shots; can the player read and dodge everything that kills them?**

Every milestone ends with a playable build, a commit, a `PLAYTEST.md` entry, and a headless-Chromium smoke test
with screenshots checked against `STYLE.md`.

## M0: Style and plan ✅
- Study the White Lavender store screenshots. Write `STYLE.md` (palette, lighting, shading, silhouettes), `CLAUDE.md`
  (pillars + conventions) and this plan.

## M1: Greybox
- Vite + TS + Three + Rapier scaffold, relative `base` for GitHub Pages.
- Seeded RNG from `?seed=` and debug overlay (seed, FPS, draw calls).
- Input: pointer lock, key/mouse state, wheel.
- Rapier kinematic character controller: walk, sprint, gravity, autostep, slope limit, snap-to-ground.
  A basic dodge-roll already exists here so later reload-cancel can be tested; stamina and i-frames arrive in M4.
- Over-the-shoulder camera: shoulder swap (C), RMB zoom, sphere-cast collision against props.
- Procedural biped:
  - feet plant via ground raycasts, stepping with an arc when drift > threshold (alternating)
  - hip bob + lean with velocity
  - two-bone IK arms to the weapon grips, weapon aimed at the crosshair target
  - head + antennae look at the aim point
- Test arena: flat ground, pebbles, grass trees, a matchstick bridge, a sugar-cube staircase, a slope, a bottle cap.
- Toon materials + palette + fog + one shadow light per STYLE.md.
- Unit tests: two-bone IK solver, gait step selection, RNG determinism.
- lil-gui skeleton (backtick) with player/camera numbers, presets and Copy JSON.

## M2: Gun-feel (heart of the project). Don't move on until the user says it feels good
- Weapon data object with every number in the brief, exposed in the tuning panel.
- Rubber-band repeater fully juiced:
  - hitscan on the input frame (RPM accumulator, so frame rate doesn't eat shots)
  - muzzle flash sprite + persistent point light (1–2 frames), tracer, impact puff, decal pool, ejected casings
  - camera kick with spring recovery, separate weapon/arm recoil spring, FOV punch
  - trauma² screen shake
  - crosshair bloom from current spread, hit marker (normal / crit / kill)
  - enemy hit-flash + flinch impulse into body spring, hitstop on crit/kill
  - layered synthesized audio: click + filtered noise body + thump + tail; reload clicks, hit and crit sounds
  - committed procedural reload arm animation; dodge cancels it and the reload is lost
- Target-dummy range from the start menu: static dummies at 5/10/20/40 units, a sliding dummy, weak-spot heads,
  a DPS/last-hit readout.
- Debug toggles: hitboxes, IK targets, god mode, slow-mo 0.25×.
- **Stop here for the user to playtest and send back tuning JSON.**

## M3: Seed-spitter + Staple driver + weapon swap
- Seed-spitter: pellets, big knockback impulse, close-range stagger, a chunky "pomp" sound.
- Staple driver: visible fast projectile, bolt cycle, long reload, pierce 1, big crit, a sharp "thwack".
- Swap via 1/2/3 and the wheel, with a short committed swap animation.

## M4: Souls-like body + enemies
- Stamina (dodge/sprint gates, regen delay), roll i-frames (~0.3s) + recovery, no shooting mid-roll.
- 3 heal charges, 1.2s committed heal that slows movement and is interrupted by damage.
- Death: drop pollen at the death spot, death screen, respawn at the checkpoint.
- Multi-legged IK enemy rig: tripod gait, step arcs, body follows the feet plane, spring hit reactions,
  death flip + leg curl.
- AI FSM (idle → alert → approach → wind-up → attack → recover → stagger), steering + avoidance, poise.
- Skitterer, Spitter (lob + ground marker), Brute (armoured front, cyan abdomen weak spot, long charge telegraph).

## M5: Zones + loop
- Seeded clearing graph (6–10 nodes) over a noise heightfield. Start = checkpoint, farthest = Brute,
  one side branch = pollen cache.
- Theme data: Garden Bed and Kitchen Floor (palette, fog, ground noise, prop generators, enemy weights).
- Sugar-cube checkpoint: rest refills heals and ammo and respawns non-elites. Pollen counter, dropped-pollen recovery.
- Debug: regenerate with a new seed, draw the graph overlay. Unit test: same seed → same zone.

## M6: Style, performance, deploy
- Compare against STYLE.md; optional posterise pass; low-res toggle check.
- Performance: instancing audit, draw-call budget (<150), shadow frustum tuning.
- GitHub Pages workflow.

## Risks / open questions
- Headless Chromium uses SwiftShader, so screenshots verify the look, not the frame rate. Performance must be judged on real hardware.
- Feel can only be judged by playing. Every feel number is in the panel so the user can tune and paste JSON back.

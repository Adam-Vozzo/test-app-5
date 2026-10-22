# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.

## M2: Gun-feel (rubber-band repeater, fully juiced) ⏸ waiting on your playtest
**Run:** `npm run dev` and pick **Target-dummy range** (or add `?mode=range` to the URL). Ammo is infinite in the range.
Dummies stand at 5 / 10 / 20 / 40 units, and the one at 15 slides side to side. The glowing cyan band on each head is the weak spot (2× crit).
The readout at the top shows last hit, DPS over 3s, time-to-kill, accuracy and current spread.

**Try, roughly in this order:**
1. **Single taps** at the 10u dummy. Every click fires on the frame it lands, even a click shorter than one frame.
   You should see the band-tracer, a muzzle flash for 2 frames, a casing flipping out to the right, a dust puff and decal on misses, a white flash and a wobble on the dummy, and a white hit marker.
2. **Headshots**: the gold marker plus a "ting" plus a ~50ms hitstop. **Kills**: the red rotating X, a crunch and ~70ms hitstop; the dummy topples and respawns after 2.2s.
3. **Hold fire for a full mag** without correcting. The crosshair climbs (about 0.4°/shot, ramping over 6 shots), sways a little, and the spread ticks open (bloom).
   Then do it again while pulling the mouse down: is the climb *controllable* and does it feel like something you get better at?
4. **RMB (ADS)**: tighter spread (0.35°), 75% recoil, slower look, the FOV zooms to 52.
5. **R to reload** (1.9s, committed). The off hand reaches up, pulls the spool off, goes to the hip, seats a new spool and racks the lever, with a click at each beat.
   **Roll (Space) mid-reload**: the reload is cancelled and lost ("reload lost" toast), so you start over.
6. **T for slow-mo 0.25×**. This is the best way to judge each layer: the kick spring, weapon spring, FOV punch, shake, flash frames and casing arcs.
7. Close your eyes and fire: it's a twangy "thwip" (click + triangle twang + band-passed noise + low thump + short tail).

**Tune it:** backtick, then `weapons → repeater`. The numbers are grouped as damage / handling / spread / recoil / weapon kick-fov-shake / fx / audio (each audio layer is editable).
Hit-stop, shake and marker timing live in `feel`; dummy health and flinch in `dummy`. When it feels right, use **📋 Copy JSON** and paste it back to me, and I'll bake the values in as defaults.

**Unsure about:**
- **Recoil model.** Each shot's kick is split by `kickReturn` (0.45): that fraction springs back like a camera kick, and the rest is permanent climb you pull down against. If it feels floaty, lower `kickReturn`. If it feels like a fight, lower `recoilVertical`.
- **Hitstop on every crit** with an automatic weapon could feel stuttery. Try `feel.hitstopCrit` at 0.02–0.03 if so.
- **Dummy health 220** makes body-shot TTK about 2.3s at 660rpm. That's tuned for "a few seconds of tracking", not for real enemies (M4).
- **Audio** has only been verified to run without errors headless (the context runs and nodes are created). I haven't heard it. Whether the twang reads as "rubber band" needs your ears.
- **Muzzle-light strength** (`flashLight` 2.5). Higher values blew out the floor under the player in screenshots.
- God mode and AI labels exist as toggles but do nothing until M4 adds enemies and player damage.

Per the brief I've stopped here, because M3+ shouldn't start until the repeater feels good to you.

## M1: Greybox (controller, camera, procedural biped, test arena)
**Run:** `npm install && npm run dev`, open the URL and click **Play: test arena**. Click the canvas to capture the mouse.

**Try:**
- Walk (WASD), sprint (Shift) and dodge-roll (Space). The roll is a forward tumble and fully committed: no steering mid-roll, then a short recovery.
- Climb the **button ziggurat** (0.3-high steps, autostep) and watch the feet plant on each step. Press **I** to see foot plants (green), desired foot spots (yellow) and hand IK targets (blue).
- Walk up the **matchstick ramp** onto the big boulder, and over the **leaf** slope.
- Hold **RMB**: the camera pulls in over the shoulder, the body turns to the camera, and both arms IK to the gun pointing at the crosshair. Press **C** to swap shoulders.
- Back into a grass stalk or boulder: the camera sphere-casts so it should never clip inside props.
- **T** toggles slow-mo (0.25×), which is good for watching the step arcs. **H** shows every collider.
- Backtick opens the tuning panel. `biped` (step threshold, duration, height, lean) and `camera` are the folders to play with.

**Unsure about:**
- Walk cadence. Steps trigger on distance (`biped.stepThreshold` 0.24, `stepDuration` 0.15s). At sprint speed the feet can look skate-y, so judge it in slow-mo.
- Whether the body should always face the camera (strafe style) instead of free-running when not aiming. Right now it free-runs and turns to the camera for 1.6s after aiming (`player.combatModeTime`).
- Camera distance and shoulder offset. The head can cover the crosshair at some pitches; ADS offsets were widened for that.
- Headless screenshots run on SwiftShader (~20fps), so they say nothing about real performance. The overlay shows FPS and draw calls (~50 in the arena).

## M0: Style and plan
Nothing to play yet. Read `STYLE.md` and push back on anything that doesn't match your memory of White Lavender:
- Is "fog toward dark warm umber" (the lamp-lit stage) the look you want, or should the Garden be brighter and airier?
- Is hot magenta `#FF2E9A` acceptable as the universal enemy-telegraph colour?

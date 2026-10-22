# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.

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

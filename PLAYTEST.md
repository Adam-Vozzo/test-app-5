# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.

## M4: Stamina, dodge, heal, death, and three IK enemies
**Run:** **Play: test arena** (or `?mode=arena`). Seven enemies are placed around the arena:
- four **skitterers** in the middle distance
- two **spitters** further back
- the **brute beetle** (elite) inside the bottle cap. It shows a boss bar when it engages.

The sugar cube behind the spawn is the checkpoint (**E** to rest).

**Souls-like rules:**
- **Stamina** (green bar) pays for rolls (28) and sprinting (18/s), and regenerates after 0.7s. Emptying it exhausts you: no roll or sprint until it's back to 25.
- **Roll i-frames**: the first 0.26s of the roll (your tuned value). The status line shows `i-frames`, and a dodged hit plays a whoosh.
- **Heal (Q)**: 3 dewdrop charges. It takes 1.2s, you move at 35% speed, and the gun is lowered while the off hand brings a dewdrop to your mouth. It lands at 70%. Getting hit before then interrupts it, and the charge is wasted.
- **Damage**: enemies take 3–4 hits to kill you (25 / 30 / 32 / 40 damage). A hit gives knockback, a red vignette, a short stun and a lagging health chunk.
- **Death**: the beetle flips onto its back, legs flailing, and the gun drops. You get "Squished" and rise at the sugar cube (button, E or Space). Heals and ammo refill, and every enemy except a slain elite respawns.
  Your **pollen** (✿, from kills: 4 / 8 / 60) stays where you fell, marked by a gold puff with a beam. Walk back to it to recover it. Die again first and it's gone.
- **Rest (E)** at the sugar cube refills heals and ammo and respawns the non-elite enemies.

**Enemies** (all procedural: tripod gait, feet raycast to the ground, body rides the feet plane, spring hit reactions, belly-up death with curled legs):
| | Telegraph (pose + magenta glow + sound) | Active | Punish window | Weak spot |
|---|---|---|---|---|
| **Skitterer** (low, wide, fast, 40hp) | crouches 0.38s + rising chirp | lunge bite | 0.75s | head (2× crit) |
| **Spitter** (tall, keeps 12u away, 70hp) | rears up 0.85s + gurgle | lobs a glob; a **magenta ring marks where it lands** and fills until impact (1.15s) | 1.1s | glowing cyan sac on the abdomen |
| **Brute beetle** (elite, 480hp) | charge: 1.25s of stomping, growl and a **magenta lane on the ground** showing the exact path. Headbutt up close: 0.75s head-down | charge at 13u/s, or headbutt | 1.4s, or **2.2s dazed if it charges into a wall** | glowing seam on the top-back of the abdomen. The domed front and head are **armour** (20% damage, dull sparks, "tink") |

Poise is live too: enough stagger in a short window staggers an enemy, and the seed-spitter up close is the fastest way.
Debug: **L** shows AI state labels, **G** is god mode, **I** shows enemy foot plants, **H** shows hitboxes and armour.

**Fixes from your playtest:**
- **The beetle's eyes floated in front of its head.** The geometry helper `place()` mutated its input, so the second eye (built from a clone of the moved first eye) was translated twice. It's fixed at the source, with a regression test. The same bug had displaced the second mandible.
- Also caught in testing: the killing blow could let you instantly re-collect the pollen you dropped. A drop now only becomes collectible once you've been away from it.

**Unsure about (needs your hands):**
- **Difficulty.** Four skitterers rushing together might be overwhelming at 25 damage per bite, or trivial with the seed-spitter. Tune `enemies.skitterer.damage`, `windup` and `speed`.
- **Spitter lead.** Globs aim at where you're heading (half lead). Strafing in a straight line gets you hit; changing direction or rolling dodges.
- **The brute's charge** tracks you for the first 70% of the wind-up, then locks. Is the lane readable soon enough at 1.25s? Baiting it into the bottle-cap wall should give a long punish.
- **Perception.** Enemies need line of sight (from just above their body to your chest or head) or have to be within hearing range. Low cover like the matchstick ramp can hide you.
- All of this was verified headless at about 20fps (bites land, heals heal, i-frames dodge, death drops pollen and rise restores). Whether the fights *feel* fair can only be judged by playing.

## M3: Seed-spitter, staple driver, weapon swap
**Run:** the target range (`?mode=range`). Press **1 / 2 / 3** or scroll the **mouse wheel** to swap.
The swap is committed (about 0.36s to lower and raise, with no firing in between), and swapping away loses a reload in progress.

**The three verbs** (each should feel different within three shots):
| | Rubber-band repeater (1) | Seed-spitter (2) | Staple driver (3) |
|---|---|---|---|
| Fire | full-auto hitscan, 660 rpm | 9 seeds in a fixed sunflower cone, pump between shots (72 rpm) | one visible staple (95 u/s, slight drop), cock the stapler arm between shots (46 rpm) |
| Damage | 9, 2× crit | 7 per seed, falls to 15% by 14u | 55, **2.6× crit (143)**, pierces one target |
| Recoil | small climb you pull down | big kick that springs back, shoves *you* back | sharp kick, very accurate in ADS (0.04°), wild from the hip (2.6°) |
| Reload | spool swap, 1.9s | **one seed at a time** (0.48s each); firing interrupts it instantly | arm hinges open and a new staple strip goes in, 3.1s |
| Stagger | low | high up close, scaled by falloff | high |

**Try:**
- Seed-spitter at the 5u dummy versus the 20u dummy. The damage readout and the dummy's lurch should make the range falloff obvious.
  Poise-breaking shots show up as **staggers** in the readout: the dummy lurches hard and stays loose for 0.9s.
- Fire two spitter shots, press R, then click mid-reload. It fires right away with whatever is loaded.
- Staple driver: line up the 5u dummy in front of the sliding one, ADS and fire. The staple pierces the first target and hits the second.
  Misses stick in the ground for a moment.
- Slow-mo (**T**) on each weapon to watch the pump slide, the husk eject, the stapler arm snap down and get re-cocked, and the staple in flight.

**Fixes from your M2 playtest:**
- **Beetle vanishing when walk speed hit 0.** Fixed (NaN guard), with regression tests.
- **Holding fire through a reload dumped most of the next mag.** Fixed. The fire-rate accumulator now only carries shots owed within the current frame and resets whenever the gun can't fire (reload, roll, swap). It's covered by a unit test.
- New: semi-auto clicks are **buffered for 0.15s** (`feel.fireBuffer`), so clicking just before the pump or stapler finishes still fires.
- `biped.armSwingIdle` (which you tuned) previously did nothing. It's now a real idle breathing sway on the held weapon. The unused `feel.recoilRecoverDelay` knob has been removed.

**Unsure about:**
- **The spitter's self-knockback** (`selfKnockback` 3.2) shoves you back about half a unit. It might be fun or might be annoying.
- **Staple flight speed** (95 u/s, so ~0.2s to the 20u dummy) asks you to lead the sliding dummy a little. Is that the right amount of skill for a 143-damage crit?
- **Swap time** (`swap.lowerTime` / `raiseTime`). Long enough to be a commitment, but it might feel sluggish mid-fight.
- All three weapons share the same reload foley clicks; only the shots and cycle sounds are distinct. Tell me if a reload sound gives the wrong weapon away.

## M2: Gun-feel (rubber-band repeater, fully juiced) ✅ signed off (your tuning is now the default)
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

# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.
v1 entries (M0–M6, tuning passes, render passes) are in `archive/v1/PLAYTEST.md`.

## V2-6: Justice and the dimension loop
**Run:** play through levels 1–3 (each court card opens the way on), or jump straight in with `?mode=level&level=4`.

**Try:**
1. **The approach:** the long walled pass under three arches, the scales filling the sky, then the arena. Does the
   reveal land?
2. **Phase 1:** her two-swing edict (the second swing mirrored), the cleave's ground ring, and the blade lines (find
   the gap; the follow-up gap is mirrored).
3. **Phase 2** (half health): a horn, and the two brass pans come down out of the fog. Now every cleave and verdict
   lands twice: once where she aimed and once mirrored across the arena, a beat later.
4. **Death:** your pentacles (✪) drop where you fall. Rise at the lantern; she's whole again and the pans have risen.
   Walk back for your pentacles.
5. **Victory:** the veiled gate north opens. For now it returns you to level 1; the hub comes in V2-7.

**Unsure about:**
- **Her health** (2600) is a guess: a few minutes with good play. The echoes make phase 2 much busier; they may need
  a longer delay than 0.45 s.
- **The pans** are visual plus low platforms; they don't do anything themselves yet. "What she throws onto one side
  lands on the other" is carried by the echoes. Should standing on a pan matter?
- **Pentacles** have nothing to buy until the Magician (V2-7).

## SwordRifle on her back (your request)
**Try:** with the pistol out, the SwordRifle hangs diagonally across her back. Press **2**: she reaches over her right
shoulder and draws it; **1** stows it the same way. Watch it while rolling (it tumbles with her) and when she falls.

**Unsure about:** the draw (0.36 s) and stow (0.38 s) are slower than the old dip-swap (0.36 s total) and they're
committed, so swapping mid-fight costs a little more. Tune `swap.drawTime` and `swap.stowTime`. The slot position and
angle are in `BODY.back`; it may clip the hood on some poses.

## V2-5: the court cards
**Run:** play to the end of a level (the throne room), or `?mode=level&level=1` (Knight), `2` (Queen), `3` (King).
The court card rises when you walk in; the way on stays sealed until it falls.

**Try:**
1. **Knight of Swords:** read the lane on the ground and roll out of it before the charge; punish the recovery. Up
   close it cuts twice (mirrored) and falls back. Under half health it charges back the way it came.
2. **Queen of Swords:** seven lanes appear with one gap; stand in it. The second volley leaves the mirrored gap. Does
   it read as "learn one, know the other"? Under half health there are nine lanes and three volleys.
3. **King of Swords:** don't stand still: verdicts strike where you were. In his second phase he marks three
   (where you are, where you're heading, and the mirror of that). At 66% and 33% he calls two Bailiffs.

**Unsure about:**
- **Health pools** (950 / 820 / 1400) are guesses; with the pistol and the SwordRifle that's roughly 1–2 minutes each
  if you play clean. Tune in `foes.knight/queen/king`.
- **Volley readability:** lanes are thin magenta strips on pale paving. They read in headless screenshots; check them
  at speed and in pixel mode.
- **The King's squad** makes his fight much harder; two Bailiffs per phase may be one too many.

## V2-4: Justice's enemies
**Run:** **Play: Justice, level 1**. Level 1 has Bailiffs and one Blindfold; levels 2 and 3 add the Gavel and the
Page. (`?mode=level&level=3` has all four.) **L** shows each enemy's state.

**Try:**
1. **Bailiff:** shoot it from the front and the shield sparks. Flank it, or bait the thrust (a rising steel scrape),
   roll through, and punish the recovery. The sword's blade rebounds off the shield too.
2. **Gavel:** watch the magenta ring fill under its hammer during the wind-up (a deep growl and a chain), then get
   out. It's open for a long time after. The cyan seam on its back crits.
3. **Blindfold:** walk up to it. It shouldn't notice. Fire a shot and it comes for the noise, not for you. Its slash
   comes twice, from alternate sides (the mirrored combo). Rolling and sprinting make noise too.
4. **Page of Swords:** it whistles when it sees you and the room comes. It keeps its distance and throws blades you
   can see coming. Killing it is permanent; resting brings everything else back.
5. **Ambushes** (level 3): enemies crouched behind cover give a ringing tell before they rise.

**Unsure about:**
- **Every number is a first guess:** health, speeds, wind-ups, damage. I tuned so each attack telegraphs ≥ 0.3 s and
  leaves ≥ 0.5 s to punish, but difficulty can only be judged by playing. Everything is in `foes` in the tuning
  panel.
- **Pathing** is steering plus feelers inside a room (no navmesh). Enemies can snag on cover corners; a leash walks
  them home if a chase drifts more than 30–40 m.
- **The Blindfold's hearing radii** decide whether stealth is real. Walking carries 2.5 m and it feels you within
  2.4 m, so you can creep past it. Is that too easy?
- **The magenta glow** now goes full on the weapon and only a blush on the body, so the wind-up pose still reads.
  Check it reads at range in pixel mode.
- **Mirrored combos** exist only on the Blindfold so far; the court cards (V2-5) and Justice (V2-6) lean on them more.

## V2-3: generated Justice levels
**Run:** `npm run dev` → **Play: Justice, level 1** (or `?mode=level&level=1..3&seed=…`). The training courtyard is
still on the menu.

**Try:**
1. **Read the spawn view.** You look straight down the main axis: a dark arch, the courts beyond, the barred
   shortcut, and the scales standing over everything in the bright fog. Is the goal clear before you take a step?
2. **Walk toward the scales.** Fights (training dummies for now) sit in walled courts, colonnaded arenas and nests
   with a raised tier. Shields mark the guards; flank them.
3. **Rest at the mid lantern (E).** From there the path turns off the axis, loops round through two or three rooms
   and comes back to a **gate room**. Its portcullis lifts only from that side (E): the shortcut drops you back at
   the lantern. Does it feel like a souls-like loop, or like a corridor with a door?
4. **The vistas** are raised terraces (and the colonnade and wind bridge set-pieces) that frame the scales. Press
   **V** to jump between them.
5. **Each level has one set-piece:** the sword-graveyard field, the mirrored twin courts, the colonnade under the
   scales, or the wind bridge. Can you tell levels apart by them?
6. **Branches** off a fight end in a lit cache (E: +1 heal flask, a placeholder reward).
7. **The exit** is a veiled gate past the miniboss room (a guard dummy stands in for the court card). E takes you to
   level 2 (develop: denser, a nest) and level 3 (twist: back-to-back fights allowed, an ambush). After level 3 it
   wraps to level 1 until the boss arrives in V2-6.
8. **Die and rise:** you rise at the last lantern you rested at.
9. **Debug:** **M** draws the mission graph with kit labels over each room, **O** the overview, **N** rolls a new
   seed. The stats line shows the validation report (attempts, time, and why a level failed if one ever does).

**Unsure about:**
- **Platforms over a fog-filled drop.** `DESIGN.md` describes a windswept plateau. I broke it into stone platforms
  joined by causeways, so the rooms read as designed pieces and boundaries are always parapets, never invisible walls.
  That's an assumption (marked Proposed in `DESIGN.md`). Say if you'd rather have continuous ground.
- **Generic risk.** Every Justice level is the same shape: a straight axis with one loop out to one side. The
  variety comes from the set-piece, the kits, the side and the encounters. That suits Justice (formal, ordered), but
  three levels in a row may feel samey. Doglegs off the axis would be cheap to add.
- **Length.** The critical path is about 250–330 m. With dummies it's a few minutes; whether it reaches the 8–12
  minute target depends on V2-4's enemies.
- **The scales are bigger** (175 m, ≥ 360 m from the spawn) so the beam rises above the height fog. Check that they
  read as a silhouette at the spawn and loom at the vistas without stealing the play space.
- **Enemy counts** are low in level 1 (the signature court holds a single dummy by design). Judge density with
  real enemies.
- **The ambush's audible tell** and the ranged-distance rule wait for V2-4's enemies.

## V2-2 tuning pass (your JSON, baked in as defaults)
- **Swings:** snappier and harder-hitting.
  - Recovery is 0.2 s on all three swings (was 0.32–0.45), and the charged strike recovers in 0.3 s (was 0.6).
  - Damage is 45 / 50 / 60 (was 30 / 30 / 45). The forehand is active for 0.15 s and the overhead winds up for 0.25 s.
  - Lunges are 0.5 / 0.5 / 0.6 m (was 0.9 / 0.9 / 1.4).
- **Hold:** the hands are further out (reach 0.8 m, height 0.05 m), and the charged hold leans the other way (yaw 15°).
- **SwordRifle:**
  - The rifle bolt hits harder (80 damage, was 55) and is drawn bigger.
  - The switch takes 0.4 s (was 0.5) and the cell flare lasts 0.5 s.
- **Pixel outlines** are stronger (0.4) and more eager (threshold 0.15).
- **Trail colour:** you set the bolt's `tracerColor` to violet `#6104C8`. Projectile trails used a fixed pale colour,
  so that setting did nothing. Trails now take each weapon's `tracerColor`: the bolt streaks violet and the pistol
  keeps its cream.

## V2-2: the SwordRifle
**Run:** `npm run dev` → **Play: Justice courtyard**. Press **2** for the SwordRifle (**1** is the pistol).

**Try:**
1. **Rifle mode** (it starts here):
   - **Aim with RMB, then fire.** It's heavy: a visible bolt, a hard kick, and the off hand works the bolt lever after
     each shot. It's wild from the hip (2.6°) and precise aimed.
   - **Each shot spends a charge.** The violet cells along the spine and the pips under the crosshair show the six.
     There's **no reload**: an empty trigger dry-clicks and the cells flicker.
2. **F switches to the sword.** It's a committed transform: the weapon dips, the stock folds down into a pommel and the
   off hand moves. It's slower while rusted (it starts rusted).
3. **LMB swings a three-hit combo** (forehand, backhand, overhead). Press again during a swing or early in its
   recovery to chain.
   - Each swing that lands refills **one** charge: a cell flares and a chime rises.
   - Each swing lunges you about a metre.
4. **Hold RMB** to ready the **charged strike**. It takes about 0.45 s, then a hum and the blade raised overhead.
   Release to bring it down. It needs and spends **2 charges**.
5. **Guard dummies** stand just inside the gate with their shields facing you. A blow to the front clangs and the
   blade rebounds (a longer recovery). Walk round and **hit them from the side**.
6. **The loop:** close in with the blade to fuel the rifle, back off and spend it. Press F to swap mid-fight.
7. **Rust:** set `swordRifle → repairStage` from 0 (rusted) to 4 (restored) to feel damage, switch speed, tone and
   cell glow change.

**Tune it:**
- `melee`: each swing's timing, arc, damage and lunge; the combo window; the charge hold and cost; charges per hit;
  hitstop; trauma; move speed while swinging.
- `swordRifle`: switch time and repair stage.
- `weapons → swordRifle`: rifle mode.
- **Copy JSON** when it feels right.

**Your pistol tuning (pass 2) is baked in:**
- 12 damage, 650 rpm, 28-round magazine.
- It now fires **visible rounds** (75 m/s, slight drop) instead of hitscan, drawn small (`projectileScale` 0.45).

**Unsure about:**
- **Swing timing and arcs are first guesses**: windup 0.10–0.18 s, active 0.12–0.14 s, recovery 0.32–0.45 s. The
  blade's path is procedural keyframes (guard → from → to → guard), so it may look stiff. Watch it in slow-mo (T).
- **The lunge** (0.9 m light, 2.2 m charged) may feel like sliding rather than stepping.
- **Charge pacing:** 6 charges and +1 per landed swing (max 1 per swing) means six hits to refill the rifle.
  `melee.chargePerHit` / `chargeCapPerSwing` change it.
- **The controls are my choice:** F to switch, hold RMB to charge. Tell me if you'd rather have a different mapping.
- **The blade passes through walls.** It only tests targets, so you can't snag it on cover, but you also can't be
  stopped by it.
- **The blade sweep** now follows the swing's arc. At low frame rates a straight chord between frames missed targets
  near the tip.
- **New: a dodge press is buffered for 0.15 s** (`feel.rollBuffer`), so one pressed during hitstop or right at the end
  of a swing's committed part still happens. Tell me if rolls ever feel like they come out late.
- **Charge colour** `#9C7BFF`: it reads against the Justice court in the screenshots. Check it in play.

## Pixel mode gets its own settings; the painterly pass is gone
- The painterly post pass (Kuwahara smear, posterise, grain) is **removed**. Other post techniques get explored
  later (`PLAN.md → Later`).
- Pixel mode is now its own tuning group, **`pixel`**: `enabled` (P), `scale`, `outline`, **`edgeThreshold`**,
  **`edgeWidth`** (line thickness in blocks; 0.5 steps), `outlineFadeStart` and `outlineFadeEnd`. Your values carry
  over: outline 0.3, threshold 0.3, width 1, fade 30 → 140 m.
- A preset or JSON saved before this change still loads, but its old `post` and `debug.pixel*` keys are ignored.

## V2-1 tuning pass 1 (your JSON, baked in as defaults)
- **Movement:** walk 4.5 m/s (was 4.8), sprint 7.5 (was 8.8).
- **Roll:** 8.5 m/s for 0.5 s (was 12.8 for 0.4), so about 4.6 m.
- **Camera:** closer and wider. 3.5 m back, 1.5 m pivot height, 1 m shoulder, 0.3 m lift; ADS 2 m. FOV 80, ADS FOV 60.
- **Cloth:** shorter tails (0.43 m) under slightly less gravity (8.4).
- **Look:**
  - Fog power 1.4 with full height mix: the court stays clear (~17% at 40 m) and the distance walls off (~91% at
    250 m), while tall things like the scales stay readable.
  - 24 sky bands (nearly smooth), clouds 0.35, outlines fade from 30 m.
- **Pixel mode:** lighter outlines (strength 0.3, edge threshold 0.3). AI labels are off by default.
- **Painterly pass:** your `post` values are baked too (radius 0, no posterise, no grain, saturation 2). It's still
  off by default.

`STYLE.md` now states the fog targets from these settings. `tests/rescale.test.ts` no longer asserts that speed,
roll and camera are v1 conversions, since you've tuned them.

**Worth a second look:**
- **The roll's i-frames are still 0.3 s**, but it now lasts 0.5 s. That's 60% of the roll invulnerable (it was 75%), so
  the back end of a roll is now hittable. Fine if intended; `roll.iFrames` 0.375 restores the old ratio.
- **The painterly values now act as an off switch.** Kuwahara 0 and posterise 0 mean that turning `post → enabled`
  on now mostly doubles saturation. If those values were only to get the painterly look out of the way, nothing to
  do. If you'd like the old painterly defaults kept for when it's turned on, say so.
- **`post.edgeThreshold` also sets pixel-mode outline sensitivity** (it's shared). At 0.3, only strong silhouettes
  get a line.

## V2-1: Humanoid rescale and the new look
**Run:** `npm run dev`, then **Play: Justice courtyard** (or add `?mode=justice` to the URL). Pixel mode is on;
**P** toggles it.

**Try:**
1. **Stand at the spawn and look through the gate.** This is the composition test:
   - the dark gate is the foreground frame
   - the chalk court and steel colonnades are the middle
   - the great scales hang far down the axis in the pale fog

   Walk to the court's centre, and the scales should sit framed between the colonnades.
2. **Walk, sprint, roll and aim.** She is now a 1.6 m hooded figure. Every v1 feel number was *converted* (× 1.6),
   not re-tuned, so timing should feel like your v1 sign-off at a bigger size. Watch the blindfold tails when you stop
   and turn.
3. **Shoot the training dummies** with the **auto-pistol**:
   - the dummies stand at 8, 16 (sliding), 32 and 47 m from the gate; 47 m is up on the dais
   - the cyan band on each head is the weak spot
   - the pistol has 18 rounds and an infinite reserve, but still reloads, and a roll still loses the reload
4. **Walk out through a side doorway** into the sword graveyard, as far as the broken-stone ring at the plateau's
   edge, and look back at the court.
5. **Rest at the lantern** (E) beside the path. It's the Hermit's lantern, the v2 checkpoint.
6. **Tune the look** under backtick → `look`:
   - fog density, power, height falloff and height mix
   - sky bands and cloud amount
   - outline fade distances

   Under `cloth` are the tail settings. `post → enabled` turns on the painterly pass.

**Unsure about:**
- **Converted speeds might feel fast for a person.** Walk is 4.8 m/s, sprint 8.8 m/s and the roll covers ~5 m.
  That's the beetle's feel scaled up, but a human-sized body may want slower numbers. `player.walkSpeed` and
  `roll.speed` are the first knobs.
- **Camera distance** converted to 4.3 m behind and 1 m to the shoulder. It may sit too far back now that she's
  bigger on screen.
- **Pixel mode on by default.** It's the Brume look, but outlines turn the grass and the small swords near you into
  dark ticks. Compare with P off and with `post → enabled`.
- **The scales may be too faint from the spawn** (~85% fogged) and clearer from mid-court. `look.fogDensity` and
  `heightMix` move this.
- **The roll** is the rigid robe tumbling: a red cone for 0.4 s. A tuck animation might read better.
- **v1 leftovers are still on screen:** the HUD's ✿ pollen counter, and the v1 enemies and zones behind
  `?mode=garden|kitchen|arena|range`, now with a humanoid in a bug-sized world. They go in V2-3, V2-4 and V2-6.
- **The robe red is darker than planned.** `#9E3B32` failed the 2:1 contrast check against kill red, so it's
  `#923A33`.
- Headless screenshots run on SwiftShader, so frame rate is unmeasured. Draw calls in the courtyard are ~22–44.

## V2-0 follow-up: decisions recorded
Your answers are now in the docs:
- **Title:** *Eight*.
- **The four pairings, their order, and Justice as the slice.**
- **SwordRifle:** sword hits refill charges, and every level and lantern starts full. The rifle mode is built from
  the staple driver's def so it feels as heavy.
- **Progression:** each arcana boss frees one restraint, which is a new move.
- **Trial grounds:** a dev sandbox (`?mode=trials`) for the Chariot (momentum) and the Hanged Man (the world moves only
  while you stand still). It's a side track in `PLAN.md` that doesn't block the slice.

**Also decided since:**
- **No rifle reload.** The SwordRifle shows its charge as glowing cells on the weapon (plus HUD pips), in a new
  reserved violet.
- **Parry** is Justice's unbinding move.

**Unsure about:** the violet charge colour (`#9C7BFF`) is a first pick. It needs to stay readable on the weapon at
pixel scale and never be mistaken for telegraph magenta. It's well clear of magenta (74° of hue apart), but it shares
a hue family with the Tower's grey-violet fog and the Moon's indigo. It's much more saturated than either, which is
fine on paper, but check it in those dimensions' screenshots.

## V2-0: Direction and docs
Nothing new to play: the build is still the v1 prototype. Read `DESIGN.md`, `LEVELS.md` and `STYLE.md`, and accept,
change or reject each **Proposed** item.

**Decide before V2-2 (the SwordRifle):**
- **The charge loop:** sword hits refill charges and rifle shots spend them. Is that the SwordRifle you imagined?
- **The four dimensions:** Justice × Swords, the Devil × Pentacles, the Tower × Wands and the Moon × Cups, in that
  order. And is Justice the right slice?

**Decide before V2-7 (the hub):**
- Unbinding as the progression arc (`DESIGN.md → The protagonist`).
- The hub as The World, and its cast (Magician, High Priestess, the Star arriving after the Tower).

**Unsure about:**
- **The palettes** in `STYLE.md` are first guesses from screenshots of the references, not tested in-engine. V2-1's
  greybox courtyard is where they get judged.
- **Pixel mode on by default** suits Brume, but it may fight the painterly sky. Both are evaluated in V2-1.
- **The Moon's illusions** stretch pillar 2. The tells (no shadow, no footsteps) need to be readable in pixel mode
  and fog, and that can't be known until it's played.

# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.
v1 entries (M0–M6, tuning passes, render passes) are in `archive/v1/PLAYTEST.md`.

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

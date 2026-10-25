# PLAN.md: v2

v1's plan (M0–M6, all complete) is in `archive/v1/PLAN.md`. v2 milestones are numbered `V2-n`.

## The question v2's first slice answers

> **Does one tarot dimension's meaning come across through how it plays? Does the SwordRifle's two-mode loop earn
> its place next to the auto-pistol? Do generated levels feel designed?**

The slice is **one full dimension (Justice × Swords)**, made of 3 generated levels, a Knight, a Queen, a King and the
Justice boss, plus a **minimal hub** with one gate and the Magician. Everything else waits until the slice has been
played. The other three dimensions are listed at the end, without detail on purpose.

Every milestone ends with a playable build, a commit, a `PLAYTEST.md` entry and a headless-Chromium smoke test with
screenshots checked against `STYLE.md`. That doesn't change from v1.

## V2-0: Direction and docs ✅
- Archive the v1 docs in `archive/v1/`.
- Write `DESIGN.md` (structure, dimensions, court cards, hub, characters), `LEVELS.md` (level design principles and
  generation pipeline) and v2 `STYLE.md` (Brume, Grey Scout and Remnant 2 composition), and rewrite `CLAUDE.md`
  and this plan.
- **Next:** the user accepts or changes the **Proposed** items in `DESIGN.md`. At minimum, settle the
  Justice details and the SwordRifle charge loop before V2-2.

## V2-1: Humanoid rescale and new look
- **Units:**
  - 1 unit = 1 m. Rescale the player controller, camera, gravity, roll and weapon numbers in `src/tuning.ts`.
  - Keep v1 *feel* by converting values rather than re-tuning (e.g. speeds × player height ratio).
  - Unit test: the converted values preserve the time-based feel (roll duration, i-frames, step cadence).
- **Player:**
  - Re-proportion the procedural biped to a stocky, about 3-heads-tall hooded figure. Remove the antennae.
  - Add the rust-red robe and the blindfold with **cloth tails** (a verlet ribbon, pure logic in `src/anim/`, tested).
- **Look:**
  - Fog toward light, height fog, a sky gradient with posterised cloud bands.
  - Faceted, blocky prop kit (boxes, low-segment cylinders, lumps); Justice palette and accent.
  - Evaluate pixel mode on by default.
- **Test scene:** a greybox Justice courtyard with a planted-sword hero prop and a distant scales landmark, to check
  the three value planes in screenshots.
- **Weapon:** the **auto-pistol** as a def in `src/weapons/defs.ts`, built from the repeater's hitscan path, with
  infinite ammo.
- Retire the bug content from menus. It stays in git history and `archive/v1/`, but the v1 range, arena and zones
  are replaced by v2 scenes as they arrive.

## V2-2: SwordRifle (the new verb)
- **Melee system** (new code path):
  - a swing arc sweep against hurtboxes
  - a committed swing with an anticipation → active → recovery timeline from tuning
  - hit-stop, flinch and sound, reusing v1's juice
  - a combo of 2–3 swings
- **Mode switch:** rifle ⇄ sword, with a short committed transform animation (the procedural arm IK moves the grip).
- **Charges:** rifle shots cost charges, sword hits refill them, and a charged sword strike spends them. Charges
  refill at a lantern. All of it is tunable.
- **Rusted state:** lower damage, slower switch and a dull sound. Repair stages are data (four stages), so V2-7 can
  apply one.
- **Melee range:** dummies that block from the front (a Bailiff stand-in), so the flank-and-punish rhythm can be felt
  before real enemies exist.
- **Stop here for the user to playtest and send tuning JSON**, as with v1's M2. Melee feel is the biggest risk in v2.

## V2-3: Level generator v2
Implements `LEVELS.md` for one dimension:
- level script
- mission-graph grammar
- Justice room and connector kits, including the mirror axis
- landmark placement and vista nodes
- lanterns and the shortcut loop
- dressing rules
- validation with reseed

Pure logic in `src/world/gen*` with unit tests for the graph constraints, validation checks and determinism.
Debug: the graph overlay with node types, the validation report, and the vista-camera screenshots in the smoke test.
Enemy spawns can use placeholder dummies until V2-4.

## V2-4: Justice enemies
- **Humanoid enemy rig:** reuse the procedural biped for stocky humanoids. Keep the multi-leg rig for beasts later
  (the Moon's dog, wolf and crayfish).
- **Archetypes:**
  - *Bailiff* (front guard, flank to hit)
  - *Gavel* (slow slam)
  - *Blindfold* (signature: hunts by sound; firing reveals you)
  - *Page of Swords* (elite scout)
- Body plans are data, AI reuses the v1 state machine, and telegraphs follow the existing magenta rules.
- Encounter templates from `LEVELS.md` drive placement.

## V2-5: Court-card minibosses (rank behaviours)
- Shared behaviour sets: **Knight** (mobility), **Queen** (control), **King** (command), each with a Swords suit kit.
- Arenas come from the generator's `miniboss` node. Each miniboss escalates the rule for its beat.
- Unit tests where the behaviour is pure (phase thresholds, attack selection with a seeded RNG).

## V2-6: Justice boss and the dimension loop
- The **Justice** boss: phase 1 is the sword with mirrored combos; phase 2 is the scales.
- The boss arena (`LEVELS.md → Boss arenas`).
- **Dimension flow:** level 1 → 2 → 3 → boss.
- **Death loop:** drop currency (v1 pollen becomes pentacles), respawn at the lantern, recover the drop.
- Elites, minibosses and shortcuts stay done.

## V2-7: Minimal hub
- The World plaza with one active gate (Justice) and three sleeping ones.
- **The Magician:** one upgrade menu with SwordRifle repair stage 1, plus 2–3 pistol and flask upgrades, paid in
  pentacles. **The High Priestess:** gate keeper, with 3–5 lines.
- Save of progress (unlocked gates, upgrades, repair stage, seed) in `localStorage`.
- The first **unbinding**, if accepted (`DESIGN.md`), granted on Justice's defeat.
- **Slice complete:** a `PLAYTEST.md` entry against the slice question above.

## Later (after the slice is played; no detail on purpose)
- **The Devil × Pentacles**, **The Tower × Wands**, **The Moon × Cups**: each needs kits, a signature enemy, a suit
  kit for the court ranks and a boss.
- The Star and the Fool in the hub, the remaining unbindings, and the Sun ending.
- A performance pass on real hardware and a deploy.

## Risks / open questions
- **Melee feel** is new and the biggest risk. That's why it gets its own milestone and a playtest stop (V2-2).
- **The rescale** touches every feel number. Convert, don't re-tune, then check against the v1 sign-off.
- **Generated levels might feel generic.** Mitigations: set-pieces, landmarks, vistas and validation. Judge by
  playing, not by screenshots alone.
- **Scope:** 4 dimensions is the cap. If the slice takes much longer than planned, cut to 3 dimensions before cutting
  depth.
- Headless Chromium runs SwiftShader, so screenshots verify the look, not the frame rate.

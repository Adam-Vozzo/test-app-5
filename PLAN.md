# PLAN.md: *Eight* (v2)

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
- **Decided since:**
  - the title *Eight*
  - the four pairings and their order, with Justice as the slice
  - the SwordRifle charge loop: start full, with a heavy rifle like the staple driver
  - unbinding as the progression
  - a trial-grounds sandbox for other arcana concepts

  - no rifle reload, with a visible charge indicator on the weapon
  - a parry as Justice's unbinding move

## V2-1: Humanoid rescale and new look ✅ (awaiting the user's notes)
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
- **Rename to *Eight*:** page title, start menu and `package.json` name.
- Retire the bug content from menus. It stays in git history and `archive/v1/`, but the v1 range, arena and zones
  are replaced by v2 scenes as they arrive.
- **Done as:**
  - every v1 feel number converted × 1.6, with `tests/rescale.test.ts` holding time-based feel equal
  - `BODY` proportions; a hooded humanoid rig with verlet blindfold tails
  - a fog-chunk override (soft exponent + height falloff) and a posterised sky dome
  - outlines that fade with distance; a faceted prop kit
  - the Justice courtyard, which doubles as the pistol range
  - the auto-pistol; pixel mode on by default
  - the v1 bug weapons and the `--range` smoke scenario retired; v1 scenes kept behind `?mode=` for now

## V2-2: SwordRifle (the new verb) ✅ (waiting on your playtest and tuning JSON)
- **Melee system** (new code path):
  - a swing arc sweep against hurtboxes
  - a committed swing with an anticipation → active → recovery timeline from tuning
  - hit-stop, flinch and sound, reusing v1's juice
  - a combo of 2–3 swings
- **Mode switch:** rifle ⇄ sword, with a short committed transform animation (the procedural arm IK moves the grip).
- **Charges:**
  - Rifle shots cost charges, sword hits refill them, and a charged sword strike spends them.
  - Every level start and lantern rest begins **full**.
  - All of it is tunable.
- **Rifle mode is heavy:** built from v1's staple-driver def (visible projectile with drop, 0.8 s bolt cycle,
  pierce 1, 2.6× crit, big stagger, hard kick). No reload: charges are the magazine.
- **Charge indicator:**
  - glowing cells on the weapon (one per charge), with a refill flare and chime, and a dry click when empty
  - a mirrored HUD pip row
  - the reserved charge colour, added to `src/render/palette.ts` and covered by `tests/palette.test.ts`
    (contrast against every area palette and against telegraph magenta)
  - readable at pixel scale 2–3 in the smoke screenshots
- **Rusted state:** lower damage, slower switch and a dull sound. Repair stages are data (four stages), so V2-7 can
  apply one.
- **Melee range:** dummies that block from the front (a Bailiff stand-in), so the flank-and-punish rhythm can be felt
  before real enemies exist.
- **Stop here for the user to playtest and send tuning JSON**, as with v1's M2. Melee feel is the biggest risk in v2.
- **Done as:**
  - pure swing logic in `src/weapons/swing.ts`, unit-tested: timeline, combo window, charged hold, roll-cancel rules,
    blade pose, charge economy, guard cone
  - the `SwordRifle` controller in `src/weapons/swordrifle.ts`
  - a blade hit sweep that follows the swing's arc (so it holds up at low frame rates)
  - the folding-stock model with instanced charge cells
  - HUD pips, guard dummies, the charge colour
  - a 0.15 s roll-press buffer (`feel.rollBuffer`) so a dodge pressed during hitstop isn't lost
  - the `--sword` smoke scenario
  - *later (your request):* the SwordRifle rides on her back while the pistol is out, and swaps draw it over the
    shoulder and stow it back (slot in `BODY.back`, timings in `tuning.swap`)

## V2-3: Level generator v2 ✅ (waiting on your playtest)
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
- **Done as:**
  - the dimension script, room kits and connector rules as data in `src/world/dimensions.ts`
  - pure generation in `src/world/gen-graph.ts` (script, mission graph), `gen-space.ts` (rooms on a right-angled grid,
    the loop, the shortcut, branches), `gen-dress.ts` (kit structure, encounter sockets, dressing, vista poses) and
    `gen-validate.ts` (graph, space, sockets, landmark sight lines, budget), run by `gen-level.ts` with reseeding
  - `tests/gen-level.test.ts`: 150 seeds across the three levels; graph constraints, layout, sockets, sight lines,
    determinism, and that each check catches a broken level
  - the builder `src/world/level.ts`: stone platforms over a fog-filled drop, causeways and stairs, arches, the
    one-sided portcullis, lanterns, caches, the veiled exit, hero swords, the scales
  - in the game: **Play: Justice, level 1** (or `?mode=level&level=1..3`), rest at any lantern and rise at the last
    one, E to use doors and the exit, the exit leads to the next level (it wraps to level 1 until V2-6's boss)
  - debug: M draws the mission graph and kit labels, O the overview, V jumps between vistas, N rolls a new seed, and
    the stats line shows the validation report
  - the `--level` smoke scenario
  - placeholders: enemies are training dummies (shields for guards), the miniboss is a guard dummy, and a cache gives
    back one heal flask

## V2-4: Justice enemies ✅ (waiting on your playtest)
- **Humanoid enemy rig:** reuse the procedural biped for stocky humanoids. Keep the multi-leg rig for beasts later
  (the Moon's dog, wolf and crayfish).
- **Archetypes:**
  - *Bailiff* (front guard, flank to hit)
  - *Gavel* (slow slam)
  - *Blindfold* (signature: hunts by sound; firing reveals you)
  - *Page of Swords* (elite scout)
- Body plans are data, AI reuses the v1 state machine, and telegraphs follow the existing magenta rules.
- Encounter templates from `LEVELS.md` drive placement.
- **Done as:**
  - a light humanoid rig for enemies (`src/enemies/humanoid.ts`: the player's planted-step gait and IK, no cloth)
    driven by data poses
  - the four archetypes as data in `src/enemies/foes.ts` (looks, gear, hitboxes, senses, attack poses), with feel
    numbers in `tuning.foes`
  - pure AI decisions in `src/enemies/foe-ai.ts` (attack timelines with mirrored combos, choice by range and weight,
    arcs, guard cone, hearing, the fair-range rule), tested in `tests/foe-ai.test.ts`
  - the `Foe` state machine (`src/enemies/foe.ts`): stand, patrol or ambush (with an audible tell), alert, approach
    or hold range, attack, search, return on a leash, stagger, die
  - the player makes noise (gunfire, blades, sprinting, rolling) that enemies hear; the Page's whistle wakes the room
  - hazards: the slam ring and thrown blades; seven new wind-up and impact sounds
  - generated levels fill encounter sockets from each beat's roster (data in `dimensions.ts`), and validation enforces
    the ranged-distance rule
  - the `--foes` smoke scenario: the shield blocks from the front but not in recovery, the slam hurts in its ring,
    the Blindfold ignores walking and comes for gunfire, the Page throws, kills pay
  - the miniboss socket stays a guard dummy until V2-5

## V2-5: Court-card minibosses (rank behaviours) ✅ (waiting on your playtest)
- Shared behaviour sets: **Knight** (mobility), **Queen** (control), **King** (command), each with a Swords suit kit.
- Arenas come from the generator's `miniboss` node. Each miniboss escalates the rule for its beat.
- Unit tests where the behaviour is pure (phase thresholds, attack selection with a seeded RNG).
- **Done as:**
  - `src/enemies/court.ts`: the three Swords court cards as data (looks with a pale sword crest, poses) and
    `CourtCard`, a `Foe` with the rank verbs: the Knight's lane charge and hit-and-run, the Queen's blade volleys with
    a mirrored gap, the King's verdict zones and squad
  - phases at health thresholds (`phaseOf`), phase-gated attacks (`minPhase`), volley lanes (`volleyOffsets`), all
    pure and tested; feel numbers in `tuning.foes.knight/queen/king`
  - hazards: multi-lane telegraphs and delayed verdict strikes; summoned squads dismissed on rest
  - the generator's miniboss socket now seats the level's court card in the throne room (`idle: 'throne'`, waking
    when you walk in); the exit stays sealed until it falls
  - the `--court` smoke scenario, and the level walkthrough checks the sealed exit

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
- The first **unbinding**, granted on Justice's defeat: the **parry**. It's a new verb, so it gets its own timing
  window, telegraph-matched feedback and a tuning folder. Melee from V2-2 is the base.
- **Slice complete:** a `PLAYTEST.md` entry against the slice question above.

## Side track T: trial grounds (doesn't block the slice)
A dev sandbox (`?mode=trials`, reached from the start menu) for arcana concepts that aren't among the four dimensions.
Each trial is one generated room plus one rule (`DESIGN.md → Trial grounds`).
- **Can start once V2-3 kits and V2-4 enemies exist.**
- **First trials:**
  - The Chariot (*momentum*: decaying kill buffs)
  - The Hanged Man (*hesitation is punished*: the world moves only while you stand still, plus a gravity-flip
    variant)
- Each trial ends with a `PLAYTEST.md` entry: is the rule fun, and should it challenge a current dimension?

## Later (after the slice is played; no detail on purpose)
- **Post-processing:** explore new techniques for the look (the v1 painterly pass was removed after V2-1; pixel
  mode stays).
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

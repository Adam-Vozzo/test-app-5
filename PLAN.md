# PLAN.md: *Eight* (v2)

v1's plan (M0–M6, all complete) is in `archive/v1/PLAN.md`. v2 milestones are numbered `V2-n`.

## The question v2's first slice answers

> **Does one tarot dimension's meaning come across through how it plays? Does the SwordRifle's two-mode loop earn
> its place next to the auto-pistol? Do generated levels feel designed?**

The slice is **one full dimension (Justice × Swords)**, made of 3 generated levels, a Knight, a Queen, a King and the
Justice boss, plus a **minimal hub** with one gate and the Magician. The other three dimensions are planned at the end
(V2-8 onward).

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

## V2-6: Justice boss and the dimension loop ✅ (waiting on your playtest)
- The **Justice** boss: phase 1 is the sword with mirrored combos; phase 2 is the scales.
- The boss arena (`LEVELS.md → Boss arenas`).
- **Dimension flow:** level 1 → 2 → 3 → boss.
- **Death loop:** drop currency (v1 pollen becomes pentacles), respawn at the lantern, recover the drop.
- Elites, minibosses and shortcuts stay done.
- **Done as:**
  - `src/enemies/justice.ts`: Justice as data (looks, poses) and `JusticeBoss` (a `CourtCard` with echoes across her
    arena's axis in phase 2; `mirrorAcross` is pure and tested)
  - `src/world/boss.ts`: the arena by rules (lantern, walled approach under arches, octagon under the scales, the pans
    that come down in phase 2, the veiled way on)
  - the flow: level 1 → 2 → 3 → the arena (`?mode=level&level=4` jumps there); walking on after her completes the
    dimension (it returns to level 1 until the hub exists)
  - pentacles replace pollen in v2 scenes (kills, caches; carried between levels); the v1 drop-and-recover death loop
  - the `--boss` smoke scenario: she wakes, holds the bar, the death drop is recovered, the pans come down, strikes
    echo, and the way on completes the dimension

## V2-7: Minimal hub ✅ (slice complete; waiting on your playtest)
- The World plaza with one active gate (Justice) and three sleeping ones.
- **The Magician:** one upgrade menu with SwordRifle repair stage 1, plus 2–3 pistol and flask upgrades, paid in
  pentacles. **The High Priestess:** gate keeper, with 3–5 lines.
- Save of progress (unlocked gates, upgrades, repair stage, seed) in `localStorage`.
- The first **unbinding**, granted on Justice's defeat: the **parry**. It's a new verb, so it gets its own timing
  window, telegraph-matched feedback and a tuning folder. Melee from V2-2 is the base.
- **Slice complete:** a `PLAYTEST.md` entry against the slice question above.
- **Done as:**
  - `src/world/hub.ts`: The World plaza (wreath, four gates and creatures, the Magician's table, the Priestess's
    pillars, the lantern); content in `src/world/hub-data.ts` (dimension order, shop items, lines)
  - `src/core/save.ts`: pure save logic (parse and validate, buy, effects, clear a dimension, gates, lines) plus the
    two `localStorage` helpers; tested in `tests/save.test.ts`
  - `src/ui/shop.ts`: the Magician's one menu
  - `src/weapons/parry.ts`: the parry's timing (tested); the game turns parryable blows (enemy melee and thrown
    blades now carry their source) and staggers the attacker
  - the flow: menu → hub → the angel's gate → levels 1–3 → Justice → home, with the parry freed and the bull awake;
    the King of Swords gives up the relic of Swords
  - the `--hub` smoke scenario (new game, Priestess, shop, gate, clearing Justice, a parry against a Bailiff, the save
    surviving a reload)

## Side track T: trial grounds (doesn't block the slice)
A dev sandbox (`?mode=trials`, reached from the start menu) for arcana concepts that aren't among the four dimensions.
Each trial is one generated room plus one rule (`DESIGN.md → Trial grounds`).
- **Can start once V2-3 kits and V2-4 enemies exist.**
- **First trials:**
  - The Chariot (*momentum*: decaying kill buffs)
  - The Hanged Man (*hesitation is punished*: the world moves only while you stand still, plus a gravity-flip
    variant)
- Each trial ends with a `PLAYTEST.md` entry: is the rule fun, and should it challenge a current dimension?

## Dimensions 2–4 (planned at the user's request, before the slice has been played)
The slice is done, so the other three dimensions are planned here. Each one follows the Justice pattern: **space →
rule and enemies → court suit kit and boss**, two or three milestones each. Each milestone still ends with a playable
build, a commit, a `PLAYTEST.md` entry and a smoke scenario. Per `CLAUDE.md` → Content is data, a new dimension should
be mostly new data. Where it needs new code, that code is the dimension's **rule**, and each rule is one new verb.

**Decisions needed from the user** (each is Proposed in `DESIGN.md`; marked ⚑ where a milestone depends on it):
- ⚑ The Devil's, the Tower's and the Moon's **unbinding moves** (candidates: a chain-break dash, a safe fall, and the
  blindfold as the ending).
- ⚑ The Devil's **pact** (double damage dealt and taken): keep it, and is it once per fight or a standing choice?
- ⚑ **Accent colours** per dimension (proposed below; each is checked by `tests/palette.test.ts`).
- The second and third repair stages' relics and prices, and when the Star arrives in the hub.

### V2-8: The Devil's descent (space and flow) ✅ (waiting on your playtest)
- **Make the pipeline multi-dimension.** `DimensionDef` gains:
  - `descent`: metres the critical path drops per room. The loop stays level, so its shortcut stays flat.
  - per-dimension landmark sight targets
  - which props the dimension strews (strewn and hero props)

  The level builder takes its palette and landmark from the dimension. The game tracks which dimension it's in, and
  the save keeps progress per road.
- **The Devil × Pentacles space** (`LEVELS.md → The Devil`):
  - descending vaults and mine galleries, each room lower than the last
  - set-pieces: the gold vault, the chain shaft, the gilded market, the collapsing mine
  - **the landmark:** the Devil's throne-pedestal rising out of the pit, its brazier glowing ahead and below
  - **palette:** umber stone, sooty fog toward a smoky amber light, and old gilt as the accent (dark enough never to
    read as crit gold)
- **The bull's gate** opens once Justice is cleared and leads into the Devil's levels.
- **Placeholders:** until V2-9 the Devil's rooms are held by Justice's archetypes and Swords court cards, and level 3's
  exit leads home, since the Devil's arena comes in V2-10. (V2-9 replaced the archetypes; V2-10 the court cards
  and the arena.)
- Tests cover the descent (every room drops, the loop stays level, connectors stay within slope) and run the same 150
  seeds as Justice. Smoke: `--devil`.
- **Done so far:**
  - `DimensionDef` gained `descent`, landmark `kind` and sight `targets`, and strewn and hero prop kinds
    (`src/world/dimensions.ts`). `RoomKitId` is now any kit name a dimension defines.
  - `DEVIL_DIMENSION`: shared rooms restyled, plus four set-piece kits.
  - `embed` (`gen-space.ts`) drops each critical room outside the loop by `descent`.
  - Validation reads each dimension's own landmark targets.
  - The builder (`level.ts`) takes its palette from `AREAS`. New kit pieces: the throne-pedestal with its unlit
    brazier flame, coin hoards and the great pillars of the pit (`kit.ts`).
  - `DEVIL` palette. The palette test now also checks accents against kill red.
  - The game tracks `dimension`. Through the bull's gate are three Devil levels, then home (no arena yet), with
    progress saved per road; `?mode=level&dim=devil` jumps in.
  - Tests: 150 Devil seeds valid; every step drops, the loop and branches stay level, Justice stays level, and the
    brazier is visible from the spawn and the vistas.
  - Smoke: the `--devil` scenario.

### V2-9: The Devil's rule and enemies (*temptation*) ✅ (waiting on your playtest)
- **The rule:**
  - **Tempting hoards:** pentacles lie in plain sight on pedestals and spill. Taking one costs something, decided by
    data per hoard: it rings a bell that alerts the room, it **weighs you down** (slower rolls until you rest or spend),
    or it springs an ambush.
  - **Binding attacks:** chains that look fatal (a growing magenta coil) but are always broken by one roll.
- **Enemies.** Archetype verbs are shared and re-skinned as data (`foes.ts`); the Thralls are new code, and they are
  the rule:
  - *Miser* (the guard verb, shield → coin chest)
  - *Imp* (a fast melee harasser; a new light verb)
  - *Thralls* (signature: a chained pair; the chain between them is a sweeping hazard; shoot the chain and both are
    freed, one flees and one fights)
  - *Page of Pentacles* (elite: carries a purse and runs, so it's a chase)
- **Risk branches:** Devil branches hold bigger hoards with harsher costs (`LEVELS.md → Risk branches`).
- **Done as:**
  - `src/enemies/devil.ts`:
    - the Miser, Imp and Page of Pentacles as data plans (looks, poses, hitboxes) on the one `Foe` state machine,
      with two new data flags: `hitAndRun` (fall back for `retreatTime` after each attack) and `flees` (keep
      `holdRange` away, circling inside the leash, and cut only when cornered)
    - the `Thrall` pair and its `ThrallChain` (one instanced draw, shootable along its length, glowing magenta
      through the binding's wind-up)
    - a 'thrall' socket spawns a pair
  - The binding, `src/player/binding.ts` (pure, tested):
    - The game roots her while bound, lets any roll through (stamina or not) and draws the tightening coil.
    - `EnemyWorld.bindPlayer` is the hook.
  - Pure helpers in `foe-ai.ts`, tested: `segmentDistance`, `flankPoints`, `fleeHeading`.
  - Hoards:
    - placed by the dressing layer from `DimensionDef.temptation` (count, costs per level, branch cost) and checked by
      `checkHoards`
    - built with their tells (`hoardTellGeo` in `kit.ts`)
    - paid and costed by the game (`takeHoard`); the weight is a `rollMul` on the controller
    - feel numbers in `tuning.foes.hoard`
  - Devil rosters use only the Devil's own; `rangedFoes` is empty (no thrower).
  - Sounds: chain rattle, snap and break; the bound cinch; imp chitter; coin jingle; the hoard bell.
  - Tests: `tests/devil.test.ts`; Devil palette checks.
  - Smoke: `devilFoesScenario`, run under `--devil`:
    - the binding strikes when it runs out and breaks to a roll at 0 stamina
    - a real pair binds her
    - shooting the chain splits them into fight and flee
    - the Imp falls back, the Page runs and the Miser blocks from the front
    - each hoard costs what its tell says

### V2-10: Pentacles court cards and the Devil ✅ (waiting on your playtest)
- **Suit kit over the rank verbs** (`court.ts`, data):
  - **Knight of Pentacles:** a slow, unstoppable armoured advance. It's the charge verb, slowed and made unstoppable.
  - **Queen of Pentacles:** nurtures her side. Volleys become healing seeds you shoot down.
  - **King of Pentacles:** buys mercenaries and throws coins. Verdicts become coin rain.
- **The Devil** (boss) on his pedestal arena:
  - chains, and a mid-fight ⚑ **pact** offer
  - his unbinding: ⚑ the chain-break dash
  - the arena by rules: a pit ringed by chained pillars
- **Hub:** the bull wakes, the lion's gate opens, the relic of Pentacles unlocks repair stage 2, and new Priestess and
  Magician lines.
- **Done as:**
  - `src/enemies/court-pentacles.ts`: the three Pentacles cards as data on `CourtCard`.
    - New plan fields: `rank` (which rank verbs) and `squadId` (the King hires Misers).
    - New attack data: `binds` (a charge that pins), kind `sow` (seeds that sprout `spawn` unless trampled),
      `coins` (a verdict that leaves coin).
  - Hazard zones gained kinds: `strike`, `shackle` (binds) and `seed` (gilt, trampled, sprouts), plus a resolve
    callback.
  - `src/enemies/devil-boss.ts`: the Devil (`DevilBoss extends CourtCard`).
    - Claws, the brand, shackles and coin rain.
    - At half health he holds out the pact (`EnemyWorld.offerPact` / `pact`): E accepts, letting it pass refuses.
      Accepted doubles the damage he takes and she takes, for that fight.
  - `boss.ts` builds his arena (`kind: 'devil'`).
  - `src/world/coins.ts`: coin on the floor. A pile pays and weighs, and it's never taken by standing still.
  - The dash (X, `tuning.dash`):
    - a `dashing` variant of the controller's roll with its own numbers
    - breaks bindings
    - a swept check (`sweepCrosses`) breaks any Thrall chain it crosses
  - Hub and save:
    - `UNBINDINGS.devil = 'dash'` and `UNBINDING_LINES`; the generic `completeDimension`
    - the lion wakes
    - repair stage 2 (needs the relic of Pentacles); the Priestess's `devil` lines
  - Fixed: the rifle slung on her back was left behind in the world whenever a level was rebuilt.
  - Tests: `tests/devil-court.test.ts`, plus `sweepCrosses` in `tests/devil.test.ts`.
  - Smoke: `devilCourtScenario` under `--devil`:
    - the Knight pins and won't stagger
    - a trampled seed is crushed and an untrampled one sprouts
    - the King's coin stays until she steps clear, weighs when taken, and he hires Misers
    - the Devil shackles, offers the pact (and can't be hurt meanwhile), and accepting doubles damage both ways
    - his fall frees the dash and wakes the lion
    - the dash breaks a chain
  - The V2-9 scenarios now fight in the Devil's open arena (the courtyard's training-dummy colliders got in the way).

### V2-11: The Tower's climb (space and the collapse rule) ✅ (waiting on your playtest)
- **The generator stacks floors** and turns the heading around the tower (`LEVELS.md → The Tower`).
- **The collapse rule:**
  - floors crumble on a telegraphed timer (cracks glow magenta, then drop)
  - lightning strikes marked ground
  - fire spreads along wooden structure

  Physics colliders are removed and restored on rest, like the shortcut door.
- **Palette:** soot and charred timber, an ember fog, and storm violet held clear of the charge colour (tested).
- **Done as:**
  - `TOWER_DIMENSION`: negative `descent` (a climb), scaffold kits, four set-pieces, `CollapseDef` (deck size, rot
    by level), and a `seat` (where the arcana waits) on every dimension.
  - Pure rules in `src/world/scaffold.ts`, tested:
    - `ScaffoldGrid`: step, crack, ignite, spread, fall, reset
    - `connected`: the door check
  - The dressing layer lays decks and rot (`Scaffold`, `deckCell`, `doorCells`); `checkScaffolds` validates them.
  - Builder:
    - `src/world/decks.ts`: an instanced draw per room and a collider per deck; state colours as in `STYLE.md`
    - beam-and-stilt frames under scaffold rooms
    - rubble cover
    - the Tower landmark (`towerGeo`) with an unfogged storm glow
  - `Game.collapse` each frame:
    - steps crack rotten decks; fire ticks; lightning marks and strikes, then ignites
    - falls cost health and return her to the last stone (`lastSafe`); a rest resets the decks
    - feel numbers in `tuning.tower`
  - Sounds: creak, timber fall, fire catching, thunder.
  - `TOWER` palette (tested); the lion's gate.
  - Tests: `tests/tower.test.ts`.
  - Smoke: `--tower`:
    - through the lion's gate
    - a rotten deck cracks and drops her, and the fall costs health and returns her to stone
    - lightning marks, strikes and sets decks alight
    - a rest restores the decks
    - three levels, then home

### V2-12: Wands enemies, court cards and the Crowned Tower ✅ (waiting on your playtest)
- **Enemies:**
  - *Firebrand* (ignites ground)
  - *Fallers* (signature: drop from above, shown by a growing magenta shadow)
  - *Builder* (raises barricades)
  - *Page of Wands* (signal fires call reinforcements)
- **Court:** the Knight's fire trail, the Queen's black cat and fire zones, and the King burning the floor away.
- **Boss:** the Crowned Tower. Each phase removes ground, ending on one platform under open sky.
- **Unbinding:** ⚑ a safe fall or plunge.
- **Hub:** the Star arrives (heal-flask upgrades).
- **Done as:**
  - `src/enemies/tower-foes.ts`:
    - the four commons and the cat as data
    - `TowerFoe`: the Builder's barricade (kind `barricade`; a runtime collider and mesh with a lifetime) and the
      Page of Wands' signal (kind `signal`: a channel started on waking, stopped by a stagger, summons on success)
    - `Faller`: perched, a falling shadow, a landing
  - Shared attack data: `ignite` (ground strikes, lobs, verdicts and a charge's trail set timber alight through
    `EnemyWorld.ignite`) and `lob` (a lobbed pot with a filling ring).
  - The Page of Swords' whistle is now its own flag (`herald`), not "any ranged enemy".
  - `src/enemies/court-wands.ts`:
    - the Wands court as data on `CourtCard`
    - new plan fields: `squadId` for any rank (the Queen's cat) and `phaseBurn` (the King's burning floor)
    - `CrownedTower`, whose phases call the arena
  - `boss.ts` kind `tower`:
    - a deck grid with `holes` (`ScaffoldGrid` and `Decks` support holes)
    - `crackWhere` drops a ring with warning; `nearestStanding` is used for falls in the arena
    - the floor holds again when the boss falls
  - The safe fall: `UNBINDINGS.tower = 'fall'`; `tuning.tower.landingRadius`.
  - The Star:
    - in the hub once the Tower is cleared; `STAR_SHOP` in the same overlay (now titled per keeper)
    - `healMul` in the save effects and vitals
  - The Priestess's `tower` lines; the eagle wakes.
  - Tests: `tests/tower-court.test.ts`.
  - Smoke: `towerFoesScenario` under `--tower`:
    - the pot lights decks; the Faller hides, drops and lands; the Builder walls
    - the Page's signal calls Firebrands, and a stagger stops it
    - the Knight's trail burns; the Queen's cat; the King's Firebrands and burning floor
    - the Crowned Tower's two rings and the last platform; the floor holds when it falls
    - home: the safe fall freed, the Star present, the eagle awake; the Star's menu sells a flask
    - a fall costs nothing once unbound

### V2-13: The Moon's marsh (space and the illusion rule)
- **The generator meanders between pools,** with deliberate near-duplicate rooms and two towers on the path.
- **The illusion rule:** reflections cast **no shadow and make no footsteps**. Hitting one dispels it harmlessly.
  Fake paths and pickups use the same tells. The shadow tell needs a cheap per-foe blob shadow so it reads at
  pixel scale.
- **Palette:** deep teal water and a cold moonlit fog. Check it against the weak-spot cyan.

### V2-14: Cups enemies, court cards, the Shadow and the ending
- **Enemies:**
  - *Dog and Wolf* (on the multi-legged v1 rig, re-scaled)
  - *Crayfish* (signature: ripples, then an ambush from the water)
  - *Phantoms* (decoys)
  - *Page of Cups* (fish from its cup)
- **Court:** the Knight's cup (heal or poison, with a tell), the Queen's mirror copies (one casts a shadow), and the
  King's tidal waves.
- **Boss:** the Shadow, the Eight of Swords' own shadow using her moves. Its unbinding is the blindfold.
- **Ending:** the Sun, which is short and has no cutscene (the card's image and one line).

### Later
- **Post-processing:** explore new techniques for the look (the v1 painterly pass was removed after V2-1; pixel
  mode stays).
- The Fool in the hub.
- A performance pass on real hardware and a deploy.
- The trial grounds (side track T) stay open.

## Risks / open questions
- **Melee feel** is new and the biggest risk. That's why it gets its own milestone and a playtest stop (V2-2).
- **The rescale** touches every feel number. Convert, don't re-tune, then check against the v1 sign-off.
- **Generated levels might feel generic.** Mitigations: set-pieces, landmarks, vistas and validation. Judge by
  playing, not by screenshots alone.
- **Scope:** 4 dimensions is the cap. If the slice takes much longer than planned, cut to 3 dimensions before cutting
  depth.
- Headless Chromium runs SwiftShader, so screenshots verify the look, not the frame rate.

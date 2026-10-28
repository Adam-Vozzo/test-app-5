# LEVELS.md: level design and procedural generation

How v2 builds its 12 levels and 4 boss arenas: the principles first, then the generation pipeline that enforces them.
Game structure is in `DESIGN.md`, and the look (fog, value planes, palettes) is in `STYLE.md`.

## What Remnant 2 does, and what we take

Remnant 2 generates from the top down. The high-level choices come first: which storyline a world runs, which
dungeons and minibosses it holds, which events appear. Then the layout is assembled from **pre-built, hand-designed
tiles**, randomised within each world. Enemy types, bosses, NPCs and events are randomised too, so two players in the
same area can meet different bosses. Reviewers found that recurring tiles were noticeable but the maps mostly felt
hand-made ([Wikipedia](https://en.wikipedia.org/wiki/Remnant_2),
[PC Gamer review](https://www.pcgamer.com/remnant-2-review/),
[GameBanshee](https://www.gamebanshee.com/9d648),
[Wccftech](https://wccftech.com/remnant-2-promises-to-take-procedural-generation-to-the-next-level/amp/)).

Its levels look beautiful because of art direction, not because of the generator. Layouts lead you to framed vistas,
huge structures disappear into fog, and light shows the way (`STYLE.md`).

**What we take:**
1. **Designed pieces, randomised arrangement.** Every piece is designed; only the arrangement is random.
2. **Big decisions first, layout last.**
3. **Vary content, not just layout.**

**What we change:** our pieces are *code*, not hand-modelled tiles (pillar 3). Each piece is a parametric kit
generator with guarantees, such as "this courtyard always has 2–3 cover clusters and an exit on the far side".

## Principles

1. **Authored rules, procedural arrangement.** Randomness picks and arranges. It never invents. Each kit (room or
   connector) is designed, has parameters, and makes guarantees the generator can rely on.
2. **Big decisions first, layout last.** Generation runs in layers: dimension script → level script → mission graph →
   space → dressing → encounters. Each layer is chosen before the one below it is built, so a level is *about*
   something before it has a shape.
3. **The space carries the meaning.** Each dimension has a spatial grammar that expresses its card:

   | Dimension | Spatial grammar |
   |---|---|
   | Justice | symmetric, formal, ordered: mirror-axis courts and straight colonnades |
   | The Devil | descending and hoarding: always going down, with tempting side vaults |
   | The Tower | vertical and decaying: stacked floors that ascend, ground that is temporary |
   | The Moon | winding and doubling: paths that look alike, loops, routes threaded between two towers |

4. **Every level has one landmark you can always see.** It's the dimension's symbol (Justice's scales, the Devil's
   pedestal, the Tower, the Moon and its two towers). It sits beyond the miniboss arena, so walking towards it is
   progress. **Show the goal early**: the spawn view frames it.
5. **Frame, then reveal.** Paths alternate between **compression** (narrow passes and arches with dark walls, the
   foreground frame) and **release** (a vista over the next space with the landmark in the bright fog). That is the
   composition in the Remnant screenshot: dark converging walls, a framed focal object, a bright opening beyond.
   Every level has at least two **vista nodes** whose camera direction is part of the layout.
6. **Light leads.** Warm light (lanterns, braziers, the accent motif) marks the critical path and the next goal.
   Optional branches are lit dimmer or differently. Never put a bright light at a dead end unless there's a reward
   there.
7. **Rhythm: push, rest, reveal.** Combat clusters are separated by traversal and vistas. A lantern comes after every
   major tension spike and always right before a miniboss. Two large fights never run back to back, except in the
   level that is the dimension's twist.
8. **Loops beat lines.** Every level has at least one **shortcut** that loops a late node back near an earlier
   lantern. It opens from the far side only (a gate, ladder or bridge to lower). This is the souls-like moment of
   seeing where you've been.
9. **Combat spaces are shaped for a shooter that dodges.** See *Combat spaces* below. Fair fights come from geometry
   as much as from AI.
10. **Every level has an identity.** A player should be able to describe a level as "the one with the bridge over
    the chasm". Each level gets one **set-piece** from a small per-dimension pool, and the same seed always gives the
    same level.
11. **Validate, don't hope.** Generated levels must pass automated checks (*Validation* below). A failure re-rolls
    with `seed + attempt`. Generator logic is pure and unit-tested.

## Dimension script: the four beats (fixed data)

A dimension's three levels and boss follow **introduce → develop → twist → master** (kishōtenketsu). Its rule
(`DESIGN.md`) escalates across them:

| Beat | Level | The rule… | Miniboss |
|---|---|---|---|
| Introduce | Level 1 | appears in safe, readable form; one new enemy at a time | Knight (mobility) |
| Develop | Level 2 | combines with other threats; denser encounters | Queen (control) |
| Twist | Level 3 | turns on the player, or the space changes (Tower: the floor goes; Moon: the path lies) | King (command) |
| Master | Boss arena | the arcana uses the rule against you; everything learned is tested | Major arcana |

This table is data (`src/world/dimensions.ts`). The generator reads the beat to pick kits, encounter
density and set-pieces. It never decides pacing on its own.

## Generation pipeline

```
seed ─▶ 1 Level script ─▶ 2 Mission graph ─▶ 3 Space ─▶ 4 Dressing ─▶ 5 Encounters ─▶ 6 Validate ─┬▶ build meshes
                                                                                                  └▶ fail: reseed
```
Each step is a pure function (no Three/DOM) in `src/world/gen*`, so it's unit-testable. Each step forks the RNG by
name (`rng.fork('graph')`, `rng.fork('dress')`…), so changing dressing never moves a wall. (v1's `src/world/gen.ts`
still generates the bug-scale zones; v2's generator is `gen-level.ts` and its layers, below.)

### 1. Level script
Chosen from the dimension script and seed:
- the beat
- the miniboss
- one **set-piece** from the dimension's pool (examples below)
- a target length of 8–12 minutes on first play
- the number of lanterns (1–2 plus the pre-miniboss one)
- which signature-enemy encounters must appear

Set-piece pools, 3–4 each (first ideas):

| Dimension | Set-pieces |
|---|---|
| Justice | the sword-graveyard field; the mirrored twin courts; the colonnade under the scales; the wind bridge |
| The Devil | the gold vault (temptation room); the chain lift down a shaft; the gilded market; the collapsing mine |
| The Tower | the scaffold climb; the burning library floor; the bell that brings lightning; the leap between towers |
| The Moon | the reflecting pool crossing; the two-tower gate; the drowned path (only shadows show the real route); the crayfish shallows |

### 2. Mission graph (topology before space)
A small graph grammar builds the sequence of *experiences* before any geometry exists. Node types:

| Node | Purpose |
|---|---|
| `start` | spawn plus the first lantern; frames the landmark |
| `combat` | an encounter space (sized by encounter template) |
| `traverse` | movement and tension without a fight: a narrow pass, a climb, a bridge |
| `vista` | release; a framed view of the landmark and the next space |
| `lantern` | checkpoint (the Hermit's lantern); rest, refill, respawn point |
| `branch` | an optional dead-end with a reward (risk branch in the Devil); 1–2 per level. *As built in V2-9:* a Devil branch holds a bigger hoard (twice the pentacles) instead of the cache, always with the ambush cost |
| `setpiece` | the level's identity node |
| `gate` | the shortcut's far side; opens back towards an earlier lantern |
| `miniboss` | the court-card arena; always preceded by a lantern |
| `exit` | towards the landmark and the next level (or back to the hub) |

The grammar starts from `start → … → lantern → miniboss → exit`, then expands the middle by rules such as these
(weighted by beat):
- `… → combat → vista → …` (release after a fight)
- `… → traverse → combat → …` (tension, then the fight)
- `combat ⇒ combat + branch` (hang an optional branch off a combat node)
- `insert gate→lantern back-edge` (exactly one shortcut loop)

Constraints: 6–10 nodes on the critical path; no two `combat` nodes adjacent unless the beat is *twist*; the
`setpiece` sits in the middle third; at least two `vista` nodes.

### Temptation (the Devil's dressing, V2-9)
The dressing layer also places **hoards** wherever a dimension has a `temptation` table (`dimensions.ts`). Each hoard
sits in a fight or a set-piece room: on the far side, off the way through, clear of the sockets and cover.
- **Counts per level:** 2 / 2–3 / 3–4.
- **Costs introduced one at a time:** level 1 only rings (bell), level 2 adds the weight, and level 3 adds the ambush.
- **Validation:** checks the count, that each hoard is inside its room, that each cost is one its level teaches, and
  that every branch has its hoard.

### Collapse (the Tower's dressing, V2-11)
Rooms whose kit is `scaffold` get a grid of timber decks (`CollapseDef.tile`, 3 m) in place of a stone floor.
- **Rotten share by level:** 10% / 16% / 24%.
- **Always sound:** the door landings, the decks under cover, and enough of a way that every door stays joined by
  sound decks (`connected`, re-rolled with less rot if not).
- **Validation:** checks that every scaffold room has its decks and that the rot doesn't cut its doors apart. The rot
  can close ways behind you as decks fall, but never the way on before you've stepped on anything.

### Illusion (the Moon's dressing, V2-13)
With an `illusion` table (`dimensions.ts`):
- **Reflections:** the encounter layer marks a share of each room's sockets as reflections (20% / 30% / 40% by
  level), never all of a room's enemies and never the court card.
- **False paths:** the dressing layer makes `falseBranches` branch connectors false paths. *After the first
  playtest* each also gets a **hidden way across**: stepping stones (`Dressing.stones`, `stonesAcross`) with
  colliders but no visible mesh, only their shadows on the water. They wind left, middle, right, middle along the
  connector, so the drawn boardwalk's middle line still has 2 m holes; the cache beyond is real. *After the second
  playtest (V2-17)* the stones also lay their shadows across the drawn boardwalk (their hidden casters stand a little
  proud of it, front faces in the shadow map), and the count is by level (`falseBranches`: 1, 1, 2). The Moon has two
  or three branches a level, and the true ones stand between towers: at a fork, the way without towers is the lie.
- **Validation:** checks that false paths are only branches (never the way on), that each has its stones within a
  careful step of each other, and that no room is all reflections.

### 3. Space (embedding the graph)
Each node becomes a **room kit** and each edge a **connector kit**. Kits are parametric generators that return
footprint, walkable area, colliders, exits, cover positions and spawn sockets:
- **Room kits:**
  - shared shapes (courtyard, clearing, hall, terrace, chamber, ledge), restyled per dimension
  - dimension-specific rooms (Justice's mirrored court, the Devil's vault, the Tower floor, the Moon's pool)
- **Connector kits:** path, stairs, bridge, tunnel, arch, ladder, lift. *As built:* a room's doorway is exactly its
  connector's width, so the connector's parapets run on flush (wider doorways left their end faces standing in the
  opening, and she caught on them). Stairs and tier ramps collide as a solid wedge down to the floor, like the
  stepped treads drawn over them (a thin tilted slab hung over a gap near its foot, and from the side her feet slid
  under it). `tests/level-walk.test.ts` walks the real player controller over every connector of real levels. **Compression** connectors (tunnels, arches,
  narrow passes) go before `vista` and `combat` nodes to build the frame-then-reveal rhythm.
- **Layout:** *as built in V2-16 (Proposed until played)*, each dimension lays its rooms out by its card
  (`DimensionDef.layout`), and **rooms stand at any heading**:
  - **Rooms** are rectangles turned to any yaw. A room is always entered by its back edge and leaves by its far edge
    or a side, so its kit, cover, tier and sockets work in its own frame as before.
  - **Connectors** run straight out of one doorway and into the next, square to both edges (their parapets still run
    on flush). Where the heading changes they turn on a **round landing**, once or twice (out, across, in). A
    landing's disc is level; the runs climb only off it. Its parapet ring is open where the runs meet it, and wide
    enough (radius `width/2 + 2.2`) that the two openings stay apart at the sharpest turn the layouts make (about 95°).
  - **Placement** steers each room toward where the dimension's rule wants it (a heading, or a point on a curve),
    checking footprints as oriented boxes (2 m apart, clear of every connector). Joins between rooms already placed
    are solved: straight if they line up, else the landing where their doors' lines cross, else two landings.
  - **The shortcut loop** (all but Justice): the mid lantern leaves sideways; the gate stands straight ahead of it,
    turned to face away from the loop side; the loop rooms step out well past the gate, and the last is laid
    backwards from the gate's back door and joined to them in the middle.
  - **Justice weighs:** a straight axis (start … the mid lantern; the gate … the exit), with **two mirrored wings**
    off the mid lantern's sides, each bending forward at each room (`wingBend`) to a **key room**. The right wing is
    the left reflected about the axis. The axis between the lantern and the gate is barred until both keys are set
    (`Dressing.door.opens = 'keys'`); each key room's pan rides back to the mid lantern (`Dressing.keys`).
  - **The Devil descends:** a spiral down the walls of a pit, its radius tightening (120 m to 70 m) round a centre
    fitted to the rooms afterwards, each room on the way 4 m below the last. The pedestal stands at the centre, and
    each room's side facing it is open (`Room.open`: a parapet, whatever the kit's edge).
  - **The Tower climbs:** the same spiral, up (radius 110 m to 80 m, 4 m a room), round the Tower itself; its open
    side faces the Tower. Footprints never overlap, so a fall drops into the void, never onto a floor below.
  - **The Moon meanders:** the first causeway runs straight at the Moon, then each room swings 20–45° to one side or
    the other of that heading (swapping sides often). Every true connector's far end stands between **two towers**
    (`DimensionDef.gateway = 'towers'`, `Dressing.towers`); branches never do.
  - *Before V2-16* every dimension used one right-angled grid heading north (V2-3's), which measured the same in all
    four (see *Measuring the generator*): the planned spiral, stack and meander had been deferred until the levels
    had been played.
- **The landmark** sits where the layout puts it: beyond the exit along the axis (Justice), straight ahead of the
  spawn past the exit (the Moon), or at the spiral's centre (the Devil's pedestal, the Tower). Every `vista` stands
  at a spot in its room the landmark can be seen from (a walled room is looked out of through a doorway).
- **Boundaries** are dense wall props (v1's approach) plus the dark foreground frame, never invisible walls.

### 4. Dressing
Dressing is rules, not scatter:
- **Frame props:** dark, tall props placed near connectors, on either side of the view line, to build the foreground
  frame.
- **Hero props:** 1–3 per level (statues, planted swords, chained pillars), placed at vista focal points.
- **Cover clusters:** placed by the combat kits (below). Dressing never puts props on cover sockets or lanes.
- **Ground cover:** instanced fields (grass boxes, rubble, reeds) by noise, kept off paths and lanes.
- **Lights:** the accent motif and warm lights on the critical path. Lights are emissive meshes, not extra real
  lights (only one shadow light, and changing light count recompiles shaders).

### 5. Encounters (templates, not random scatter)
Combat nodes get an **encounter template**, chosen by beat and dimension:

| Template | Shape |
|---|---|
| **Ambush** | enemies hidden behind cover facing the entrance; one audible tell before they move |
| **Guarded gate** | a tough enemy holds a choke point, with support behind |
| **Nest** | ranged enemies on high ground; flanking route exists |
| **Arena** | waves in an open space with cover clusters |
| **Patrol** | a moving group crossing the space; can be avoided or picked off |
| **Signature** | the dimension's signature enemy on its own terms (the Blindfold in a quiet court, Fallers under the scaffold) |

Difficulty rises with depth along the critical path, as v1 already does. The dimension's beat sets the
ceiling.

### 6. Validation (pure, unit-tested)
A generated level is rejected and regenerated from `seed + attempt` if any check fails:
- **Reachability:** every node is reachable, and the shortcut is opened from the far side.
- **Lantern placement:** one before the miniboss; no combat spawn within 15 m of a lantern.
- **The landmark** is visible (unoccluded ray through the fog) from the `start` and from every `vista`.
- **Combat sizes** fit the template; every enemy spawn has a path to the player.
- **Fair angles:** no spawn behind the entrance unless the template is *Ambush* with an audible tell.
- **Budget:** critical-path length, room count and prop/draw-call estimates within *Budgets*.
- **Determinism:** the same seed gives the same layout (`tests/gen-level.test.ts`).
- **The card's shape** (`checkShape`, V2-16): Justice's wings mirror, with one key in each pan and the axis gate on
  the keys; the Devil only goes down and the Tower only up; the Moon's true ways stand between towers and its false
  paths never do. In a spiral the landmark must be in sight from 60% of the rooms (the pit) or every room (the crown).
- **Square doors:** every connector leaves and enters its doorways square (V2-16).

## Measuring the generator

`src/world/gen-metrics.ts` measures a level's shape from its output; `tests/gen-metrics.test.ts` generates 60 levels
per dimension (20 seeds × 3), holds each dimension to its card's shape, and prints the means. Before V2-16 (the grid),
measured the same way on 120 levels each:

| Measure (mean) | Justice | Devil | Tower | Moon |
|---|---|---|---|---|
| Straightness (start→exit ÷ path) | 0.79 | 0.79 | 0.80 | 0.79 |
| Turns on the critical path | 4.0 | 4.0 | 4.0 | 4.0 |
| Height range (m) | 2.6 | 17.6 | 17.7 | 0 |
| Distinct room-kind sequences | 10 | 8 | 12 | 9 |

After V2-16:

| Measure (mean) | Justice | Devil | Tower | Moon |
|---|---|---|---|---|
| Straightness | 0.53 | 0.47 | 0.47 | 0.64 |
| Turns (heading swings > 15° room to room) | 5.0 | 7.1 | 7.4 | 6.2 |
| Heading spread (circular s.d., rad) | 0.49 | 1.35 | 1.35 | 0.95 |
| Height range (m) | 3.0 | 23.5 | 23.4 | 0 |
| Landings | 4.0 | 7.3 | 7.5 | 6.2 |
| Landmark in sight (share of rooms) | 0.99 | 1.00 | 1.00 | 1.00 |
| Rooms seen ≥ 3 steps before they're reached | 5.4 | 1.6 | 3.2 | 4.6 |
| Distinct room-kind sequences (of 60) | 10 | 8 | 11 | 8 |

The sequences haven't moved: the mission graph is still one template per layout (the cycle library proposed in the
discovery is the next step).

After V2-17 (the second playtest: *too much walking with nothing in it*; *the gates aren't worth opening*). Three
measures of pace join the table. A fight on the way counts its room's encounter or the miniboss; *walked* is each
room's depth plus every way between them on the way:

| Measure (mean) | Justice | Devil | Tower | Moon |
|---|---|---|---|---|
| Fights on the way | 4.6 | 4.5 | 4.5 | 4.5 |
| Metres walked per fight | 97 | 112 | 111 | 103 |
| Fights past the gate, before the next lantern | 1.1 | 1.0 | 1.0 | 1.0 |
| Straightness | 0.59 | 0.44 | 0.45 | 0.66 |
| Turns | 7.6 | 8.8 | 9.3 | 7.7 |
| Height range (m) | 2.7 | 29.5 | 30.0 | 0.8 |
| Landings | 6.6 | 7.3 | 7.1 | 6.2 |
| Distinct room-kind sequences (of 60) | 23 | 36 | 36 | 32 |

For the pace: before V2-16 a level walked about 108 m per fight; V2-16 stretched it to about 150 m (its turning
connectors doubled the walking between rooms, with the same three fights). V2-17 adds a fight a level, holds the loop
levels to 11–12 rooms, steepens the stairs (`maxSlope` 0.45), shortens connectors (6–11 m), and runs a turn gentler than `layout.straightUnder` straight (the next room makes it
up). The rule *a fight past every gate* (`pastGate` ≥ 1) is what makes the shortcut worth opening: with the next
lantern right past the gate, dying never brought you back to it. More rooms in a sequence, and Justice's swept wings,
moved the distinct sequences off their floor.

## As built in V2-3 (Justice)
*Superseded in part by V2-16:* Justice now weighs (two mirrored wings off the mid lantern, the axis gate on both
keys; see *3. Space*) instead of the loop below, and its wing rooms turn off the grid. The kits, sockets, templates,
rosters and validation below still hold.
The pipeline above, for one dimension. Files: `src/world/dimensions.ts` (data), `gen-graph.ts`, `gen-space.ts`,
`gen-dress.ts`, `gen-validate.ts`, `gen-level.ts` (pure), and `level.ts` (the builder).

- **The critical path** always has this shape:
  `start → P… → lantern → loop… → gate → Q… → lantern → miniboss → exit`.
  - The middle slots (P, the 2–3 loop rooms, Q) hold the set-piece, the vistas, the combats and any traverse. They
    are permuted until the order meets the constraints: set-piece in the middle third, gate in the second half, no
    back-to-back fights unless the beat is the twist, and no two vistas side by side. While possible, there's also a
    lantern after a fight, and the introduce level opens without a fight.
  - **Counting:** a set-piece with a fight counts as one of the level's combats, and a set-piece that is a view (the
    colonnade, the wind bridge) counts as one of its vistas. A **guarded gate** (the gate room holds the fight) counts
    as a combat. That keeps the critical path at 9–10 nodes with 2–3 combats. There are 3 lanterns (start, mid,
    pre-miniboss).
  - Each beat must include one template: the introduce level the **signature**, develop a **nest**, twist an
    **ambush**.
- **Space:**
  - Justice lays out on a right-angled grid along one axis that runs north toward the scales. Rooms are axis-aligned
    stone platforms over a fog-filled drop, joined by causeways (or stairs where floors differ; the steepest is 0.36).
  - **The loop:** the mid lantern exits sideways, the loop rooms run north and turn back, and the gate lands on the
    axis just north of the lantern. The shortcut is the axis itself, barred by a portcullis that lifts only from the
    gate's side. From the spawn you look straight down the barred axis at the scales.
  - **Branches** leave a free edge of a combat room (never into the loop) and end in a lit cache.
  - **Compression:** an arch frames the far end of every connector into a vista, a fight, the gate or the miniboss.
    Half of the long ones are walled passes.
- **Kits** are data: size ranges, edge style (wall / parapet / colonnade), floor height, cover clusters, a raised tier
  (the nest, ≤ 4 m with ramps at both ends), a divider (the twin courts), planted swords (the sword field), grass.
  Cover is mirrored about each room's axis.
- **Order:** cover belongs to the kit (space), encounter sockets come next, and decorative dressing (swords, grass, hero
  props) comes last so it can keep off the sockets.
- **Sockets by template:** arena (mirrored spread over the far half), guarded (a guard holding the way out, support
  behind it), nest (ranged on the tier wings, one fighter below), ambush (behind cover, facing the entrance), patrol
  (a line crossing the room), signature (one, alone, in a quiet court), miniboss (one, on the axis).
- **Validation as built:** graph shape and constraints, reachability, the shortcut's direction; room and connector
  overlaps, slopes, shortcut length (8–70 m); sockets inside their room, ≥ 6 m in front of the entry unless ambush, ≥
  15 m from every lantern, ≤ 4 m up; combat rooms 18–44 m; an unoccluded sight line from the spawn and every vista to
  the scales (beam, pans or pillar) past walls, columns, arch piers and lintels, slabs and hero swords; a props
  budget.
  - **Since V2-4:** each beat has a **roster** (data) that fills socket roles with enemies. The introduce level has only
    Bailiffs and the signature Blindfold; develop adds the Gavel and the Page; the twist mixes them all. The
    **ranged-distance rule** is enforced: the generator puts a fighter on any ranged socket closer to its room's way
    in than (throw wind-up × blade speed) + one roll (14.65 m with today's tuning), and validation checks it.
  - **Still open:** "every spawn has a path to the player" holds because every room is connected and enemies steer
    by feelers inside their room. There's no navmesh; a leash walks enemies home if a chase drifts.
- **Numbers:** across 1,500 seeds (500 per level), 93% of levels pass on the first attempt and all pass within 3;
  generation takes ≤ 20 ms. Levels draw 43–62 calls in the smoke run.

## Trial rooms
The trial grounds (`DESIGN.md → Trial grounds`) reuse this pipeline at its smallest. A trial is a level script with
a single `combat` node (or a tiny `start → combat → combat` chain), built from shared kits in a neutral palette, plus
the trial's rule. Validation still runs. If a rule needs its own kit (the Hanged Man's gravity flip), that's the
first sign it costs more than data.

## Combat spaces (shooter rules)

| Rule | Value | Why |
|---|---|---|
| Clearing size | 18–40 m across | big enough to roll out of lanes, small enough to see every enemy |
| Cover clusters | 2–4 per space, 6–12 m apart | always somewhere to go next |
| Half cover | 0.8–1.0 m | shoot over it; it blocks low projectiles |
| Full cover | ≥ 2 m | breaks line of sight; enemies must reposition |
| Entrances | on the player's side, facing into the space | the player sees the fight before it starts |
| Ranged enemy distance | ≥ (telegraph time × projectile speed) + roll distance | every shot can be read and dodged (pillar 2) |
| Verticality | max one raised tier (≤ 4 m) in normal fights | readable; big vertical play is the Tower's set-piece |
| Fallback | every combat space has a retreat route back toward the last lantern | dodge, reset, re-engage |

## Boss arenas (Proposed)
Each arcana boss gets its own short space rather than a full level:
1. A lantern.
2. A short **approach** connector: a long compression into a big reveal of the boss in its arena (the frame-then-reveal
   at full scale).
3. The arena. Arenas are mostly authored-by-rules: a fixed shape per boss with seeded dressing.

The landmark the player has walked towards for three levels *is* the arena, or the boss.

**As built for Justice (V2-6, `src/world/boss.ts`):** a lantern platform; a 57 m walled pass under three dark arches
that frames the scales; then an octagonal arena (28 m radius) with tall columns, a ring-patterned floor centred on
her, and the great scales standing just beyond. In phase 2 two brass pans (the accent motif) lower out of the fog on
chains and settle as low platforms either side of the axis. The way on is a veiled gate north, open once she falls.

**As built for the Devil (V2-10, the same builder with `kind: 'devil'`):** the same shape in the Devil's palette. The
arena is the pit at the foot of his pedestal: the columns are **chained to each other** with heavy iron swags, and
the throne-pedestal (the landmark), with its brazier, rises just beyond. Nothing in the arena changes with his phase:
his change is the pact, and the coin his rain leaves on the floor.

**As built for the Crowned Tower (V2-12, `kind: 'tower'`):** the approach climbs to the Tower's **top floor**, an
octagon of timber decks (a 3 m grid laid over it, with holes outside the octagon) on a few stilts, under a storm
ring with lightning in its eye. There are no columns: it's open sky. At each phase the decks beyond a radius (18 m,
then 9 m) pulse magenta and fall, down to a last platform. When the boss falls the floor holds again, so the way on
can be walked. *After the first playtest:* fallen decks are built back after 6 s, each phase's ring gives way again
every 14 s, and stone landings at both doors never fall (the deck grid stopped short of the octagon's faces, leaving a
gap off the bridge you fell through).

**All arenas, after the first playtest:** the distant scenery (pillars, great swords) keeps 30 m from the walkable
strip: one stood up through the spawn platform, scenery with no collider, and you began inside it. Bosses never
sleep-hide in the fog (they popped in as you walked up) and wake only as you step into the arena (they had started
on you down the approach). `tests/arena-walk.test.ts` walks each arena and checks the scenery's clearance.

## Budgets
| Budget | Target |
|---|---|
| Level length (first play) | 8–12 min |
| Critical-path nodes | 6–10 |
| Draw calls | < 150 (v1 zones: 58–70) |
| Triangles in view | < 250k (re-check on real hardware) |
| Real lights | 1 shadow light, plus the muzzle light (always present) |
| Generation time | < 200 ms on desktop, including validation retries |

## Debug tools (extend v1's)
- Regenerate with a new seed (exists).
- **Graph overlay**, drawn over the level with node types coloured. It exists for clearings; extend it to the mission
  graph.
- **Kit labels** and cover sockets.
- **Validation report:** which check failed and how many attempts were needed.
- **Vista camera:** jump to each vista's framed view and screenshot it. The smoke test does this for every level
  seed it runs.

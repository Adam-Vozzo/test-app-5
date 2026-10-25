# DESIGN.md: *Eight* (v2 game design)

**Working title: *Eight*** (Decided). v2 grows the v1 prototype (archived in `archive/v1/`) into a small, finished game: a souls-like third-person shooter
set in a world built from the tarot. The protagonist is the **Eight of Swords**, someone who has only ever been held
back by herself.

Each item below is tagged **Decided** (the user's call), **Proposed** (a suggestion awaiting a yes or no) or
**Open** (not settled yet). When a proposal is accepted, change its tag here and update `PLAN.md`, `LEVELS.md`
and `STYLE.md` to match.

Influences, and what we take from each:
- **Remnant 2**: a souls-like shooter whose levels are generated from designed pieces.
- **Hades**: a hub between runs and a cast of mythic characters.
- **Sokpop (Grey Scout, Brume)**: a small team, a simple style and procedural animation.

What makes it ours: **the cards become the rules.** Each dimension's mechanics, spaces and enemies express the
meaning of its arcana, so the theme is something you play, not something you read.

## Shape of the game (Decided)

```
            ┌──────────── Hub ────────────┐
            │  gates unlock in order       │
            └──┬────────┬────────┬────────┬┘
               ▼        ▼        ▼        ▼
          Dimension Dimension Dimension Dimension      ×4, one major arcana + one suit each
               │
               ├─ Level 1 (procedural) → Knight miniboss
               ├─ Level 2 (procedural) → Queen miniboss
               ├─ Level 3 (procedural) → King miniboss
               └─ Arcana boss arena    → the major arcana itself
```

- **4 dimensions**, each built around one major arcana and one suit.
- **3 procedural levels per dimension.** Each level ends with a court-card miniboss of that suit: Knight, then
  Queen, then King.
- **The major arcana is the dimension's final boss**, fought in its own arena after the King. *(Proposed: the arena is a
  short authored-by-rules space, not a full fourth level; see `LEVELS.md → Boss arenas`.)*
- **A hub** gives access to each dimension. Gates unlock as the player progresses, in a fixed order (linear, per the
  planning board).
- **Pages** (the fourth court card) are elite enemies inside levels, not minibosses. *(Proposed.)*

**Scope check.** That's 12 levels, 12 minibosses and 4 bosses. It stays small only because of three rules:
1. Levels are generated from per-dimension kits (`LEVELS.md`). We build 4 kit sets, not 12 levels.
2. **Rank is the verb, suit is the flavour.** Knight, Queen and King each have one behaviour set shared across suits.
   A suit re-skins them and adds one twist. That's 3 behaviour sets plus 4 suit kits, not 12 bespoke fights.
3. Common enemies share 3–4 archetype verbs across all dimensions, re-skinned per dimension, plus **one signature
   enemy per dimension** that carries its rule.

## The four dimensions (Decided: pairings, order, and Justice as the first slice; details Proposed)

The four pairings and their order are decided, and **Justice is the first playable slice**. The per-dimension
details below (enemies, minibosses, boss phases, set-pieces) are still proposals, to be confirmed as each dimension
is built.

**Pairing.** Arcana and suits are paired by the traditional elemental attributions (Golden Dawn): Swords = air,
Pentacles = earth, Wands = fire, Cups = water. That gives each pairing a reason beyond taste.

**Order.** Gates open in arcana number order, which follows the Fool's journey. Read as a hero's journey, it runs:
threshold → trials → ordeal → the last illusion before the dawn.

| # | Arcana | Suit | Element | The rule (one verb) | Emotional target |
|---|---|---|---|---|---|
| 1 | **Justice (XI)** | Swords | Air | *Answer in kind*: every act is weighed | Discipline, dread |
| 2 | **The Devil (XV)** | Pentacles | Earth | *Temptation*: the chains are loose | Greed, unease |
| 3 | **The Tower (XVI)** | Wands | Fire | *Collapse*: nothing stays standing | Panic, momentum |
| 4 | **The Moon (XVIII)** | Cups | Water | *Illusion, but fair*: not everything is real | Doubt, fear |
| — | The Sun (XIX) | — | — | The ending: she takes off the blindfold | Relief |

**Why these four.** Each turns into a mechanic, not just an image, and together they ramp in difficulty:
- **Justice** teaches the fundamentals: read the telegraph, punish the recovery.
- **The Devil** adds risk and reward.
- **The Tower** takes away safe ground.
- **The Moon** tests whether you've really learned to read.

The Chariot (Cancer, water) and the Hanged Man (water) were left out because both are water cards, the Moon's
element. Their concepts live on in the **trial grounds** (below).

**The Moon breaks pillar 2 on purpose.** "Everything is readable" stays true: illusions have consistent, learnable
tells (see below). The Moon checks the player's reading instead of breaking it.

### 1. Justice × Swords: "Every act is weighed"
- **The card:** Justice sits between pillars, holding a raised sword and scales. It's about understanding right and
  wrong, and about consequence.
- **Rule: answer in kind.** Swords enemies keep a guard facing you. They parry or deflect from the front and open up on the
  flank or after their own swing. **Mirrored combos**: the second half of a combo mirrors the first, so learning one
  side teaches the other. Fairness made literal.
- **Space:** a windswept plateau of white stone courts and colonnades, with swords planted in the earth like grave
  markers. Rooms are **symmetric** (the generator uses a mirror axis), formal and ordered.
- **Landmark:** a vast set of scales hanging over the dimension, visible from every level.
- **Enemies:**
  - *Bailiff*: a guard enemy with a front shield; flank it or bait its swing.
  - *Blindfold* (signature, after the Two of Swords): hunts by **sound**. Firing reveals you, walking doesn't, which
    nods to Grey Scout's stealth.
  - *Gavel*: a slow overhead slam.
  - *Page of Swords* (elite): a fast scout that alerts the room.
- **Minibosses:**
  - *Knight of Swords*: charges through wind lanes.
  - *Queen of Swords*: cold precision, with lines of thrown blades to read and step through.
  - *King of Swords*: a judge who commands Bailiffs and hands down **verdicts**, marking a zone that strikes later.
- **Boss: Justice.** Phase 1 is the sword (mirrored combos). In phase 2 the scales come down into the arena as two
  great pans, and what she throws onto one side lands on the other.

### 2. The Devil × Pentacles: "The chains are loose"
- **The card:** two figures chained to the Devil's pedestal, with chains loose enough to lift off. It's about temptation,
  and that echoes our protagonist's own loose bindings.
- **Rule: temptation.** Wealth (pentacles, the upgrade currency) lies in plain sight, and taking it costs something:
  it alerts, weighs you down, or triggers an ambush. **Binding attacks look fatal, but one roll always breaks them**:
  you could always have walked away.
- **Space:** descending mines, vaults and a gilded market of excess. Low ceilings and dense cover. Side vaults are
  tempting branches off the critical path (`LEVELS.md → Risk branches`).
- **Landmark:** the Devil's throne-pedestal, glowing far below. You are always going down towards it.
- **Enemies:**
  - *Thralls* (signature): chained pairs, and the chain between them is a sweeping hazard. Shoot it and both are freed:
    one flees and one fights.
  - *Miser* (after the Four of Pentacles): a tank that hugs its coins.
  - *Imp*: a fast harasser.
  - *Page of Pentacles* (elite): carries a coin purse and runs, so it's a chase.
- **Minibosses:**
  - *Knight of Pentacles*: a slow, unstoppable armoured advance.
  - *Queen of Pentacles*: nurtures her side, healing and regrowing allies.
  - *King of Pentacles*: buys mercenaries mid-fight and throws coins as projectiles.
- **Boss: the Devil.** Mid-fight he offers a **pact**: double damage dealt and taken. Accept or refuse.
  It's an autonomy choice the player owns.

### 3. The Tower × Wands: "Everything falls"
- **The card:** a tower struck by lightning, its crown blown off, with figures falling. It's sudden collapse, and the
  end of false structures.
- **Rule: collapse.** Ground is temporary: floors crumble on a telegraphed timer, lightning strikes marked ground,
  and fire spreads along wooden structure. Standing still is the mistake. The Tower comes right before the Star in
  the deck, so it's the darkest point before hope.
- **Space:** a burning scaffold-city climbing a tower. **Vertical**: levels stack floors and ascend.
- **Landmark:** the Tower itself, with a crown of storm at its top.
- **Enemies:**
  - *Firebrand*: torch-bearers who ignite ground.
  - *Fallers* (signature, the card's falling figures): drop from above, telegraphed by a magenta shadow growing on the
    ground.
  - *Builder*: raises barricades.
  - *Page of Wands* (elite): lights signal fires that call reinforcements.
- **Minibosses:**
  - *Knight of Wands*: a fiery charge that leaves a fire trail.
  - *Queen of Wands*: with her black cat (a summoned flanker) and fire zones.
  - *King of Wands*: lord of the tower; his phases burn the floor away.
- **Boss: the Crowned Tower.** The fight on the top floor *is* the collapse. Each phase removes ground, ending on a
  last platform under open sky.

### 4. The Moon × Cups: "Not everything is real"
- **The card:** a path from a pool between two towers, a dog and a wolf howling, a crayfish crawling out of the water.
  Illusion and trepidation.
- **Rule: illusion, but fair.** Some enemies, paths and pickups are reflections. **Illusions cast no shadow and make no
  footsteps** (consistent, learnable tells). Hitting an illusion dispels it harmlessly but costs you time and position.
- **Space:** marsh and shoreline in heavy fog (Brume is the reference here), with pools that reflect. Paths double
  back and look alike. Each level threads **between two towers**.
- **Landmark:** the Moon, enormous and low, and the two towers beneath it.
- **Enemies:**
  - *Dog and Wolf*: a pair, tame and wild; when one howls, the other is buffed.
  - *Crayfish* (signature): ambushes from the water, telegraphed by ripples.
  - *Phantoms* (after the Seven of Cups): decoys.
  - *Page of Cups* (elite): spawns fish from its cup.
- **Minibosses:**
  - *Knight of Cups*: offers you a cup. Drinking heals you or poisons you, and there's a tell.
  - *Queen of Cups*: makes mirror copies of herself; one casts a shadow.
  - *King of Cups*: throned on the water, sending tidal waves.
- **Boss: the Moon / the Shadow.** The Moon's light casts the Eight of Swords' own shadow, which fights with her moves.
  This is the Jungian shadow, and the last thing holding her back is herself.

## Trial grounds (Decided: exists; concepts Proposed)

A **separate area for trialling other arcana concepts** (the user's call). It's a **development sandbox**: like v1's
target range, it's reached from the start menu (`?mode=trials`), not from the hub. It isn't a dimension and doesn't
count toward the 4-dimension cap.

Each trial is **one generated room** built from the V2-3 kits, plus one rule. It answers one question: is this rule
fun? A trial that proves stronger than a current dimension's rule can **replace** that dimension by the user's call.
Element collisions are weighed when that happens; the Chariot and the Hanged Man are both water, like the Moon.

| Trial | The card | Rule to try (first ideas) |
|---|---|---|
| **The Chariot (VII)** | Victory, though momentary; willpower driving two opposed sphinxes | *Momentum*: kills grant a strong buff that decays fast, and chaining kills keeps it alive. Stopping is losing. Arena variant: two opposed hazards (one light, one dark) push you in different directions, and you steer between them. |
| **The Hanged Man (XII)** | Suspension, indecision, seeing from a new perspective | *Hesitation is punished*: the world only moves while **you** stand still (an inverted "time moves when you move"), so deciding fast keeps enemies frozen. Arena variant: gravity flips, and you hang from the ceiling and fight upside down. |

More concepts can be added to this table as they come up. Trials are cheap by construction: data plus a rule, on
existing kits.

## Court cards as minibosses (Proposed)

**Rank is the verb, suit is the flavour.** The player learns what a Knight *does* in dimension 1 and recognises it
in dimension 4, while the suit changes how it feels.

| Rank | Verb | Tests | Shared behaviour set |
|---|---|---|---|
| Page | Herald (elite, not a miniboss) | Target priority | Alerts, flees, buffs, or spawns |
| Knight (level 1) | **Mobility** | Dodging | Gap-closing charges, hit-and-run, lanes |
| Queen (level 2) | **Control** | Positioning | Area denial, zones, summons and copies |
| King (level 3) | **Command** | Priorities under pressure | Leads a squad, buffs it, phases at health thresholds |

Each miniboss also **escalates the dimension's rule**. The Knight introduces the rule in a fight, the Queen twists
it, and the King combines it with a squad.

## The protagonist: the Eight of Swords (Decided, details Proposed)

- **Decided:** the card shows a woman bound and blindfolded, ringed by swords, with the bindings loose and the path
  open. She's a zero-to-hero protagonist who has only been held back by herself.
- **Decided: unbinding instead of buildcraft.** She starts bound (the card's binding). Each **arcana boss frees one
  restraint, which gives her a new move.** That gives a progression arc without loot, rarity or a skill tree.
  Which four moves is still Proposed. Candidates:
  - Justice frees a **parry** (answer in kind).
  - The Devil frees a **chain-break dash**.
  - The Tower frees a **safe fall or plunge**.
  - The Moon frees the **blindfold**, which is the ending.
- **Proposed look:** a stocky hooded figure in a rust-red robe (the card's red, desaturated so it never reads as
  kill-red). The off-white blindfold is pushed up onto her forehead, carrying cloth tails that trail behind her.
  See `STYLE.md`.

## Weapons (Decided; the rifle's reload rule Proposed)

Depth over breadth: two weapons for the whole game, made deeper through upgrades.

- **Auto-pistol** (Decided): the default fallback with infinite ammo. Reliable, low damage, always there. Built on the
  v1 repeater's hitscan and juice.
- **SwordRifle** (Decided): one weapon with a long-range rifle mode and a close-range sword mode, plus **limited
  charges that power both**. It **starts rusted and is repaired** over the game.
  - **Charge loop (Decided):** rifle shots cost 1 charge. Basic sword swings are free, and sword **hits refill
    charges**. A charged sword strike spends charges. The loop is: close in to fuel the rifle, back off to spend it.
  - **Start full (Decided):** she begins each level, and every lantern rest, with a **full set of charges**.
  - **The rifle is heavy (Decided).** It should feel like v1's **staple driver**. Its def (`STAPLER` in
    `src/weapons/defs.ts`) is the starting point:
    - a visible fast projectile with slight drop
    - a bolt cycle between shots (0.8 s), semi-auto
    - pierce 1, huge crits (2.6×) and a big stagger
    - a sharp crack-and-thump sound
    - a hard pitch kick that mostly springs back
  - *Proposed:* **no rifle reload.** Charges *are* the magazine, so the only ways to refill are sword hits and
    lanterns. That keeps the loop pure: an empty rifle means it's time to swing.
  - *Proposed repair:* four repair stages, one per suit relic (dropped by each King). Each stage restores a part:
    blade, barrel, stock and edge.
- **Melee is a genuinely new verb.** It gets its own code path (`CLAUDE.md → Weapons are data`). It's also the
  biggest feel risk in v2, so it gets its own milestone and range before any content is built on it (`PLAN.md`).

## The hub (Decided: exists, gates unlock; details Proposed)

- **Proposed: the hub is built on The World (XXI).** A circular plaza inside a great wreath, outside the four
  dimensions. Its four gates are guarded by the four creatures from the card's corners:
  - the **angel** (Aquarius, air) for Swords
  - the **bull** (Taurus, earth) for Pentacles
  - the **lion** (Leo, fire) for Wands
  - the **eagle** (Scorpio, water) for Cups

  A creature wakes when its gate unlocks. The last card of the deck is the frame that holds the journey.
- **The hub grows.** Each cleared dimension leaves something behind, such as a character arriving or a creature
  waking. That gives cheap, visible progress (relatedness without social features).

### Hub characters (Proposed)
| Character | Role | Why them |
|---|---|---|
| **The Magician (I)** | Shopkeeper: upgrades and SwordRifle repair (the user's idea) | His table holds a cup, a pentacle, a sword and a wand: one tool of each suit, exactly our four dimensions. Each suit relic goes on his table. |
| **The High Priestess (II)** | Keeper of the gates, lore, hints for the next dimension | She sits before a veil between two pillars, and the veil is the way through. |
| **The Star (XVII)** | Heal-flask upgrades (the Star pours water) | **Arrives after the Tower** (she follows it in the deck: hope after collapse). Early heal upgrades come from the Magician. |
| **The Fool (0)** | Wanders the hub and comments; the one who set her on the road | Optional. Cut first if dialogue cost bites. |
| **The Hermit (IX)** | Not a hub NPC: his **lantern is the checkpoint** in every level | Same item in every level, so no extra cost. |

**Dialogue budget:** short state-based lines with no trees and no voice. Each NPC gets about 3–5 lines per
dimension cleared. Relatedness comes from characters noticing your progress, not from conversation systems.

## Progression and death (Proposed)

- **Currency:** pentacles, dropped by enemies and found in caches. Spent at the Magician.
- **Death** works as in v1: you drop your carried currency where you fell and respawn at the last lantern. Non-elite
  enemies respawn, and you recover the drop by reaching it. Elites, minibosses and opened shortcuts stay done.
- **Level seeds** are fixed per save, so a level's layout stays learnable across deaths (souls-like memory). A new save
  or New Game+ rerolls them.
- **Save state** is minimal: unlocked gates, cleared levels, upgrades, repair stage and seed. It's stored in
  `localStorage`. There's no mid-level save; quitting returns you to the last lantern.

## Meta: motivation, emotion and flow (from the planning board)

- **Competence:** levels rise in difficulty; ranks are learned once and recognised later; each boss tests its
  dimension's rule. Short-term goal: the next lantern. Medium: the miniboss. Long: the arcana.
- **Autonomy:** whether to take the risk branches and treasure, the Devil's pact, how to spend at the Magician, and
  which SwordRifle mode to lean on. Dimension order is linear (Decided), so autonomy lives inside the levels.
- **Relatedness:** the hub characters noticing what you did, and the hub growing. No social or co-op features
  (Decided).
- **Emotion:** each dimension has an emotional target (table above). The arc runs from bound and judged, through
  tempted, broken and doubting, to free.
- **Flow:** level length and rhythm targets live in `LEVELS.md`. Difficulty is tuned per dimension in `src/tuning.ts`,
  never hard-coded.

## Open questions

1. **Which four unbinding moves?** Only Justice's is needed for the slice. The proposal is a parry.
2. **Rifle reload:** none, because charges are the magazine (Proposed above)?
3. **Is the arcana boss arena its own short space or the end of level 3?** (Proposed: its own space.)
4. **Story delivery.** The proposal is card-title intros plus short NPC lines and no cutscenes. Is that enough?
5. **Death rule.** Proposed: v1's drop-and-recover. Does that fit, or should death send you to the hub?

Resolved:
- Working title: ***Eight***.
- The four pairings and order, with Justice as the slice.
- The charge loop, starting full, and a heavy rifle.
- Unbinding as the progression.
- Trial grounds for the Chariot and the Hanged Man.

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
  markers. Rooms are **symmetric** (the generator uses a mirror axis), formal and ordered. *As built in V2-3
  (Proposed until played):* the plateau is broken into stone platforms over a fog-filled drop, joined by causeways on
  a right-angled grid, with the barred shortcut running down the main axis toward the scales.
- **Landmark:** a vast set of scales hanging over the dimension, visible from every level.
- **Enemies:**
  - *Bailiff*: a guard enemy with a front shield; flank it or bait its swing.
  - *Blindfold* (signature, after the Two of Swords): hunts by **sound**. Firing reveals you, walking doesn't, which
    nods to Grey Scout's stealth.
  - *Gavel*: a slow overhead slam.
  - *Page of Swords* (elite): a fast scout that alerts the room.
  - **As built in V2-4 (Proposed until played):**
    - **Bailiff:** a tower shield with a pale sword crest. It turns shots and blade strikes from the front (a 120°
      cone) except during and after its own swing. It thrusts (0.6 s wind-up) or shield-bashes up close. Flank it, or
      dodge the thrust and punish the 0.85 s recovery.
    - **Gavel:** a stooped 2.15 m mass dragging a great hammer. Its **slam** fills a magenta ground ring during a
      1.15 s wind-up and erupts there (42 damage), then leaves it open for 1.6 s. It also sweeps. A cyan seam on its
      back is the weak spot.
    - **Blindfold** (signature): blind. It hears gunfire (42–55 m), blades (16 m), sprinting (9 m) and rolls (7 m),
      but walking carries only 2.5 m, and it feels you within 2.4 m. It goes to the last noise, searches, then gives
      up. Its slash is a **mirrored combo**: the second swing comes from the other side, so learning one teaches the
      other.
    - **Page of Swords** (elite, stays dead once slain): it holds about 15 m off, circles, and throws a blade
      (telegraph-magenta, 0.65 s wind-up). When it first sees you it whistles, and every enemy within 32 m comes.
    - **Shared:** every wind-up has a pose, a magenta glow (full on the weapon, a blush on the body) and its own
      sound. Fights stay in their rooms: an enemy pulled more than 30–40 m from home walks back and heals. Resting
      at a lantern brings back everyone except slain elites. Kills pay currency.
- **Minibosses:**
  - *Knight of Swords*: charges through wind lanes.
  - *Queen of Swords*: cold precision, with lines of thrown blades to read and step through.
  - *King of Swords*: a judge who commands Bailiffs and hands down **verdicts**, marking a zone that strikes later.
- **Boss: Justice.** Phase 1 is the sword (mirrored combos). In phase 2 the scales come down into the arena as two
  great pans, and what she throws onto one side lands on the other.
  - **As built in V2-6 (Proposed until played):** a 6 m crowned figure from the card: greatsword raised in her right
    hand, brass scales in her left, slate gown and pale mantle. Phase 1: a mirrored two-swing edict, an overhead cleave
    with a ground ring, and lines of thrown blades with a gap (the follow-up mirrored). At half health the horn sounds
    and two brass pans lower out of the fog onto the arena floor; from then on her cleaves and verdicts **echo across
    the arena's axis** (a beat later, on the other side), her combos run to three swings, and she marks verdicts.

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
- **As built in V2-8 (Proposed until played): the space only.**
  - **Levels:** the generator lays the Devil's levels on the same right-angled grid as Justice, without the mirror.
    Each room on the critical path sits a step (3 m) lower than the last, so a level falls about 18 m. The
    shortcut loop stays level, so the barred shortcut is still a flat walk back.
  - **Rooms:** walled vaults and pillared halls on sandstone flags, mine galleries on bare earth, and strewn coin
    hoards (cover) in the vault and the mine.
  - **Set-pieces:** the gold vault, the gilded market (a divided hall), the chain shaft (a vista that drops 4 m) and
    the collapsing mine (a long walled gallery).
  - **Landmark:** the throne-pedestal rises 175 m out of the pit beyond the exit, with great pillars standing in the
    fog. Its brazier burns above the levels in the lantern's warm light, unfogged so it reads from every vista, and
    each room you walk takes you further below it.
  - **Placeholders:** Justice's archetypes and the Swords court cards hold the rooms until V2-9 and V2-10. Level 3's
    way on leads home, because the Devil's arena isn't built yet.
- **As built in V2-9 (Proposed until played): the rule and the enemies.**
  - **The binding (the rule's first half):**
    - A Thrall pair's chain glows magenta as they wind up (1.25 s, from 5.5 m). They run to either side of her and haul it tight
      across her.
    - Caught, she's **rooted** and a magenta coil tightens for 1.5 s, then a 48-damage blow lands.
    - **One roll always breaks it**, with or without stamina, mid-swing or not. A roll's i-frames slip the haul
      entirely.
  - **The temptation (the rule's second half):** gilt hoards lie in plain sight in fights and set-pieces. Each pays
    pentacles and costs what its tell shows:
    - **bell** (40): the bell rings and wakes everything within 36 m.
    - **weight** (60): chained down. Each one shortens rolls (×0.82) and slows the walk (×0.9) until you rest, up to
      three. The purse shows "⛓ heavy ×n".
    - **ambush** (80): two Imps climb out of the cracked floor.

    Level 1 only rings, level 2 adds the weight, and level 3 adds the ambush. Risk branches hold a double hoard with
    the ambush and three Imps, instead of the cache.
  - **Enemies:**
    - **Miser** (the guard verb): hugs a strongbox that turns blows from a 150° front, except during and after its
      club swing or shove. Its coin bag on the back is the weak spot.
    - **Imp** (a fast harasser): a two-rake combo or a pounce, then it falls back before darting in again (hit and
      run).
    - **Page of Pentacles** (elite, stays dead): it doesn't fight. It runs to stay 16 m off, circling inside its room,
      and cuts only when cornered. Its purse pays 90.
    - **Thralls** (signature): a chained pair (one socket, two bodies; the chain can't stretch past 6 m). Their solo
      attack is a flail swing; together they bind. **Shoot the chain** (40 health) and both are freed: the nearer
      turns on you 30% faster, the other runs into the fog and is gone (no reward). Kill one and the other drags the
      chain alone.
- **As built in V2-10 (Proposed until played): the court, the Devil, the pact and the dash.**
  - **Knight of Pentacles (mobility):** a slow, heavily armoured advance. Shots can't stagger it (a parry can), and its
    front is armour. Its lane charge is slow (10 m/s) but runs its full length, and it **pins** what it hits: the
    Devil's binding, so one roll breaks it. From half health it charges, turns and charges back. Up close it mauls
    with a ground ring, then falls back.
  - **Queen of Pentacles (control):** nurtures her side.
    - She throws lines of coin with a gap (the volley verb in earth).
    - She **sows gilt seeds** in a ring around you. Each sprouts an Imp when it ripens (3 s), unless you **trample**
      it first.
    - From half health she sows four at a time.
    - Seeds are gilt, not magenta: they're coin to step on, not danger to leave.
  - **King of Pentacles (command):** at 66% and 33% he **hires two Misers**. His **coin rain** (one zone, then three
    from phase 2) strikes and leaves a pile of coin on the floor. Walk over a pile and it pays 15 but weighs like a
    chained hoard. Coin that lands under you isn't taken until you've stepped off it and come back: it's always a
    choice. Up close: a sceptre slam and a two-swing sweep.
  - **The Devil (boss, 6.5 m):** horned and bat-winged, the right hand raised and a torch held low, as on the card.
    - **Phase 1:** raking claws (a two-swing combo), the torch **brand** (a 3.4 m ground ring), and **shackles**: a
      magenta zone closes where you stand and **binds** you if you're in it, and a roll breaks it.
    - **At half health he stops and offers the pact:** "double the damage you deal, and double what you take."
      **E** accepts within 6 s; letting it pass refuses. He can't be hurt while he offers, and the choice lasts the
      fight (resting or dying resets it).
    - **Phase 2:** shackles in threes, and coin rain that leaves coin.
    - **The arena:** the pit at the pedestal's foot, ringed by chained pillars (`LEVELS.md → Boss arenas`).
  - **His unbinding: the chain-break dash** (**X**, Proposed). A short, very fast burst: 17 m/s for 0.22 s, i-frames
    the whole way, 14 stamina, 0.9 s cooldown. It breaks any binding, and **any Thrall chain it passes through**.
    It doesn't tumble, so it reads as a burst rather than a roll.

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
- **As built in V2-11 (Proposed until played): the space and the rule.**
  - **Levels:** the same right-angled grid, climbing. Each critical room is 3 m above the last, about 18 m per level.
    The loop stays level.
  - **Timber and stone:** the fights and the scaffold set-pieces are **timber decks** (3 m square) over the drop. The
    lanterns, gates, passes and the throne room are stone.
  - **Rotten decks:** 10% / 16% / 24% of the decks by level. They're charred, sag, and sit loose in a wider gap (the
    tell). Stepped on, one **cracks (pulsing magenta) and falls after 1 s**. The rot never cuts a room's doors apart
    before you've stepped on anything.
  - **Lightning:** every 10–14 s (level 1) down to 6–9 s (level 3), lightning **marks where you stand** (a magenta
    ring, 1.4 s) and strikes (28 damage). The timber within 2.6 m **catches fire**. Never at a lantern.
  - **Fire:** a burning deck hurts while you stand on it (14/s) and spreads to its neighbours. After 4.5 s it falls.
    Fire doesn't jump a gap.
  - **Falling** into the drop costs 30 and puts you back on the last stone you stood on.
  - **Resting** brings every deck back.
  - **Set-pieces:** the burning library floor (rubble cover), the bell that brings lightning, the scaffold climb, and
    the leap between towers (a long narrow deck).
  - **Landmark:** the Tower itself, 260 m, pale stone with its crown struck askew, fire in the break and a dark storm
    ring over it.
  - **The lion's gate** opens once the Devil is cleared.
  - **Placeholders:** the rooms hold Swords and Pentacles archetypes and the Swords court until V2-12, and level 3
    leads home. *(V2-12 replaced them.)*
- **As built in V2-12 (Proposed until played): enemies, court, boss, unbinding.**
  - **Commons:**
    - **Firebrand:** holds 11 m off and **lobs fire**. The landing ring fills as the pot flies, and the timber there
      catches.
    - **Faller** (signature): perched unseen in the storm. Come within 8 m and it **drops where you stand**: its
      magenta shadow grows for 1.3 s, it lands hard (the ring hurts), then fights.
    - **Builder:** hammers up a **barricade** (3 m of timber that stands 9 s) between you, cover for the Firebrands.
    - **Page of Wands** (elite): seeing you, it raises its staff and **lights a signal fire**, a 2.6 s channel. Lit,
      it calls two Firebrands. **Stagger it during the channel and the fire never lights.** Afterwards it lobs fire.
  - **Court (all on timber: the Tower's throne rooms are decks):**
    - **Knight of Wands:** the lane charge **leaves the decks burning** where it ran.
    - **Queen of Wands:** **fire zones** (one, then three) that flare and set the timber alight. Her **black cat**
      comes at each phase (66%, 33%).
    - **King of Wands:** calls **two Firebrands** at each phase, and each phase **burns the floor away** around him
      (six fires). Up close: a slam that ignites, and a sweep.
  - **The Crowned Tower (boss, 7 m):** a stone colossus coursed like masonry, its crown broken open and burning.
    - **Attacks:** smashes (an igniting ground ring), lightning (one, then three), hurled burning masonry (three lobs)
      and a sweep.
    - **The arena is the Tower's top floor, all timber** under a storm. At 66% the outer ring of decks pulses and
      falls (1.6 s warning plus the crack). At 33% it falls again, down to a **last platform** about 9 m across.
      Falling puts you on the nearest deck still standing.
    - **When it falls,** the storm passes and the floor holds again.
  - **Its unbinding: the safe fall** (Proposed). Once the Tower has fallen, a fall into the drop costs nothing, and
    the landing knocks back anyone within 4.5 m.
  - **The hub:** the eagle wakes (its road comes with the Moon), and **the Star** arrives. She kneels at a pool
    south-west of the spawn, with her own short menu: *A third jug* (+1 flask, 450) and *Pour freely* (heals 30%
    stronger, 500). The Priestess has four new lines.

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
- **As built in V2-13 (Proposed until played): the space and the rule.**
  - **Levels:** islands in a fogged marsh, **level** (no climb, no descent), joined by causeways over **dark water**.
    The rooms are near-duplicates on purpose: earth islands, reeds, low parapets.
  - **Landmark:** the Moon, an enormous pale disc hung low and unfogged, with **two dark towers** beneath it.
  - **Set-pieces:** the two-tower gate, the crayfish shallows (reed beds), the reflecting pool crossing, and the
    drowned path (a long narrow causeway).
  - **Reflections:** 20% / 30% / 40% of each level's enemies (never a whole room, never the court card). The tells
    are consistent:
    - **No shadow:** every real enemy now has a soft blob shadow under it, as well as its cast shadow; reflections
      have neither.
    - **No footsteps:** real enemies now make soft footsteps near you; reflections are silent.

    A reflection's swings and rings look real but touch nothing, and one hit dispels it with a shimmer, for no
    pentacles.
  - **False paths:** one branch per level is a causeway that isn't there. It's drawn, but casts no shadow on the
    water and holds nothing up, so you sink and come up on the last stone (a fall). Its cache is a reflection too:
    "Nothing was ever there."
  - **The eagle's gate** opens once the Tower is cleared.
  - **Placeholders:** the rooms hold archetypes from the first three dimensions and the Swords court until V2-14,
    and level 3 leads home.

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

**As built in V2-5 for Swords (Proposed until played):** each holds the throne room, rises when you walk in, shows
the big health bar, escalates at health thresholds (a stagger and a horn call), stays dead once slain, and seals the
level's exit until it falls.
- **Knight of Swords (mobility):** charges down a **wind lane** drawn on the ground during the wind-up (the aim locks
  for the last third), then a long recovery. Up close it cuts twice, the second cut mirrored, then falls back (hit and
  run). Below half health it **charges, turns and charges back**.
- **Queen of Swords (control):** holds ~11 m off and throws **lines of blades**: 7 lanes are drawn on the ground, one
  left empty; step into the gap. The follow-up volley leaves the **mirrored gap** (answer in kind). Below half health:
  9 lanes, three volleys. A quick riposte if you close in.
- **King of Swords (command):** raises his greatsword and **marks verdicts**, rings on the ground where you stand
  that strike 1.6 s later. From his second phase he marks three: where you are, where you're heading, and the mirror
  of that across his line to you. At 66% and 33% he **calls two Bailiffs** to his flanks (they're dismissed when you
  rest). Up close, an overhead judgement with a ground ring and a mirrored two-swing sweep.

## The protagonist: the Eight of Swords (Decided, details Proposed)

- **Decided:** the card shows a woman bound and blindfolded, ringed by swords, with the bindings loose and the path
  open. She's a zero-to-hero protagonist who has only been held back by herself.
- **Decided: unbinding instead of buildcraft.** She starts bound (the card's binding). Each **arcana boss frees one
  restraint, which gives her a new move.** That gives a progression arc without loot, rarity or a skill tree.
  Justice's move is decided (a parry). The other three are still Proposed. Candidates:
  - Justice frees a **parry** (answer in kind). **Decided.**
  - The Devil frees a **chain-break dash**. *(Built in V2-10 on X, Proposed until confirmed.)*
  - The Tower frees a **safe fall or plunge**. *(Built in V2-12 as the safe fall, Proposed until confirmed.)*
  - The Moon frees the **blindfold**, which is the ending.
- **Proposed look:** a stocky hooded figure in a rust-red robe (the card's red, desaturated so it never reads as
  kill-red). The off-white blindfold is pushed up onto her forehead, carrying cloth tails that trail behind her.
  See `STYLE.md`.

## Weapons (Decided; the charge indicator's look Proposed)

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
  - **No rifle reload (Decided).** Charges *are* the magazine, so the only ways to refill are sword hits and
    lanterns. That keeps the loop pure: an empty rifle means it's time to swing.
  - **The charge must be visible on the weapon (Decided).** The look is Proposed:
    - **On the weapon:** one glowing cell per charge, set along the SwordRifle's spine and visible in both modes.
      A cell goes dark when spent.
    - **Feedback:** a sword hit that refills a charge lights its cell with a short flare and a rising chime. Firing
      the last charge leaves the weapon visibly dark.
    - **Empty:** pulling the trigger with no charge gives a dry click and a dull flicker. The shot never fires, and
      the cue says *swing*.
    - **HUD:** a small pip row by the crosshair mirrors the cells, for when the weapon is off-screen or small at
      pixel scale.
    - **Colour:** a new reserved **charge** signal colour (`STYLE.md`).
    - **Rusted state:** cells are cracked and dim, and repair stages brighten them.
  - *Proposed repair:* four repair stages, one per suit relic (dropped by each King). Each stage restores a part:
    blade, barrel, stock and edge.
- **Melee is a genuinely new verb.** It gets its own code path (`CLAUDE.md → Weapons are data`). It's also the
  biggest feel risk in v2, so it gets its own milestone and range before any content is built on it (`PLAN.md`).
- **As built in V2-2 (Proposed until playtested):**
  - **Controls:**
    - **2** takes up the SwordRifle (**1** is the pistol).
    - **F** switches rifle ⇄ sword. The switch is committed: about 0.5 s, longer while rusted, and a roll cancels it.
    - In sword mode, **LMB** is a three-swing combo (forehand, backhand, overhead) and **holding RMB** readies the
      charged strike, which lands on release.
  - **Charge economy:**
    - 6 charges.
    - A landed swing refills 1 (at most 1 per swing).
    - The charged strike costs 2, and it won't start without them.
    - An empty rifle dry-fires and flickers its cells.
  - **Committed body:** a swing's windup and active phases can't be rolled out of, but its recovery can.
  - **Carried on her back:** while the pistol is out, the SwordRifle is slung diagonally across her back, muzzle up past
    the right shoulder. Swapping to it reaches over the shoulder and draws it (0.36 s); swapping away stows it the same
    way (0.38 s). It's committed like any swap (`tuning.swap.drawTime / stowTime`).
  - **Rust:** stage 0 deals 65% damage, switches 1.5× slower, sounds duller and has dim cells. The four repair
    stages step this up to full (`REPAIR_STAGES` in `src/weapons/defs.ts`).

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
| **The Star (XVII)** | Heal-flask upgrades (the Star pours water) | **Arrives after the Tower** (she follows it in the deck: hope after collapse). Early heal upgrades come from the Magician. *Built in V2-12: her pool in the hub, two items.* |
| **The Fool (0)** | Wanders the hub and comments; the one who set her on the road | Optional. Cut first if dialogue cost bites. |
| **The Hermit (IX)** | Not a hub NPC: his **lantern is the checkpoint** in every level | Same item in every level, so no extra cost. |

**Dialogue budget:** short state-based lines with no trees and no voice. Each NPC gets about 3–5 lines per
dimension cleared. Relatedness comes from characters noticing your progress, not from conversation systems.

**As built in V2-7 (Proposed until played):**
- **The plaza:** a round stone platform over the fog inside a laurel wreath tied with blue ribbons. The angel's gate
  (Justice) faces the spawn down the axis; the bull, lion and eagle sleep at the other three. Clearing Justice wakes
  the bull, whose gate leads down into the Devil's levels (V2-8). The Hermit's lantern burns by the spawn.
- **The Magician** (east), behind his table of a cup, a pentacle, a sword and a wand. His one menu sells, for
  pentacles: *Mend the edge* (SwordRifle repair stage 1, 400, needs the relic of Swords that the King of Swords gives
  up), *Tempered rounds* (pistol +15% damage, 250), *Deeper magazine* (+8 rounds, 200) and *Another flask* (+1 heal,
  300). Items are data (`src/world/hub-data.ts`) applied to the defs and vitals.
- **The High Priestess** (west), between her pillars: 4 lines each for three states (fresh, on the road, Justice
  cleared), cycling as you talk.
- **The bull's gate (V2-8):** once Justice is cleared, the bull's gate leads into the Devil's levels. The save keeps
  each road's next level separately.
- **After the Devil (V2-10):**
  - Clearing him wakes the lion (its road isn't built yet) and frees the dash.
  - The King of Pentacles gives up the relic of Pentacles, which the Magician needs for **True the barrel** (repair
    stage 2, 650, after stage 1).
  - The High Priestess has four new lines.
- **Save** (`localStorage`): seed, the next level on each road, cleared dimensions, relics, upgrades, repair stage,
  pentacles, unbindings and where each conversation is. Saved at every rest, level transition, purchase and on quit.
  **Play/Continue** resumes it; **New game** wipes it.
- **The parry (Justice's unbinding):** **V**, once she has fallen. A 0.2 s window then a committed 0.38 s recovery
  (slowed, no roll, no fire). A melee blow or thrown blade from in front (140°) is turned: the attacker staggers
  (the riposte window), the SwordRifle gains a charge, and there's a hitstop and a bright ring. Ground strikes (slams,
  verdicts) can't be parried. Numbers in `tuning.parry`.

## Progression and death (Proposed)

- **Currency:** pentacles, dropped by enemies and found in caches. Spent at the Magician.
- **Death** works as in v1: you drop your carried currency where you fell and respawn at the last lantern. Non-elite
  enemies respawn, and you recover the drop by reaching it. Elites, minibosses and opened shortcuts stay done.
  *As built in V2-6:* pentacles (✪) replace pollen in v2 scenes; kills and branch caches pay them, and you carry them
  from level to level. A boss resets when you rest or rise (Justice's pans rise again).
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

1. **The other unbinding moves.** The Devil's is built as the chain-break dash (V2-10, Proposed until you confirm it).
   The Tower's is built as the safe fall (V2-12, Proposed). The Moon's (the blindfold) is still open.
2. **Is the arcana boss arena its own short space or the end of level 3?** (Proposed: its own space.)
3. **Story delivery.** The proposal is card-title intros plus short NPC lines and no cutscenes. Is that enough?
4. **Death rule.** Proposed: v1's drop-and-recover. Does that fit, or should death send you to the hub?

Resolved:
- Working title: ***Eight***.
- The four pairings and order, with Justice as the slice.
- The charge loop, starting full, a heavy rifle, no reload, and a visible charge indicator on the weapon.
- Unbinding as the progression, with Justice's move being a parry.
- Trial grounds for the Chariot and the Hanged Man.

# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.
v1 entries (M0–M6, tuning passes, render passes) are in `archive/v1/PLAYTEST.md`.

## V2-16: levels shaped by their cards
Every dimension now lays out its own way, and rooms stand at any angle, turning on round landings.

**Try:**
- **Justice:** at the mid lantern the way forks left and right (the scales' pans). Each wing ends in a key room
  with a brass **weight**, guarded. Set it (E): the pan beside it is weighted. Ride the pan (E) and it carries you
  back to the lantern. The gate on the axis lifts once both pans are weighted. Does the ride save enough walking, and
  is it clear what to do at the barred gate?
- **The Devil:** you spiral down round the pit. Is the pedestal always there below you? Do the chains read?
- **The Tower:** you climb round the Tower itself, the crown overhead. Falls still drop you into the void (falls
  as routes are held back, as you asked).
- **The Moon:** the way swings side to side toward the Moon. Every true way passes **between two towers**; a false
  path has none (a second tell beside the shadows).
- **Turns everywhere:** walk the bends and landings, hug the parapets, and cut corners.

**Unsure about:**
- **Getting lost:** the Moon's meander and the spirals turn a lot. The landmark should orient you; tell me where it
  didn't.
- **The ride** is a scripted arc (2.6 s), untouchable while you ride. It might feel like a cutscene.
- **Landings** are 9.4 m discs for a 5 m causeway: they may look large.
- **Room sequences** still repeat (the order of fights and vistas is one template per layout). That's next.
- **The player sinking into a floor** (fixed): if you ever stuck fast on a flat floor before, that was it.

## V2-15: fixes from your first full playthrough
All 23 notes are addressed (the list is in `PLAN.md → V2-15`). Two bugs I found on the way were behind several of
them. An enemy could sink through the floor and stand there unable to reach you. A court card's single-lane volley
(the Shadow's "rifle" move) picked its gap before drawing it, so it never fired.

**Try:**
- **Kill things:** they should buckle and topple away from the blow, then sink into the floor, all in one piece.
- **Shield-bearers:** when the swing comes, the shield arm swings wide. That's your window.
- **Walk up to every melee enemy and stand there:** each should swing once in reach, and no swing should land from
  further than its arm and weapon look.
- **Stairs:** run onto them from the side and at angles.
- **The Devil:** walk in. He should already be on his throne and wake as you get close, not before. When he offers
  the pact, the game waits for you.
- **The Tower's stages:** fallen decks grow back after 6 s. Fight the Knight and Queen of Wands on their stages, and
  the Crowned Tower on its top floor. Knock a court card off and it should land back on safe ground, staggered.
- **The animals:** Dogs, Wolves, the cat, the Crayfish (bigger now) and the fish have their own bodies. Watch them
  walk and lunge.
- **The Moon's false paths:** the boardwalk still isn't there, but a hidden way is. Look at the water for the shadows
  of stones and hop across. The cache beyond is real now. If you fall, you're put back well inside the last room.
- **Change scenes** with the SwordRifle out in sword mode. It should still be out, still a sword.
- **Swing at a cat at your feet.**

**Unsure about:**
- **The parry (note 4):** I couldn't reproduce it. My best guess is a mode switch pressed during a swing's recovery
  being swallowed, so the next input landed as a parry. Switches now buffer for 0.6 s. If it happens again, say what
  you'd just done.
- **Stairs (note 5):** I found and fixed a catch on the tier ramps' top edge. If you still catch somewhere, a seed
  and room would help.
- **The stepping stones** wind side to side so you can't walk the drawn boardwalk's line. Are they findable from the
  shadows alone, and is the hop fair, or fiddly?
- **The beasts' gait** has only been seen at headless frame rates. The tuning is in `BeastSpec` in `moon-foes.ts`.
- **Regrowing decks:** 6 s (`tuning.tower.regrowTime`) may make the Tower too forgiving now. The ring re-cracks every
  14 s in the boss fight (`tuning.tower.ringEvery`).
- **Bosses wake at 30 m** (`wakeRadius`). In the Devil's long approach that may still feel sudden.

## V2-14: the Moon's own, the Cups court, the Shadow, and the Sun
The last dimension is complete, and so is the game: the Moon's rooms hold its own enemies, its throne rooms the Cups
court, and at its end **the Shadow** waits on an island under the Moon. Beat it and the blindfold comes off, and
**the Sun** follows (the card and one line), then back to the World.

**Try:**
- **Dog and Wolf:** when one stops and lifts its head (the howl), the other is maddened: faster, quicker. Kill the
  howler mid-howl, or split them up.
- **Crayfish:** walk the shallows. Ripples spread under you: get out of the ring before it surges. Then go round to
  its tail; the front is armoured.
- **Phantoms** are always reflections. Do they teach the tells, or just waste your shots?
- **Page of Cups:** when it raises its cup, stagger it before the fish pour.
- **Knight of Cups:** he sets a cup down near you. **Look before you drink:** moonlight shining out of it heals, a
  dark one poisons.
- **Queen of Cups:** two copies rise and she swaps places with one. Find her by her shadow and her footsteps.
- **King of Cups:** waves come down the room the full width but for one gap; the gap is drawn on the floor first.
  Step into it, or roll through.
- **The Shadow:** your own moves turned on you. It shoots when you're far, cuts when you're close, and rolls when
  you fire. At 60% and 30% the Moon darkens and it splits: find the one with the shadow.

**Unsure about:**
- **Dog and Wolf** are built crouched on the humanoid rig, not the v1 multi-legged rig the plan named. They may read
  as hunched people at range.
- **The cup** is a coin flip each time. The tell is clear up close, but is it worth the walk?
- **The Shadow's roll** fires on any of your shots every 2.2 s. It may feel like it reads your mind; the cooldown is
  `tuning.foes.shadow.dodgeCooldown`.
- **The ending** is deliberately small: one image and one line. Is that enough of a payoff after four dimensions?
- **How many reflections:** Phantoms are reflections on top of the 20/30/40% share, so the smoke seed's third level
  had 8 reflections among 13 enemies. That may tip from "doubt" into "ignore everything". `IllusionDef.share` in
  `dimensions.ts` and the Phantom's place in the rosters are the knobs.

## V2-13: the Moon's marsh (the space and the rule)
After the Tower, the eagle's gate opens on **the Moon**: three level marsh levels of near-identical islands over dark
water, with the Moon low ahead between two towers. (Its own enemies and the Shadow came in V2-14.)

**Also fixed (affects every dimension):** enemies never actually took steps. Their feet were re-planted under them
every frame, so they glided. They walk now, and real ones make soft **footsteps** near you and have a **blob
shadow** under them.

**Try:**
- **Look for the tells:** a reflection has **no shadow** and **makes no sound**. Some enemies in each room are
  reflections, more as you go: 20%, 30%, then 40%.
- **Let a reflection swing at you:** nothing happens. Hit one: it shimmers away and pays nothing. It cost you the time
  and the position.
- **False paths:** one branch per level is a causeway that isn't there. Real causeways cast a shadow on the water; the
  false one doesn't. Walk it and you sink.

**Unsure about:**
- **Is the shadow tell readable?** The blob shadows make it readable at range, but in the pale moon-fog, mid-fight,
  you may not look down. Footsteps help up close.
- **Is a reflection's harmlessness a relief or a cheat?** The design says reflections cost "time and position". If
  they never hurt, players may learn to ignore everything; if they could hurt, they'd break pillar 2. I went
  harmless.
- **The false path** only shows if you look at the water under it. That's fair by the letter of the rule, but it's a
  narrow tell.
- **Near-duplicate rooms** reuse a few earth kits. It's on purpose ("paths that look alike"), but may just read as
  repetition.

## V2-12: the Tower's enemies, court and the Crowned Tower
The Tower is complete: its own enemies feed its rule (fire on the timber), the Wands court fights on burning decks,
and the Crowned Tower's top floor falls away under you. Beating it frees the **safe fall** and brings **the Star**
to the hub.

**Try:**
- **Firebrands** lob fire: step out of the filling ring. Then watch where the fire goes.
- **Fallers** wait unseen above. A magenta shadow grows where you stand: move.
- **Builders** wall you off. Do the barricades make the Firebrands harder to reach, or just clutter?
- **Page of Wands:** when it raises its staff, **stagger it** (or kill it) before the fire lights, or two Firebrands
  come.
- **Knight of Wands:** dodge the charge, then mind the burning lane it leaves.
- **Queen of Wands:** fire zones, and her cat.
- **King of Wands:** Firebrands and a burning floor at each phase.
- **The Crowned Tower:** at two thirds and one third the outer floor pulses and falls. Get inward. Does fighting on a
  last platform under open sky feel like the card?
- **After it falls:** fall off something. You land on your feet, and nearby enemies reel. Then visit the Star at
  her pool (south-west of the spawn).

**Unsure about:**
- **Fire everywhere:** five sources of fire on one floor may be too much. Fire is the rule, but it could become
  noise. The numbers are in `tuning.foes.*.ignite`.
- **The Page's signal** is a 2.6 s channel that a stagger stops for good. Is that clear enough without a hint?
- **The Faller's landing** hits the spot you stood on when it dropped. Standing still is the mistake, which is the
  card's lesson. Its shadow gives 1.3 s.
- **The safe fall** (Proposed) is passive. It's meant as the Tower's gift ("nothing stays standing; you do"), but
  there's no new verb. A plunge attack would be one, but there's no jump to build it on.
- **The Star's menu** is a second hub shop. `CLAUDE.md` allows "the Magician's one upgrade menu", and `DESIGN.md`
  gives the Star heal upgrades, so this stretches that. Fold her items into the Magician's table if you'd rather.

## V2-11: the Tower's climb (the space and the rule)
After the Devil, the lion's gate opens on **the Tower**: three generated levels that climb about 18 m each, fought on
**timber decks** over the drop. Its own enemies, court cards and boss are V2-12. Until then it borrows Bailiffs,
Imps, Misers, Gavels and Pages, and the Swords court.

**Try:**
- **Rotten decks** are darker, sag, and sit in a wider gap. Step on one: it pulses magenta and falls a second later.
  Can you read them before you step?
- **Lightning** marks where you stand (a magenta ring) every 6–14 s. Move, and watch the timber it hits catch
  fire, spread, and fall away.
- **Fire** hurts while you stand in it, and burnt decks fall. Does the floor of a long fight change shape in a way
  that's interesting, or just punishing?
- **Fall in:** it costs 30 and puts you back on the last stone you stood on.
- **Rest** at a lantern: every deck is back.

**Unsure about:**
- **"Standing still is the mistake"** is the card's rule. Lightning that tracks you does push you to move. Is it
  frequent enough to matter, or so frequent it's noise? The numbers are in `tuning.tower.lightning`.
- **The rotten tell** is colour, sag and a wider gap. At pixel scale and in fog it may be too subtle.
- **Burning decks** use the Tower's fire orange, not magenta: fire is a lasting state of the ground, not an attack's
  wind-up. Does that read as "don't stand here"?
- **The climb is the grid, not a spiral** round the tower, like the Devil's descent.
- **Falling to the last stone** can put you back some way behind.

## V2-10: the Pentacles court, the Devil and the dash
The second dimension is complete: three generated levels with their court cards, then the Devil in his pit. Beating
him frees the **dash (X)**. Everything here is a first version that nobody has played yet.

**Try:**
- **Knight of Pentacles** (level 1): its lane is slow but it runs the whole way, and it **pins** you (roll). Shooting
  it won't stagger it. Get round its armoured front, or parry it.
- **Queen of Pentacles** (level 2): she sows **gilt** rings around you. Step on one to crush it, or each becomes an
  Imp. Which one do you go for?
- **King of Pentacles** (level 3): he hires Misers at 66% and 33%. His coin rain leaves coin on the floor: do you
  pick it up mid-fight? It pays, and it makes you heavy.
- **The Devil:** watch for the shackles (a magenta ring closing on you; roll if you're caught). At half health he
  stops and **offers a pact**. Press E to take it, or wait. Does the choice feel like yours, and does the doubled
  fight feel different?
- **The dash (X), after he falls:** fast, short, with no tumble. Dash through a Thrall pair's chain to snap it.

**Unsure about:**
- **Seeds aren't magenta.** Telegraph magenta means "get out", and seeds want you to step *in*, so they're gilt. Do
  they read clearly enough as something to act on?
- **The pact's window** is 6 s and he can't be hurt during it. Is that a pause the fight can afford? Is double damage
  both ways a real temptation, or an obvious refuse?
- **Unstoppable** (the Knight of Pentacles) means shots never stagger it. It may feel like a damage sponge. A parry
  still works.
- **The dash vs the roll:** the dash is the better escape, but it has a cooldown and the roll doesn't. Will the roll
  still get used? The Devil's unbinding itself is Proposed (`DESIGN.md`).
- **The Devil's look:** the wings and horns read at 6.5 m, but the raised hand is small.

## V2-9: the Devil's rule and enemies
The Devil's levels now have **his own enemies and his rule**. Two halves of *temptation*: chains that look fatal
but always break, and wealth in plain sight that costs something to take. The court cards are still Swords
placeholders (V2-10).

**Try:**
- **Thralls:**
  - Let a pair wind up: the chain between them glows magenta, and they run to either side of you.
  - Get caught and do nothing: the coil tightens and a heavy blow lands after 1.5 s.
  - Get caught and press Space: one roll always breaks it, even with no stamina.
  - Roll *through* the haul: the i-frames slip it.
- **Shoot the chain** between a pair (aim for its middle): both are freed. The nearer one comes at you faster, and
  the other runs into the fog.
- **The Miser:** flank it (the coin bag on its back glows cyan) or bait its club.
- **The Imps:** they rake and fall back. Are they readable, or just noise?
- **The Page of Pentacles** (level 2 onward) runs from you. Is chasing it a good kind of greed, or a chore?
- **Hoards:** read the tell before you take one.
  - **bell:** a bell over the heap; taking it wakes the room.
  - **chains:** the hoard is heavy; your rolls fall short until you rest (the purse shows "⛓ heavy").
  - **broken floor:** Imps climb out.
  - **Risk branches:** they hold a double hoard with Imps under it.
  - Do you find yourself weighing whether to take one? That's the whole rule.

**Unsure about:**
- **Is 1.5 s too generous?** The binding is meant to look fatal but teach "you could always walk away". If rolling
  out is too easy it won't feel like temptation; if the coil reads as a stun, it will feel unfair. Its numbers are
  `tuning.foes.thrall.attacks.bind`.
- **The pair's run to your flanks** is at 1.6× their run speed, so they can arrive within the wind-up. It may look
  like a slide. The aim locks for the last fifth.
- **The weight** stacks to three (rolls ×0.55, walk ×0.73 at most). Is resting the right way to shed it? The plan
  said "rest or spend", but spending only happens in the hub.
- **The fleeing Thrall gives nothing** when it runs off. That's on purpose (it walked away), but players may feel
  robbed.
- **Draw calls** in level 3 reach about 114 with Thrall pairs (the chain is one instanced draw per pair).

## V2-8: the Devil's descent (in progress: the space only)
You asked me to plan the other dimensions and start on them before the slice has been played. The plan is in
`PLAN.md`, V2-8 to V2-14. This first step builds **the Devil's levels as space**: they generate, they descend, and you
can walk them. The Devil's own enemies, rule, court cards and arena are V2-9 and V2-10.

**Try:**
- From the hub, after clearing Justice (or use `?mode=level&dim=devil&level=1..3` to jump straight in), go through
  **the bull's gate**.
- Walk a level from the spawn to the exit:
  - Each room on the main path is a step lower than the last.
  - Does it feel like going *down*, toward the glowing pedestal, or just like Justice in brown?
- Find the shortcut: it still runs flat back to the mid lantern.
- Look at the set-pieces: the gold vault (strewn hoards as cover), the gilded market, the chain shaft (a 4 m drop
  with a view) and the collapsing mine (a long gallery). `O` shows the overview and `V` jumps between vistas.
- After level 3 the way on leads home. The bull's gate then says the road is walked as far as it's built.

**Unsure about:**
- **3 m per step** (about 18 m per level) may still be too timid to read as a descent. Stairs between rooms carry it, but nothing yet is
  overhead (the planned low ceilings and beams), so it still reads as open air. Ceilings would hide the landmark, so
  they need the vista rules to stay intact.
- **The pedestal is mostly its flame at range.** The column is pale in the fog and the unfogged brazier carries it.
  That keeps "light leads" but loses the card's silhouette, and the column may need to be darker or nearer.
- **The layout is a grid, not a spiral.** `LEVELS.md` proposed a descending spiral. The grid kept the shortcut solve
  and validation unchanged; a spiral is a later step if the grid doesn't feel like going down.
- **The palette:** the documented smoky amber fog was too dark for the telegraph-contrast rule, and the ember accent
  sat too close to kill red. The fog is now pale smoky amber and the accent is old gilt (`STYLE.md`). The gilt
  hoards are the temptation motif, which suits the rule.
- **Placeholders** (V2-9 has since replaced the enemies and added the rule):
  - Justice's Bailiffs, Gavels, Blindfolds and Pages, plus the Swords court cards, hold the Devil's rooms. The level
    3 King gives up the relic of *Pentacles* although he's dressed as Swords.
  - Hoards are only cover: the temptation rule that makes them cost something is V2-9.

## The slice, complete: does it answer the question?
> **Does one tarot dimension's meaning come across through how it plays? Does the SwordRifle's two-mode loop earn
> its place next to the auto-pistol? Do generated levels feel designed?**

Everything the slice needs now exists in a first version: the hub, Justice's three generated levels with her
enemies and court cards, Justice herself, the parry, the shop and the save. None of it has been played by a person
yet, so here is what to judge, not a verdict.

**Play the whole loop once:** **New game** → the hub → the angel's gate → levels 1, 2, 3 → Justice → home.

1. **Does Justice read as Justice?** The rule is *answer in kind*. Look for it in the shields that turn blows from the
   front, the mirrored combos (Blindfold, Knight, Justice), the mirrored volleys (Queen) and verdicts (King), the
   echoes across Justice's arena, and finally the parry she frees. Does the dimension feel like being weighed, or
   like a generic fantasy road with scales on the horizon?
2. **SwordRifle vs pistol.** The pistol is reliable; the SwordRifle trades charges between blade and bolt, and now
   the parry feeds it too. Do you reach for it because the loop is fun, or only against shields?
3. **Generated levels.** Same axis, one loop to the side, a set-piece each. Across three levels and a few seeds, do
   they feel designed, or samey? (N rolls a new seed; B jumps between vistas; M shows the map.)
4. **Difficulty and length** are unknown: every number is a first guess in the tuning panel.

## V2-7: the hub, the shop, the save and the parry
**Run:** **New game** (or **Play/Continue**). `?mode=hub` jumps straight in.

**Try:**
1. **The High Priestess** (left of the lantern): E, several times. Her lines change once you've walked the road, and
   again once Justice falls.
2. **The Magician** (right): E opens his table. Pentacles from kills and caches buy upgrades. *Mend the edge* needs the
   relic of Swords: kill the King of Swords for it.
3. **The angel's gate** (ahead) takes you into Justice at the next level on your road (progress saves at each exit).
4. **After Justice:** you come home with the **parry (V)**. Meet a blow as it lands (watch the magenta wind-up); the
   attacker staggers and the SwordRifle drinks a charge. A whiff leaves you open. The bull's gate is now awake (its
   road isn't built).
5. **Quit and come back:** Continue resumes the save.

**Unsure about:**
- **The parry window (0.2 s)** is a guess, and in headless tests only a wider window could be timed. It may be too
  tight at real frame rates, or too generous.
- **Prices** (200–400) against rewards (6–16 per common, 120–600 per court card or arcana, 30 per cache): roughly one
  item per level. Is it worth farming?
- **The pistol upgrades** are plain numbers. Are they interesting enough to want?
- **No fog wall:** the hub is outside the dimensions, so I gave it no landmark. Is it too plain next to the levels?

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

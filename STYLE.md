# STYLE.md: the look of *Eight* (v2)

The v1 style study (White Lavender, the warm lamp-lit stage, bug-scale props) is in `archive/v1/STYLE.md`.
v2 keeps v1's *technique* (no textures, vertex colours, toon ramp, reserved signal colours) and changes its *look*.

Three references, and what each one gives us. We take the *spirit* and copy no shapes, characters or layouts.
- **Brume** (Sokpop, 2019): a souls-like set on a foggy island, rendered in low-res 3D.
- **Grey Scout** (Sokpop, 2020): a stealth game on a rainy island.
- **Remnant 2** (Gunfire Games, 2023): scale and atmospheric perspective. It is rendered in a style far richer than
  ours, so we take its *composition*, not its surfaces.

## What makes the references work

Notes from studying the store screenshots, plus a Remnant 2 screenshot the user shared:

1. **Fog runs toward light.** Distance dissolves into a pale sky colour (atmospheric perspective). This is the
   **opposite of v1**, where fog ran toward dark. Depth reads as layers of silhouettes that lighten with distance.
2. **Values step from near to far.** Remnant puts near-black rock walls in the foreground, grey-teal cliffs in the
   middle and a bright fog opening at the back. Brume frames shots with dark trunks and arches against pale distance.
   Dark near, light far: the eye goes to the light.
3. **A framed landmark.** Converging walls, an overhead arch and hanging chains all point at one big thing (a statue
   on a pedestal, a keep, a giant figure). The bright opening behind it is where you're going.
4. **Scale through contrast.** A giant sword planted in the ground (Grey Scout), a towering cloaked figure (Brume),
   stacked ruins rising out of sight (Remnant). The player is small *in the world*, not small *as a bug*.
5. **A very limited palette per area.** It's desaturated and close in value: greys, mauves, lavenders, sage and
   teal-grey. Brume gives each area its own 4–5 colour palette (snow white, pale teal, dusty pink, olive, deep violet).
6. **One accent motif.** Remnant threads crimson growth through a teal-grey scene. Grey Scout's warm lanterns are the
   only saturated warmth in a cool world. One accent per area, used sparingly, means something.
7. **Warm light marks the way.** A lantern, a brazier, a fire at the goal. Light is navigation.
8. **Blocky, faceted forms, not rounded.** Grey Scout's grass is a field of upright boxes, and its rocks are low-poly
   lumps. Brume's trees are a slab trunk with a blob canopy. Hard edges, few faces and no cute roundness.
9. **Small, stocky, readable figures.** A hooded or helmeted head, a box or capsule body and stick limbs. The face is
   a dark hole or a single dot. Figures are read by their gear silhouette (sword, spear, shield, lantern).
10. **Painterly sky, posterised ground and low resolution.** Grey Scout has smeared, banded clouds and a diagonal rain
    hatch over the whole frame. Brume renders at low resolution with crisp pixels. We have pixel mode; a painterly
    or hatch pass is still to find (see *Shading and post*).

## v2 rules

### Tone: not cute (Decided)
- Proportions are about **3 heads tall** (stocky but not chibi), with angular silhouettes, flat-shaded facets and hard
  edges.
- No squash-and-stretch bounciness on characters. Weight comes from the procedural rig (lean, plant, recoil), not
  from cartoon deformation.
- Muted palettes and dark themes. Humour, if any, is dry.

### Scale (Decided: humanoid)
Units change in v2: **1 world unit = 1 metre**, and the player is about 1.6 m tall. The rescale is a `PLAN.md`
milestone; until it lands, the code still uses v1's beetle units.

| Thing | Size | Notes |
|---|---|---|
| Player | 1.6 m | stocky: ~0.55 m wide at the shoulders |
| Half cover | 0.8–1.0 m | waist height: crouch-free cover you shoot over |
| Full cover | ≥ 2.0 m | blocks the player and line of sight |
| Path width | 3–6 m | enough to roll sideways out of a lane |
| Combat clearing | 18–40 m across | see `LEVELS.md → Combat spaces` |
| Doorway / arch | 2.5–4 m tall | arches frame vistas, so err tall |
| Hero props | 8–30 m | planted swords, statues, chained pillars |
| Landmark | 60–450 m | the dimension's symbol, visible through fog; generated levels stand Justice's 175 m scales ≥ 360 m from the spawn, so the beam rides above the height fog |

### Atmospheric perspective (the core look)
- **Fog colour = the horizon/sky colour of the area**, and it is light. The play space stays clear and the distance
  walls off quickly. On flat ground (the user's tuning: density 0.0075, power 1.4) it's ~17% at 40 m, ~58% at 120 m and
  ~91% at 250 m. Height mix 1 thins it for anything tall, so a landmark's upper parts read at ~70–85% fog: a
  silhouette, never a detailed one.
- **Three value planes per shot:**
  - **foreground frame**: darkest, near the camera (walls, trunks, arches)
  - **play space**: mid values, where the toon bands live
  - **distance**: pale, low contrast, silhouettes only
- **Height fog** (denser low, thinner high) makes valleys mysterious and peaks clear. It's a cheap shader tweak, so
  the decision is (Proposed) to add it in the rescale milestone.
- **Sky** is a vertical gradient with painterly, posterised cloud bands generated in code. Never a texture.

### Palettes (Proposed, first pass; screenshots decide)
Each area has 4–5 surface colours, one fog/sky colour and **one accent motif**. Values are first guesses to test
against screenshots, the same way v1's palettes were.

| Area | Surfaces | Fog / sky | Accent motif |
|---|---|---|---|
| **Hub** (The World) | twilight lavender `#8C86A3`, wreath sage `#7E9078`, stone `#C9C2B8`, shadow `#3E3A4D` | pale lilac `#D9D3E0` | warm lantern amber `#F0B266` |

*As built in V2-7 (`WORLD` in `src/render/palette.ts`):* warm stone `#E7E0D2` / `#B4A996` / `#6A6157`, laurel `#7F9466`,
a pale warm fog `#ECE6E2` under a lilac sky `#BDB7CF`. The accent motif is the wreath's ribbons in deep blue `#4F6B92`:
the first pick (a dusty violet) failed the palette test against the SwordRifle's charge violet.
| **Justice** (Swords, air) | chalk `#E4E1D8`, pale steel `#9FB0BC`, slate `#5C6873`, shadow `#2F3640` | cold white-blue `#E3E9EE` | tarnished brass `#B39A5E` (the scales) |
| **The Devil** (Pentacles, earth) | umber `#5A4636`, ochre `#A3824F`, oxide green `#5F7A64`, shadow `#231C18` | smoky amber haze `#B59A7A` | ember `#C0573A` (the pedestal glow) |
| **The Tower** (Wands, fire) | ash `#9A9490`, charcoal `#3B3836`, scorched wood `#6B5244`, shadow `#1E1B1C` | storm grey-violet `#8E8A9C` | fire orange `#E07A3A` |
| **The Moon** (Cups, water) | indigo `#3E4466`, marsh teal `#4F7470`, reed `#8D9A7A`, shadow `#1B1E2E` | moon-fog `#C9CEC8` | pale moonlight `#E9E4C4` |

*As built in V2-8 (`DEVIL` in `src/render/palette.ts`, Proposed until played):* dusty sandstone flags `#CDB99A`, umber
stone `#8F7660`, umber rock `#5A4636`, shadow `#231C18` and dusty spoil `#857559` on the mine floors. Three changes from the table
above:
- **Fog:** the smoky amber haze `#B59A7A` failed the telegraph-contrast test (magenta needs a pale or a very dark fog),
  so the fog is a pale smoky amber `#F0E2CB` under a dusty sky `#C9AB8A`.
- **Accent:** the ember `#C0573A` sits about 11° of hue from kill red at a similar brightness, so the accent is
  **old gilt** `#9B7232` (the hoards and the pedestal's band), dark enough never to read as crit gold. The pedestal's
  brazier burns in the lantern's warm amber instead, the light that leads down. Its flame is a glow, so it opts out of
  the fog and reads as a warm point from every vista.
- **Growth:** the oxide green `#5F7A64` read as lawn on the mine floors, so the earth there is dusty spoil.

The palette test now checks every accent against kill red as well as crit gold.

Rules:
- **Accent colours must stay clear of the signal colours** (below) in hue and saturation. The Tower's fire orange and
  the Devil's gilt get the `tests/palette.test.ts` checks against telegraph magenta, crit gold and kill red.
- Accents are used on **one motif** per area (the scales, the Devil's gilt, fire, moonlight). Never on general props.

### Characters (Proposed)
- **The Eight of Swords:**
  - **Rust-red robe** `#923A33`: the card's red, desaturated and dark enough (≥ 2:1 contrast) that it never reads
    as kill-red `#FF3B30`. V2-1's palette test darkened it from the first pick, `#9E3B32`.
  - **Off-white blindfold** `#E8E0D0`, pushed up, with **cloth tails** that trail behind her as cheap secondary motion
    (a procedural verlet ribbon).
  - **Dark stick limbs** `#1E1A1C`.

  She is the warmest mid-value shape in any cool scene and the darkest shape in any pale one. That's v1's "one bright
  shape, one dark shape" rule, carried over.
- **Arcana** (bosses and hub NPCs) are **large**: 1.5–4× the player's height. Their silhouettes are built from their
  card's iconography (Justice's sword and scales, the Magician's raised wand, the Star's two jugs). Scale contrast
  is how they read as more than human.
- **Court cards** wear their suit symbol as a large, simple silhouette element (a sword crest, a pentacle shield, a
  wand torch, a cup helm), so the suit reads before the face.
- **Common enemies** are stocky like the player but darker and more hunched. Each archetype has a distinct silhouette
  at 30 m.
  - *As built (V2-4, `FOES` in `src/render/palette.ts`):* the Bailiff is slate armour behind a dark tower shield with a
    pale sword crest; the Gavel is a 2.15 m stooped mass with a hammer; the Blindfold is a slate-blue robe with a pale
    band across the eyes and two long blades; the Page is small, blue, with a cape snapped back. Bodies are ≥ 4:1
    against the Justice fog; pale cloth is cool chalk-grey, so it never reads as crit gold or weak-spot cyan (tested).
  - *Court cards (V2-5, `COURT`):* 2.05–2.4 m, each crowned or crested with a large pale sword: the Knight in steel-blue
    with a long cape, the Queen in a floor-length slate gown with a pale veil, the King broad in a dark robe and
    squared mantle with a greatsword. Crowns are steel, never brass (brass belongs to the scales).
  - Ground telegraphs (lanes, rings, verdicts) sit 12 cm up so paving never hides them.
  - *The Devil's commons (V2-9, `DEVIL_FOES`):* soot, rust-brown and dark olive, ≥ 4:1 against the Devil's pale amber
    fog. Their coin and brass are dull and dark, never the area's gilt (tested).
    - **Miser:** broad, in a fur collar, hugging a banded strongbox heaped with dull coin, with a coin bag on its
      back (the weak spot, in cyan).
    - **Imp:** 1.15 m, soot-red, with horns and a curled tail, crouched low with claws out.
    - **Page of Pentacles:** small, in dark olive, holding a purse up like the card's pentacle.
    - **Thralls:** pale-grey, ragged and horned like the card's figures, collared in iron, the chain slung
      collar to collar between a pair.
  - *The binding's telegraph:* the chain between a pair **glows magenta** through the wind-up. Caught, a magenta
    coil circles her and tightens until the blow lands or she rolls.
  - *Hoard tells (the temptation must be learnable):* each hoard is a gilt heap with a faint gilt glow and one tell.
    - **bell:** a bell hangs on a crooked post over the heap.
    - **weight:** chains are looped over it and staked into the floor.
    - **ambush:** a broken ring of tilted floor slabs surrounds it.
  - *Hub arcana (V2-7):* the Magician (≈ 3.2 m, brown robe, wand raised behind his table of four tools) and the High
    Priestess (seated, deep blue, between a dark and a pale pillar before a veil). The four gate creatures are pale
    and upright when awake, dark and slumped asleep.
  - *Justice (V2-6):* 6 m, slate gown, pale mantle and stole, steel crown with three square points, a greatsword
    raised upright, and small brass scales in her left hand. The brass on her scales and on the arena's descending
    pans is the accent motif: the scales are the motif, wherever they appear.

### Shading and post
- Toon-ramp Lambert, generated 4-step gradient, vertex colours. No textures, specular, PBR or normal maps.
- **Stripes become facets.** v1's wobbly organic stripes give way to flat-shaded facets and per-face value jitter,
  which reads as blocky rather than soft.
- **Pixel mode** (`tuning.pixel`, `src/render/pixel.ts`) is the Brume look and the only post step. It's on by
  default (P toggles it): `scale` 2, a light outline (`outline` 0.3, `edgeThreshold` 0.3, `edgeWidth` 1 block), from
  the user's tuning.
- **Outlines fade with distance** (`pixel.outlineFadeStart` → `outlineFadeEnd`, 30 → 140 m). Ink lines belong to the
  play space. Outlining fogged hills turned the distance into shards, against the "silhouettes only" value plane.
- **No painterly pass for now (Decided).** v1's Kuwahara/posterise pass didn't suit v2 and was removed. Other post
  techniques get explored later (`PLAN.md → Later`).
- A **rain/hatch overlay** (Grey Scout's diagonal streaks) is a cheap screen-space option for the Moon dimension.

### Reserved signal colours (unchanged from v1, must pop in **every** area palette)
| Signal | Hex | Use |
|---|---|---|
| **Enemy telegraph** | `#FF2E9A` hot magenta, pulsing to white | wind-ups, ground markers, charge lanes, falling-shadow markers |
| **Weak spot** | `#7CFFEA` cyan | weak points |
| **Crit / currency pickup** | `#FFE14D` gold | crit markers, pentacle pickups |
| **Kill / damage taken** | `#FF3B30` red | kill marker, HP bar |
| **SwordRifle charge** (Proposed hue) | `#9C7BFF` electric violet | charge cells on the weapon, the HUD charge pips. The player's own resource, so it must never be confused with an enemy telegraph; the hue sits ~75° from telegraph magenta. |
| **UI / interact** | `#FFFFFF` | UI, muzzle flash, interaction rings |

Never use signal colours on props, characters or accent motifs. `tests/palette.test.ts` checks every area palette
against them, and v2 palettes join that test as they're added.

### Silhouette rules (v2)
1. Every character is identifiable **by silhouette alone at 30 m**, against both a dark frame and pale fog.
2. Characters are **2–4 primitives for the body and stick limbs**. Gear (weapon, shield, suit symbol) makes the
   silhouette.
3. Props are **faceted primitives** (boxes, low-segment cylinders, low-poly lumps) with a darker base where they
   meet the ground.
4. Nothing smaller than ~4 px on screen at play distance unless it's an effect. Pixel mode makes this rule stricter.
5. **Telegraph poses are exaggerated**: wind-up, rear back, weapon raised high, magenta glow.

## Screenshot checklist (each v2 milestone)
- [ ] Three value planes are visible: a dark frame, a mid play space, pale distance.
- [ ] Fog runs toward the area's light sky colour, and the landmark reads as a silhouette.
- [ ] The landmark is visible from the spawn view and from at least one vista.
- [ ] One accent motif per area, and nowhere else.
- [ ] The player reads instantly: the warmest mid-value shape in a cool scene, the darkest shape in a pale one.
- [ ] Signal colours appear only on signals and stand out against every surface and the fog.
- [ ] Shapes are blocky and faceted; nothing reads as cute.
- [ ] The draw-call budget holds (see `LEVELS.md → Budgets`).
